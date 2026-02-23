from __future__ import annotations

import base64
import re
import secrets
from dataclasses import dataclass
from urllib.parse import unquote

from django.conf import settings
from django.core.cache import cache
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from django.utils import timezone

from accesos.models import RefreshSession, Sede, SedePolicy


SIGNED_PREFIX = "SADI1:"
SIGNED_B64_PREFIX = "SADI1B64:"
SIGNED_DOC_SALT = "sadi.aprendiz.qr.doc"
SIGNED_DOC_MAX_AGE_SECONDS = int(getattr(settings, "APRENDIZ_QR_TTL_SECONDS", 120) or 120)
QR_NONCE_CACHE_PREFIX = "sadi:qr:nonce:"
DOCUMENT_6_TO_10_RE = re.compile(r"^\d{6,10}$")


class QRParseError(ValueError):
    """Raised when a scan payload does not match configured QR policy."""

    def __init__(self, message: str, *, code: str = "invalid"):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class QRPayload:
    documento: str
    mode_used: str
    session_id: str | None = None


class QRService:
    """
    Parse and generate QR payloads according to sede policy.

    Modes:
    - PLAIN: accepts numeric documento
    - SIGNED: accepts only signed token (SADI1/SADI1B64)
    - DUAL: accepts both
    """

    @classmethod
    def _normalize_documento(cls, value: str) -> str:
        clean = str(value or "").strip()
        if not DOCUMENT_6_TO_10_RE.fullmatch(clean):
            raise QRParseError("El documento debe tener entre 6 y 10 digitos.", code="invalid_document")
        return clean

    @classmethod
    def _effective_mode(cls, sede: Sede | None, qr_mode: str | None = None) -> str:
        if qr_mode:
            return str(qr_mode).strip().upper()
        if not sede:
            return SedePolicy.QrMode.DUAL
        policy = SedePolicy.objects.filter(sede=sede).only("qr_mode").first()
        if not policy or not policy.qr_mode:
            return SedePolicy.QrMode.DUAL
        return policy.qr_mode

    @classmethod
    def sign_document(
        cls,
        documento: str,
        *,
        session_id: str | None = None,
        user_id: int | None = None,
    ) -> str:
        normalized = cls._normalize_documento(documento)
        if not session_id:
            raise QRParseError("No hay una sesion valida para generar QR firmado.", code="missing_session")
        now_ts = int(timezone.now().timestamp())
        payload = {
            "doc": normalized,
            "sid": str(session_id),
            "uid": int(user_id) if user_id is not None else None,
            "nonce": secrets.token_urlsafe(10),
            "iat": now_ts,
            "exp": now_ts + SIGNED_DOC_MAX_AGE_SECONDS,
        }
        signed = signing.dumps(payload, salt=SIGNED_DOC_SALT, compress=True)
        signed_b64 = base64.urlsafe_b64encode(signed.encode("utf-8")).decode("ascii").rstrip("=")
        return f"{SIGNED_B64_PREFIX}{signed_b64}"

    @classmethod
    def _assert_active_session(cls, *, session_id: str, documento: str, user_id: int | None = None):
        now = timezone.now()
        qs = RefreshSession.objects.filter(
            id=session_id,
            user__documento=documento,
            revoked_at__isnull=True,
            expires_at__gt=now,
        )
        if user_id is not None:
            qs = qs.filter(user_id=int(user_id))
        exists = qs.exists()
        if not exists:
            raise QRParseError("QR invalido o sesion vencida.", code="invalid_session")

    @classmethod
    def _protect_against_replay(cls, *, session_id: str, nonce: str):
        key = f"{QR_NONCE_CACHE_PREFIX}{session_id}:{nonce}"
        # Atomic add avoids race conditions between parallel scanners/workers.
        if not cache.add(key, "1", timeout=SIGNED_DOC_MAX_AGE_SECONDS):
            raise QRParseError("QR reutilizado. Genera uno nuevo.", code="replay")

    @classmethod
    def _parse_signed_payload(cls, raw_token: str) -> tuple[str, str]:
        token = str(raw_token or "").strip()
        try:
            payload = signing.loads(
                token,
                salt=SIGNED_DOC_SALT,
                max_age=SIGNED_DOC_MAX_AGE_SECONDS,
            )
        except SignatureExpired as exc:
            raise QRParseError("QR expirado. Genera uno nuevo.", code="expired") from exc
        except (BadSignature, ValueError) as exc:
            raise QRParseError("QR firmado invalido.", code="invalid_signed") from exc

        if not isinstance(payload, dict):
            raise QRParseError("QR firmado invalido.", code="invalid_signed")
        documento = cls._normalize_documento(payload.get("doc"))
        sid = str(payload.get("sid") or "").strip()
        uid_raw = payload.get("uid")
        nonce = str(payload.get("nonce") or "").strip()
        exp = payload.get("exp")
        try:
            uid = int(uid_raw) if uid_raw is not None else None
        except Exception:
            uid = None
        if not sid or not nonce or exp is None:
            raise QRParseError("QR firmado invalido.", code="invalid_signed")
        try:
            exp_ts = int(exp)
        except Exception as exc:
            raise QRParseError("QR firmado invalido.", code="invalid_signed") from exc
        if int(timezone.now().timestamp()) > exp_ts:
            raise QRParseError("QR expirado. Genera uno nuevo.", code="expired")

        cls._assert_active_session(session_id=sid, documento=documento, user_id=uid)
        cls._protect_against_replay(session_id=sid, nonce=nonce)
        return documento, sid

    @classmethod
    def _try_parse_signed(cls, raw: str) -> tuple[str, str] | None:
        candidate = str(raw or "").strip()
        upper = candidate.upper()
        if upper.startswith(SIGNED_B64_PREFIX):
            token = candidate.split(":", 1)[1]
            token = re.sub(r"\s+", "", token)
            try:
                padding = "=" * (-len(token) % 4)
                signed_payload = base64.urlsafe_b64decode((token + padding).encode("ascii")).decode("utf-8")
            except Exception as exc:
                raise QRParseError("QR firmado invalido.", code="invalid_signed") from exc
            return cls._parse_signed_payload(signed_payload)

        if upper.startswith(SIGNED_PREFIX):
            token = candidate.split(":", 1)[1]
            token = re.sub(r"\s+", "", token)
            return cls._parse_signed_payload(token)
        return None

    @classmethod
    def _try_parse_plain(cls, raw: str) -> str:
        clean = unquote(str(raw or "").strip())
        digits = re.sub(r"[^\d]", "", clean)
        return cls._normalize_documento(digits)

    @classmethod
    def parse_document(cls, raw: str, *, sede: Sede | None = None, qr_mode: str | None = None) -> QRPayload:
        mode = cls._effective_mode(sede=sede, qr_mode=qr_mode)
        upper_mode = str(mode or SedePolicy.QrMode.DUAL).strip().upper()

        if upper_mode == SedePolicy.QrMode.SIGNED:
            parsed = cls._try_parse_signed(raw)
            doc = parsed[0] if parsed else None
            if not doc:
                raise QRParseError("Esta sede requiere QR firmado.", code="mode_violation")
            return QRPayload(documento=doc, mode_used=SedePolicy.QrMode.SIGNED, session_id=parsed[1] if parsed else None)

        if upper_mode == SedePolicy.QrMode.PLAIN:
            doc = cls._try_parse_plain(raw)
            return QRPayload(documento=doc, mode_used=SedePolicy.QrMode.PLAIN)

        # DUAL
        signed_parsed = cls._try_parse_signed(raw)
        if signed_parsed:
            return QRPayload(
                documento=signed_parsed[0],
                mode_used=SedePolicy.QrMode.SIGNED,
                session_id=signed_parsed[1],
            )
        plain_doc = cls._try_parse_plain(raw)
        return QRPayload(documento=plain_doc, mode_used=SedePolicy.QrMode.PLAIN)

    @classmethod
    def build_aprendiz_qr_value(
        cls,
        documento: str,
        *,
        sede: Sede | None = None,
        qr_mode: str | None = None,
        session_id: str | None = None,
        user_id: int | None = None,
    ) -> tuple[str, str]:
        normalized = cls._normalize_documento(documento)
        mode = cls._effective_mode(sede=sede, qr_mode=qr_mode)
        upper_mode = str(mode or SedePolicy.QrMode.DUAL).strip().upper()

        # Security hardening:
        # My QR generation is always signed and session-bound, even when sede
        # scanner policy still accepts plain (DUAL/PLAIN) for physical badges.
        signed = cls.sign_document(
            normalized,
            session_id=session_id,
            user_id=user_id,
        )
        if upper_mode == SedePolicy.QrMode.SIGNED:
            return signed, SedePolicy.QrMode.SIGNED
        if upper_mode == SedePolicy.QrMode.PLAIN:
            return signed, SedePolicy.QrMode.SIGNED
        return signed, SedePolicy.QrMode.DUAL
