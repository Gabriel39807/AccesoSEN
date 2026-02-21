from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from urllib.parse import unquote

from django.core import signing
from django.core.signing import BadSignature, SignatureExpired

from accesos.models import Sede, SedePolicy


SIGNED_PREFIX = "SADI1:"
SIGNED_B64_PREFIX = "SADI1B64:"
SIGNED_DOC_SALT = "sadi.aprendiz.qr.doc"
SIGNED_DOC_MAX_AGE_SECONDS = 60 * 60 * 24 * 365  # 1 year
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
    def sign_document(cls, documento: str) -> str:
        normalized = cls._normalize_documento(documento)
        signed = signing.TimestampSigner(salt=SIGNED_DOC_SALT).sign(normalized)
        signed_b64 = base64.urlsafe_b64encode(signed.encode("utf-8")).decode("ascii").rstrip("=")
        return f"{SIGNED_B64_PREFIX}{signed_b64}"

    @classmethod
    def _try_parse_signed(cls, raw: str) -> str | None:
        candidate = str(raw or "").strip()
        upper = candidate.upper()
        if upper.startswith(SIGNED_B64_PREFIX):
            token = candidate.split(":", 1)[1]
            token = re.sub(r"\s+", "", token)
            try:
                padding = "=" * (-len(token) % 4)
                signed_doc = base64.urlsafe_b64decode((token + padding).encode("ascii")).decode("utf-8")
                doc = signing.TimestampSigner(salt=SIGNED_DOC_SALT).unsign(
                    signed_doc,
                    max_age=SIGNED_DOC_MAX_AGE_SECONDS,
                )
                return cls._normalize_documento(doc)
            except SignatureExpired as exc:
                raise QRParseError("QR expirado. Genera uno nuevo.", code="expired") from exc
            except (BadSignature, ValueError) as exc:
                raise QRParseError("QR firmado invalido.", code="invalid_signed") from exc

        if upper.startswith(SIGNED_PREFIX):
            token = candidate.split(":", 1)[1]
            token = re.sub(r"\s+", "", token)
            try:
                doc = signing.TimestampSigner(salt=SIGNED_DOC_SALT).unsign(
                    token,
                    max_age=SIGNED_DOC_MAX_AGE_SECONDS,
                )
                return cls._normalize_documento(doc)
            except SignatureExpired as exc:
                raise QRParseError("QR expirado. Genera uno nuevo.", code="expired") from exc
            except (BadSignature, ValueError) as exc:
                raise QRParseError("QR firmado invalido.", code="invalid_signed") from exc
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
            doc = cls._try_parse_signed(raw)
            if not doc:
                raise QRParseError("Esta sede requiere QR firmado.", code="mode_violation")
            return QRPayload(documento=doc, mode_used=SedePolicy.QrMode.SIGNED)

        if upper_mode == SedePolicy.QrMode.PLAIN:
            doc = cls._try_parse_plain(raw)
            return QRPayload(documento=doc, mode_used=SedePolicy.QrMode.PLAIN)

        # DUAL
        signed_doc = cls._try_parse_signed(raw)
        if signed_doc:
            return QRPayload(documento=signed_doc, mode_used=SedePolicy.QrMode.SIGNED)
        plain_doc = cls._try_parse_plain(raw)
        return QRPayload(documento=plain_doc, mode_used=SedePolicy.QrMode.PLAIN)

    @classmethod
    def build_aprendiz_qr_value(
        cls,
        documento: str,
        *,
        sede: Sede | None = None,
        qr_mode: str | None = None,
    ) -> tuple[str, str]:
        normalized = cls._normalize_documento(documento)
        mode = cls._effective_mode(sede=sede, qr_mode=qr_mode)
        upper_mode = str(mode or SedePolicy.QrMode.DUAL).strip().upper()

        if upper_mode == SedePolicy.QrMode.SIGNED:
            return cls.sign_document(normalized), SedePolicy.QrMode.SIGNED
        if upper_mode == SedePolicy.QrMode.PLAIN:
            return normalized, SedePolicy.QrMode.PLAIN
        # DUAL -> generate signed by default for better anti-forgery while
        # scanner still accepts plain compatibility.
        return cls.sign_document(normalized), SedePolicy.QrMode.DUAL
