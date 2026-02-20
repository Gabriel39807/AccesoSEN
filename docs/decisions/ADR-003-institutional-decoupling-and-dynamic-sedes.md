# ADR-003: Desacople institucional y sedes dinamicas

Fecha: 2026-02-19
Estado: Aprobado

## Contexto

El sistema tenia sedes hardcodeadas en modelos, filtros y frontend (`CEGAFE`, `SANTA_CLARA`, `ITEDRIS`, `GASTRONOMIA`), lo que impedia operar como plataforma generica multi-sede y obligaba cambios de codigo para cada institucion.

## Decision

1. Introducir entidad `Sede` en base de datos como fuente de verdad:
   - `code` (slug unico)
   - `name` (nombre visible)
   - `is_active`
   - `metadata`
   - `created_at`
2. Migrar `Usuario.sede_principal`, `Turno.sede` y `Acceso.sede` de `CharField` a `ForeignKey(Sede)`.
3. Mantener contrato API orientado a `code` para minimizar impacto:
   - serializers de `Usuario`, `Turno` y `Acceso` exponen/aceptan `code`.
4. Agregar endpoint `GET /api/sedes/` para que web y mobile carguen sedes dinamicamente.
5. Crear configuracion institucional por entorno y seed por perfil:
   - `INSTITUTION_NAME`
   - `SEDES_PROFILE` (default `generic`)
   - comando `seed_institution --profile generic|sena`
6. El perfil `sena` queda encapsulado en seeds, no en logica de negocio.

## Consecuencias

Positivas:
- Multi-sede real sin redeploy por cambios de sedes.
- Menor acoplamiento institucional en backend/frontend.
- Permisos por sede robustos basados en FK.

Costos:
- Migracion de datos y ajustes de filtros/serializers/tests.
- Riesgo de incompatibilidad si un cliente externo depende de labels fijos.

## Mitigaciones

- Se mantiene `sede_principal`/`sede` como codigo en respuestas para compatibilidad.
- Migracion `0012` convierte datos legacy a codigos genericos (`sede-1..sede-4`) sin perdida de relaciones.
- Se agregaron pruebas de alcance por sede con codigos dinamicos.

## Rollback

1. Revertir a commit previo al `0012`.
2. Restaurar backup de DB previo a migracion.
3. Ejecutar `migrate accesos 0011`.
