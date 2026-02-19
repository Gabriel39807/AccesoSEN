# Runbook de Operacion

## Reinicio de servicios (Docker Compose)
```bash
docker compose restart api web
```

## Verificar salud
```bash
curl http://localhost:8000/health/
curl http://localhost:8000/ready/
```

## Aplicar migraciones
```bash
docker compose exec api python manage.py migrate --noinput
```

## Recolectar estaticos (si aplica)
```bash
docker compose exec api python manage.py collectstatic --noinput
```

## Rollback rapido
1. Identificar commit estable en `dev` o release tag.
2. `git checkout <commit/tag>`
3. Rebuild de imagenes:
```bash
docker compose build --no-cache api web
docker compose up -d
```

## Incidente por credenciales filtradas
1. Rotar `DJANGO_SECRET_KEY`.
2. Rotar credenciales SMTP/Twilio y DB.
3. Invalidar refresh tokens (blacklist/rotacion).
4. Revisar logs por actividad anomala en endpoints de auth/otp.
