# Deploy de Produccion Oficial

Fecha base: 2026-03-17

## Topologia oficial del release inicial

La historia oficial de despliegue para reconsiderar release es:

1. `PostgreSQL` gestionado externamente.
2. `API Django` desplegada con el `Dockerfile` de `services/api`.
3. `Web Next.js` desplegada con el `Dockerfile` de `apps/web`.
4. Reverse proxy o plataforma con HTTPS real al frente.

El archivo [docker-compose.yml](/C:/Users/picos/Desktop/SADI/docker-compose.yml) es la referencia operativa para esta topologia.

## Lo que no es la historia oficial

- [render.yaml](/C:/Users/picos/Desktop/SADI/render.yaml) queda como blueprint util para un despliegue backend-only en Render.
- Ese blueprint no cubre hoy la topologia completa del release, porque no define el despliegue oficial de web.
- Por tanto, `render.yaml` no es el gate de salida principal de esta fase.

## Requisitos previos

- Docker 24+
- Docker Compose v2
- PostgreSQL productivo accesible por red
- Secretos reales para backend, web y SMTP
- Dominio HTTPS real para web y API
- Backup reciente y verificable antes de correr migraciones

## Variables obligatorias

Usar como fuente de verdad:

- [production-env-matrix.md](/C:/Users/picos/Desktop/SADI/docs/production-env-matrix.md)
- [auth-web-official-flow.md](/C:/Users/picos/Desktop/SADI/docs/auth-web-official-flow.md)

Minimo:

- Backend:
  - `DJANGO_ENV=production`
  - `DJANGO_DEBUG=false`
  - `DJANGO_SECRET_KEY`
  - `DJANGO_ALLOWED_HOSTS`
  - `DATABASE_URL`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`
  - `REFRESH_TOKEN_PEPPER`
  - `WEBAUTHN_MOCK=false`
  - `SESSION_COOKIE_SECURE=true`
  - `CSRF_COOKIE_SECURE=true`
  - `SECURE_SSL_REDIRECT=true`
  - `SECURE_HSTS_SECONDS>0`
- Web:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_AUTH_COOKIE_MODE=true`
  - `NEXT_PUBLIC_INSTITUTION_NAME`
- Mobile:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_INSTITUTION_NAME`

## Secuencia oficial

1. Preparar `.env` o secretos equivalentes para `services/api` y `apps/web`.
2. Verificar gates locales con `cmd /c check.cmd`.
3. Ejecutar backup de la base productiva.
4. Levantar o actualizar `api` y `web` con Docker.
5. Ejecutar `python manage.py migrate --noinput` contra PostgreSQL productivo.
6. Verificar `GET /health/` y `GET /ready/`.
7. Ejecutar smoke post-deploy por rol.

## Comandos de referencia

```bash
docker compose build api web
docker compose up -d api web
docker compose exec api python manage.py migrate --noinput
```

Si el despliegue real no usa `docker compose exec`, el equivalente de plataforma debe preservar exactamente la misma secuencia: build, migrate, readiness y smoke.

## Smoke minimo post deploy

1. `GET /health/` devuelve `200`.
2. `GET /ready/` devuelve `200`.
3. Login web admin funciona.
4. Login mobile funciona.
5. `Control Panel` exige step-up valido.
6. Cambio de branding por preset se refleja en web.
7. Guarda no registra acceso sin turno activo.
8. QR firmado valida correctamente.

## Rollback minimo

1. Volver al tag o imagen anterior.
2. Re-desplegar `api` y `web`.
3. Verificar `health`, `ready`, login admin y flujo QR.
4. Si el problema fue de migracion o datos, detener escrituras y restaurar desde backup segun el runbook.

## Referencias operativas

- [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md)
- [production-cutover-runbook.md](/C:/Users/picos/Desktop/SADI/docs/production-cutover-runbook.md)
- [production-readiness.md](/C:/Users/picos/Desktop/SADI/docs/production-readiness.md)
- [invariant-enforcement.md](/C:/Users/picos/Desktop/SADI/docs/invariant-enforcement.md)
