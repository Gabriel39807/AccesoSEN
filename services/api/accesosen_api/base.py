"""Base settings for S.A.D.I backend.

Responsibility:
- Define shared configuration between development/production.
- Load environment variables securely.
- Keep non-sensitive defaults and require secrets by environment.
"""

from __future__ import annotations

import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
CURRENT_DJANGO_ENV = os.getenv("DJANGO_ENV", "development").strip().lower()

# Load local .env first when present.
load_dotenv(BASE_DIR / ".env")
load_dotenv()


def env_bool(name: str, default: bool = False) -> bool:
    """Read a boolean environment variable.

    Args:
        name: Environment variable name.
        default: Default value when variable is missing.

    Returns:
        bool: Parsed boolean value.
    """
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: list[str] | None = None) -> list[str]:
    """Read a comma-separated environment variable as list."""
    raw = os.getenv(name, "")
    if not raw:
        return default or []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _build_cache_config() -> dict:
    """Build cache backend settings.

    Uses Redis when REDIS_URL is configured; otherwise falls back to LocMem for
    local development/test.
    """
    redis_url = str(os.getenv("REDIS_URL", "") or "").strip()
    if redis_url:
        return {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": redis_url,
            "TIMEOUT": int(os.getenv("CACHE_DEFAULT_TIMEOUT", "300")),
            "KEY_PREFIX": os.getenv("CACHE_KEY_PREFIX", "sadi"),
        }
    return {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sadi-cache",
    }


def enforce_production_security_guards(*, django_env: str, cache_backend: str, webauthn_mock: bool):
    """Fail fast on insecure production runtime settings."""
    env_name = str(django_env or "").strip().lower()
    backend = str(cache_backend or "").strip()
    if env_name == "production" and backend.endswith("LocMemCache"):
        raise ImproperlyConfigured(
            "Unsafe cache backend for production: LocMemCache is not allowed. Configure REDIS_URL."
        )
    if env_name == "production" and webauthn_mock:
        raise ImproperlyConfigured(
            "Unsafe WebAuthn setting for production: WEBAUTHN_MOCK must be false."
        )


def env_required(name: str, *, allow_generated_for_dev: bool = False) -> str:
    """Read a required environment variable.

    Args:
        name: Required variable name.
        allow_generated_for_dev: If True, generate an ephemeral value on
            non-production environments to keep local checks running.

    Returns:
        str: Non-empty environment value.

    Raises:
        ImproperlyConfigured: If value is missing/empty and cannot be generated.
    """
    value = os.getenv(name)
    if value is None:
        if allow_generated_for_dev and CURRENT_DJANGO_ENV != "production":
            # Ephemeral key for non-production environments.
            return secrets.token_urlsafe(64)
        raise ImproperlyConfigured(f"Missing required environment variable: {name}")
    clean = value.strip()
    if not clean:
        if allow_generated_for_dev and CURRENT_DJANGO_ENV != "production":
            return secrets.token_urlsafe(64)
        raise ImproperlyConfigured(f"Environment variable cannot be empty: {name}")
    return clean


SECRET_KEY = env_required("DJANGO_SECRET_KEY", allow_generated_for_dev=True)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "accesos",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "accesos.logging_middleware.RequestLogMiddleware",
]

ROOT_URLCONF = "accesosen_api.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "accesos" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "accesosen_api.wsgi.application"
ASGI_APPLICATION = "accesosen_api.asgi.application"


# Database
# Para PostgreSQL se exigen credenciales por entorno (sin hardcodes de secretos).
DATABASE_ENGINE = os.getenv("DATABASE_ENGINE", "django.db.backends.sqlite3")
if DATABASE_ENGINE == "django.db.backends.postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env_required("DATABASE_NAME"),
            "USER": env_required("DATABASE_USER"),
            "PASSWORD": env_required("DATABASE_PASSWORD"),
            "HOST": env_required("DATABASE_HOST"),
            "PORT": env_required("DATABASE_PORT"),
            "CONN_MAX_AGE": int(os.getenv("DATABASE_CONN_MAX_AGE", "60")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_USER_MODEL = "accesos.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = os.getenv("DJANGO_TIMEZONE", "America/Bogota")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("accesos.auth_jwt.SadiJWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "accesos.pagination.SafePageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "accesos.exceptions.ui_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": env_bool("JWT_ROTATE_REFRESH_TOKENS", True),
    "BLACKLIST_AFTER_ROTATION": env_bool("JWT_BLACKLIST_AFTER_ROTATION", True),
    "UPDATE_LAST_LOGIN": env_bool("JWT_UPDATE_LAST_LOGIN", True),
}
REFRESH_TOKEN_PEPPER = str(os.getenv("REFRESH_TOKEN_PEPPER", "") or SECRET_KEY).strip()
GUARDA_SINGLE_ACTIVE_SESSION = env_bool("GUARDA_SINGLE_ACTIVE_SESSION", True)
DOMAIN_POLICY_EXEMPT_SUPERADMIN = env_bool("DOMAIN_POLICY_EXEMPT_SUPERADMIN", False)

CACHES = {"default": _build_cache_config()}

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@sadi.local")

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
)
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)

DEFAULT_SUPERADMIN_USERNAME = os.getenv("DEFAULT_SUPERADMIN_USERNAME", "superadmin")
DEFAULT_SUPERADMIN_EMAIL = os.getenv("DEFAULT_SUPERADMIN_EMAIL", "superadmin@sadi.local")
DEFAULT_SUPERADMIN_AUTO_CREATE = env_bool("DEFAULT_SUPERADMIN_AUTO_CREATE", False)
DEFAULT_SUPERADMIN_PASSWORD = os.getenv("DEFAULT_SUPERADMIN_PASSWORD", "").strip()
if DEFAULT_SUPERADMIN_AUTO_CREATE and not DEFAULT_SUPERADMIN_PASSWORD:
    raise ImproperlyConfigured(
        "DEFAULT_SUPERADMIN_PASSWORD is required when DEFAULT_SUPERADMIN_AUTO_CREATE=true."
    )

WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "SADI")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:3000")
WEBAUTHN_MOCK = env_bool("WEBAUTHN_MOCK", True)

enforce_production_security_guards(
    django_env=CURRENT_DJANGO_ENV,
    cache_backend=CACHES["default"]["BACKEND"],
    webauthn_mock=WEBAUTHN_MOCK,
)

# Security defaults; production overrides these to hardened values.
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False

LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO").upper()
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}
