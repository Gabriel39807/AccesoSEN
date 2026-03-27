from __future__ import annotations

from .base import *  # noqa: F401,F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://192.168.80.15:8081",
    "http://192.168.1.2:8081",
    "http://10.217.195.70:8081",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.80.15:8081",
    "http://192.168.1.2:8081",
    "http://10.217.195.70:8081",
]

WEBAUTHN_MOCK = True

