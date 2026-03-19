# Release Readiness Checklist

Fecha base: 2026-03-15

Este checklist es el criterio operativo minimo para decidir si una version de SADI puede salir a produccion.

## 1. Gate tecnico previo

- `cmd /c check.cmd` en verde.
- Backend:
  - `python manage.py check` en verde.
  - `python manage.py check --deploy` en verde.
  - `pytest --create-db --cov=accesos --cov-report=term-missing --cov-fail-under=30` en verde.
- Web:
  - `npm run lint` en verde.
  - `npm run typecheck` en verde.
  - `npm run build` en verde.
  - `npm run test:e2e:mocked` en verde como validacion UI mockeada.
  - `npm run test:e2e:integrated` en verde como smoke real web -> API.
- Mobile:
  - `npm run lint` en verde.
  - `npm run typecheck` en verde.
  - `npm run test:smoke` en verde.

## 2. Gate de configuracion

- El flujo web vigente coincide con [auth-web-official-flow.md](/C:/Users/picos/Desktop/SADI/docs/auth-web-official-flow.md).
- `DJANGO_ENV=production`.
- `DEBUG=False`.
- `DJANGO_SECRET_KEY` real, largo y sin fallback.
- `DJANGO_ALLOWED_HOSTS` configurado para el dominio final.
- `CSRF_TRUSTED_ORIGINS` configurado con el dominio HTTPS real.
- `CORS_ALLOWED_ORIGINS` limitado a frontends reales.
- Base de datos y cache reales accesibles desde la API.
- SMTP/OTP configurado y probado.
- la topologia oficial coincide con [deploy-production.md](/C:/Users/picos/Desktop/SADI/docs/deploy-production.md).
- `NEXT_PUBLIC_API_URL` apunta al backend oficial del release.
- no existe fallback hardcodeado a un host productivo fijo.
- la matriz minima de variables coincide con [env-matrix-operativa.md](/C:/Users/picos/Desktop/SADI/docs/env-matrix-operativa.md).

## 3. Gate de datos y migraciones

- Backup de base de datos ejecutado antes del despliegue.
- `python manage.py migrate --noinput` aplicado sin errores.
- El mapa de invariantes y su mecanismo de enforcement coincide con [invariant-enforcement.md](/C:/Users/picos/Desktop/SADI/docs/invariant-enforcement.md).
- Seeds de permisos y branding presentes:
  - `control_panel.*`
  - presets de branding activos
- No hay drift de migraciones:
  - `python manage.py makemigrations --check --dry-run`

## 4. Smoke tests manuales por rol

### Superadmin

- Puede iniciar sesion.
- Puede listar y crear sedes.
- Puede crear `admin_sede`.
- Puede asignar capacidad global a guardas segun politica actual.
- Puede entrar al `Control Panel` solo con step-up auth valido.
- Puede consultar cuotas y auditoria del panel.
- Puede cambiar branding por preset activo con motivo obligatorio.
- El cambio queda auditado y visible en web/mobile.

### Admin_Sede

- Puede iniciar sesion.
- Solo ve usuarios/equipos/accesos/turnos de su sede.
- Puede crear `aprendiz` y `guarda` de su sede.
- No puede crear admins.
- No puede acceder a `Control Panel`.
- No puede operar datos de otra sede via URL directa.

### Guarda

- No puede registrar accesos sin turno activo.
- Puede abrir turno solo en sede permitida.
- Puede escanear QR firmado valido y registrar entrada/salida.
- No puede registrar acceso fuera de la sede del turno.
- No puede editar accesos historicos.

### Aprendiz

- Puede iniciar sesion en web/mobile.
- Puede ver su QR dinamico.
- El QR firmado expira y valida correctamente.
- Puede gestionar hasta 4 equipos.
- Solo puede editar/eliminar equipo en estado `PENDIENTE`.
- Puede ver solo su historial y sus datos.

## 5. Casos adversariales minimos

- Un `admin_sede` no puede leer ni mutar recursos de otra sede.
- Un `guarda` no puede usar endpoints de admin.
- Un token emitido en un rol multirol no hereda permisos de otro rol.
- `GET /api/sedes/` sin autenticacion devuelve `401` o `403`.
- passkeys no estan expuestas en produccion sin verificacion WebAuthn real.
- `Control Panel` rechaza mutaciones sin:
  - sesion reforzada
  - header `X-Control-Panel-Reason`
  - cuota disponible
- El endpoint `/api/sedes/` falla de forma segura ante filtros no permitidos para usuarios no globales.

## 6. Verificaciones post deploy

- `GET /health/` responde 200.
- `GET /ready/` responde 200.
- Login web responde correctamente.
- Login mobile responde correctamente.
- Un cambio de branding por preset se refleja en:
  - panel web
  - frontend web
  - mobile moderna
- Logs de app sin errores repetitivos de arranque.

## 7. Criterios de no salida

No desplegar si ocurre cualquiera de estos puntos:

- Falla cualquier gate tecnico.
- `/ready/` no valida DB/cache.
- Hay ambiguedad entre `UserMembership` y rol legado en un flujo critico nuevo.
- Existe un bypass de sede o escalacion de privilegios.
- Passkey/WebAuthn sigue habilitada en produccion sin validacion criptografica real.
- El frontend puede redirigirse a una API hardcodeada distinta del release actual.
- El `Control Panel` permite mutaciones sin step-up auth o sin auditoria.
- Un flujo critico de QR/turno/acceso falla en smoke test.

## 8. Rollback minimo

1. Revertir al commit o tag estable anterior.
2. Re-desplegar version previa.
3. Verificar `/health/` y `/ready/`.
4. Ejecutar smoke tests cortos:
   - login superadmin
   - login guarda
   - escaneo QR
   - lectura de configuracion/branding
5. Si la regresion fue por migracion, detener rollout y evaluar rollback de datos segun backup.

## 9. Estado de referencia historico

Los valores de esta seccion son solo una foto previa de validacion y **no equivalen** a aprobacion vigente de release.

Antes de reconsiderar salida deben re-ejecutarse todos los gates de las secciones anteriores sobre el commit objetivo.

Referencia historica conocida:

- `cmd /c check.cmd`: `CHECK_OK`
- Backend test suite: `127 passed, 3 skipped`
- Cobertura backend: `75.34%`
- Web build: verde
- Web lint/typecheck: verde
- Web mocked UI e2e: `3 passed`
- Web integrated smoke e2e: `1 passed`
- Mobile lint/typecheck: verde
- Mobile smoke tests: `10 passed`
- Riesgo residual principal: falta validar el enforcement DB-level nuevo tambien sobre PostgreSQL real y ejecutar el cutover en la topologia oficial documentada
