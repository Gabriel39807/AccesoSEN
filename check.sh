#!/usr/bin/env bash
set -euo pipefail

echo "[1/5] Backend: django check"
(
  cd services/api
  ./.venv/Scripts/python.exe manage.py check
)

echo "[2/5] Backend: tests + coverage"
(
  cd services/api
  ./.venv/Scripts/python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30
)

echo "[3/5] Web: lint"
(
  cd apps/web
  npm run lint -- --rule "@typescript-eslint/no-explicit-any: off"
)

echo "[4/5] Web: build"
(
  cd apps/web
  npm run build
)

echo "[5/5] Mobile: lint"
(
  cd apps/mobile-rn
  npm run lint
)

echo "CHECK_OK"
