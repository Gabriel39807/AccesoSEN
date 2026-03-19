# Auth Web Official Flow

Fecha: 2026-03-17

## Flujo oficial vigente

La web de SADI soporta un unico flujo oficial de autenticacion para release:

1. `POST /api/token/` con credenciales y `auth_transport=cookie`
2. Backend devuelve `access` en body y `refresh` en cookie HttpOnly
3. Frontend guarda solo el `access` token en memoria/sessionStorage
4. Ante `401`, frontend intenta `POST /api/token/refresh/` usando exclusivamente la cookie HttpOnly
5. Backend rota la sesion y devuelve nuevo `access`
6. `logout` y `logout-all` revocan sesiones y limpian la cookie

## Contrato de seguridad

- La web no debe almacenar `refresh` token en `sessionStorage` ni `localStorage`.
- La web no debe depender de un segundo modo de refresh por body token.
- El middleware edge y el cliente HTTP deben asumir el mismo transporte: cookie HttpOnly.
- Si la cookie no existe o fue revocada, la sesion debe caer a login sin fallback ambiguo.

## Fuera de soporte para release

- Refresh token persistido en frontend web
- Modo alterno no-cookie en web
- Passkeys/WebAuthn en produccion sin verificacion criptografica real

## Inventario actual de endpoints `AllowAny`

Quedan permitidos solo por necesidad operativa o compatibilidad:

- `/health/`
  - Justificacion: liveness/readiness basico
- `/api/configuracion/` `GET`
  - Justificacion: branding/configuracion publica consumida por frontends
- `/api/auth/login/`
  - Justificacion: inicio de sesion
- `/api/auth/refresh/`
  - Justificacion: renovacion de sesion por cookie
- `/api/auth/password-reset/*`
  - Justificacion: recovery
- `/api/auth/passkeys/auth/*`
  - Justificacion: legado temporal, pero debe permanecer deshabilitado en produccion real
- `/api/control-panel/session/request-passkey/`
  - Justificacion: legado temporal de step-up, pero debe permanecer deshabilitado en produccion real
- `/api/control-panel/session/verify-passkey/`
  - Justificacion: legado temporal de step-up, pero debe permanecer deshabilitado en produccion real

## Criterio de salida de Fase 1 relacionado con web auth

- `COOKIE_AUTH_MODE` fijo en modo cookie-only
- cliente web sin lectura de refresh token desde storage
- refresh, logout y logout-all cubiertos por pruebas funcionales y adversariales
- documentacion y codigo alineados en un solo flujo oficial
