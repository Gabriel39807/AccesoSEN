from __future__ import annotations

from django.utils import timezone
from rest_framework.permissions import BasePermission

from accesos.domain.services.authorization import AuthorizationService
from accesos.models import ControlPanelSession


def _request_ip(request) -> str:
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR", "") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return str(request.META.get("REMOTE_ADDR", "") or "").strip()


def _request_user_agent(request) -> str:
    return str(request.META.get("HTTP_USER_AGENT", "") or "").strip()


def resolve_control_panel_session(request):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None

    raw_id = str(request.META.get("HTTP_X_CONTROL_PANEL_SESSION", "") or "").strip()
    if not raw_id:
        return None

    session = (
        ControlPanelSession.objects.filter(
            id=raw_id,
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by("-granted_at")
        .first()
    )
    if session is None:
        return None

    request_ip = _request_ip(request)
    request_user_agent = _request_user_agent(request)
    if session.ip_address and request_ip and session.ip_address != request_ip:
        return None
    if session.user_agent and request_user_agent and session.user_agent != request_user_agent:
        return None

    request.control_panel_session = session
    if (timezone.now() - session.last_used_at).total_seconds() >= 30:
        session.last_used_at = timezone.now()
        session.save(update_fields=["last_used_at"])
    return session


class RequiresPermission(BasePermission):
    """
    Generic permission checker backed by AuthorizationService.

    View configuration:
    - permission_map: dict[action, perm_code]
    - object_permission_map: optional dict[action, perm_code]
    """

    def _action(self, view) -> str:
        return str(getattr(view, "action", "") or "").strip()

    def _allow_own_without_object(self, view, action: str) -> bool:
        allowed = getattr(view, "allow_own_scope_actions", set())
        if isinstance(allowed, (list, tuple, set)):
            return action in allowed
        return False

    def _perm_for_action(self, view, *, object_level: bool = False) -> str | None:
        action = self._action(view)
        if not action:
            return None
        source = getattr(view, "object_permission_map", {}) if object_level else getattr(view, "permission_map", {})
        if not isinstance(source, dict):
            return None
        code = source.get(action)
        if not code and object_level:
            code = getattr(view, "permission_map", {}).get(action)
        return str(code).strip() if code else None

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        action = self._action(view)
        if not isinstance(getattr(view, "permission_map", None), dict):
            # Fail secure: permission map is mandatory.
            return False
        perm_code = self._perm_for_action(view, object_level=False)
        if not perm_code:
            return False
        if action and self._allow_own_without_object(view, action):
            return AuthorizationService.has_perm(user, perm_code, obj=user)
        return AuthorizationService.has_perm(user, perm_code)

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if not isinstance(getattr(view, "permission_map", None), dict):
            return False
        perm_code = self._perm_for_action(view, object_level=True)
        if not perm_code:
            return False
        return AuthorizationService.has_perm(user, perm_code, obj=obj)


class RequiresControlPanelSession(BasePermission):
    message = "Se requiere una sesion reforzada vigente del panel de control."

    def has_permission(self, request, view) -> bool:
        return resolve_control_panel_session(request) is not None
