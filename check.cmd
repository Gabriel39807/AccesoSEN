@echo off
setlocal

echo [1/5] Backend: django check
pushd services\api
.\.venv\Scripts\python.exe manage.py check
if errorlevel 1 (
  popd
  exit /b 1
)

echo [2/5] Backend: tests + coverage
.\.venv\Scripts\python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [3/5] Web: lint
pushd apps\web
call npm run lint -- --rule "@typescript-eslint/no-explicit-any: off"
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [4/5] Web: build
pushd apps\web
call npm run build
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [5/5] Mobile: lint
pushd apps\mobile-rn
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo CHECK_OK
exit /b 0
