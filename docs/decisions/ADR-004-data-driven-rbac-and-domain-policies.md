# ADR-004: RBAC data-driven + politicas de dominio por rol/sede

Fecha: 2026-02-21  
Estado: Aprobado

## Contexto
El sistema tenia autorizacion mezclada en `get_permissions()` y filtros en frontend.  
Eso impedia:
- escalar reglas por sede sin tocar codigo,
- garantizar aislamiento cross-sede solo desde backend,
- configurar dominios de correo por rol/sede.

## Decision
Se adopta una base de autorizacion data-driven con modelos:
- `Role`
- `Permission`
- `RolePermission` (scope `GLOBAL|SEDE|OWN`)
- `UserMembership`
- `SedePolicy`
- `AllowedEmailDomain`

Adicionalmente:
- se mantiene `Usuario.rol` temporalmente para compatibilidad,
- se crea sincronizacion de membresia primaria por usuario,
- validacion de dominio de correo usa precedencia:
  1) regla especifica `(rol, sede)`
  2) regla global `(rol, null)`
  3) **deny by default**

## Razonamiento
- Seguridad primero: si no hay regla explicita, el correo se rechaza.
- Compatibilidad: no se rompen endpoints existentes ni payloads actuales.
- Escalabilidad: superadmin/admin pueden ajustar reglas desde BD/admin.

## Consecuencias
Positivas:
- aislamiento server-side mas robusto por sede,
- limites/politicas por sede configurables en tiempo real,
- dominio de correo controlado sin hardcode en serializer.

Costos:
- mayor complejidad de datos (seed + mantenimiento de memberships),
- deuda tecnica temporal por mantener `Usuario.rol` junto a memberships.

## Plan de deprecacion
1. Mantener `Usuario.rol` como campo de compatibilidad.
2. Migrar consumo interno a `UserMembership` como fuente de verdad.
3. Eliminar dependencias de `Usuario.rol` cuando clientes legacy ya no lo requieran.

