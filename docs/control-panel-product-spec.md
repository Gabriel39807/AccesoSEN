# Control Panel Product Spec

**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-15

## Executive Summary

Este documento define el modelo funcional y de seguridad para el `Control Panel` de SADI.

El objetivo es permitir que `superadmin` personalice y opere la plataforma para cada cliente sin convertir esa capacidad en un punto de riesgo. El `Control Panel` queda separado de la administracion operativa diaria y protegido por autorizacion explicita, step-up auth, auditoria fuerte y limites de cambio.

## 1. Alcance

Este spec cubre:

- Matriz de roles administrativos
- Capacidades permitidas por rol
- Modelo de `Control Panel`
- Seguridad reforzada para cambios sensibles
- Cuotas y limites de modificacion
- Personalizacion visual segura
- Reglas backend no negociables

No cubre:

- Implementacion UI detallada
- Maquetacion visual final
- Migraciones tecnicas especificas

## 2. Roles Canonicos

### 2.1 superadmin

Alcance: global.

Capacidades:

- CRUD global sobre sedes
- Crear y desactivar `admin_sede`
- Crear y asignar roles/capacidades especiales globales
- Gestionar dominios de correo permitidos
- Gestionar politicas de sede
- Gestionar branding y presets visuales
- Gestionar permisos especiales del `Control Panel`
- Consultar auditoria completa

Restricciones:

- No puede saltarse auditoria
- No debe poder editar configuraciones sensibles sin step-up auth
- Cambios de alto impacto deben quedar sujetos a cuota y motivo

### 2.2 admin_sede

Alcance: una sede.

Capacidades:

- Crear y administrar `aprendiz` y `guarda` de su sede
- Gestionar turnos, accesos y equipos de su sede
- Consultar informacion operativa de su sede

Restricciones:

- No puede crear otros admins
- No puede gestionar otras sedes
- No puede entrar al `Control Panel`
- No puede modificar branding, dominios ni permisos globales

### 2.3 guarda

Alcance: sede asignada dentro de turno activo.

Capacidades:

- Iniciar y finalizar turno
- Escanear QR
- Registrar acceso

Restricciones:

- No administra configuracion
- No accede al `Control Panel`

### 2.4 guarda_global

Alcance: varias sedes o todas las sedes segun asignacion explicita.

Capacidades:

- Operacion de guarda en sedes autorizadas
- Iniciar turno en cualquiera de sus sedes permitidas

Restricciones:

- No es administrador
- No hereda permisos de `superadmin`
- No accede al `Control Panel`

Decision de modelado:

- `guarda_global` no debe ser un rol administrativo.
- Debe implementarse como:
  - rol explicito `guarda_global`, o
  - capacidad `guarda.multisede` sobre membresias/sedes permitidas.

La segunda opcion es preferible si quieres mantener pocos roles canonicos y expresar alcance por permisos.

### 2.5 aprendiz

Alcance: self.

Capacidades:

- Gestionar perfil propio
- Generar QR
- Ver historial propio
- Gestionar hasta 4 equipos segun politica

Restricciones:

- Sin acceso administrativo
- Sin acceso al `Control Panel`

## 3. Separacion de Superficies

### 3.1 Administracion Operativa

Es la administracion normal del sistema:

- usuarios
- equipos
- turnos
- accesos
- consultas operativas

### 3.2 Control Panel

Es la administracion avanzada de producto/tenant:

- branding
- dominios de correo
- politicas de sede
- configuracion avanzada
- permisos especiales
- limites de uso del panel

Regla obligatoria:

- `Control Panel` no comparte permisos con la administracion operativa.
- Un usuario puede ser `superadmin` y aun asi requerir permisos explicitos para submodulos del panel.

## 4. Matriz de Permisos Propuesta

### 4.1 Administracion Operativa

- `sede.read`
- `sede.create`
- `sede.update`
- `sede.deactivate`
- `usuario.read`
- `usuario.create`
- `usuario.update`
- `usuario.delete`
- `turno.read`
- `turno.create`
- `turno.update`
- `turno.close`
- `acceso.read`
- `acceso.create`
- `equipo.read`
- `equipo.create`
- `equipo.update`
- `equipo.review`
- `equipo.delete`

### 4.2 Control Panel

- `control_panel.read`
- `control_panel.session.open`
- `control_panel.audit.read`
- `control_panel.branding.read`
- `control_panel.branding.update`
- `control_panel.domains.read`
- `control_panel.domains.update`
- `control_panel.policies.read`
- `control_panel.policies.update`
- `control_panel.permissions.read`
- `control_panel.permissions.update`
- `control_panel.limits.read`
- `control_panel.limits.update`

### 4.3 Permisos Especiales de Riesgo Alto

- `control_panel.override_limits`
- `control_panel.override_guardrails`
- `control_panel.emergency_unlock`
- `control_panel.theme.publish`

Regla:

- Estos permisos no deben venir por defecto ni siquiera para todo `superadmin`.
- Deben ser asignables de forma explicita.

## 5. Matriz por Rol

### superadmin base

Incluye:

- Todo lo operativo global
- `control_panel.read`
- `control_panel.session.open`
- `control_panel.audit.read`
- `control_panel.branding.read`
- `control_panel.branding.update`
- `control_panel.domains.read`
- `control_panel.domains.update`
- `control_panel.policies.read`
- `control_panel.policies.update`

No incluye por defecto:

- `control_panel.permissions.update`
- `control_panel.override_limits`
- `control_panel.override_guardrails`
- `control_panel.emergency_unlock`

Estas quedan como capacidades elevadas y auditables.

### admin_sede

Incluye:

- `usuario.read/create/update/delete` solo dentro de su sede para `aprendiz` y `guarda`
- `turno.read/close` en su sede
- `acceso.read` en su sede
- `equipo.read/review/delete` en su sede

No incluye:

- ningun permiso `control_panel.*`
- `sede.create/update/deactivate`
- creacion o edicion de admins

### guarda_global

Incluye:

- `turno.create/update/read`
- `acceso.create`
- `acceso.read` limitado a su operacion
- capacidad multisede segun membresias/sedes permitidas

No incluye:

- `usuario.*`
- `sede.*`
- `control_panel.*`

## 6. Step-Up Auth Para Control Panel

Entrar al `Control Panel` no debe depender solo de tener sesion autenticada.

### 6.1 Requisito

Para abrir una sesion del panel se requiere:

- sesion autenticada valida
- permiso `control_panel.session.open`
- verificacion reciente por OTP o passkey

### 6.2 Resultado

Al aprobar step-up auth, backend emite una `ControlPanelSession`:

- `user_id`
- `granted_at`
- `expires_at`
- `verified_by` (`otp` o `passkey`)
- `ip`
- `user_agent`
- `scope_snapshot`

### 6.3 TTL

Recomendado:

- 10 a 15 minutos

### 6.4 Enforcement

Todo endpoint `control_panel.*` debe exigir:

- JWT valido
- permiso explicito
- `ControlPanelSession` vigente

## 7. Cuotas y Limites de Modificacion

No usar un limite unico para todo el panel. Debe ser por categoria.

### 7.1 Categorias

- `branding`
- `domains`
- `policies`
- `permissions`
- `sede_management`

### 7.2 Propuesta inicial

- `branding.update`: hasta 10 cambios por dia
- `domains.update`: hasta 5 cambios por dia
- `policies.update`: hasta 3 cambios por dia
- `permissions.update`: hasta 2 cambios por dia
- `sede_management`: hasta 5 cambios por dia

### 7.3 Exceso de cuota

Si supera la cuota:

- bloquear por defecto
- requerir step-up nuevo
- pedir motivo obligatorio
- requerir permiso `control_panel.override_limits`

## 8. Personalizacion Visual Segura

La personalizacion no debe permitir CSS arbitrario ni colores libres.

### 8.1 Modelo permitido

- presets de paleta preaprobados
- tokens controlados por backend
- variantes definidas por catalogo

Ejemplo:

- `theme.slug = ocean-blue`
- `theme.slug = emerald-green`
- `theme.slug = graphite`

### 8.2 Restricciones

- no guardar CSS libre
- no permitir hex/rgb arbitrario desde panel en v1
- validar contraste minimo
- validar combinaciones de fondo/texto/estado

### 8.3 Alcance

La personalizacion aplica al sistema/cliente, no a cada usuario individual.

## 9. Entidades Backend Nuevas Recomendadas

### 9.1 ControlPanelSession

Proposito:

- encapsular acceso temporal reforzado al panel

Campos:

- `user`
- `verified_by`
- `granted_at`
- `expires_at`
- `revoked_at`
- `ip`
- `user_agent`
- `scope_snapshot_json`

### 9.2 ControlPanelAuditEvent

Proposito:

- auditoria completa de cambios del panel

Campos:

- `actor`
- `action`
- `category`
- `target_type`
- `target_id`
- `before_json`
- `after_json`
- `reason`
- `ip`
- `created_at`
- `session_id`

### 9.3 ControlPanelQuotaCounter

Proposito:

- enforcement de limites por categoria

Campos:

- `user`
- `category`
- `window_start`
- `count`
- `last_action_at`

### 9.4 BrandingPreset

Proposito:

- catalogo seguro de temas

Campos:

- `slug`
- `name`
- `tokens_json`
- `is_active`
- `is_default`

### 9.5 TenantBrandingConfig

Proposito:

- asignacion del preset vigente

Campos:

- `branding_preset`
- `updated_by`
- `updated_at`

## 10. Endpoints Propuestos

### 10.1 Session

- `POST /api/control-panel/session/open/`
- `POST /api/control-panel/session/verify-otp/`
- `POST /api/control-panel/session/verify-passkey/`
- `POST /api/control-panel/session/close/`
- `GET /api/control-panel/session/status/`

### 10.2 Branding

- `GET /api/control-panel/branding/presets/`
- `GET /api/control-panel/branding/config/`
- `PATCH /api/control-panel/branding/config/`

### 10.3 Domains

- `GET /api/control-panel/domains/`
- `POST /api/control-panel/domains/`
- `PATCH /api/control-panel/domains/{id}/`
- `DELETE /api/control-panel/domains/{id}/`

### 10.4 Policies

- `GET /api/control-panel/policies/`
- `PATCH /api/control-panel/policies/{id}/`

### 10.5 Permissions

- `GET /api/control-panel/permissions/`
- `GET /api/control-panel/role-assignments/`
- `PATCH /api/control-panel/role-assignments/{id}/`

### 10.6 Audit y limites

- `GET /api/control-panel/audit-events/`
- `GET /api/control-panel/quotas/`

## 11. Reglas de Seguridad No Negociables

- Todo endpoint del panel debe usar `RequiresPermission` y `permission_map`.
- Todo endpoint del panel debe requerir `ControlPanelSession` vigente.
- Todo cambio del panel debe generar auditoria before/after.
- Todo cambio sensible debe requerir motivo.
- Toda cuota debe enforcementarse en backend.
- Ningun control de seguridad puede quedar solo en frontend.
- Todo alcance debe salir de `UserMembership`.
- No se permiten fallbacks a `rol` legado para decisiones de autorizacion del panel.

## 12. Fases de Implementacion

### Fase 1

- Matriz final de permisos
- nuevos permisos `control_panel.*`
- viewsets existentes migrados a `RequiresPermission`

### Fase 2

- `ControlPanelSession`
- step-up auth por OTP/passkey
- middleware o permission class para sesion reforzada

### Fase 3

- `ControlPanelAuditEvent`
- cuota por categoria
- motivos obligatorios para cambios sensibles

### Fase 4

- branding presets
- configuracion de tenant
- consumo frontend de tokens seguros

## 13. Criterios de Aceptacion

- Un `admin_sede` recibe `403` en cualquier endpoint `control_panel.*`.
- Un `superadmin` sin `ControlPanelSession` vigente recibe `403` o `401` segun corresponda.
- Un `superadmin` con sesion vigente y permiso suficiente puede operar el panel.
- Un cambio de branding no acepta CSS libre ni colores arbitrarios en v1.
- Un cambio de permisos deja auditoria before/after.
- Superar cuota bloquea cambios salvo override autorizado.
- `guarda_global` puede operar en sedes permitidas sin heredar privilegios administrativos.

## 14. Decisiones de Diseño

- `Control Panel` es un perimetro separado.
- `superadmin` no equivale automaticamente a `root` sin guardrails.
- Personalizacion visual en v1 sera por presets cerrados.
- Los permisos de alto riesgo deben asignarse explicitamente.
- El backend es la fuente de verdad de autorizacion y limites.
