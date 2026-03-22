from __future__ import annotations

import hashlib
import hmac
import logging
import os
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

DEVICE_ID_MAX_LEN = 128
DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
logger = logging.getLogger(__name__)


AUTH_TRANSPORT_COOKIE = "cookie"


def _auth_transport(request) -> str:
    if request is None:
        return ""
    from_header = str(request.headers.get("X-Auth-Transport", "") or "").strip().lower()
    if from_header:
        return from_header
    from_body = str(request.data.get("auth_transport", "") or "").strip().lower() if hasattr(request, "data") else ""
    return from_body


def _refresh_cookie_name() -> str:
    return str(getattr(settings, "AUTH_COOKIE_REFRESH_NAME", "sadi_refresh") or "sadi_refresh")


def _cookie_mode_requested(request) -> bool:
    if not bool(getattr(settings, "AUTH_COOKIE_REFRESH_ENABLED", True)):
        return False
    return _auth_transport(request) == AUTH_TRANSPORT_COOKIE


def _set_refresh_cookie(response, refresh_token: str):
    if not response or not refresh_token:
        return
    max_age = int(_refresh_token_lifetime().total_seconds())
    response.set_cookie(
        _refresh_cookie_name(),
        refresh_token,
        max_age=max_age,
        httponly=bool(getattr(settings, "AUTH_COOKIE_REFRESH_HTTPONLY", True)),
        secure=bool(getattr(settings, "AUTH_COOKIE_REFRESH_SECURE", False)),
        samesite=str(getattr(settings, "AUTH_COOKIE_REFRESH_SAMESITE", "Lax") or "Lax"),
        path=str(getattr(settings, "AUTH_COOKIE_REFRESH_PATH", "/api/") or "/api/"),
        domain=getattr(settings, "AUTH_COOKIE_REFRESH_DOMAIN", None),
    )


def _clear_refresh_cookie(response):
    if not response:
        return
    response.delete_cookie(
        _refresh_cookie_name(),
        path=str(getattr(settings, "AUTH_COOKIE_REFRESH_PATH", "/api/") or "/api/"),
        domain=getattr(settings, "AUTH_COOKIE_REFRESH_DOMAIN", None),
        samesite=str(getattr(settings, "AUTH_COOKIE_REFRESH_SAMESITE", "Lax") or "Lax"),
    )


def _extract_refresh_from_request(request) -> str:
    if request is None:
        return ""
    from_body = str(request.data.get("refresh", "") or "").strip()
    if from_body:
        return from_body
    if bool(getattr(settings, "AUTH_COOKIE_REFRESH_ENABLED", True)):
        from_cookie = str(request.COOKIES.get(_refresh_cookie_name(), "") or "").strip()
        if from_cookie:
            return from_cookie
    return ""


def _strip_refresh_from_body_if_needed(*, request, payload: dict):
    if not isinstance(payload, dict):
        return
    if _cookie_mode_requested(request) and not bool(getattr(settings, "AUTH_COOKIE_REFRESH_LEGACY_BODY", True)):
        payload.pop("refresh", None)


def _env_int(name: str, default: int, *, min_value: int = 1) -> int:
    raw = str(os.getenv(name, str(default)) or "").strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(min_value, value)


def _env_int_list(name: str, default: str) -> list[int]:
    raw = str(os.getenv(name, default) or "").strip()
    values: list[int] = []
    for item in raw.split(","):
        token = item.strip()
        if not token:
            continue
        try:
            parsed = int(token)
        except ValueError:
            continue
        if parsed > 0:
            values.append(parsed)
    if values:
        return values
    return [60, 180, 300, 900, 1800]


LOGIN_MAX_ATTEMPTS = _env_int("LOGIN_MAX_ATTEMPTS", 5, min_value=1)
LOGIN_WINDOW_SEC = _env_int("LOGIN_WINDOW_SEC", 15 * 60, min_value=30)
LOGIN_IP_LOCK_SEC = _env_int("LOGIN_IP_LOCK_SEC", 60, min_value=30)
LOGIN_PROGRESSIVE_LOCKOUT_SECONDS = _env_int_list(
    "LOGIN_PROGRESSIVE_LOCKOUT_SECONDS",
    "60,180,300,900,1800",
)

REPEATED_LOCKOUT_THRESHOLD = _env_int("REPEATED_LOCKOUT_THRESHOLD", 5, min_value=2)
REPEATED_LOCKOUT_WINDOW = timedelta(hours=_env_int("REPEATED_LOCKOUT_WINDOW_HOURS", 24, min_value=1))

REFRESH_MAX_ATTEMPTS_DEVICE = _env_int("REFRESH_MAX_ATTEMPTS_DEVICE", 12, min_value=1)
REFRESH_MAX_ATTEMPTS_IP = _env_int("REFRESH_MAX_ATTEMPTS_IP", 24, min_value=1)
REFRESH_WINDOW_SEC = _env_int("REFRESH_WINDOW_SEC", 10 * 60, min_value=30)
REFRESH_LOCK_SEC = _env_int("REFRESH_LOCK_SEC", 15 * 60, min_value=30)


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


def _build_access_token(user: Usuario, sid, *, role_code: str | None = None) -> str:
    access = AccessToken.for_user(user)
    access["rol"] = role_code or AuthorizationService.default_role_for_user(user)
    access["sid"] = str(sid)
    return str(access)


def _validated_session_role_code(
    user: Usuario,
    *,
    preferred_role_code: str | None = None,
    fallback_to_default: bool,
) -> str:
    return AuthorizationService.resolve_session_role(
        user,
        preferred_role_code=preferred_role_code,
        fallback_to_default=fallback_to_default,
    )


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


def _current_lockout_count(user) -> int:
    if not user:
        return 0
    first = getattr(user, "first_lockout_at", None)
    count = int(getattr(user, "failed_lockouts_count", 0) or 0)
    if not first or count <= 0:
        return 0
    if (timezone.now() - first) > REPEATED_LOCKOUT_WINDOW:
        return 0
    return count


def _next_lockout_seconds(user) -> int:
    prior_lockouts = _current_lockout_count(user)
    idx = min(prior_lockouts, len(LOGIN_PROGRESSIVE_LOCKOUT_SECONDS) - 1)
    return int(LOGIN_PROGRESSIVE_LOCKOUT_SECONDS[idx])


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
    role_code: str | None = None,
    rotate_guard_session: bool = True,
    previous_session: RefreshSession | None = None,
) -> dict[str, str]:
    now = timezone.now()
    resolved_role_code = _validated_session_role_code(
        user,
        preferred_role_code=role_code or getattr(previous_session, "role_code", ""),
        fallback_to_default=previous_session is None,
    )
    if not resolved_role_code:
        raise AuthenticationFailed(
            {
                "code": ErrorCode.NOT_AUTHENTICATED,
                "message": "Sesion invalida o expirada. Inicia sesion nuevamente.",
            }
        )
    refresh_value = _new_refresh_token()
    refresh_hash = _hash_refresh_token(refresh_value)

    with transaction.atomic():
        if (
            rotate_guard_session
            and Usuario.Rol.GUARDA in AuthorizationService.role_codes(user)
            and _guard_single_active_session()
        ):
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
            role_code=resolved_role_code,
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
        "access": _build_access_token(user, session.id, role_code=resolved_role_code),
    }


def issue_tokens_for_user(
    user: Usuario,
    *,
    request=None,
    device_id: str | None = None,
    role_code: str | None = None,
    rotate_guard_session: bool = True,
) -> dict[str, str]:
    resolved_device = _resolve_device_id(request, explicit=device_id, require_explicit=False)
    return _issue_session_tokens(
        user,
        device_id=resolved_device,
        role_code=role_code,
        rotate_guard_session=rotate_guard_session,
    )


class SadiTokenObtainPairSerializer(TokenObtainPairSerializer):
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)
    device_id = serializers.CharField(required=False, allow_blank=True, max_length=DEVICE_ID_MAX_LEN)
    auth_transport = serializers.ChoiceField(choices=[AUTH_TRANSPORT_COOKIE], required=False)

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
        canonical_login = (getattr(user, "username", "") or "").strip().lower() if user else login_identifier

        resolved_login_role = AuthorizationService.resolve_login_role(user, expected_role) if user else ""

        if "@" in login_identifier:
            domain_check = EmailDomainService.validate(
                email=login_identifier,
                role_code=resolved_login_role or (AuthorizationService.default_role_for_user(user) if user else None),
                sede=AuthorizationService.default_sede(user, role_code=resolved_login_role) if user else None,
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
            user_lock_sec = _next_lockout_seconds(user)
            ip_lock_sec = max(LOGIN_IP_LOCK_SEC, user_lock_sec)
            lock_user = {"locked": False, "remaining_sec": 0, "just_locked": False}
            if canonical_login:
                lock_user = bump_with_lock(
                    "login-user",
                    [canonical_login],
                    LOGIN_MAX_ATTEMPTS,
                    LOGIN_WINDOW_SEC,
                    user_lock_sec,
                )
            lock_ip = bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, ip_lock_sec)

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
            raise AuthenticationFailed(
                {"code": ErrorCode.INVALID_CREDENTIALS, "message": "Usuario o contrasena invalidos."}
            )

        role = AuthorizationService.resolve_login_role(self.user, expected_role)
        if not _role_allowed_for_expected(role, expected_role):
            user_lock_sec = _next_lockout_seconds(self.user)
            ip_lock_sec = max(LOGIN_IP_LOCK_SEC, user_lock_sec)
            if canonical_login:
                bump_with_lock(
                    "login-user",
                    [canonical_login],
                    LOGIN_MAX_ATTEMPTS,
                    LOGIN_WINDOW_SEC,
                    user_lock_sec,
                )
            bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, ip_lock_sec)
            raise AuthenticationFailed(
                {"code": ErrorCode.INVALID_CREDENTIALS, "message": "Credenciales invalidas para este modulo."}
            )

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
                role_code=role,
                rotate_guard_session=True,
            )
        )
        return data


class SadiTokenObtainPairView(TokenObtainPairView):
    serializer_class = SadiTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            if response.status_code == status.HTTP_200_OK and isinstance(response.data, dict):
                refresh_token = str(response.data.get("refresh", "") or "").strip()
                if refresh_token and _cookie_mode_requested(request):
                    _set_refresh_cookie(response, refresh_token)
                    _strip_refresh_from_body_if_needed(request=request, payload=response.data)
            return response
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
        refresh_raw = _extract_refresh_from_request(request)
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
                limit_ip = bump_with_lock(
                    "refresh-ip", [ip], REFRESH_MAX_ATTEMPTS_IP, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC
                )
                limit_device = bump_with_lock(
                    "refresh-device", [device_key], REFRESH_MAX_ATTEMPTS_DEVICE, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC
                )
                if limit_ip["locked"] or limit_device["locked"]:
                    lock_remaining = max(
                        int(limit_ip.get("remaining_sec", 0)), int(limit_device.get("remaining_sec", 0))
                    )
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
                bump_with_lock(
                    "refresh-device", [device_key], REFRESH_MAX_ATTEMPTS_DEVICE, REFRESH_WINDOW_SEC, REFRESH_LOCK_SEC
                )
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

            refreshed_role_code = _validated_session_role_code(
                user,
                preferred_role_code=session.role_code,
                fallback_to_default=False,
            )
            if not refreshed_role_code:
                session.revoked_at = now
                session.last_used_at = now
                session.save(update_fields=["revoked_at", "last_used_at"])
                return error_response(
                    code=ErrorCode.NOT_AUTHENTICATED,
                    message="Sesion invalida o expirada. Inicia sesion nuevamente.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            tokens = _issue_session_tokens(
                user,
                device_id=session.device_id,
                role_code=refreshed_role_code,
                rotate_guard_session=True,
                previous_session=session,
            )

        reset_counter("refresh-ip", [ip])
        reset_counter("refresh-device", [device_key])
        response = Response(tokens, status=status.HTTP_200_OK)
        if _cookie_mode_requested(request):
            refresh_token = str(tokens.get("refresh", "") or "").strip()
            if refresh_token:
                _set_refresh_cookie(response, refresh_token)
            _strip_refresh_from_body_if_needed(request=request, payload=response.data)
        return response


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

        response = ok_response({"mensaje": "Sesion cerrada.", "revoked_sessions": revoked})
        _clear_refresh_cookie(response)
        return response


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

        response = ok_response({"mensaje": "Todas las sesiones fueron revocadas.", "revoked_sessions": revoked})
        _clear_refresh_cookie(response)
        return response
