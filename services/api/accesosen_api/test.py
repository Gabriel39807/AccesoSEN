"""Test settings for deterministic PostgreSQL execution.

Responsibility:
- Force PostgreSQL in tests, independent from local `.env` drift.
- Use explicit test DB naming to avoid collisions with generic defaults.
"""

from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False


def _required(name: str) -> str:
    value = str(os.getenv(name, "") or "").strip()
    if not value:
        raise ImproperlyConfigured(f"Missing required test environment variable: {name}")
    return value


TEST_DATABASE_URL = str(os.getenv("TEST_DATABASE_URL", "") or "").strip()

if TEST_DATABASE_URL:
    db = _parse_postgres_database_url(TEST_DATABASE_URL)  # noqa: F405
    test_db_name = str(os.getenv("TEST_DATABASE_NAME", "") or "").strip() or f"{db['NAME']}_test"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": str(db["NAME"]),
            "USER": str(db["USER"]),
            "PASSWORD": str(db["PASSWORD"]),
            "HOST": str(db["HOST"]),
            "PORT": str(db["PORT"]),
            "OPTIONS": {
                "sslmode": str(db.get("SSLMODE") or "prefer"),
            },
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,
            "TEST": {
                "NAME": test_db_name,
            },
        }
    }
else:
    base_name = _required("DATABASE_NAME")
    test_db_name = str(os.getenv("TEST_DATABASE_NAME", "") or "").strip() or f"{base_name}_test"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": base_name,
            "USER": _required("DATABASE_USER"),
            "PASSWORD": _required("DATABASE_PASSWORD"),
            "HOST": _required("DATABASE_HOST"),
            "PORT": _required("DATABASE_PORT"),
            "OPTIONS": {
                "sslmode": str(os.getenv("DATABASE_SSLMODE", "prefer") or "prefer").strip() or "prefer",
            },
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,
            "TEST": {
                "NAME": test_db_name,
            },
        }
    }

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sadi-tests-cache",
    }
}
