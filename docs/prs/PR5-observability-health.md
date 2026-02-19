# PR5 - Observabilidad y Healthchecks

- Commit: `52b8815`
- Scope: trazabilidad de requests y endpoints de salud.

## Descripcion
- Middleware `RequestLogMiddleware` con `X-Request-ID`.
- Endpoint `/health/`.
- Endpoint `/ready/` con chequeos de DB/cache.
- Tests de salud.

## Checklist
- [x] Liveness y readiness listos.
- [x] Request logging estructurado en JSON.
- [x] Tests agregados.

## Riesgos
- Bajo: impacto principal en logs y rutas nuevas.

## Pruebas
- `GET /health/`
- `GET /ready/`
- `pytest`

## Rollback
```bash
git revert 52b8815
```
