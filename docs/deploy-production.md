# Deploy de Produccion (Docker)

## Requisitos
- Docker 24+
- Docker Compose v2
- Dominio y TLS gestionado por reverse proxy (Nginx/Caddy) o plataforma.

## 1) Configurar variables
1. Copia templates:
```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
cp apps/web/.env.example apps/web/.env
```
2. En `services/api/.env` configura:
- `DJANGO_ENV=production`
- `DJANGO_SECRET_KEY` largo y aleatorio
- `DJANGO_ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- credenciales DB y SMTP reales

## 2) Build y arranque
```bash
docker compose build api web
docker compose up -d
```

## 3) Validacion
```bash
curl http://<host>:8000/health/
curl http://<host>:8000/ready/
```

Notas:
- La plataforma debe usar `/ready/` como healthcheck operativo real.
- `/health/` solo valida liveness del proceso.

## 4) Migraciones
El contenedor `api` aplica `migrate` en `entrypoint.sh`.
Si quieres control manual, elimina el `migrate` del entrypoint y ejecuta:
```bash
docker compose exec api python manage.py migrate --noinput
```

## 5) Smoke test minimo post deploy

1. Login de `superadmin`.
2. Entrada al `Control Panel` con OTP o passkey.
3. Lectura de auditoria/cuotas del panel.
4. Login de `guarda`.
5. Apertura o validacion de turno.
6. Escaneo de QR firmado.
7. Login de `aprendiz`.
8. Carga correcta de `/api/configuracion/` y branding efectivo.

## Plataformas recomendadas
- Render: web service para API + managed Postgres.
- Fly.io: despliegue con Dockerfile y volumen para DB (si no usas managed DB).
- DigitalOcean: App Platform o Droplet con Docker Compose + reverse proxy.

## Rollback
1. Volver al commit/tag anterior.
2. Rebuild:
```bash
docker compose build api web
docker compose up -d
```
3. Verificar health/readiness.
4. Ejecutar smoke test corto de login, QR y branding.

## Referencias operativas

- [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md)
- [production-cutover-runbook.md](/C:/Users/picos/Desktop/SADI/docs/production-cutover-runbook.md)
- [production-env-matrix.md](/C:/Users/picos/Desktop/SADI/docs/production-env-matrix.md)
