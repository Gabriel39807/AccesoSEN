from __future__ import annotations

import re
from dataclasses import dataclass

from django.conf import settings

from accesos.error_codes import ErrorCode
from accesos.models import AllowedEmailDomain, Role, Sede


@dataclass(frozen=True)
class DomainPolicyResult:
    allowed: bool
    code: str | None = None
    message: str | None = None
    matched_scope: str | None = None


class DomainPolicyService:
    """
    Global email-domain policy resolver for the whole product.

    Precedence:
    1) role + sede
    2) role
    3) sede
    4) global

    Default behavior:
    - If there are no active rules in the system: allow all domains.
    - If there is at least one active rule and context has no matching rule set:
      deny by default (fail closed).
    """

    DOMAIN_RE = re.compile(
        r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
    )

    @classmethod
    def normalize_role_code(cls, role_code: str | None) -> str | None:
        raw = str(role_code or "").strip().lower()
        if not raw:
            return None
        if raw == "admin":
            return "admin_sede"
        return raw

    @classmethod
    def normalize_domain(cls, value: str) -> str:
        raw = str(value or "").strip().lower()
        if "@" in raw:
            raw = raw.split("@")[-1]
        return raw.replace("@", "").strip()

    @classmethod
    def extract_email_domain(cls, email: str) -> str:
        return cls.normalize_domain(email)

    @classmethod
    def validate_domain_format(cls, domain: str) -> bool:
        return bool(cls.DOMAIN_RE.fullmatch(cls.normalize_domain(domain)))

    @classmethod
    def _resolve_sede_id(cls, *, sede_id: int | None = None, sede: Sede | None = None) -> int | None:
        if sede_id is not None:
            try:
                return int(sede_id)
            except (TypeError, ValueError):
                return None
        if sede is not None:
            return getattr(sede, "id", None)
        return None

    @classmethod
    def _resolve_role(cls, role_code: str | None) -> Role | None:
        normalized = cls.normalize_role_code(role_code)
        if not normalized:
            return None
        return Role.objects.filter(code=normalized).first()

    @classmethod
    def _is_superadmin_exempt(cls, role_code: str | None) -> bool:
        if not bool(getattr(settings, "DOMAIN_POLICY_EXEMPT_SUPERADMIN", False)):
            return False
        return cls.normalize_role_code(role_code) == "superadmin"

    @classmethod
    def _active_rules_qs(cls):
        return AllowedEmailDomain.objects.filter(is_active=True)

    @classmethod
    def _first_scope_domains(cls, *, role: Role | None, sede_id: int | None) -> tuple[str | None, set[str]]:
        base = cls._active_rules_qs()
        checks: list[tuple[str, set[str]]] = []

        if role is not None and sede_id is not None:
            checks.append(
                (
                    AllowedEmailDomain.Scope.ROLE_SEDE,
                    set(
                        base.filter(role=role, sede_id=sede_id).values_list("domain", flat=True)
                    ),
                )
            )

        if role is not None:
            checks.append(
                (
                    AllowedEmailDomain.Scope.ROLE,
                    set(
                        base.filter(role=role, sede__isnull=True).values_list("domain", flat=True)
                    ),
                )
            )

        if sede_id is not None:
            checks.append(
                (
                    AllowedEmailDomain.Scope.SEDE,
                    set(
                        base.filter(role__isnull=True, sede_id=sede_id).values_list("domain", flat=True)
                    ),
                )
            )

        checks.append(
            (
                AllowedEmailDomain.Scope.GLOBAL,
                set(
                    base.filter(role__isnull=True, sede__isnull=True).values_list("domain", flat=True)
                ),
            )
        )

        for scope, domains in checks:
            if domains:
                return scope, domains
        return None, set()

    @classmethod
    def is_email_allowed(
        cls,
        email: str,
        *,
        role_code: str | None = None,
        sede_id: int | None = None,
    ) -> bool:
        return cls.validate_email(email, role_code=role_code, sede_id=sede_id).allowed

    @classmethod
    def validate_email(
        cls,
        email: str,
        *,
        role_code: str | None = None,
        sede_id: int | None = None,
        sede: Sede | None = None,
    ) -> DomainPolicyResult:
        domain = cls.extract_email_domain(email)
        if not cls.validate_domain_format(domain):
            return DomainPolicyResult(
                allowed=False,
                code=ErrorCode.EMAIL_DOMAIN_NOT_ALLOWED,
                message="El correo no tiene un dominio valido.",
            )

        normalized_role = cls.normalize_role_code(role_code)
        if cls._is_superadmin_exempt(normalized_role):
            return DomainPolicyResult(allowed=True)

        resolved_sede_id = cls._resolve_sede_id(sede_id=sede_id, sede=sede)
        role = cls._resolve_role(normalized_role)
        matched_scope, allowed_domains = cls._first_scope_domains(role=role, sede_id=resolved_sede_id)

        if not allowed_domains:
            if not cls._active_rules_qs().exists():
                # Empty policy: allow all to keep initial setup functional.
                return DomainPolicyResult(allowed=True)
            return DomainPolicyResult(
                allowed=False,
                code=ErrorCode.EMAIL_DOMAIN_NOT_ALLOWED,
                message="No hay dominios permitidos configurados para este contexto.",
            )

        if domain not in allowed_domains:
            return DomainPolicyResult(
                allowed=False,
                code=ErrorCode.EMAIL_DOMAIN_NOT_ALLOWED,
                message=f"El dominio '{domain}' no esta permitido.",
                matched_scope=matched_scope,
            )

        return DomainPolicyResult(allowed=True, matched_scope=matched_scope)


@dataclass(frozen=True)
class EmailDomainValidationResult:
    allowed: bool
    message: str | None = None
    code: str | None = None
    matched_scope: str | None = None


class EmailDomainService:
    """
    Backward-compatible facade used by existing code paths.
    """

    @classmethod
    def normalize_domain(cls, email: str) -> str:
        return DomainPolicyService.extract_email_domain(email)

    @classmethod
    def validate(
        cls,
        *,
        email: str,
        role_code: str | None,
        sede: Sede | None,
    ) -> EmailDomainValidationResult:
        result = DomainPolicyService.validate_email(
            email=email,
            role_code=role_code,
            sede=sede,
        )
        return EmailDomainValidationResult(
            allowed=result.allowed,
            message=result.message,
            code=result.code,
            matched_scope=result.matched_scope,
        )
