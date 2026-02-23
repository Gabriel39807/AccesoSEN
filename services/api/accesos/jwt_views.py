from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .api_responses import error_response, ok_response
from .domain.services.authorization import AuthorizationService
from .domain.services.email_domain_service import EmailDomainService
from .error_codes import ErrorCode
from .models import RefreshSession, Usuario
from .rate_limit import bump_with_lock, get_client_ip, get_lock_remaining, reset_counter

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SEC = 15 * 60
LOGIN_LOCK_SEC = 15 * 60

REPEATED_LOCKOUT_THRESHOLD = 3
REPEATED_LOCKOUT_WINDOW = timedelta(hours=24)

REFRESH_MAX_ATTEMPTS_DEVICE = 12
REFRESH_MAX_ATTEMPTS_IP = 24
REFRESH_WINDOW_SEC = 10 * 60
REFRESH_LOCK_SEC = 15 * 60

DEVICE_ID_MAX_LEN = 128
DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
logger = logging.getLogger(__name__)


def _refresh_token_lifetime() -> timedelta:
    conf = getattr(settings, "SIMPLE_JWT", {})
    value = conf.get("REFRESH_TOKEN_LIFETIME")
    if isinstance(value, timedelta):
        return value
    return timedelta(days=14)


def _guard_single_active_session() -> bool:
    return bool(getattr(settings, "GUARDA_SINGLE_ACTIVE_SESSION", True))


def _refresh_pepper() -> str:
    return str(getattr(settings, "REFRESH_TOKEN_PEPPER", "") or settings.SECRET_KEY)


def _hash_refresh_token(token: str) -> str:
    payload = f"{_refresh_pepper()}:{token}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def _build_access_token(user: Usuario, sid) -> str:
    access = AccessToken.for_user(user)
    access["rol"] = AuthorizationService.default_role_for_user(user)
    access["sid"] = str(sid)
    return str(access)


def _normalize_device_id(raw: str | None) -> str | None:
    value = str(raw or "").strip()
    if not value:
        return None
    if len(value) > DEVICE_ID_MAX_LEN:
        return None
    if not DEVICE_ID_RE.fullmatch(value):
        return None
    return value


def _legacy_device_id(request) -> str:
    ip = get_client_ip(request) if request else "unknown"
    ua = ""
    if request:
        ua = str(request.META.get("HTTP_USER_AGENT", "") or "")
    digest = hashlib.sha256(f"{ip}|{ua}".encode("utf-8")).hexdigest()[:24]
    return f"legacy-{digest}"


def _resolve_device_id(request, explicit: str | None = None, *, require_explicit: bool = False) -> str:
    if explicit is None and request is not None:
        explicit = request.data.get("device_id") or request.headers.get("X-Device-Id")
    clean = _normalize_device_id(explicit)
    if clean:
        return clean
    if require_explicit:
        raise ValidationError({"device_id": "Debes enviar un identificador de dispositivo valido."})
    return _legacy_device_id(request)


def _active_sessions_qs(user: Usuario, device_id: str | None = None):
    now = timezone.now()
    qs = RefreshSession.objects.filter(user=user, revoked_at__isnull=True, expires_at__gt=now)
    if device_id:
        qs = qs.filter(device_id=device_id)
    return qs


def _revoke_sessions(qs, *, when=None):
    when = when or timezone.now()
    return qs.update(revoked_at=when, last_used_at=when)


def _register_lockout_event(user):
    now = timezone.now()
    first = getattr(user, "first_lockout_at", None)
    count = int(getattr(user, "failed_lockouts_count", 0) or 0)

    if not first or (now - first) > REPEATED_LOCKOUT_WINDOW:
        user.first_lockout_at = now
        user.failed_lockouts_count = 1
    else:
        user.failed_lockouts_count = count + 1

    if user.failed_lockouts_count >= REPEATED_LOCKOUT_THRESHOLD:
        user.force_password_reset = True
        logger.warning("force_password_reset_enabled user_id=%s", getattr(user, "id", None))

    user.save(update_fields=["first_lockout_at", "failed_lockouts_count", "force_password_reset"])


def _clear_lockout_state(user):
    if not user:
        return
    updates = []
    if getattr(user, "failed_lockouts_count", 0):
        user.failed_lockouts_count = 0
        updates.append("failed_lockouts_count")
    if getattr(user, "first_lockout_at", None):
        user.first_lockout_at = None
        updates.append("first_lockout_at")
    if updates:
        user.save(update_fields=updates)


def _role_allowed_for_expected(actual_role: str | None, expected_role: str | None) -> bool:
    if not expected_role:
        return True
    if expected_role == "admin":
        return actual_role in {Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE}
    return actual_role == expected_role


def _find_user_by_login_identifier(User, identifier: str):
    login_value = (identifier or "").strip()
    if not login_value:
        return None

    user = User.objects.filter(username__iexact=login_value).first()
    if user:
        return user
    user = User.objects.filter(Q(email__iexact=login_value)).first()
    if user:
        return user
    if login_value.isdigit():
        return User.objects.filter(documento=login_value).first()
    return None


def _issue_session_tokens(
    user: Usuario,
    *,
    device_id: str,
    rotate_guard_session: bool = True,
    previous_session: RefreshSession | None = None,
) -> dict[str, str]:
    now = timezone.now()
    refresh_value = _new_refresh_token()
    refresh_hash = _hash_refresh_token(refresh_value)

    with transaction.atomic():
        if rotate_guard_session and Usuario.Rol.GUARDA in AuthorizationService.role_codes(user) and _guard_single_active_session():
            qs = _active_sessions_qs(user=user)
            if previous_session:
                qs = qs.exclude(id=previous_session.id)
            _revoke_sessions(qs, when=now)
        else:
            qs = _active_sessions_qs(user=user, device_id=device_id)
            if previous_session:
                qs = qs.exclude(id=previous_session.id)
            _revoke_sessions(qs, when=now)

        session = RefreshSession.objects.create(
            user=user,
            device_id=device_id,
            refresh_token_hash=refresh_hash,
            expires_at=now + _refresh_token_lifetime(),
            last_used_at=now,
        )

        if previous_session:
            previous_session.revoked_at = now
            previous_session.last_used_at = now
            previous_session.replaced_by = session
            previous_session.save(update_fields=["revoked_at", "last_used_at", "replaced_by"])

        if Usuario.Rol.GUARDA in AuthorizationService.role_codes(user) and rotate_guard_session:
            user.active_session_id = session.id
            user.last_guard_login_at = now
            user.save(update_fields=["active_session_id", "last_guard_login_at"])

    return {
        "refresh": refresh_value,
        "access": _build_access_token(user, session.id),
    }


def issue_tokens_for_user(
    user: Usuario,
    *,
    request=None,
    device_id: str | None = None,
    rotate_guard_session: bool = True,
) -> dict[str, str]:
    resolved_device = _resolve_device_id(request, explicit=device_id, require_explicit=False)
    return _issue_session_tokens(
        user,
        device_id=resolved_device,
        rotate_guard_session=rotate_guard_session,
    )


class SadiTokenObtainPairSerializer(TokenObtainPairSerializer):
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)
    device_id = serializers.CharField(required=False, allow_blank=True, max_length=DEVICE_ID_MAX_LEN)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = AuthorizationService.default_role_for_user(user)
        token["sid"] = str(user.active_session_id or "")
        return token

    def validate(self, attrs):
        request = self.context.get("request")
        login_identifier = (attrs.get("username") or "").strip().lower()
        expected_role = attrs.get("expected_role")
        ip = get_client_ip(request) if request else "unknown"

        if expected_role in {"guarda", "aprendiz"} and (
            not login_identifier.isdigit() or len(login_identifier) < 6 or len(login_identifier) > 10
        ):
            logger.info("login_rejected_invalid_document expected_role=%s ip=%s", expected_role, ip)
            raise AuthenticationFailed(
                {"code": ErrorCode.INVALID_CREDENTIALS, "message": "Usuario o contrasena invalidos."}
            )

        User = get_user_model()
        user = _find_user_by_login_identifier(User, login_identifier) if login_identifier else None
        canonical_login = ((getattr(user, "username", "") or "").strip().lower() if user else login_identifier)

        if "@" in login_identifier:
            domain_check = EmailDomainService.validate(
                email=login_identifier,
                role_code=AuthorizationService.default_role_for_user(user) if user else None,
                sede=getattr(user, "sede_principal", None) if user else None,
            )
            if not domain_check.allowed:
                logger.info(
                    "login_rejected_domain_policy login=%s ip=%s",
                    canonical_login,
                    ip,
                )
                raise AuthenticationFailed(
                    {"code": ErrorCode.INVALID_CREDENTIALS, "message": "Usuario o contrasena invalidos."}
                )

        if user and getattr(user, "username", None):
            attrs["username"] = user.username

        if user and getattr(user, "force_password_reset", False):
            raise AuthenticationFailed(
                {
                    "code": ErrorCode.PASSWORD_RESET_REQUIRED,
                    "message": "Debes recuperar la contrasena antes de volver a iniciar sesion.",
                }
            )

        remaining_user = get_lock_remaining("login-user", [canonical_login]) if canonical_login else 0
        remaining_ip = get_lock_remaining("login-ip", [ip])
        remaining_lock = max(remaining_user, remaining_ip)
        if remaining_lock > 0:
            logger.warning("login_locked login=%s ip=%s remaining=%s", canonical_login, ip, remaining_lock)
            raise AuthenticationFailed(
                {
                    "code": ErrorCode.ACCOUNT_LOCKED_15MIN,
                    "message": "Cuenta bloqueada temporalmente por seguridad.",
                    "detail": {
                        "seconds_remaining": remaining_lock,
                        "requires_password_reset": bool(user and getattr(user, "force_password_reset", False)),
                    },
                }
            )

        if user and getattr(user, "estado", None) == Usuario.Estado.BLOQUEADO:
            raise AuthenticationFailed(
                {"code": ErrorCode.ACCOUNT_DISABLED_SECURITY, "message": "Tu cuenta esta deshabilitada por seguridad."}
            )

        try:
            data = super().validate(attrs)
        except Exception:
            lock_user = {"locked": False, "remaining_sec": 0, "just_locked": False}
            if canonical_login:
                lock_user = bump_with_lock("login-user", [canonical_login], LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            lock_ip = bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)

            if user and lock_user.get("just_locked"):
                _register_lockout_event(user)
                logger.warning("login_just_locked user_id=%s ip=%s", getattr(user, "id", None), ip)

            if user and getattr(user, "force_password_reset", False):
                raise AuthenticationFailed(
                    {
                        "code": ErrorCode.PASSWORD_RESET_REQUIRED,
                        "message": "Debes recuperar la contrasena antes de volver a iniciar sesion.",
                    }
                )

            remaining = max(int(lock_user.get("remaining_sec", 0)), int(lock_ip.get("remaining_sec", 0)))
            if lock_user.get("locked") or lock_ip.get("locked"):
                raise AuthenticationFailed(
                    {
                        "code": ErrorCode.ACCOUNT_LOCKED_15MIN,
                        "message": "Cuenta bloqueada temporalmente por seguridad.",
                        "detail": {
                            "seconds_remaining": remaining,
                            "requires_password_reset": bool(user and getattr(user, "force_password_reset", False)),
                        },
                    }
                )
            raise AuthenticationFailed({"code": ErrorCode.INVALID_CREDENTIALS, "message": "Usuario o contrasena invalidos."})

        role = AuthorizationService.default_role_for_user(self.user)
        if not _role_allowed_for_expected(role, expected_role):
            if canonical_login:
                bump_with_lock("login-user", [canonical_login], LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            raise AuthenticationFailed({"code": ErrorCode.INVALID_CREDENTIALS, "message": "Credenciales invalidas para este modulo."})

        if canonical_login:
            reset_counter("login-user", [canonical_login])
        reset_counter("login-ip", [ip])

        _clear_lockout_state(self.user)
        logger.info("login_success user_id=%s role=%s ip=%s", getattr(self.user, "id", None), role, ip)

        resolved_device = _resolve_device_id(request, explicit=attrs.get("device_id"), require_explicit=False)
        data.update(
            issue_tokens_for_user(
                self.user,
                request=request,
                device_id=resolved_device,
                rotate_guard_session=True,
            )
        )
        return data


class SadiTokenObtainPairView(TokenObtainPairView):
    serializer_class = SadiTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except AuthenticationFailed as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            code = detail.get("code", ErrorCode.INVALID_CREDENTIALS)
            message = detail.get("message", "Usuario o contrasena invalidos.")
            http_status = status.HTTP_401_UNAUTHORIZED
            if code == ErrorCode.ACCOUNT_LOCKED_15MIN:
                http_status = status.HTTP_423_LOCKED
            elif code == ErrorCode.PASSWORD_RESET_REQUIRED:
                http_status = status.HTTP_403_FORBIDDEN
            return error_response(
                code=code,
                message=message,
                status_code=http_status,
                detail=detail.get("detail"),
            )


class SadiTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        refresh_raw = str(request.data.get("refresh", "") or "").strip()
        if not refresh_raw:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Debes enviar el token de refresco.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="refresh",
                detail={"refresh": ["Este campo es obligatorio."]},
            )

        ip = get_client_ip(request)
        explicit_device_id = _normalize_device_id(request.data.get("device_id") or request.headers.get("X-Device-Id"))
        device_key = explicit_device_id or _legacy_device_id(request)

        remaining = max(
            get_lock_remaining("refresh-ip", [ip]),
            get_lock_remaining("refresh-device", [device_key]),
        )
        if remaining > 0:
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiados intentos de renovacion. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        token_hash = _hash_refresh_token(refresh_raw)
        now = timezone.now()
        with transaction.atomic():
            session = (
                RefreshSession.objects.select_for_update()
                .select_related("user")
                .filter(refresh_token_hash=token_hash)
                .first()
            )

            if not session or not hmac.compare_digest(session.refresh_token_hash, token_hash):
                limit_ip = bump_with_lock("refresh-ip", [ip], REFRESH_MAX_ATTEMPTS_IP, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC)
                limit_device = bump_with_lock(
                    "refresh-device", [device_key], REFRESH_MAX_ATTEMPTS_DEVICE, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC
                )
                if limit_ip["locked"] or limit_device["locked"]:
                    lock_remaining = max(int(limit_ip.get("remaining_sec", 0)), int(limit_device.get("remaining_sec", 0)))
                    return error_response(
                        code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                        message="Demasiados intentos de renovacion. Intenta mas tarde.",
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={"seconds_remaining": lock_remaining},
                    )
                return error_response(
                    code=ErrorCode.NOT_AUTHENTICATED,
                    message="Sesion invalida o expirada. Inicia sesion nuevamente.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            if explicit_device_id and session.device_id != explicit_device_id:
                bump_with_lock("refresh-ip", [ip], REFRESH_MAX_ATTEMPTS_IP, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC)
                bump_with_lock("refresh-device", [device_key], REFRESH_MAX_ATTEMPTS_DEVICE, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC)
                return error_response(
                    code=ErrorCode.NOT_AUTHENTICATED,
                    message="Sesion invalida o expirada. Inicia sesion nuevamente.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            if session.revoked_at is not None or now >= session.expires_at:
                return error_response(
                    code=ErrorCode.NOT_AUTHENTICATED,
                    message="Sesion invalida o expirada. Inicia sesion nuevamente.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            user: Usuario = session.user
            if getattr(user, "estado", None) == Usuario.Estado.BLOQUEADO:
                return error_response(
                    code=ErrorCode.ACCOUNT_DISABLED_SECURITY,
                    message="Tu cuenta esta deshabilitada por seguridad.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            if getattr(user, "force_password_reset", False):
                return error_response(
                    code=ErrorCode.PASSWORD_RESET_REQUIRED,
                    message="Debes recuperar la contrasena antes de volver a iniciar sesion.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            tokens = _issue_session_tokens(
                user,
                device_id=session.device_id,
                rotate_guard_session=True,
                previous_session=session,
            )

        reset_counter("refresh-ip", [ip])
        reset_counter("refresh-device", [device_key])
        return Response(tokens, status=status.HTTP_200_OK)


class SadiLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user: Usuario = request.user
        sid = str(getattr(request.auth, "get", lambda *_: None)("sid") or "").strip()
        explicit_device_id = request.data.get("device_id") or request.headers.get("X-Device-Id")
        device_id = _normalize_device_id(explicit_device_id)
        now = timezone.now()

        revoked = 0
        with transaction.atomic():
            if sid:
                revoked += RefreshSession.objects.filter(
                    id=sid,
                    user=user,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                ).update(revoked_at=now, last_used_at=now)

            if device_id:
                revoked += RefreshSession.objects.filter(
                    user=user,
                    device_id=device_id,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                ).update(revoked_at=now, last_used_at=now)

            if revoked == 0 and not sid and not device_id:
                guessed = _resolve_device_id(request, explicit=None, require_explicit=False)
                revoked += RefreshSession.objects.filter(
                    user=user,
                    device_id=guessed,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                ).update(revoked_at=now, last_used_at=now)

            if Usuario.Rol.GUARDA in AuthorizationService.role_codes(user):
                still_active = _active_sessions_qs(user).exists()
                if not still_active and user.active_session_id is not None:
                    user.active_session_id = None
                    user.save(update_fields=["active_session_id"])

        return ok_response({"mensaje": "Sesion cerrada.", "revoked_sessions": revoked})


class SadiLogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user: Usuario = request.user
        now = timezone.now()
        revoked = RefreshSession.objects.filter(
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).update(revoked_at=now, last_used_at=now)

        if Usuario.Rol.GUARDA in AuthorizationService.role_codes(user) and user.active_session_id is not None:
            user.active_session_id = None
            user.save(update_fields=["active_session_id"])

        return ok_response({"mensaje": "Todas las sesiones fueron revocadas.", "revoked_sessions": revoked})
