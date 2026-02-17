#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Backend: django check"
(
  cd services/api
  ./.venv/Scripts/python.exe manage.py check
)

echo "[2/4] Backend: tests"
(
  cd services/api
  ./.venv/Scripts/python.exe manage.py test accesos
)

echo "[3/4] Web: lint"
(
  cd apps/web
  npm run lint -- --rule "@typescript-eslint/no-explicit-any: off"
)

echo "[4/4] Mobile: lint"
(
  cd apps/mobile-rn
  npm run lint
)

echo "CHECK_OK"
