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

echo "[4/9] Backend: tests + coverage"
(
  cd services/api
  ./.venv/Scripts/python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30
)

echo "[5/9] Web: lint"
(
  cd apps/web
  npm run lint
)

echo "[6/9] Web: typecheck"
(
  cd apps/web
  npm run typecheck
)

echo "[7/9] Web: build"
(
  cd apps/web
  npm run build
)

echo "[8/9] Mobile: lint"
(
  cd apps/mobile-rn
  npm run lint
)

echo "[9/9] Mobile: typecheck"
(
  cd apps/mobile-rn
  npm run typecheck
)

echo "CHECK_OK"
