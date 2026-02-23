from __future__ import annotations

from rest_framework.permissions import BasePermission

from accesos.domain.services.authorization import AuthorizationService


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
