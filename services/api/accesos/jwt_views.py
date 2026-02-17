from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api_responses import error_response
from .error_codes import ErrorCode
from .rate_limit import bump_with_lock, get_client_ip, get_lock_remaining, reset_counter

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SEC = 15 * 60
LOGIN_LOCK_SEC = 15 * 60

REPEATED_LOCKOUT_THRESHOLD = 3
REPEATED_LOCKOUT_WINDOW = timedelta(hours=24)


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
        return actual_role in {"admin", "superadmin", "admin_sede"}
    return actual_role == expected_role


def issue_tokens_for_user(user, rotate_guard_session: bool = True) -> dict[str, str]:
    if getattr(user, "rol", None) == "guarda" and rotate_guard_session:
        user.active_session_id = uuid4()
        user.last_guard_login_at = timezone.now()
        user.save(update_fields=["active_session_id", "last_guard_login_at"])

    refresh = RefreshToken.for_user(user)
    refresh["rol"] = getattr(user, "rol", "")
    refresh["sid"] = str(getattr(user, "active_session_id", "") or "")
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class SadiTokenObtainPairSerializer(TokenObtainPairSerializer):
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = user.rol
        token["sid"] = str(user.active_session_id or "")
        return token

    def validate(self, attrs):
        request = self.context.get("request")
        username = (attrs.get("username") or "").strip().lower()
        expected_role = attrs.get("expected_role")
        ip = get_client_ip(request) if request else "unknown"

        User = get_user_model()
        user = User.objects.filter(username__iexact=username).first() if username else None

        if user and getattr(user, "force_password_reset", False):
            raise AuthenticationFailed(
                {
                    "code": ErrorCode.PASSWORD_RESET_REQUIRED,
                    "message": "Debes recuperar la contrasena antes de volver a iniciar sesion.",
                }
            )

        remaining_user = get_lock_remaining("login-user", [username]) if username else 0
        remaining_ip = get_lock_remaining("login-ip", [ip])
        remaining_lock = max(remaining_user, remaining_ip)
        if remaining_lock > 0:
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

        if user and getattr(user, "estado", None) == "bloqueado":
            raise AuthenticationFailed(
                {"code": ErrorCode.ACCOUNT_DISABLED_SECURITY, "message": "Tu cuenta esta deshabilitada por seguridad."}
            )

        try:
            data = super().validate(attrs)
        except Exception:
            lock_user = {"locked": False, "remaining_sec": 0, "just_locked": False}
            if username:
                lock_user = bump_with_lock("login-user", [username], LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            lock_ip = bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)

            if user and lock_user.get("just_locked"):
                _register_lockout_event(user)

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

        role = getattr(self.user, "rol", None)
        if not _role_allowed_for_expected(role, expected_role):
            if username:
                bump_with_lock("login-user", [username], LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            raise AuthenticationFailed({"code": ErrorCode.INVALID_CREDENTIALS, "message": "Credenciales invalidas para este modulo."})

        if username:
            reset_counter("login-user", [username])
        reset_counter("login-ip", [ip])

        _clear_lockout_state(self.user)

        data.update(issue_tokens_for_user(self.user, rotate_guard_session=True))
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


class SadiTokenRefreshView(TokenRefreshView):
    pass

