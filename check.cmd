@echo off
setlocal

echo [1/4] Backend: django check
pushd services\api
.\.venv\Scripts\python.exe manage.py check
if errorlevel 1 (
  popd
  exit /b 1
)

echo [2/4] Backend: tests
.\.venv\Scripts\python.exe manage.py test accesos
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [3/4] Web: lint
pushd apps\web
call npm run lint -- --rule "@typescript-eslint/no-explicit-any: off"
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo [4/4] Mobile: lint
pushd apps\mobile-rn
call npm run lint
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo CHECK_OK
exit /b 0
