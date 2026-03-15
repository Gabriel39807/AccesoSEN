from __future__ import annotations

from rest_framework.permissions import BasePermission

from accesos.domain.services.authorization import AuthorizationService
from accesos.models import Usuario

ADMIN_ROLES = {"superadmin", "admin_sede", "admin"}


def is_superadmin(user) -> bool:
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and AuthorizationService.runtime_role_for_user(user) == AuthorizationService.SUPERADMIN_CODE
    )


def is_admin_sede(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return AuthorizationService.runtime_role_for_user(user) == AuthorizationService.ADMIN_SEDE_CODE


def is_admin_role(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return AuthorizationService.runtime_role_for_user(user) in ADMIN_ROLES


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin_role(request.user)


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_superadmin(request.user)


class IsGuarda(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and AuthorizationService.runtime_role_for_user(user) == Usuario.Rol.GUARDA
        )


class IsAprendiz(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and AuthorizationService.runtime_role_for_user(user) == Usuario.Rol.APRENDIZ
        )
