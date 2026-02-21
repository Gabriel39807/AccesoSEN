from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q, QuerySet

from accesos.models import Permission, Role, RolePermission, UserMembership, Usuario


@dataclass(frozen=True)
class AuthorizationContext:
    role_codes: set[str]
    sede_ids: set[int]


class AuthorizationService:
    """
    Data-driven RBAC service.

    - Source of truth: Role/Permission/RolePermission/UserMembership.
    - Backward compatibility: falls back to Usuario.rol and sede_principal while
      old clients still depend on that field.
    """

    SUPERADMIN_CODE = "superadmin"

    @classmethod
    def role_codes(cls, user: Usuario) -> set[str]:
        if not user or not getattr(user, "is_authenticated", False):
            return set()

        role_codes = set(
            UserMembership.objects.filter(user=user, is_active=True).values_list("role__code", flat=True)
        )
        if getattr(user, "rol", None):
            legacy = str(user.rol)
            role_codes.add(legacy)
            if legacy == "admin":
                role_codes.add("admin_sede")
        return role_codes

    @classmethod
    def allowed_sede_ids(cls, user: Usuario) -> set[int]:
        if not user or not getattr(user, "is_authenticated", False):
            return set()

        if cls.is_superadmin(user):
            return set()

        membership_sede_ids = set(
            UserMembership.objects.filter(user=user, is_active=True, sede__isnull=False).values_list("sede_id", flat=True)
        )
        if membership_sede_ids:
            return membership_sede_ids

        sede_ids: set[int] = set()
        if getattr(user, "sede_principal_id", None):
            sede_ids.add(int(user.sede_principal_id))
        return sede_ids

    @classmethod
    def context(cls, user: Usuario) -> AuthorizationContext:
        return AuthorizationContext(
            role_codes=cls.role_codes(user),
            sede_ids=cls.allowed_sede_ids(user),
        )

    @classmethod
    def is_superadmin(cls, user: Usuario) -> bool:
        return cls.SUPERADMIN_CODE in cls.role_codes(user)

    @classmethod
    def _matches_sede_scope(cls, user: Usuario, sede_id: int | None = None, obj=None) -> bool:
        if cls.is_superadmin(user):
            return True

        if sede_id is None and obj is not None:
            for attr in ("sede_id",):
                if hasattr(obj, attr):
                    sede_id = getattr(obj, attr)
                    break
            if sede_id is None and hasattr(obj, "sede_principal_id"):
                sede_id = getattr(obj, "sede_principal_id")
            if sede_id is None and hasattr(obj, "propietario") and getattr(obj.propietario, "sede_principal_id", None):
                sede_id = obj.propietario.sede_principal_id

        if sede_id is None:
            return False

        return int(sede_id) in cls.allowed_sede_ids(user)

    @classmethod
    def _matches_own_scope(cls, user: Usuario, obj=None) -> bool:
        if not user or not obj:
            return False
        if hasattr(obj, "id") and getattr(obj, "id", None) == getattr(user, "id", None):
            return True
        for owner_field in ("user_id", "usuario_id", "propietario_id", "guarda_id"):
            if hasattr(obj, owner_field) and getattr(obj, owner_field, None) == getattr(user, "id", None):
                return True
        return False

    @classmethod
    def has_perm(cls, user: Usuario, perm_code: str, *, sede=None, obj=None) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if not perm_code:
            return False
        if cls.is_superadmin(user):
            return True

        role_codes = cls.role_codes(user)
        if not role_codes:
            return False

        sede_id = getattr(sede, "id", None) if sede is not None else None
        if sede_id is None and isinstance(sede, int):
            sede_id = sede

        assignments = RolePermission.objects.filter(
            role__code__in=role_codes,
            permission__code=perm_code,
        ).select_related("role", "permission")

        for assignment in assignments:
            if assignment.scope == RolePermission.Scope.GLOBAL:
                return True
            if assignment.scope == RolePermission.Scope.SEDE and cls._matches_sede_scope(user, sede_id=sede_id, obj=obj):
                return True
            if assignment.scope == RolePermission.Scope.OWN:
                if obj is None:
                    # Create/list own resources is allowed by role-level assignment.
                    return True
                if cls._matches_own_scope(user, obj=obj):
                    return True

        return False

    @classmethod
    def scoped_queryset(cls, user: Usuario, qs: QuerySet, *, resource: str) -> QuerySet:
        if not user or not getattr(user, "is_authenticated", False):
            return qs.none()
        if cls.is_superadmin(user):
            return qs

        roles = cls.role_codes(user)
        sede_ids = cls.allowed_sede_ids(user)

        if resource == "usuario":
            if "admin_sede" in roles:
                return qs.filter(sede_principal_id__in=sede_ids)
            return qs.filter(id=user.id)

        if resource == "equipo":
            if "admin_sede" in roles:
                return qs.filter(propietario__sede_principal_id__in=sede_ids)
            if "guarda" in roles:
                return qs.filter(propietario__sede_principal_id__in=sede_ids)
            return qs.filter(propietario_id=user.id)

        if resource == "turno":
            if "admin_sede" in roles:
                return qs.filter(sede_id__in=sede_ids)
            if "guarda" in roles:
                return qs.filter(guarda_id=user.id)
            return qs.none()

        if resource == "acceso":
            if "admin_sede" in roles:
                return qs.filter(sede_id__in=sede_ids)
            if "guarda" in roles:
                return qs.filter(Q(turno__guarda_id=user.id) | Q(sede_id__in=sede_ids))
            return qs.filter(usuario_id=user.id)

        if resource == "notificacion":
            if "admin_sede" in roles:
                return qs.filter(
                    Q(user__isnull=True)
                    | Q(user=user)
                    | Q(user__sede_principal_id__in=sede_ids)
                )
            if "aprendiz" in roles or "guarda" in roles:
                return qs.filter(Q(user=user) | Q(user__isnull=True))
            return qs

        return qs

    @classmethod
    def can_manage_role(cls, actor: Usuario, target_role_code: str) -> bool:
        if cls.is_superadmin(actor):
            return True
        if "admin_sede" in cls.role_codes(actor):
            return target_role_code in {"guarda", "aprendiz"}
        return False

    @classmethod
    def default_role_for_user(cls, user: Usuario) -> str:
        """
        Returns the best current role code for login compatibility.
        """
        if not user:
            return ""
        roles = cls.role_codes(user)
        if "superadmin" in roles:
            return "superadmin"
        if "admin_sede" in roles:
            return "admin_sede"
        if "admin" in roles:
            return "admin_sede"
        if "guarda" in roles:
            return "guarda"
        if "aprendiz" in roles:
            return "aprendiz"
        return str(getattr(user, "rol", "") or "")
