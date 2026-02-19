# PR2 - Infra, Env y Docker

- Commit: `f91bb33`
- Scope: separar settings por entorno y preparar stack docker.

## Descripcion
- Split de settings en `base/development/production`.
- Dispatcher por `DJANGO_ENV`.
- Dockerfile API (gunicorn + entrypoint con migrate).
- Dockerfile web multi-stage.
- `docker-compose.yml` raiz con db/redis/api/web.
- `.env.example` para raiz/API/web/mobile.

## Checklist
- [x] Entornos dev/prod diferenciados.
- [x] Composicion docker reproducible.
- [x] Variables ejemplo documentadas.

## Riesgos
- Medio: cambio estructural de settings.

## Pruebas
- `python manage.py check`
- `docker compose config`

## Rollback
```bash
git revert f91bb33
```
