@echo off
setlocal

echo [1/9] Backend: ruff lint
pushd services\api
.\.venv\Scripts\python.exe -m ruff check accesos accesosen_api
if errorlevel 1 (
  popd
  exit /b 1
)

echo [2/9] Backend: black format check
.\.venv\Scripts\python.exe -m black --check accesos/auth_jwt.py accesos/jwt_views.py accesos/rate_limit.py accesos/otp_services.py
if errorlevel 1 (
  popd
  exit /b 1
)

echo [3/9] Backend: django check
.\.venv\Scripts\python.exe manage.py check
if errorlevel 1 (
  popd
  exit /b 1
)

echo [4/9] Backend: tests + coverage
.\.venv\Scripts\python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [5/9] Web: lint
pushd apps\web
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [6/9] Web: typecheck
pushd apps\web
call npm run typecheck
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [7/9] Web: build
pushd apps\web
call npm run build
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [8/9] Mobile: lint
pushd apps\mobile-rn
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [9/9] Mobile: typecheck
pushd apps\mobile-rn
call npm run typecheck
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo CHECK_OK
exit /b 0
