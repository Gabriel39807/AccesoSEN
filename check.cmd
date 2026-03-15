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

echo [4/10] Backend: production deploy check
set DJANGO_ENV=production
set DJANGO_SECRET_KEY=this-is-a-ci-only-secret-key-with-more-than-fifty-characters-123456789
set DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
set DATABASE_ENGINE=django.db.backends.sqlite3
set CACHE_BACKEND=database
set WEBAUTHN_MOCK=false
set SECURE_SSL_REDIRECT=true
set SESSION_COOKIE_SECURE=true
set CSRF_COOKIE_SECURE=true
.\.venv\Scripts\python.exe -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','accesosen_api.settings'); import django; django.setup(); from django.core.management import call_command; call_command('check', deploy=True, fail_level='WARNING')"
if errorlevel 1 (
  popd
  exit /b 1
)

echo [5/10] Backend: tests + coverage
set DJANGO_ENV=test
if "%TEST_DATABASE_NAME%"=="" set TEST_DATABASE_NAME=sadi_backend_test_%RANDOM%
.\.venv\Scripts\python.exe -m pytest --create-db --cov=accesos --cov-report=term-missing --cov-fail-under=30
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [6/10] Web: lint
pushd apps\web
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [7/10] Web: typecheck
pushd apps\web
call npm run typecheck
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [8/10] Web: build
pushd apps\web
call npm run build
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [9/11] Mobile: lint
pushd apps\mobile-rn
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [10/11] Mobile: typecheck
pushd apps\mobile-rn
call npm run typecheck
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [11/11] Mobile: smoke tests
pushd apps\mobile-rn
call npm run test:smoke
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo CHECK_OK
exit /b 0
