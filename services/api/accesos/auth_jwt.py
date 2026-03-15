from __future__ import annotations

from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class SadiJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        from .domain.services.authorization import AuthorizationService
        from .models import RefreshSession

        user = super().get_user(validated_token)
        sid = str(validated_token.get("sid") or "").strip()
        role_code = str(validated_token.get("rol") or "").strip().lower()

        if role_code:
            normalized = AuthorizationService._normalize_role_code(role_code)
            if normalized in AuthorizationService.role_codes(user):
                user._active_role = normalized

        # Compatibilidad con tokens antiguos sin sid.
        if not sid:
            return user

        now = timezone.now()
        session = RefreshSession.objects.filter(id=sid, user=user).first()
        if session:
            if session.revoked_at is not None or now >= session.expires_at:
                raise AuthenticationFailed("Sesion invalida para este dispositivo.")
            session_role = AuthorizationService._normalize_role_code(getattr(session, "role_code", ""))
            if session_role:
                user._active_role = session_role
        elif "guarda" not in AuthorizationService.role_codes(user):
            raise AuthenticationFailed("Sesion invalida para este dispositivo.")

        if "guarda" in AuthorizationService.role_codes(user):
            expected = str(user.active_session_id or "")
            if not sid or sid != expected:
                raise AuthenticationFailed("Sesion invalida para este dispositivo.")
        return user
