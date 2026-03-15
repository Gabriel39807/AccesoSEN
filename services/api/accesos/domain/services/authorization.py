from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q, QuerySet

from accesos.models import Notificacion, RolePermission, UserMembership, Usuario


@dataclass(frozen=True)
class AuthorizationContext:
    role_codes: set[str]
    sede_ids: set[int]


class AuthorizationService:
    """Data-driven RBAC service with fail-secure defaults.

    Source of truth:
    - UserMembership + RolePermission

    Security posture:
    - No runtime fallback to legacy `Usuario.rol` for authorization decisions.
    - Deny by default if memberships/permissions are missing.
    """

    SUPERADMIN_CODE = "superadmin"
    LEGACY_ADMIN_CODE = "admin"
    ADMIN_SEDE_CODE = "admin_sede"

    _RESOURCE_SCOPE_RULES = {
        "usuario": {
            "admin_sede": lambda user, sede_ids: Q(sede_principal_id__in=sede_ids),
            "aprendiz": lambda user, sede_ids: Q(id=user.id),
            "guarda": lambda user, sede_ids: Q(id=user.id),
        },
        "equipo": {
            "admin_sede": lambda user, sede_ids: Q(propietario__sede_principal_id__in=sede_ids),
            "guarda": lambda user, sede_ids: Q(propietario__sede_principal_id__in=sede_ids),
            "aprendiz": lambda user, sede_ids: Q(propietario_id=user.id),
        },
        "turno": {
            "admin_sede": lambda user, sede_ids: Q(sede_id__in=sede_ids),
            "guarda": lambda user, sede_ids: Q(guarda_id=user.id),
        },
        "acceso": {
            "admin_sede": lambda user, sede_ids: Q(sede_id__in=sede_ids),
            "guarda": lambda user, sede_ids: Q(turno__guarda_id=user.id) | Q(sede_id__in=sede_ids),
            "aprendiz": lambda user, sede_ids: Q(usuario_id=user.id),
        },
        "notificacion": {
            "admin_sede": (
                lambda user, sede_ids: Q(user__isnull=True)
                | Q(user=user)
                | Q(user__sede_principal_id__in=sede_ids)
            ),
            "guarda": lambda user, sede_ids: Q(user=user) | Q(user__isnull=True),
            "aprendiz": lambda user, sede_ids: Q(user=user) | Q(user__isnull=True),
        },
    }

    @classmethod
    def _normalize_role_code(cls, role_code: str | None) -> str:
        """Normalize role aliases to canonical runtime codes."""
        raw = str(role_code or "").strip().lower()
        if raw == cls.LEGACY_ADMIN_CODE:
            return cls.ADMIN_SEDE_CODE
        return raw

    @classmethod
    def _active_memberships_qs(cls, user: Usuario):
        return UserMembership.objects.filter(user=user, is_active=True).select_related("role")

    @classmethod
    def _memberships_for_role(cls, user: Usuario, role_code: str | None = None):
        qs = cls._active_memberships_qs(user)
        normalized = cls._normalize_role_code(role_code)
        if not normalized:
            return qs.order_by("-is_primary", "id")
        if normalized == cls.ADMIN_SEDE_CODE:
            return qs.filter(role__code__in=[cls.ADMIN_SEDE_CODE, cls.LEGACY_ADMIN_CODE]).order_by("-is_primary", "id")
        return qs.filter(role__code=normalized).order_by("-is_primary", "id")

    @classmethod
    def role_codes(cls, user: Usuario) -> set[str]:
        if not user or not getattr(user, "is_authenticated", False):
            return set()

        role_codes = {
            cls._normalize_role_code(code)
            for code in cls._active_memberships_qs(user).values_list("role__code", flat=True)
        }
        if getattr(user, "is_superuser", False):
            role_codes.add(cls.SUPERADMIN_CODE)
        return role_codes

    @classmethod
    def runtime_role_for_user(cls, user: Usuario) -> str:
        if not user or not getattr(user, "is_authenticated", False):
            return ""
        active_role = cls._normalize_role_code(getattr(user, "_active_role", ""))
        if active_role and active_role in cls.role_codes(user):
            return active_role
        return cls.default_role_for_user(user)

    @classmethod
    def runtime_role_codes(cls, user: Usuario) -> set[str]:
        active_role = cls.runtime_role_for_user(user)
        return {active_role} if active_role else set()

    @classmethod
    def allowed_sede_ids(cls, user: Usuario) -> set[int]:
        if not user or not getattr(user, "is_authenticated", False):
            return set()

        if cls.is_superadmin(user):
            return set()

        membership_sede_ids = set(
            cls._active_memberships_qs(user).filter(sede__isnull=False).values_list("sede_id", flat=True)
        )
        return membership_sede_ids

    @classmethod
    def allowed_sede_ids_for_roles(cls, user: Usuario, role_codes: set[str] | None = None) -> set[int]:
        if not user or not getattr(user, "is_authenticated", False):
            return set()

        if role_codes and cls.SUPERADMIN_CODE in role_codes:
            return set()
        if not role_codes and cls.is_superadmin(user):
            return set()

        qs = cls._active_memberships_qs(user).filter(sede__isnull=False)
        normalized_roles = {cls._normalize_role_code(code) for code in (role_codes or set()) if code}
        if normalized_roles:
            membership_role_codes: set[str] = set()
            for code in normalized_roles:
                if code == cls.ADMIN_SEDE_CODE:
                    membership_role_codes.update({cls.ADMIN_SEDE_CODE, cls.LEGACY_ADMIN_CODE})
                else:
                    membership_role_codes.add(code)
            qs = qs.filter(role__code__in=membership_role_codes)
        return set(qs.values_list("sede_id", flat=True))

    @classmethod
    def primary_membership(cls, user: Usuario, *, role_code: str | None = None):
        if not user or not getattr(user, "is_authenticated", False):
            return None
        effective_role = role_code or cls.default_role_for_user(user)
        if effective_role:
            membership = cls._memberships_for_role(user, effective_role).first()
            if membership is not None:
                return membership
        return cls._memberships_for_role(user).first()

    @classmethod
    def default_sede(cls, user: Usuario, *, role_code: str | None = None):
        membership = cls.primary_membership(user, role_code=role_code)
        if membership is None:
            return None
        return getattr(membership, "sede", None)

    @classmethod
    def default_sede_id(cls, user: Usuario, *, role_code: str | None = None) -> int | None:
        sede = cls.default_sede(user, role_code=role_code)
        return getattr(sede, "id", None)

    @classmethod
    def default_sede_code(cls, user: Usuario, *, role_code: str | None = None) -> str:
        sede = cls.default_sede(user, role_code=role_code)
        code = getattr(sede, "code", None)
        return (str(code or "").strip()) or ""

    @classmethod
    def context(cls, user: Usuario) -> AuthorizationContext:
        runtime_roles = cls.runtime_role_codes(user)
        return AuthorizationContext(
            role_codes=runtime_roles or cls.role_codes(user),
            sede_ids=cls.allowed_sede_ids_for_roles(user, runtime_roles) or cls.allowed_sede_ids(user),
        )

    @classmethod
    def is_superadmin(cls, user: Usuario) -> bool:
        return cls.SUPERADMIN_CODE in (cls.runtime_role_codes(user) or cls.role_codes(user))

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

        runtime_roles = cls.runtime_role_codes(user)
        return int(sede_id) in (
            cls.allowed_sede_ids_for_roles(user, runtime_roles) if runtime_roles else cls.allowed_sede_ids(user)
        )

    @classmethod
    def _matches_own_scope(cls, user: Usuario, obj=None) -> bool:
        if not user or not obj:
            return False
        if hasattr(obj, "id") and getattr(obj, "id", None) == getattr(user, "id", None):
            return True
        for owner_field in ("user_id", "usuario_id", "propietario_id", "guarda_id"):
            if hasattr(obj, owner_field) and getattr(obj, owner_field, None) == getattr(user, "id", None):
                return True
        if isinstance(obj, Notificacion) and getattr(obj, "user_id", None) is None:
            target_role = cls._normalize_role_code(getattr(obj, "rol_objetivo", None))
            runtime_roles = cls.runtime_role_codes(user) or cls.role_codes(user)
            if not target_role:
                return True
            return target_role in runtime_roles
        return False

    @classmethod
    def has_perm(cls, user: Usuario, perm_code: str, *, sede=None, obj=None) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if not perm_code:
            return False
        if cls.is_superadmin(user):
            return True

        role_codes = cls.runtime_role_codes(user) or cls.role_codes(user)
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
            if assignment.scope == RolePermission.Scope.SEDE:
                # Action-level checks (list/create) may not carry an object yet.
                # In that case, allow the permission only when the actor has at
                # least one active sede membership.
                if obj is None and sede_id is None:
                    if bool(cls.allowed_sede_ids_for_roles(user, role_codes)):
                        return True
                elif cls._matches_sede_scope(user, sede_id=sede_id, obj=obj):
                    return True
            if assignment.scope == RolePermission.Scope.OWN:
                # OWN never grants implicit create/list without explicit object.
                if obj is not None and cls._matches_own_scope(user, obj=obj):
                    return True

        return False

    @classmethod
    def scoped_queryset(cls, user: Usuario, qs: QuerySet, *, resource: str) -> QuerySet:
        if not user or not getattr(user, "is_authenticated", False):
            return qs.none()
        if cls.is_superadmin(user):
            return qs

        roles = cls.runtime_role_codes(user) or cls.role_codes(user)
        sede_ids = cls.allowed_sede_ids_for_roles(user, roles)
        resource_rules = cls._RESOURCE_SCOPE_RULES.get(resource, {})
        if not resource_rules:
            # Unknown resource -> fail secure.
            return qs.none()

        predicates: list[Q] = []
        for role_code in roles:
            rule = resource_rules.get(role_code)
            if not rule:
                continue
            predicates.append(rule(user, sede_ids))

        if not predicates:
            return qs.none()

        combined = predicates[0]
        for predicate in predicates[1:]:
            combined |= predicate
        return qs.filter(combined)

    @classmethod
    def can_manage_role(cls, actor: Usuario, target_role_code: str) -> bool:
        if cls.is_superadmin(actor):
            return True
        if "admin_sede" in (cls.runtime_role_codes(actor) or cls.role_codes(actor)):
            return target_role_code in {"guarda", "aprendiz"}
        return False

    @classmethod
    def default_role_for_user(cls, user: Usuario) -> str:
        """
        Returns the effective role code for login compatibility from memberships.
        """
        if not user:
            return ""
        roles = cls.role_codes(user)
        for role_code in ("superadmin", "admin_sede", "guarda", "aprendiz"):
            if role_code in roles:
                return role_code
        return ""

    @classmethod
    def resolve_login_role(cls, user: Usuario, expected_role: str | None) -> str:
        if not user or not getattr(user, "is_authenticated", False):
            return ""
        available_roles = cls.role_codes(user)
        requested = cls._normalize_role_code(expected_role)
        if not requested:
            return cls.default_role_for_user(user)
        if requested == cls.ADMIN_SEDE_CODE:
            if cls.SUPERADMIN_CODE in available_roles:
                return cls.SUPERADMIN_CODE
            if cls.ADMIN_SEDE_CODE in available_roles:
                return cls.ADMIN_SEDE_CODE
            return ""
        return requested if requested in available_roles else ""
