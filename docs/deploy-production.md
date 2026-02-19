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

## 4) Migraciones
El contenedor `api` aplica `migrate` en `entrypoint.sh`.
Si quieres control manual, elimina el `migrate` del entrypoint y ejecuta:
```bash
docker compose exec api python manage.py migrate --noinput
```

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
