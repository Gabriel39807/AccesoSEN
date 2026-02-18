from __future__ import annotations

from rest_framework.permissions import BasePermission


ADMIN_ROLES = {"superadmin", "admin_sede"}


def is_superadmin(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "rol", None) == "superadmin")


def is_admin_sede(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "rol", None) == "admin_sede")


def is_admin_role(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and getattr(user, "rol", None) in ADMIN_ROLES)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_admin_role(request.user)


class IsGuarda(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "rol", None) == "guarda")


class IsAprendiz(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "rol", None) == "aprendiz")
