from __future__ import annotations

import re
from dataclasses import dataclass

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from openpyxl import load_workbook
from rest_framework import status

from accesos.domain.services.email_domain_service import EmailDomainService
from .error_codes import ErrorCode
from .models import AprendizImportAudit, Role, Sede, UserMembership, Usuario

EXPECTED_COLUMNS = [
    "Nombres",
    "Apellidos",
    "Documento",
    "Telefono",
    "Correo",
    "Jornada",
    "Programa",
    "Sede",
]

PHONE_10_RE = re.compile(r"^\d{10}$")
DOCUMENT_6_TO_10_RE = re.compile(r"^\d{6,10}$")

MORNING_CODE = "MAÃ‘ANA"
VALID_JORNADAS = {MORNING_CODE, "TARDE", "NOCHE"}
JORNADA_ALIASES = {
    "MAÑANA": MORNING_CODE,
    "MANANA": MORNING_CODE,
    "MANAÑA": MORNING_CODE,
    MORNING_CODE: MORNING_CODE,
    "TARDE": "TARDE",
    "NOCHE": "NOCHE",
}


@dataclass
class ImportValidationResult:
    rows: list[dict]
    errors: list[dict]


@dataclass
class ImportExecutionResult:
    created_count: int
    updated_count: int
    errors_count: int
    total_rows: int


class ImportServiceError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        detail: dict | None = None,
        field: str | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail
        self.field = field


def _normalize_cell(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_valid_email(email: str) -> bool:
    clean = email.lower().strip()
    try:
        validate_email(clean)
    except DjangoValidationError:
        return False
    return True


def _normalize_phone(phone: str) -> str:
    return str(phone or "").strip()


def _normalize_sede_token(value: str) -> str:
    return str(value or "").strip().lower().replace("_", "-").replace(" ", "-")


def _build_sede_lookup() -> dict[str, str]:
    out: dict[str, str] = {}
    for sede in Sede.objects.filter(is_active=True).only("code", "name"):
        out[_normalize_sede_token(sede.code)] = sede.code
        out[_normalize_sede_token(sede.name)] = sede.code
    return out


def _normalize_jornada(value: str) -> str:
    raw = _normalize_cell(value).upper()
    return JORNADA_ALIASES.get(raw, raw)


def _role_display_name(code: str) -> str:
    names = {
        Usuario.Rol.SUPERADMIN: "Superadmin",
        Usuario.Rol.ADMIN_SEDE: "Admin de sede",
        Usuario.Rol.GUARDA: "Guarda",
        Usuario.Rol.APRENDIZ: "Aprendiz",
    }
    return names.get(code, code)


def _sync_primary_membership_for_user(user: Usuario):
    role_code = str(getattr(user, "rol", "") or "").strip()
    if not role_code:
        return

    role_obj, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": _role_display_name(role_code), "is_system": True},
    )
    target_sede = None if role_code == Usuario.Rol.SUPERADMIN else getattr(user, "sede_principal", None)

    UserMembership.objects.filter(user=user, is_primary=True).update(is_primary=False)
    membership, created = UserMembership.objects.get_or_create(
        user=user,
        role=role_obj,
        sede=target_sede,
        defaults={"is_primary": True, "is_active": True, "can_switch_sede": False},
    )
    if not created:
        updates: list[str] = []
        if not membership.is_primary:
            membership.is_primary = True
            updates.append("is_primary")
        if not membership.is_active:
            membership.is_active = True
            updates.append("is_active")
        if updates:
            membership.save(update_fields=updates)


def validate_excel(content) -> ImportValidationResult:
    wb = load_workbook(filename=content, read_only=True, data_only=True)
    ws = wb.active

    headers = [_normalize_cell(v) for v in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    if headers != EXPECTED_COLUMNS:
        return ImportValidationResult(
            rows=[],
            errors=[
                {
                    "row": 1,
                    "code": "INVALID_COLUMNS",
                    "message": "Las columnas del Excel no coinciden con la estructura requerida.",
                    "expected": EXPECTED_COLUMNS,
                    "received": headers,
                }
            ],
        )

    sedes_lookup = _build_sede_lookup()
    sedes_by_code = {s.code: s for s in Sede.objects.filter(is_active=True).only("id", "code", "name")}
    if not sedes_lookup:
        return ImportValidationResult(
            rows=[],
            errors=[
                {
                    "row": 1,
                    "code": "NO_ACTIVE_SEDES",
                    "message": "No hay sedes activas configuradas en el sistema.",
                    "field": "Sede",
                }
            ],
        )

    rows: list[dict] = []
    errors: list[dict] = []
    seen_docs: set[str] = set()

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        data = {EXPECTED_COLUMNS[i]: _normalize_cell(row[i] if i < len(row) else "") for i in range(len(EXPECTED_COLUMNS))}
        missing = [k for k, v in data.items() if not v]
        if missing:
            errors.append({"row": idx, "code": "MISSING_REQUIRED", "message": "Hay campos obligatorios vacios.", "fields": missing})
            continue

        doc = str(data["Documento"] or "").strip()
        if not DOCUMENT_6_TO_10_RE.fullmatch(doc):
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_DOCUMENTO",
                    "message": "El documento debe tener entre 6 y 10 digitos.",
                    "field": "Documento",
                }
            )
            continue

        if doc in seen_docs:
            errors.append({"row": idx, "code": "DUPLICATE_IN_FILE", "message": "Documento duplicado dentro del archivo.", "field": "Documento"})
            continue
        seen_docs.add(doc)

        phone = _normalize_phone(data["Telefono"])
        if not PHONE_10_RE.fullmatch(phone):
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_TELEFONO",
                    "message": "El telefono debe tener exactamente 10 digitos.",
                    "field": "Telefono",
                }
            )
            continue

        email = data["Correo"].lower().strip()
        if not _is_valid_email(email):
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_EMAIL",
                    "message": "El correo no tiene un formato valido.",
                    "field": "Correo",
                }
            )
            continue

        jornada = _normalize_jornada(data["Jornada"])
        if jornada not in VALID_JORNADAS:
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_JORNADA",
                    "message": "Jornada invalida. Valores permitidos: MANANA, TARDE, NOCHE.",
                    "field": "Jornada",
                }
            )
            continue

        sede = sedes_lookup.get(_normalize_sede_token(data["Sede"]))
        if not sede:
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_SEDE",
                    "message": "Sede invalida. Debe coincidir con una sede activa del sistema.",
                    "field": "Sede",
                }
            )
            continue

        domain_check = EmailDomainService.validate(
            email=email,
            role_code="aprendiz",
            sede=sedes_by_code.get(sede),
        )
        if not domain_check.allowed:
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_EMAIL_DOMAIN",
                    "message": domain_check.message or "El dominio del correo no esta permitido para esta sede.",
                    "field": "Correo",
                }
            )
            continue

        rows.append(
            {
                "first_name": data["Nombres"],
                "last_name": data["Apellidos"],
                "documento": doc,
                "telefono": phone,
                "email": email,
                "jornada": jornada,
                "programa_formacion": data["Programa"],
                "sede_principal": sede,
            }
        )

    return ImportValidationResult(rows=rows, errors=errors)


def cache_import_payload(import_id: str, user_id: int, rows: list[dict], errors: list[dict], ttl_sec: int = 15 * 60):
    cache.set(f"sadi:import:{import_id}", {"user_id": user_id, "rows": rows, "errors": errors}, timeout=ttl_sec)


def get_cached_import_payload(import_id: str):
    return cache.get(f"sadi:import:{import_id}")


def execute_aprendices_import(
    *,
    rows: list[dict],
    imported_by: Usuario,
    errors: list[dict] | None = None,
) -> ImportExecutionResult:
    created_count = 0
    updated_count = 0
    errors = errors or []

    try:
        with transaction.atomic():
            sedes_by_code = {
                s.code: s for s in Sede.objects.filter(code__in=[str(r.get("sede_principal", "")).strip() for r in rows])
            }

            for idx, row in enumerate(rows, start=2):
                sede_code = str(row.get("sede_principal", "")).strip()
                sede_obj = sedes_by_code.get(sede_code)
                if not sede_obj:
                    raise ImportServiceError(
                        code=ErrorCode.VALIDATION_ERROR,
                        message="Una o mas filas del archivo tienen sede invalida.",
                        field="sede_principal",
                        detail={"row": idx, "sede_principal": sede_code},
                    )

                user = Usuario.objects.filter(documento=row["documento"]).first()
                if user:
                    user.first_name = row["first_name"]
                    user.last_name = row["last_name"]
                    user.email = row["email"]
                    user.telefono = row["telefono"]
                    user.sede_principal = sede_obj
                    user.jornada = row["jornada"]
                    user.programa_formacion = row["programa_formacion"]
                    user.rol = Usuario.Rol.APRENDIZ
                    user.save(
                        update_fields=[
                            "first_name",
                            "last_name",
                            "email",
                            "telefono",
                            "sede_principal",
                            "jornada",
                            "programa_formacion",
                            "rol",
                        ]
                    )
                    _sync_primary_membership_for_user(user)
                    updated_count += 1
                else:
                    created = Usuario.objects.create(
                        username=row["documento"],
                        first_name=row["first_name"],
                        last_name=row["last_name"],
                        email=row["email"],
                        telefono=row["telefono"],
                        documento=row["documento"],
                        sede_principal=sede_obj,
                        jornada=row["jornada"],
                        programa_formacion=row["programa_formacion"],
                        rol=Usuario.Rol.APRENDIZ,
                        estado=Usuario.Estado.ACTIVO,
                        must_change_password=True,
                    )
                    doc = str(row["documento"] or "").strip()
                    initial_password = doc[-6:] if len(doc) >= 6 else doc[-4:] if len(doc) >= 4 else doc
                    created.set_password(initial_password)
                    created.save(update_fields=["password"])
                    _sync_primary_membership_for_user(created)
                    created_count += 1

            AprendizImportAudit.objects.create(
                imported_by=imported_by,
                total_rows=len(rows) + len(errors),
                created_count=created_count,
                updated_count=updated_count,
                errors_count=len(errors),
            )

        return ImportExecutionResult(
            created_count=created_count,
            updated_count=updated_count,
            errors_count=len(errors),
            total_rows=len(rows) + len(errors),
        )
    except ImportServiceError:
        raise
    except Exception as exc:
        raise ImportServiceError(
            code=ErrorCode.SERVER_ERROR,
            message="No se pudo completar la importacion masiva. Intenta nuevamente.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"reason": "unexpected_error"},
        ) from exc
