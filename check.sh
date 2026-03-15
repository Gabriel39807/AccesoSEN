#!/usr/bin/env bash
set -euo pipefail

echo "[1/9] Backend: ruff lint"
(
  cd services/api
  ./.venv/Scripts/python.exe -m ruff check accesos accesosen_api
)

echo "[2/9] Backend: black format check"
(
  cd services/api
  ./.venv/Scripts/python.exe -m black --check accesos/auth_jwt.py accesos/jwt_views.py accesos/rate_limit.py accesos/otp_services.py
)

echo "[3/9] Backend: django check"
(
  cd services/api
  ./.venv/Scripts/python.exe manage.py check
)

echo "[4/10] Backend: production deploy check"
(
  cd services/api
  export DJANGO_ENV=production
  export DJANGO_SECRET_KEY=this-is-a-ci-only-secret-key-with-more-than-fifty-characters-123456789
  export DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
  export DATABASE_ENGINE=django.db.backends.sqlite3
  export CACHE_BACKEND=database
  export WEBAUTHN_MOCK=false
  export SECURE_SSL_REDIRECT=true
  export SESSION_COOKIE_SECURE=true
  export CSRF_COOKIE_SECURE=true
  ./.venv/Scripts/python.exe -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','accesosen_api.settings'); import django; django.setup(); from django.core.management import call_command; call_command('check', deploy=True, fail_level='WARNING')"
)

echo "[5/10] Backend: tests + coverage"
(
  cd services/api
  export DJANGO_ENV=test
  export TEST_DATABASE_NAME="${TEST_DATABASE_NAME:-sadi_backend_test_$$}"
  ./.venv/Scripts/python.exe -m pytest --create-db --cov=accesos --cov-report=term-missing --cov-fail-under=30
)

echo "[6/10] Web: lint"
(
  cd apps/web
  npm run lint
)

echo "[7/10] Web: typecheck"
(
  cd apps/web
  npm run typecheck
)

echo "[8/10] Web: build"
(
  cd apps/web
  npm run build
)

echo "[9/11] Mobile: lint"
(
  cd apps/mobile-rn
  npm run lint
)

echo "[10/11] Mobile: typecheck"
(
  cd apps/mobile-rn
  npm run typecheck
)

echo "[11/11] Mobile: smoke tests"
(
  cd apps/mobile-rn
  npm run test:smoke
)

echo "CHECK_OK"
