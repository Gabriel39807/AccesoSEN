from __future__ import annotations

import re
from dataclasses import dataclass

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from openpyxl import load_workbook

from .models import Sede

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
