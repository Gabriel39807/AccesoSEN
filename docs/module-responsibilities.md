# Module Responsibilities

Fecha base: 2026-03-17

Este mapa resume el recorte inicial de responsabilidades hecho durante la Fase 5.

## Backend `accesos`

- [views.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/views.py)
  - Adaptadores HTTP y composicion de respuestas DRF.
  - Debe quedarse orientado a permisos, serializers, orchestration y status codes.
- [webauthn_flow.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/webauthn_flow.py)
  - Plumbing reutilizable de WebAuthn:
  - cache keys
  - resolucion de `rp_id`
  - resolucion de `origin`
  - constantes TTL propias de challenges
- [webauthn_guards.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/webauthn_guards.py)
  - Respuestas fail-closed para passkeys deshabilitadas.
- [control_panel_support.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/control_panel_support.py)
  - Helpers reutilizables de `Control Panel`:
  - cuota diaria
  - auditoria
  - motivo obligatorio
  - sesion reforzada
  - cache keys OTP/passkey
- [models.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/models.py)
  - Invariantes de dominio y enforcement de modelo.
- [tests_support.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_support.py)
  - Base compartida de fixtures y helpers HTTP para tests API.
- [tests_control_panel.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_control_panel.py)
  - Cobertura de step-up, cuota y auditoria de `Control Panel`.
- [tests_passkeys.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_passkeys.py)
  - Cobertura de passkeys mockeadas y fail-closed en produccion.
- [tests_frontend_contract.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_frontend_contract.py)
  - Smoke contractual entre backend y frontend/mobile.
- [tests_security_hardening.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_security_hardening.py)
  - Cobertura de invariantes, idempotencia, QR firmado, RLS y hardening de accesos.
- [tests_allowed_domains.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests_allowed_domains.py)
  - Cobertura de politicas globales de dominios permitidos y su precedencia por rol.
- [tests.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/tests.py)
  - Resto de cobertura de regresion todavia pendiente de particion.

## Web

- [auth.ts](/C:/Users/picos/Desktop/SADI/apps/web/src/lib/auth.ts)
  - Estado del `access token` solo en memoria.
- [api-config.ts](/C:/Users/picos/Desktop/SADI/apps/web/src/lib/api-config.ts)
  - Contrato de URL backend y modo cookie.
- [playwright.config.ts](/C:/Users/picos/Desktop/SADI/apps/web/playwright.config.ts)
  - Suite `mocked UI`.
- [playwright.integrated.config.ts](/C:/Users/picos/Desktop/SADI/apps/web/playwright.integrated.config.ts)
  - Smoke integrado real web -> API.

## Siguiente recorte recomendado

1. Partir reglas de dominio/RBAC restantes y luego bloques de importacion o turno a modulos separados.
2. Extraer vistas o mixins de `Control Panel` fuera de [views.py](/C:/Users/picos/Desktop/SADI/services/api/accesos/views.py).
3. Mantener `check.cmd` y las pruebas adversariales como gate de equivalencia despues de cada extraccion.
