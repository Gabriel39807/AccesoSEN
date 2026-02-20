from __future__ import annotations

import os


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None:
        return default
    cleaned = str(value).strip()
    return cleaned or default


INSTITUTION_NAME = _env("INSTITUTION_NAME", "Institucion Demo")
DEFAULT_SEDES_PROFILE = _env("SEDES_PROFILE", "generic").lower()
INSTITUTION_SUPPORT_EMAIL = _env("INSTITUTION_SUPPORT_EMAIL", "soporte@example.com")
