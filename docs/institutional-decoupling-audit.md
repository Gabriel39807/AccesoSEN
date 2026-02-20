# Auditoría de desacople institucional

Fecha: 2026-02-19
Rama: `dev`

Objetivo: identificar referencias directas a nombres institucionales/sedes reales y definir correcciones para convertir el sistema a una solución genérica y configurable.

## Hallazgos

| Archivo | Línea aprox | Tipo | Riesgo | Fix propuesto |
|---|---:|---|---|---|
| `services/api/accesos/models.py` | 18-22 | Modelo/choices | Alto | Eliminar `SEDE_CHOICES` hardcodeado y migrar a `ForeignKey(Sede)` en `Usuario.sede_principal`. |
| `services/api/accesos/models.py` | 84-87 | Modelo/choices | Alto | Eliminar `Turno.Sede` como enum hardcodeado; usar `Turno.sede -> FK Sede`. |
| `services/api/accesos/models.py` | 135 | Modelo/choices | Alto | Cambiar `Acceso.sede` de `CharField(choices)` a `FK Sede` (nullable). |
| `services/api/accesos/views.py` | 233-269 | Filtros backend | Alto | Reemplazar parser de sede por IDs/códigos desde DB (`Sede`) y validar sin ejemplos hardcodeados. |
| `services/api/accesos/views.py` | 255-256 | Mensajes de validación | Medio | Quitar ejemplos `CEGAFE/SANTA_CLARA`; mensajes genéricos basados en sedes activas. |
| `services/api/accesos/import_services.py` | 24 | Importación Excel | Alto | Eliminar `VALID_SEDES` estático; validar contra `Sede` activa en DB. |
| `services/api/accesos/import_services.py` | 41, 113 | Reglas de negocio/email institucional | Medio | Desacoplar dominio institucional por perfil configurable (no hardcode en código base). |
| `services/api/accesos/migrations/0002_*.py` | varios | Migraciones históricas | Bajo | Mantener históricas, pero agregar nuevas migraciones de transición a `Sede` + data migration. |
| `services/api/accesos/migrations/0003_*.py` | varios | Migraciones históricas | Bajo | Igual: no editar historia, compensar con migraciones nuevas. |
| `services/api/accesos/tests.py` | múltiples (`CEGAFE/SANTA_CLARA`) | Tests | Medio | Migrar fixtures/tests a sedes dinámicas creadas en DB por factory/helper. |
| `apps/web/src/app/(app)/admin/usuarios/page.tsx` | 43 | UI hardcode sede | Alto | Reemplazar `SEDES` fijo por fetch `/api/sedes/` y selector dinámico por rol. |
| `apps/web/src/app/(app)/admin/turnos/page.tsx` | 19, 26 | UI hardcode sede | Alto | Igual: sedes desde backend, no enums fijos. |
| `apps/web/src/app/(app)/admin/accesos/page.tsx` | 24, 45, 58 | UI hardcode sede | Alto | Igual: tipos dinámicos (`sede_id`, `sede_name`) y filtros por API. |
| `apps/mobile-rn/app/auth/login.tsx` | 22, 128-131 | UI hardcode sede | Alto | Cargar sedes vía endpoint y renderizar picker dinámico. |
| `apps/mobile-rn/src/screens/guard/GuardLoginScreen.tsx` | 16, 81-84 | UI hardcode sede | Alto | Igual: remover lista fija de sedes. |
| `apps/mobile-rn/src/api/turnos.ts` | 3 | Tipado hardcode sede | Alto | Cambiar tipo `Sede` de unión fija a entidad dinámica (`string`/DTO `Sede`). |
| `apps/mobile-rn/app/index.tsx` | 21 | Branding UI | Medio | Reemplazar texto institucional fijo por `INSTITUTION_NAME` (config remota/local). |
| `apps/web/src/components/aprendiz/AprendizShell.tsx` | 107, 138 | Branding UI | Medio | Reemplazar textos fijos por branding configurable. |
| `apps/web/src/app/(auth)/login/page.tsx` | 80, 85, 267 | Branding/UI placeholder | Medio | Eliminar referencias institucionales directas por textos genéricos. |
| `apps/web/src/app/(app)/aprendiz/ayuda/page.tsx` | 37, 152 | Contacto institucional fijo | Medio | Mover correo soporte a configuración por entorno/perfil. |
| `apps/mobile-rn/app/aprendiz/ayuda.tsx` | 24, 26 | Contacto institucional fijo | Medio | Igual: contacto configurable. |
| `services/api/accesos/templates/emails/password_reset_otp.html` | 15 | Branding de correo | Medio | Reemplazar firma por nombre institucional configurable. |
| `docs/cambios-2026-02-15-sesion-errores-importacion.md` | 26 | Documentación | Bajo | Actualizar texto para reflejar validación configurable y perfil institucional opcional. |

## Resumen de riesgo

- **Blocker (alto):** sedes hardcodeadas en modelo + filtros + frontend generan acoplamiento institucional y evitan multi-sede real.
- **Alto:** importación Excel valida contra catálogo fijo, rompe cuando sedes cambian.
- **Medio:** branding y contacto institucional expuesto por defecto en web/mobile/emails.

## Plan de corrección aplicado en esta iniciativa

1. Introducir modelo `Sede` y migrar relaciones (`Usuario`, `Turno`, `Acceso`) a `FK`.
2. Crear endpoint `GET /api/sedes/` y consumirlo desde web/mobile.
3. Eliminar listas de sedes hardcodeadas en backend/frontend/tests.
4. Añadir configuración institucional por entorno y comando `seed_institution --profile generic|sena`.
5. Dejar `generic` como perfil por defecto; nombres reales solo en perfil opcional.
