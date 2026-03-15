# Production Cutover Runbook

Fecha base: 2026-03-15

Este runbook define el orden recomendado para sacar SADI a produccion con el estado actual del proyecto.

## 1. Decision de salida

No iniciar el despliegue si alguno de estos puntos falla:

- [release-readiness-checklist.md](/C:/Users/picos/Desktop/SADI/docs/release-readiness-checklist.md) incompleto.
- `cmd /c check.cmd` no termina en `CHECK_OK`.
- No existe backup verificable de la base de datos.
- No estan listos los valores reales de dominios, correo y WebAuthn.

## 2. Variables obligatorias antes del deploy

### Backend

- `DJANGO_ENV=production`
- `DJANGO_DEBUG=false`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `REFRESH_TOKEN_PEPPER`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `DEFAULT_FROM_EMAIL`

### Web

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AUTH_COOKIE_MODE=true`
- `NEXT_PUBLIC_INSTITUTION_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`

### Mobile

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_INSTITUTION_NAME`

## 3. Validaciones de configuracion

- `NEXT_PUBLIC_API_URL` y `EXPO_PUBLIC_API_URL` deben apuntar al dominio publico real de la API.
- `DJANGO_ALLOWED_HOSTS` debe incluir el host de la API.
- `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` deben incluir el frontend web final con HTTPS.
- `WEBAUTHN_RP_ID` debe coincidir con el dominio donde vivira el login/passkey web.
- `WEBAUTHN_ORIGIN` debe ser exactamente el origen HTTPS del frontend.
- `DEFAULT_SUPERADMIN_AUTO_CREATE` debe quedar en `false` en produccion estable.

## 4. Orden de despliegue recomendado

1. Congelar cambios de ultima hora.
2. Ejecutar backup de DB.
3. Confirmar secretos y variables productivas.
4. Desplegar API.
5. Esperar migraciones y verificar `/health/` y `/ready/`.
6. Desplegar web contra la API nueva.
7. Publicar mobile solo si las URLs y branding ya estan verificados.

## 5. Smoke post deploy

### Infra

- `GET /health/` -> `200`
- `GET /ready/` -> `200`

### Web

- Login admin responde.
- Login aprendiz responde.
- `Control Panel` permite OTP/passkey y bloquea cambios sin motivo.
- Cambio de preset de branding impacta web.

### Mobile

- Login guarda responde.
- Apertura de turno responde.
- Escaneo QR firmado responde.
- Branding cargado por `/api/configuracion/`.

### Permisos

- `admin_sede` no puede entrar a `Control Center`.
- `guarda` no puede operar sin turno activo.
- `aprendiz` no ve datos ajenos.

## 6. Senales de rollback inmediato

Hacer rollback si ocurre cualquiera de estas:

- `/ready/` falla o degrada tras deploy.
- Login deja de funcionar para superadmin, admin_sede o guarda.
- QR firmado deja de validar.
- `Control Panel` cambia branding/permisos sin sesion reforzada.
- Se detecta fuga cross-sede o escalacion de privilegios.

## 7. Rollback operativo

1. Revertir al release/tag anterior.
2. Re-desplegar version previa.
3. Verificar:
   - `/health/`
   - `/ready/`
   - login admin
   - login guarda
   - QR firmado
   - lectura de branding
4. Si la incidencia esta ligada a migracion o datos, detener nuevas escrituras y evaluar restauracion desde backup.

## 8. Riesgos actuales que no bloquean salida controlada

- Render sigue configurado con `plan: free` en [render.yaml](/C:/Users/picos/Desktop/SADI/render.yaml).
  - Eso puede ser valido para piloto, pero no es una postura fuerte para operacion estable.
- Mobile ya tiene smoke de contrato, pero no pruebas automatizadas de dispositivo real.
- Web ya tiene smoke e2e basicos, pero no cubre todo el journey admin/aprendiz.
