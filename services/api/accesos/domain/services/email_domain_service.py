from __future__ import annotations

from dataclasses import dataclass

from accesos.models import AllowedEmailDomain, Role, Sede


@dataclass(frozen=True)
class EmailDomainValidationResult:
    allowed: bool
    message: str | None = None


class EmailDomainService:
    """
    Validates allowed email domains by (role, sede) with precedence:
    1. role + sede specific
    2. role + global (sede is null)
    3. deny by default
    """

    @classmethod
    def normalize_domain(cls, email: str) -> str:
        return str(email or "").strip().lower().split("@")[-1].replace("@", "")

    @classmethod
    def _active_domains(cls, role_code: str, sede: Sede | None) -> set[str]:
        if role_code == "admin":
            role_code = "admin_sede"
        role = Role.objects.filter(code=role_code).first()
        if not role:
            return set()

        if sede is not None:
            specific = set(
                AllowedEmailDomain.objects.filter(
                    role=role,
                    sede=sede,
                    is_active=True,
                ).values_list("domain", flat=True)
            )
            if specific:
                return specific

        return set(
            AllowedEmailDomain.objects.filter(
                role=role,
                sede__isnull=True,
                is_active=True,
            ).values_list("domain", flat=True)
        )

    @classmethod
    def validate(cls, *, email: str, role_code: str, sede: Sede | None) -> EmailDomainValidationResult:
        domain = cls.normalize_domain(email)
        if not domain:
            return EmailDomainValidationResult(allowed=False, message="El correo no tiene un dominio valido.")

        allowed_domains = cls._active_domains(role_code=role_code, sede=sede)
        if not allowed_domains:
            return EmailDomainValidationResult(
                allowed=False,
                message="No hay dominios permitidos configurados para este rol/sede.",
            )

        if domain not in allowed_domains:
            return EmailDomainValidationResult(
                allowed=False,
                message=f"El dominio '{domain}' no esta permitido para este rol/sede.",
            )
        return EmailDomainValidationResult(allowed=True)
