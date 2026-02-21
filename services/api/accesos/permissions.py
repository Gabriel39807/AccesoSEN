from __future__ import annotations

from rest_framework.permissions import BasePermission

from accesos.domain.services.authorization import AuthorizationService

ADMIN_ROLES = {"superadmin", "admin_sede", "admin"}


def is_superadmin(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and AuthorizationService.is_superadmin(user))


def is_admin_sede(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return "admin_sede" in AuthorizationService.role_codes(user)


def is_admin_role(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return bool(AuthorizationService.role_codes(user).intersection(ADMIN_ROLES))


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin_role(request.user)


class IsGuarda(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and "guarda" in AuthorizationService.role_codes(user))


class IsAprendiz(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and "aprendiz" in AuthorizationService.role_codes(user))
