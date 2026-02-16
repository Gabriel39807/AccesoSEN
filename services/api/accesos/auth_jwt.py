from __future__ import annotations

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class SadiJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        sid = validated_token.get("sid")

        if getattr(user, "rol", None) == "guarda":
            expected = str(user.active_session_id or "")
            if not sid or sid != expected:
                raise AuthenticationFailed("Sesion invalida para este dispositivo.")
        return user
