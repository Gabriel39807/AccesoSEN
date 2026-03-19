# Production Readiness Report

Fecha: 2026-03-17  
Rama objetivo: `dev`

## Estado actual

Veredicto operativo: **RECONSIDERABLE CON RIESGO**

La Fase 0, Fase 1, Fase 2 y Fase 4 quedan cerradas a nivel de codigo y gate local.  
La Fase 3 queda materialmente avanzada y operativa en el entorno local, pero conserva un riesgo residual: el enforcement DB-level nuevo para `Acceso` fue probado en SQLite por validacion de modelo y migracion limpia, pero la prueba automatizada raw-SQL especifica de PostgreSQL aun depende de ejecutarse en un entorno Postgres real.

## Evidencia confirmada en este commit

- `cmd /c check.cmd`: verde.
- Backend:
  - `check`: verde
  - `check --deploy`: verde con env de produccion de CI
  - `pytest`: verde
  - cobertura backend: `75.34%`
- Web:
  - `lint`: verde
  - `typecheck`: verde
  - `build`: verde
  - `test:e2e:mocked`: verde (`3 passed`)
  - `test:e2e:integrated`: verde (`1 passed`)
- Mobile:
  - `lint`: verde
  - `typecheck`: verde
  - `test:smoke`: verde (`10 passed`)

## Endurecimiento confirmado

### Seguridad y auth

- Passkeys de autenticacion permanecen fail-closed cuando `WEBAUTHN_MOCK=false`.
- `Control Panel` no depende de un step-up passkey falso.
- El flujo web oficial queda reducido a:
  - `access` corto en memoria
  - `refresh` por cookie HttpOnly

### Integracion

- Existe smoke integrado real web -> API.
- La suite mocked UI ya esta separada de la integrada y no cuenta como evidencia falsa de release.

### Persistencia

- El limite de 4 equipos por aprendiz ya no depende solo del view logic.
- Se agrego enforcement adicional para invariantes de `Acceso`.
- `showmigrations` local quedo sin pendientes tras aplicar `0022` a `0027`.

### Release gate

- Existe una ruta oficial unica de despliegue documentada en [deploy-production.md](/C:/Users/picos/Desktop/SADI/docs/deploy-production.md).
- El checklist operativo ya puede usarse como gate real.

## Riesgos residuales

1. Passkeys siguen deshabilitadas en produccion, lo cual es intencional y correcto por ahora, pero deja esa capacidad fuera del release inicial.
2. El enforcement DB-level nuevo de `Acceso` debe validarse tambien sobre PostgreSQL real antes de declarar aprobacion sin reservas.
3. [render.yaml](/C:/Users/picos/Desktop/SADI/render.yaml) sigue siendo backend-only y no debe confundirse con la topologia oficial completa del release.
4. Mobile tiene smoke automatizado, pero no E2E de dispositivo real.

## Decision actual

El proyecto ya no esta en estado **bloqueado** por fallos obvios de seguridad, integracion o build.  
El estado correcto pasa a **reconsiderable con riesgo**.

## Para subir a “aprobado”

Falta cerrar estas evidencias en entorno objetivo:

1. Ejecutar migraciones y smoke contra PostgreSQL real.
2. Validar `health`, `ready` y smoke por rol sobre la topologia oficial.
3. Confirmar variables reales, backup y rollback antes del cutover.

## Referencias

- [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md)
- [deploy-production.md](/C:/Users/picos/Desktop/SADI/docs/deploy-production.md)
- [production-cutover-runbook.md](/C:/Users/picos/Desktop/SADI/docs/production-cutover-runbook.md)
- [invariant-enforcement.md](/C:/Users/picos/Desktop/SADI/docs/invariant-enforcement.md)
