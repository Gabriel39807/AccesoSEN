# Quality Baseline Findings (dev)

## Hallazgos verificados
1. Artefactos binarios versionados:
   - `apps/web/src.zip`
   - `apps/mobile-rn/app.zip`
2. Faltaban comandos de typecheck explícitos:
   - `apps/web/package.json` no tenía `typecheck`
   - `apps/mobile-rn/package.json` no tenía `typecheck`
3. CI no ejecutaba typecheck web/mobile:
   - `.github/workflows/ci.yml`
4. Backend sin baseline de lint/format declarado:
   - faltaban `ruff` y `black` en `services/api/requirements.txt`
   - faltaba configuración central (`services/api/pyproject.toml`)
5. Cobertura de casos borde solicitados incompleta en pruebas:
   - token JWT con `sid` inválido
   - salida sin entrada previa
   - OTP vencido
   - turno con `fin < inicio`
6. Error de lint en web por `setState` en efecto:
   - `apps/web/src/components/GlobalThemeToggle.tsx`

## Cambios aplicados
1. Repo hygiene:
   - removidos del índice git:
     - `apps/web/src.zip`
     - `apps/mobile-rn/app.zip`
   - guía de limpieza histórica:
     - `docs/repo-history-cleanup.md`
2. Backend quality:
   - agregado `ruff` y `black` en `services/api/requirements.txt`
   - agregado `services/api/pyproject.toml`
   - nuevas pruebas en `services/api/accesos/tests.py`:
     - `test_verify_rejects_expired_otp`
     - `test_register_salida_without_ingreso_previo_is_rejected`
     - `test_access_token_with_invalid_sid_is_rejected`
     - `test_turno_fin_before_inicio_fails_db_constraint`
3. CI y checks:
   - `.github/workflows/ci.yml`:
     - backend ruff + black
     - web lint + typecheck + build
     - mobile lint + typecheck
   - `check.cmd` y `check.sh` alineados con CI
4. Frontend baseline:
   - `apps/web/package.json`: script `typecheck` + lint estandarizado para deuda `no-explicit-any`
   - `apps/mobile-rn/package.json`: script `typecheck`
   - `apps/web/src/components/GlobalThemeToggle.tsx`: eliminado patrón de setState en `useEffect`
5. Documentación:
   - `README.md` actualizado con badge CI, arquitectura textual, comandos granulares y docker ops
   - `CONTRIBUTING.md` actualizado con comandos y rollback
   - `docs/prs/PR-quality-baseline.md` agregado

## Pendientes (deuda controlada)
1. Web:
   - warning `no-unused-vars` en `apps/web/src/app/(auth)/login/page.tsx`
2. Mobile:
   - warnings de hooks/dependencias en:
     - `apps/mobile-rn/app/auth/login.tsx`
     - `apps/mobile-rn/app/guard/cierre-turno.tsx`
     - `apps/mobile-rn/src/screens/guard/GuardHomeScreen.tsx`
3. Backend:
   - black full-repo y reglas `isort` pospuestos para evitar refactor masivo de formato en este baseline.
