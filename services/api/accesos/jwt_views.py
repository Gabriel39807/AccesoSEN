from __future__ import annotations

from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .api_responses import error_response
from .error_codes import ErrorCode
from .rate_limit import bump_with_lock, get_client_ip, is_locked, reset_counter

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SEC = 15 * 60
LOGIN_LOCK_SEC = 15 * 60


class SadiTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = user.rol
        token["sid"] = str(user.active_session_id or "")
        return token

    def validate(self, attrs):
        request = self.context.get("request")
        username = (attrs.get("username") or "").strip().lower()
        ip = get_client_ip(request) if request else "unknown"

        if username and (is_locked("login-user", [username]) or is_locked("login-ip", [ip])):
            raise AuthenticationFailed(
                {"code": ErrorCode.ACCOUNT_LOCKED_15MIN, "message": "Cuenta bloqueada temporalmente por seguridad."}
            )

        User = get_user_model()
        user = User.objects.filter(username__iexact=attrs.get("username", "")).first()
        if user and getattr(user, "estado", None) == "bloqueado":
            raise AuthenticationFailed(
                {"code": ErrorCode.ACCOUNT_DISABLED_SECURITY, "message": "Tu cuenta esta deshabilitada por seguridad."}
            )

        try:
            data = super().validate(attrs)
        except Exception:
            if username:
                bump_with_lock("login-user", [username], LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            bump_with_lock("login-ip", [ip], LOGIN_MAX_ATTEMPTS * 2, LOGIN_WINDOW_SEC, LOGIN_LOCK_SEC)
            raise AuthenticationFailed(
                {"code": ErrorCode.INVALID_CREDENTIALS, "message": "Usuario o contrasena invalidos."}
            )

        reset_counter("login-user", [username])
        reset_counter("login-ip", [ip])

        if getattr(self.user, "rol", None) == "guarda":
            self.user.active_session_id = uuid4()
            self.user.last_guard_login_at = timezone.now()
            self.user.save(update_fields=["active_session_id", "last_guard_login_at"])

            refresh = self.get_token(self.user)
            data["refresh"] = str(refresh)
            data["access"] = str(refresh.access_token)

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
            http_status = status.HTTP_423_LOCKED if code == ErrorCode.ACCOUNT_LOCKED_15MIN else status.HTTP_401_UNAUTHORIZED
            return error_response(code=code, message=message, status_code=http_status)


class SadiTokenRefreshView(TokenRefreshView):
    pass
