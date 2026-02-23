# Domain Policy (Allowed Email Domains)

## Objetivo
Centralizar una politica de dominios de correo permitidos para todo S.A.D.I, configurable por `superadmin` y aplicada **siempre en backend**.

## Modelo
Tabla: `AllowedEmailDomain`

Campos clave:
- `domain`: dominio normalizado en minuscula, sin `@` (ej: `empresa.com`)
- `role` (nullable): rol objetivo
- `sede` (nullable): sede objetivo
- `is_active`
- `created_by`, `created_at`, `updated_at`

Scopes derivados por combinacion de campos:
- `GLOBAL`: `role=null`, `sede=null`
- `SEDE`: `role=null`, `sede!=null`
- `ROLE`: `role!=null`, `sede=null`
- `ROLE_SEDE`: `role!=null`, `sede!=null`

## Precedencia
`DomainPolicyService` aplica:
1. `ROLE_SEDE`
2. `ROLE`
3. `SEDE`
4. `GLOBAL`

Reglas por defecto:
- Si **no hay reglas activas** en el sistema: se permite cualquier dominio.
- Si **hay reglas activas** y el contexto no tiene una regla que permita el dominio: se rechaza (fail closed).

## Codigo de error
Cuando se bloquea por politica, backend responde `400` con:
- `code = EMAIL_DOMAIN_NOT_ALLOWED`

## Puntos de integracion (enforcement real)
- Creacion/edicion de usuarios: `UsuarioSerializer.validate`
- Solicitud/confirmacion de cambio de correo aprendiz:
  - `AprendizEmailChangeRequestSerializer`
  - `AprendizEmailChangeConfirmView`
- Importacion masiva:
  - `validate_excel` (prevalidacion)
  - `execute_aprendices_import` (validacion de ejecucion antes de escribir)
- Login cuando se usa identificador email:
  - `SadiTokenObtainPairSerializer.validate`

## Control Center (web)
Seccion `Dominios` en `/admin/control-center`:
- Listado + filtros (`domain`, `scope`, `role`, `sede`, `is_active`)
- Crear / editar / activar-desactivar / eliminar
- Banner de advertencia de enforcement global
- Refetch inmediato despues de mutaciones

## Seguridad
- CRUD de reglas: solo `superadmin` (`IsAuthenticated + IsSuperAdmin`)
- Usuarios no superadmin reciben `403`.
