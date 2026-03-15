"""Test settings for deterministic and safe local execution.

Responsibility:
- Use explicit PostgreSQL test settings when the caller provides them.
- Avoid accidental reuse of remote production-like databases from local `.env`.
- Fall back to isolated SQLite for local runs when no test DB is configured.
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
TEST_DATABASE_NAME = str(os.getenv("TEST_DATABASE_NAME", "") or "").strip()
TEST_DATABASE_USER = str(os.getenv("TEST_DATABASE_USER", "") or "").strip()
TEST_DATABASE_PASSWORD = str(os.getenv("TEST_DATABASE_PASSWORD", "") or "").strip()
TEST_DATABASE_HOST = str(os.getenv("TEST_DATABASE_HOST", "") or "").strip()
TEST_DATABASE_PORT = str(os.getenv("TEST_DATABASE_PORT", "") or "").strip()
TEST_DATABASE_SSLMODE = str(os.getenv("TEST_DATABASE_SSLMODE", "prefer") or "prefer").strip() or "prefer"


def _has_explicit_postgres_test_config() -> bool:
    return all((TEST_DATABASE_NAME, TEST_DATABASE_USER, TEST_DATABASE_PASSWORD, TEST_DATABASE_HOST, TEST_DATABASE_PORT))

if TEST_DATABASE_URL:
    db = _parse_postgres_database_url(TEST_DATABASE_URL)  # noqa: F405
    test_db_name = TEST_DATABASE_NAME or f"{db['NAME']}_test"
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
elif _has_explicit_postgres_test_config():
    base_name = TEST_DATABASE_NAME
    test_db_name = f"{base_name}_test"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": base_name,
            "USER": TEST_DATABASE_USER,
            "PASSWORD": TEST_DATABASE_PASSWORD,
            "HOST": TEST_DATABASE_HOST,
            "PORT": TEST_DATABASE_PORT,
            "OPTIONS": {
                "sslmode": TEST_DATABASE_SSLMODE,
            },
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,
            "TEST": {
                "NAME": test_db_name,
            },
        }
    }
else:
    sqlite_test_name = TEST_DATABASE_NAME or "sadi_backend_test"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / f"{sqlite_test_name}.sqlite3",  # noqa: F405
        }
    }

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sadi-tests-cache",
    }
}
