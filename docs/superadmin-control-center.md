# Superadmin Control Center

## Objetivo
Centralizar la administracion de `Sedes` y `RBAC` (roles, permisos y asignaciones) con enforcement real en backend.

## Rutas Backend
- `GET /api/sedes/`
  - Fuente canonica de sedes desde DB.
  - Por defecto devuelve activas (`active=true`).
  - `include_inactive=true` solo efectivo para superadmin.
- `POST /api/sedes/` (superadmin)
- `PATCH /api/sedes/{id}/` (superadmin)
- `DELETE /api/sedes/{id}/` (superadmin, desactiva `is_active=false`)
- `GET|POST|PATCH|DELETE /api/roles/` (superadmin)
- `GET|POST|PATCH|DELETE /api/permisos/` (superadmin)
- `GET|POST|PATCH|DELETE /api/asignaciones/` (superadmin)
- `GET|POST|PATCH|DELETE /api/politicas-sede/` (superadmin)
- `GET|POST|PATCH|DELETE /api/dominios-email/` (superadmin)
- `GET /api/auditoria/eventos/` (superadmin, solo lectura)

## Ruta Frontend
- `GET /admin/control-center`
  - Modulo web con menu lateral:
    - Sedes
    - Roles
    - Permisos
    - Asignaciones
    - Auditoria
  - `AuthGuard` bloquea acceso a no-superadmin.

## Permisos y seguridad
- Todas las acciones de gestion del Control Center se validan en backend con `IsAuthenticated + IsSuperAdmin`.
- Un `admin_sede` recibe `403` en crear/editar/desactivar sede, crear roles/permisos/asignaciones y ver auditoria.
- La UI no es fuente de seguridad; solo refleja lo que el backend permite.

## Fuente de verdad de sedes
- Se elimino el bootstrap runtime que inyectaba sedes por defecto en `SedeViewSet`.
- Ahora `GET /api/sedes/` solo devuelve filas existentes en la tabla `Sede`.
- Si no hay membresias para un usuario autenticado no-superadmin, retorna lista vacia (sin fallback fantasma).

## Root cause de “ghost sedes”
Se detectaron dos fuentes:
1. Hardcode frontend en admin (`usuarios`, `accesos`, `turnos`) con valores `CEGAFE/SANTA_CLARA/ITEDRIS/GASTRONOMIA`.
2. Bootstrap runtime en backend (`_ensure_default_sedes_if_empty`) ejecutado desde `SedeViewSet`.

## Analisis de reproduccion (que se reviso)
- **Seeds/fixtures/migrations**: existen seeds genericos (`seed_institution`) y migraciones historicas, pero no eran la fuente principal en runtime para los listados admin.
- **Tests**: habia pruebas que validaban bootstrap automatico de sedes; se reemplazaron por pruebas de integridad DB-only.
- **Cache local/dev**: no se encontro una capa de cache de sedes que fabricara nombres fantasma; el problema venia de constantes UI y bootstrap del endpoint.

### Correccion aplicada
- Se eliminaron listas hardcodeadas y ahora los dropdowns consumen `useSedes()` (API DB-backed).
- Se retiro el bootstrap runtime del endpoint de sedes.
- Tras create/update/deactivate de sede, se emite evento `sedes:updated` para refrescar listas y evitar stale UI.
