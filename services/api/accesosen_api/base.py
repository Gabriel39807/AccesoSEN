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
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
CURRENT_DJANGO_ENV = os.getenv("DJANGO_ENV", "development").strip().lower()

# Load base env and then allow a local override for demo/dev machines.
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)
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


def env_int(name: str, default: int, *, min_value: int | None = None) -> int:
    raw = str(os.getenv(name, str(default)) or "").strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    if min_value is not None:
        value = max(min_value, value)
    return value


def _parse_postgres_database_url(url: str) -> dict[str, object]:
    """Parse PostgreSQL DATABASE_URL into Django DB settings parts.

    Supported schemes:
    - postgresql://
    - postgres://
    """
    parsed = urlparse(url)
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise ImproperlyConfigured("DATABASE_URL must use postgres/postgresql scheme.")

    name = (parsed.path or "").lstrip("/")
    if not name:
        raise ImproperlyConfigured("DATABASE_URL must include database name in path.")

    query = parse_qs(parsed.query or "")
    sslmode = (query.get("sslmode") or [None])[0]
    pgbouncer_raw = str((query.get("pgbouncer") or ["false"])[0]).strip().lower()

    return {
        "NAME": unquote(name),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "SSLMODE": str(sslmode or "").strip(),
        "PGBOUNCER": pgbouncer_raw in {"1", "true", "yes", "on"},
    }


def _validate_runtime_database_guard(
    *,
    django_env: str,
    host: str,
    port: str,
    use_pgbouncer: bool,
):
    """Fail fast for known unsafe production DB pooler configurations."""
    env_name = str(django_env or "").strip().lower()
    if env_name != "production":
        return

    host_value = str(host or "").strip().lower()
    port_value = str(port or "").strip()

    # Supabase pooler on 5432 is session mode and may exhaust clients under API load.
    if host_value.endswith(".pooler.supabase.com") and port_value == "5432":
        raise ImproperlyConfigured(
            "Unsafe DATABASE configuration for production: Supabase pooler host on port 5432 "
            "uses session mode and can exhaust clients. Use port 6543 with pgbouncer=true."
        )

    if use_pgbouncer and not port_value:
        raise ImproperlyConfigured("DATABASE port is required when DATABASE_USE_PGBOUNCER=true.")


def _build_cache_config() -> dict:
    """Build cache backend settings.

    Priority:
    1) Explicit CACHE_BACKEND=redis/database/locmem.
    2) REDIS_URL when present.
    3) Optional database-backed cache fallback on PostgreSQL.
    4) LocMem for local-only development/test.
    """
    selected_backend = str(os.getenv("CACHE_BACKEND", "auto") or "auto").strip().lower()
    redis_url = str(os.getenv("REDIS_URL", "") or "").strip()
    timeout = int(os.getenv("CACHE_DEFAULT_TIMEOUT", "300"))
    key_prefix = os.getenv("CACHE_KEY_PREFIX", "sadi")
    database_engine = str(os.getenv("DATABASE_ENGINE", "django.db.backends.sqlite3") or "").strip().lower()
    use_database_fallback = env_bool("CACHE_USE_DATABASE_FALLBACK", True)

    if selected_backend == "redis":
        if not redis_url:
            raise ImproperlyConfigured("CACHE_BACKEND=redis requires REDIS_URL.")
        return {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": redis_url,
            "TIMEOUT": timeout,
            "KEY_PREFIX": key_prefix,
        }

    if redis_url and selected_backend in {"auto", "redis"}:
        return {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": redis_url,
            "TIMEOUT": timeout,
            "KEY_PREFIX": key_prefix,
        }

    if selected_backend == "database" or (
        selected_backend == "auto" and use_database_fallback and database_engine == "django.db.backends.postgresql"
    ):
        return {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": os.getenv("CACHE_TABLE", "django_cache"),
            "TIMEOUT": timeout,
            "KEY_PREFIX": key_prefix,
        }

    if selected_backend not in {"auto", "locmem"}:
        raise ImproperlyConfigured("CACHE_BACKEND must be one of: auto, redis, database, locmem.")

    return {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sadi-cache",
    }


def enforce_production_security_guards(
    *,
    django_env: str,
    cache_backend: str,
    webauthn_mock: bool,
    refresh_cookie_secure: bool,
):
    """Fail fast on insecure production runtime settings."""
    env_name = str(django_env or "").strip().lower()
    backend = str(cache_backend or "").strip()
    if env_name == "production" and backend.endswith("LocMemCache"):
        raise ImproperlyConfigured(
            "Unsafe cache backend for production: LocMemCache is not allowed. Configure REDIS_URL."
        )
    if env_name == "production" and webauthn_mock:
        raise ImproperlyConfigured("Unsafe WebAuthn setting for production: WEBAUTHN_MOCK must be false.")
    if env_name == "production" and not refresh_cookie_secure:
        raise ImproperlyConfigured("Unsafe cookie setting for production: AUTH_COOKIE_REFRESH_SECURE must be true.")


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
DATABASE_URL = str(os.getenv("DATABASE_URL", "") or "").strip()
DATABASE_SSLMODE = str(os.getenv("DATABASE_SSLMODE", "require") or "require").strip() or "require"
DATABASE_SQLITE_NAME = str(os.getenv("DATABASE_SQLITE_NAME", "") or "").strip()

if DATABASE_URL:
    db_url = _parse_postgres_database_url(DATABASE_URL)
    db_sslmode = str(db_url.get("SSLMODE") or DATABASE_SSLMODE).strip() or "require"
    db_use_pgbouncer = env_bool("DATABASE_USE_PGBOUNCER", bool(db_url.get("PGBOUNCER")))
    _validate_runtime_database_guard(
        django_env=CURRENT_DJANGO_ENV,
        host=str(db_url.get("HOST") or ""),
        port=str(db_url.get("PORT") or ""),
        use_pgbouncer=db_use_pgbouncer,
    )
    default_conn_max_age = "0" if db_use_pgbouncer else "60"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": str(db_url["NAME"]),
            "USER": str(db_url["USER"]),
            "PASSWORD": str(db_url["PASSWORD"]),
            "HOST": str(db_url["HOST"]),
            "PORT": str(db_url["PORT"]),
            "OPTIONS": {
                "sslmode": db_sslmode,
            },
            "CONN_MAX_AGE": int(os.getenv("DATABASE_CONN_MAX_AGE", default_conn_max_age)),
            "DISABLE_SERVER_SIDE_CURSORS": db_use_pgbouncer,
        }
    }
elif DATABASE_ENGINE == "django.db.backends.postgresql":
    db_use_pgbouncer = env_bool("DATABASE_USE_PGBOUNCER", False)
    db_host = env_required("DATABASE_HOST")
    db_port = env_required("DATABASE_PORT")
    _validate_runtime_database_guard(
        django_env=CURRENT_DJANGO_ENV,
        host=db_host,
        port=db_port,
        use_pgbouncer=db_use_pgbouncer,
    )
    default_conn_max_age = "0" if db_use_pgbouncer else "60"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env_required("DATABASE_NAME"),
            "USER": env_required("DATABASE_USER"),
            "PASSWORD": env_required("DATABASE_PASSWORD"),
            "HOST": db_host,
            "PORT": db_port,
            "OPTIONS": {
                "sslmode": DATABASE_SSLMODE,
            },
            "CONN_MAX_AGE": int(os.getenv("DATABASE_CONN_MAX_AGE", default_conn_max_age)),
            "DISABLE_SERVER_SIDE_CURSORS": db_use_pgbouncer,
        }
    }
else:
    sqlite_name = Path(DATABASE_SQLITE_NAME) if DATABASE_SQLITE_NAME else BASE_DIR / "db.sqlite3"
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": sqlite_name,
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
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON_RATE", "30/minute"),
        "user": os.getenv("THROTTLE_USER_RATE", "120/minute"),
    },
}

# drf_yasg 1.21+ recommends disabling compat renderers to avoid deprecated
# dotted format suffixes in Swagger/Redoc routes.
SWAGGER_USE_COMPAT_RENDERERS = False

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": env_bool("JWT_ROTATE_REFRESH_TOKENS", True),
    "BLACKLIST_AFTER_ROTATION": env_bool("JWT_BLACKLIST_AFTER_ROTATION", True),
    "UPDATE_LAST_LOGIN": env_bool("JWT_UPDATE_LAST_LOGIN", True),
}
REFRESH_TOKEN_PEPPER = str(os.getenv("REFRESH_TOKEN_PEPPER", "") or SECRET_KEY).strip()
AUTH_COOKIE_REFRESH_ENABLED = env_bool("AUTH_COOKIE_REFRESH_ENABLED", True)
AUTH_COOKIE_REFRESH_NAME = (
    str(os.getenv("AUTH_COOKIE_REFRESH_NAME", "sadi_refresh") or "sadi_refresh").strip() or "sadi_refresh"
)
AUTH_COOKIE_REFRESH_PATH = str(os.getenv("AUTH_COOKIE_REFRESH_PATH", "/api/") or "/api/").strip() or "/api/"
AUTH_COOKIE_REFRESH_DOMAIN = str(os.getenv("AUTH_COOKIE_REFRESH_DOMAIN", "") or "").strip() or None
AUTH_COOKIE_REFRESH_HTTPONLY = True
AUTH_COOKIE_REFRESH_SECURE = env_bool(
    "AUTH_COOKIE_REFRESH_SECURE",
    CURRENT_DJANGO_ENV == "production",
)
AUTH_COOKIE_REFRESH_SAMESITE = str(os.getenv("AUTH_COOKIE_REFRESH_SAMESITE", "Lax") or "Lax").strip().title()
if AUTH_COOKIE_REFRESH_SAMESITE not in {"Lax", "Strict", "None"}:
    raise ImproperlyConfigured("AUTH_COOKIE_REFRESH_SAMESITE must be one of: Lax, Strict, None.")
AUTH_COOKIE_REFRESH_LEGACY_BODY = env_bool("AUTH_COOKIE_REFRESH_LEGACY_BODY", True)
GUARDA_SINGLE_ACTIVE_SESSION = env_bool("GUARDA_SINGLE_ACTIVE_SESSION", True)
DOMAIN_POLICY_EXEMPT_SUPERADMIN = env_bool("DOMAIN_POLICY_EXEMPT_SUPERADMIN", False)

GEMINI_ENABLED = env_bool("GEMINI_ENABLED", False)
GEMINI_API_KEY = str(os.getenv("GEMINI_API_KEY", "") or "").strip()
GEMINI_MODEL = str(os.getenv("GEMINI_MODEL", "gemini-2.0-flash") or "gemini-2.0-flash").strip()
GEMINI_TIMEOUT_SEC = env_int("GEMINI_TIMEOUT_SEC", 12, min_value=1)
GEMINI_RETRY_ATTEMPTS = env_int("GEMINI_RETRY_ATTEMPTS", 2, min_value=1)
GEMINI_RETRY_BACKOFF_MS = env_int("GEMINI_RETRY_BACKOFF_MS", 250, min_value=50)
GEMINI_RATE_LIMIT_ATTEMPTS = env_int("GEMINI_RATE_LIMIT_ATTEMPTS", 10, min_value=1)
GEMINI_RATE_LIMIT_WINDOW_SEC = env_int("GEMINI_RATE_LIMIT_WINDOW_SEC", 60, min_value=10)
GEMINI_RATE_LIMIT_LOCK_SEC = env_int("GEMINI_RATE_LIMIT_LOCK_SEC", 60, min_value=10)
if GEMINI_ENABLED and not GEMINI_API_KEY:
    raise ImproperlyConfigured("GEMINI_API_KEY is required when GEMINI_ENABLED=true.")

IDEMPOTENCY_TTL_SEC = env_int("IDEMPOTENCY_TTL_SEC", 600, min_value=60)
IDEMPOTENCY_LOCK_SEC = env_int("IDEMPOTENCY_LOCK_SEC", 30, min_value=5)

CACHES = {"default": _build_cache_config()}

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "no-reply@sadi.local")
EMAIL_TIMEOUT = env_int("EMAIL_TIMEOUT_SEC", 15, min_value=1)
OTP_EMAIL_PROVIDER = str(os.getenv("OTP_EMAIL_PROVIDER", "smtp") or "smtp").strip().lower()
RESEND_API_KEY = str(os.getenv("RESEND_API_KEY", "") or "").strip()
RESEND_API_URL = str(
    os.getenv("RESEND_API_URL", "https://api.resend.com/emails") or "https://api.resend.com/emails"
).strip()
RESEND_USER_AGENT = str(
    os.getenv(
        "RESEND_USER_AGENT",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 SADI-OTP/1.0",
    )
    or ""
).strip()
RESEND_TIMEOUT_SEC = env_int("RESEND_TIMEOUT_SEC", EMAIL_TIMEOUT, min_value=1)

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", True)

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", default=[])

DEFAULT_SUPERADMIN_USERNAME = os.getenv("DEFAULT_SUPERADMIN_USERNAME", "superadmin")
DEFAULT_SUPERADMIN_EMAIL = os.getenv("DEFAULT_SUPERADMIN_EMAIL", "superadmin@sadi.local")
DEFAULT_SUPERADMIN_AUTO_CREATE = env_bool("DEFAULT_SUPERADMIN_AUTO_CREATE", False)
DEFAULT_SUPERADMIN_PASSWORD = os.getenv("DEFAULT_SUPERADMIN_PASSWORD", "").strip()
if DEFAULT_SUPERADMIN_AUTO_CREATE and not DEFAULT_SUPERADMIN_PASSWORD:
    raise ImproperlyConfigured("DEFAULT_SUPERADMIN_PASSWORD is required when DEFAULT_SUPERADMIN_AUTO_CREATE=true.")

WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "SADI")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "")
WEBAUTHN_MOCK = env_bool("WEBAUTHN_MOCK", CURRENT_DJANGO_ENV != "production")

enforce_production_security_guards(
    django_env=CURRENT_DJANGO_ENV,
    cache_backend=CACHES["default"]["BACKEND"],
    webauthn_mock=WEBAUTHN_MOCK,
    refresh_cookie_secure=AUTH_COOKIE_REFRESH_SECURE,
)

# Security defaults; production overrides these to hardened values.
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False

LOG_LEVEL = os.getenv("DJANGO_LOG_LEVEL", "INFO").upper()
APP_RELEASE = str(os.getenv("APP_RELEASE", "") or "").strip() or "local"
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
