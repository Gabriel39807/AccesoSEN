# Production Readiness Report

Fecha: 2026-02-19  
Rama objetivo: `dev`

## Score por area (0-100)
- Security: 72
- Reliability: 70
- Observability: 68
- CI/CD: 74
- Testing: 66
- DX (Developer Experience): 78
- Architecture: 73

Score global: **72/100**

## Riesgos y prioridades
### P0 (bloqueadores de produccion)
1. `services/api/venv` versionado en git (resuelto).
2. Settings inseguros para prod (`DEBUG`, hosts, secret fallback) (resuelto con split por entorno).
3. Sin pipeline CI para validar cambios antes de merge (resuelto con GitHub Actions).

### P1 (alto impacto)
1. Lint web con deuda tecnica (`no-explicit-any`) aun elevada.
2. Ausencia de pruebas e2e completas en dispositivo real para mobile y cobertura de journeys web todavia limitada.
3. Falta de reverse proxy/TLS documentado operativamente.

### P2 (mejora continua)
1. No hay metricas de aplicacion (Prometheus/OTel).
2. Falta politicas de retencion/anonimizacion de logs.
3. Cobertura de backend inicial todavia baja para un sistema critico.

## Actualizacion 2026-02-21 (RBAC y politicas dinamicas)
- Se implemento RBAC data-driven con modelos: `Role`, `Permission`, `RolePermission`, `UserMembership`.
- Se agregaron politicas por sede (`SedePolicy`) y dominios permitidos por rol/sede (`AllowedEmailDomain`).
- Se reforzo scoping server-side en viewsets clave (`usuarios`, `equipos`, `turnos`, `accesos`, `notificaciones`) usando `AuthorizationService`.
- Se centralizo parse/generacion de QR con `QRService` y modo por sede (`PLAIN|SIGNED|DUAL`).
- Se documento la decision en `docs/decisions/ADR-004-data-driven-rbac-and-domain-policies.md`.

## Cambios implementados en esta iteracion
### Repo hygiene
- `.gitignore` reforzado para monorepo.
- Eliminado del indice `services/api/venv` (artefactos locales).
- Agregados `.editorconfig`, `.gitattributes`, `CONTRIBUTING.md`, `CODEOWNERS`, `LICENSE`.

### Configuracion por entorno (Django)
- Split de settings:
  - `accesosen_api/base.py`
  - `accesosen_api/development.py`
  - `accesosen_api/production.py`
- Dispatcher por `DJANGO_ENV` en `accesosen_api/settings.py`.
- Hardening en produccion:
  - secure cookies
  - HSTS
  - headers de seguridad
  - validacion explicita de secretos/hosts

### Infra y despliegue
- `docker-compose.yml` raiz con `db`, `redis`, `api`, `web`.
- Dockerfile API (gunicorn + migrations en entrypoint).
- Dockerfile web multi-stage (`next build` standalone).
- `.env.example` para raiz, API, web y mobile.
- `.dockerignore` en API y web.

### Calidad/CI
- Workflow GitHub Actions (`.github/workflows/ci.yml`) para:
  - backend (`check` + `pytest --cov`)
  - web (`lint` + `build`)
  - mobile (`lint`)
- `pytest.ini` agregado en API.
- `check.sh` y `check.cmd` actualizados (lint/test/build).

### Seguridad y operacion
- `SECURITY.md`.
- `dependabot.yml` para pip/npm.
- Logging de eventos de login/lockout/OTP.
- Middleware de request logging con `X-Request-ID`.
- Endpoints de salud:
  - `/health/`
  - `/ready/`
- Runbook y guia de deploy:
  - `docs/runbook-operations.md`
  - `docs/deploy-production.md`

## Pendientes recomendados
1. Subir coverage backend a >= 60% y luego >= 75%.
2. Eliminar excepcion temporal de `no-explicit-any` en CI web.
3. Integrar escaneo de vulnerabilidades en CI (`pip-audit`, `npm audit`, `trivy`).
4. Expandir smoke e2e actuales de web hacia mas journeys criticos.
5. Evolucionar smoke mobile actuales de contrato hacia pruebas de dispositivo o navegacion real.
6. Anadir proxy TLS (Nginx/Caddy) y guia de certificados.

## Plan de mitigacion
1. Sprint corto de deuda web typing (`any` -> tipos concretos).
2. Matriz de pruebas de regresion para auth/permisos/OTP.
3. Observabilidad avanzada (Sentry + metricas HTTP).
4. Procedimiento formal de rotacion de secretos trimestral.

## Actualizacion 2026-03-15 (hardening final API + Control Panel)

Estado actual estimado:

- Security: 86
- Reliability: 84
- Observability: 72
- CI/CD: 85
- Testing: 82
- DX (Developer Experience): 82
- Architecture: 86

Score global estimado: **82/100**

### Resuelto desde la linea base

- Flujo QR firmado corregido para tokens largos.
- Healthcheck de plataforma alineado a `/ready/`.
- `check --deploy` agregado y validado en pipeline.
- Tests backend desacoplados de dependencia remota accidental.
- RBAC endurecido con evaluacion por `UserMembership` en flujos criticos.
- Multirol corregido para que el token respete el rol runtime.
- `Acceso` dejado inmutable salvo politica controlada de borrado.
- Contrasenas iniciales predecibles eliminadas.
- `Control Panel` separado como perimetro sensible con:
  - permisos `control_panel.*`
  - step-up auth
  - cuotas
  - auditoria before/after
- Branding migrado a presets seguros con consumo efectivo en web y mobile.

### Riesgos residuales

1. Web ya tiene smoke e2e basicos y mobile tiene smoke de contrato, pero aun faltan pruebas de dispositivo real y mas journeys criticos.
2. Persisten zonas de backend con cobertura funcional baja, especialmente:
   - `accesos/import_services.py`
   - zonas amplias de `accesos/views.py`
3. Falta observabilidad avanzada de negocio y aplicacion:
   - metricas HTTP
   - alertas
   - error tracking centralizado

### Criterio actual

El proyecto ya no presenta bloqueadores funcionales evidentes para una primera salida controlada, siempre que el despliegue siga el checklist operativo de [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md).
