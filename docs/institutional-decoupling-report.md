# Reporte de desacople institucional

Fecha: 2026-02-19
Rama: `dev`

## Resumen ejecutivo

Se eliminó el acoplamiento duro a nombres institucionales en lógica de negocio y UI operativa. El sistema ahora usa sedes dinámicas en DB (`Sede`) y carga de catálogo por API (`/api/sedes/`) en web/mobile.

## Cambios implementados

## Backend

- Modelo nuevo `Sede` en `services/api/accesos/models.py`.
- Migración estructural + de datos:
  - `services/api/accesos/migrations/0012_sede_alter_acceso_sede_alter_turno_sede_and_more.py`
  - Migra `Usuario.sede_principal`, `Turno.sede`, `Acceso.sede` a FK.
  - Convierte valores legacy a codificación genérica (`sede-1..sede-4`) para mantener continuidad.
- Endpoint de catálogo:
  - `GET /api/sedes/` vía `SedeViewSet`.
- Serializers actualizados a `code` (slug) para compatibilidad:
  - `UsuarioSerializer`, `TurnoSerializer`, `AccesoSerializer`, `AprendizPerfilSerializer`.
- Importación Excel desacoplada:
  - Validación de sede contra `Sede` activa en DB.
  - Eliminada validación institucional fija de correo.
- Branding backend desacoplado:
  - `services/api/core/institution_settings.py`
  - plantillas/email OTP con `institution_name`.
- Seed por perfil:
  - `python manage.py seed_institution --profile generic|sena`.

## Frontend Web

- Nuevo hook `useSedes()` en `apps/web/src/hooks/useSedes.ts`.
- Admin `usuarios`, `turnos`, `accesos` ahora cargan sedes desde API, no listas hardcodeadas.
- Textos y placeholders con referencias institucionales directas removidos (login/ayuda/perfil shell).
- `NEXT_PUBLIC_SUPPORT_EMAIL` agregado para contacto configurable.

## Frontend Mobile

- Nuevo cliente `apps/mobile-rn/src/api/sedes.ts`.
- Login guarda (pantalla principal y pantalla legacy) usa sedes dinámicas desde API.
- Eliminados pickers hardcodeados de sedes.
- Textos institucionales fijos removidos en inicio/ayuda.

## Configuración

- `services/api/.env.example`:
  - `INSTITUTION_NAME`
  - `SEDES_PROFILE`
  - `INSTITUTION_SUPPORT_EMAIL`
- `apps/web/.env.example`:
  - `NEXT_PUBLIC_SUPPORT_EMAIL`

## Validación ejecutada

- Backend:
  - `python manage.py check` OK
  - `python manage.py showmigrations accesos` OK
  - `python manage.py migrate` OK (incluyendo `0012`)
  - `pytest` por clases clave:
    - `InstitutionalDecouplingTests` OK
    - `FilterAndScopeEnforcementTests` OK
- Frontend:
  - `apps/web`: `npm run build` OK
  - `apps/mobile-rn`: `npx tsc --noEmit` OK

## Riesgos y mitigaciones

- Riesgo: clientes externos que dependan de labels fijos de sede.
  - Mitigación: API mantiene envío/recepción por `code`, y ahora expone catálogo oficial `/api/sedes/`.
- Riesgo: datos legacy con códigos no mapeados.
  - Mitigación: migración crea sedes dinámicamente para valores desconocidos mediante slug.

## Cómo reactivar perfil "sena" sin hardcode

1. Definir en entorno backend:
   - `SEDES_PROFILE=sena`
   - (opcional) `INSTITUTION_NAME=...`
2. Ejecutar:
   - `python manage.py seed_institution --profile sena --deactivate-others`
3. Reiniciar backend y recargar frontend.

No se requiere cambio de código para alternar entre `generic` y `sena`.
