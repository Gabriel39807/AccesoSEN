from __future__ import annotations

import re
from dataclasses import dataclass

from django.core.cache import cache
from openpyxl import load_workbook

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

VALID_JORNADAS = {"MANANA", "TARDE", "NOCHE"}
VALID_SEDES = {"CEGAFE", "SANTA_CLARA", "ITEDRIS", "GASTRONOMIA"}


@dataclass
class ImportValidationResult:
    rows: list[dict]
    errors: list[dict]


def _normalize_cell(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _is_institutional_email(email: str) -> bool:
    email = email.lower().strip()
    return bool(re.match(r"^[^@\s]+@(([a-z0-9-]+\.)*sena\.edu\.co|gmail\.com)$", email))


def _normalize_phone(phone: str) -> str:
    return re.sub(r"[^\d+]", "", phone)


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

    rows: list[dict] = []
    errors: list[dict] = []
    seen_docs: set[str] = set()

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        data = {EXPECTED_COLUMNS[i]: _normalize_cell(row[i] if i < len(row) else "") for i in range(len(EXPECTED_COLUMNS))}
        missing = [k for k, v in data.items() if not v]
        if missing:
            errors.append({"row": idx, "code": "MISSING_REQUIRED", "message": "Hay campos obligatorios vacíos.", "fields": missing})
            continue

        doc = data["Documento"]
        if doc in seen_docs:
            errors.append({"row": idx, "code": "DUPLICATE_IN_FILE", "message": "Documento duplicado dentro del archivo.", "field": "Documento"})
            continue
        seen_docs.add(doc)

        email = data["Correo"].lower()
        if not _is_institutional_email(email):
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_INSTITUTIONAL_EMAIL",
                    "message": "El correo debe ser institucional (sena.edu.co) o gmail.com.",
                    "field": "Correo",
                }
            )
            continue

        jornada = data["Jornada"].upper()
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

        sede = data["Sede"].upper().replace(" ", "_")
        if sede not in VALID_SEDES:
            errors.append(
                {
                    "row": idx,
                    "code": "INVALID_SEDE",
                    "message": "Sede invalida. Debe coincidir con las sedes configuradas.",
                    "field": "Sede",
                }
            )
            continue

        rows.append(
            {
                "first_name": data["Nombres"],
                "last_name": data["Apellidos"],
                "documento": doc,
                "telefono": _normalize_phone(data["Telefono"]),
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
