# Production Cutover Runbook

Fecha base: 2026-03-17

Este runbook asume la topologia oficial documentada en [deploy-production.md](/C:/Users/picos/Desktop/SADI/docs/deploy-production.md): `PostgreSQL` gestionado + `api` y `web` desplegados con sus Dockerfiles.

## 1. Decision de salida

No iniciar el cutover si falla cualquiera de estos puntos:

- [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md) incompleto.
- `cmd /c check.cmd` no termina en `CHECK_OK`.
- No existe backup verificable de la base de datos.
- No estan cargadas las variables reales de produccion.
- Se intenta usar una topologia distinta de la documentada sin una aprobacion tecnica explicita.

## 2. Confirmaciones previas

### Backend

- `DJANGO_ENV=production`
- `DJANGO_DEBUG=false`
- `DJANGO_SECRET_KEY` real
- `DJANGO_ALLOWED_HOSTS` real
- `DATABASE_URL` productivo
- `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` cerrados al frontend real
- `WEBAUTHN_MOCK=false`
- `DEFAULT_SUPERADMIN_AUTO_CREATE=false`

### Web

- `NEXT_PUBLIC_API_URL` apunta al dominio publico real de la API
- `NEXT_PUBLIC_AUTH_COOKIE_MODE=true`

### Mobile

- `EXPO_PUBLIC_API_URL` apunta a la misma API publica real

## 3. Orden de despliegue

1. Congelar cambios de ultima hora.
2. Ejecutar backup de DB.
3. Confirmar secretos y variables.
4. Build de `api` y `web`.
5. Desplegar `api`.
6. Ejecutar migraciones contra PostgreSQL productivo.
7. Verificar `GET /health/` y `GET /ready/`.
8. Desplegar `web`.
9. Publicar mobile solo si branding y URLs quedaron verificados.

## 4. Smoke post deploy

### Infra

- `GET /health/` -> `200`
- `GET /ready/` -> `200`

### Web

- Login admin responde.
- Login aprendiz responde.
- `Control Panel` exige step-up auth valido.
- Cambio de preset de branding impacta web.
- Smoke integrado real web -> API sigue pasando.

### Mobile

- Login guarda responde.
- Apertura de turno responde.
- Escaneo QR firmado responde.
- Branding cargado por `/api/configuracion/`.

### Permisos

- `GET /api/sedes/` anonimo devuelve `401` o `403`.
- `admin_sede` no accede a `Control Center`.
- `guarda` no registra acceso sin turno activo.
- `aprendiz` no ve datos ajenos.

## 5. Senales de rollback inmediato

Hacer rollback si ocurre cualquiera de estas:

- `/ready/` falla o degrada tras deploy.
- Login deja de funcionar para superadmin, admin_sede o guarda.
- QR firmado deja de validar.
- `Control Panel` pierde step-up, motivo obligatorio o auditoria.
- Se detecta fuga cross-sede o escalacion de privilegios.
- La migracion productiva falla o deja la app en estado parcial.

## 6. Rollback operativo

1. Revertir a la imagen o tag anterior.
2. Re-desplegar `api` y `web`.
3. Verificar:
   - `/health/`
   - `/ready/`
   - login admin
   - login guarda
   - QR firmado
   - lectura de branding
4. Si el problema esta ligado a migracion o datos, detener nuevas escrituras y evaluar restauracion desde backup.

## 7. Riesgos conocidos al momento del cutover

- Passkeys de autenticacion siguen fuera de produccion por decision de seguridad.
- El release puede salir sin esa feature; no debe reactivarse manualmente.
- [render.yaml](/C:/Users/picos/Desktop/SADI/render.yaml) no representa hoy la topologia oficial completa del release.
