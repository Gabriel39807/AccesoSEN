# RULES_ALIGNMENT_BACKLOG

Backlog técnico 1:1 contra `C:\Users\picos\Desktop\SADI\BUSINESS_RULES_V3.md`.

Este documento separa reglas **alineadas**, **parcialmente alineadas** y **pendientes** según el estado actual del backend y la suite de pruebas de esta sesión.

## Resumen ejecutivo

- **Alineadas:** 15
- **Parcialmente alineadas:** 8
- **Pendientes:** 2

## Orden recomendado de ejecución por fases

### Fase 1 — Bloqueadores de seguridad y privilegios
Prioridad: **P0**

1. **R-009** — cerrar aislamiento estricto por sede en todos los paths.
2. **R-010** — bloquear cualquier escalamiento de privilegios por `admin_sede`.
3. **R-021** — endurecer OTP contra abuso, reutilización y enumeración.
4. **R-025** — formalizar bulk actions con validación por elemento y auditoría por lote.

### Fase 2 — Integridad histórica y trazabilidad
Prioridad: **P0/P1**

1. **R-004** — impedir borrado físico de equipos ya revisados.
2. **R-023** — volver inmutables los accesos históricos salvo soft-delete autorizado.
3. **R-024** — asegurar auditoría persistente obligatoria en toda mutación crítica.

### Fase 3 — Flujo operativo de accesos y consistencia de dominio
Prioridad: **P1**

1. **R-013** — auto-cierre real de turnos expirados con marcador persistente.
2. **R-017** — unificar la secuencia válida entrada/salida en un solo servicio canónico.
3. **R-018** — validar que la salida cierre exactamente el mismo conjunto de equipos del ingreso.

### Fase 4 — Mantener cerradas las reglas ya alineadas
Prioridad: **P2**

1. Revalidar por regresión: **R-001, R-002, R-003, R-005, R-006, R-007, R-008, R-011, R-012, R-014, R-015, R-016, R-019, R-020, R-022**.
2. No reabrir trabajo funcional en estas reglas; solo mantener tests y CI verdes.

---

## Reglas alineadas

### R-001 — Máximo 4 equipos activos por aprendiz
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; la política global ya quedó fijada a 4.
- **Tarea técnica:** no abrir trabajo nuevo; solo mantener la regresión del hard-cap y del conteo de activos.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\policy_service.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\migrations\0017_hardening_constraints_and_soft_delete.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\migrations\0031_sqlite_equipo_hard_cap_triggers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** test / CI / auditoría
- **Prioridad:** P2
- **Criterio de cierre verificable:** el quinto equipo activo sigue siendo rechazado en backend y la suite de regresión permanece verde.

### R-002 — Transiciones válidas de estado de equipo
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; el state machine ya está cerrado.
- **Tarea técnica:** mantener la validación de transiciones y las pruebas de estados terminales.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** test / CI
- **Prioridad:** P2
- **Criterio de cierre verificable:** no se aceptan transiciones fuera de `PENDIENTE -> APROBADO|RECHAZADO`.

### R-003 — Aprendiz solo modifica equipos pendientes
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; ownership + estado ya se validan en backend.
- **Tarea técnica:** conservar la denegación backend para ediciones/borrados fuera de `PENDIENTE`.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** permiso / endpoint / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** el aprendiz solo puede mutar equipos propios con estado `PENDIENTE`.

### R-005 — Máximo 2 admins_sede activos por sede
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; el límite ya quedó bajado a 2.
- **Tarea técnica:** solo mantener la validación de activación/reactivación por sede.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** test / permiso
- **Prioridad:** P2
- **Criterio de cierre verificable:** una sede nunca supera 2 `admin_sede` activos simultáneos.

### R-006 — Fuente única de verdad para permisos y alcance
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; runtime ya depende de memberships.
- **Tarea técnica:** mantener la ruta canónica `UserMembership + RolePermission` y no reintroducir fallback legacy.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\authorization.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\signals.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\import_services.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\migrations\0029_membership_runtime_shape_hardening.py`
- **Tipo de cambio:** modelo / migración / permiso / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** ningún path runtime usa `Usuario.rol` o `Usuario.sede_principal` como fuente de autorización.

### R-007 — Forma válida de memberships por rol
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; la forma rol/sede ya quedó endurecida.
- **Tarea técnica:** mantener la constraint y la normalización de memberships.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\migrations\0029_membership_runtime_shape_hardening.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** modelo / migración / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** `superadmin` persiste sin sede; `admin_sede|guarda|aprendiz` persisten con sede.

### R-008 — Fail secure por defecto
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; rutas sensibles sin mapping ya deben negar acceso.
- **Tarea técnica:** conservar el deny-by-default y su cobertura de pruebas.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\authorization.py`
- **Tipo de cambio:** permiso / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** un endpoint sensible nuevo o sin mapping explícito no queda abierto por omisión.

### R-011 — Un solo turno activo por guarda
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; el constraint y la validación ya existen.
- **Tarea técnica:** mantener la protección concurrente y la prueba de carrera.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** modelo / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** no pueden coexistir dos turnos activos para el mismo guarda.

### R-012 — Coherencia temporal y de estado del turno
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; timestamps y estado ya son coherentes.
- **Tarea técnica:** mantener la constraint y las pruebas de turnos válidos.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`
- **Tipo de cambio:** modelo / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** `fin >= inicio`, `activo=true => fin=NULL`, `activo=false => fin!=NULL`.

### R-014 — Acceso operativo requiere turno activo
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; el flujo operativo ya rechaza accesos sin turno.
- **Tarea técnica:** mantener la separación entre operación normal y contingencia.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\serializers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** endpoint / servicio / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** el flujo operativo normal no admite accesos sin turno activo válido.

### R-015 — Flujo de contingencia separado para accesos excepcionales
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; la contingencia ya vive en un flujo separado.
- **Tarea técnica:** mantener el endpoint/flujo separado, con motivo obligatorio y auditoría persistente.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** endpoint / auditoría / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** no se reutiliza el endpoint operativo normal para contingencias sin turno.

### R-016 — Consistencia sede-turno-acceso
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; la sede del acceso coincide con la sede del turno.
- **Tarea técnica:** mantener la validación en persistencia y en flujos de importación.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\migrations\0027_access_invariants_hardening.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`
- **Tipo de cambio:** modelo / migración / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** un acceso con `turno_id` no puede apuntar a una sede distinta de la del turno.

### R-019 — QR firmado obligatorio en producción
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; producción ya fuerza `SIGNED`.
- **Tarea técnica:** mantener la validación criptográfica y la anti-replay.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\qr_service.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\policy_service.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** servicio / seguridad / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** en producción no se acepta un QR sin firma verificable, expiración y nonce único.

### R-020 — Documento plano no equivale a QR firmado
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; el documento plano no se trata como equivalente seguro.
- **Tarea técnica:** conservar la separación explícita entre modalidad débil y canal firmado.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\policy_service.py`
- **Tipo de cambio:** servicio / docs
- **Prioridad:** P2
- **Criterio de cierre verificable:** el modo documental no se reporta ni se opera como equivalente de `SIGNED`.

### R-022 — Sesiones seguras con rotación y revocación
- **Estado actual:** alineada
- **Gap concreto:** ninguno funcional; refresh rotativo y revocado ya quedó implementado.
- **Tarea técnica:** mantener la rotación de refresh y las pruebas de carrera.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\jwt_views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\auth_jwt.py`
- **Tipo de cambio:** seguridad / test
- **Prioridad:** P2
- **Criterio de cierre verificable:** un refresh token no puede reutilizarse después de rotar o cerrar sesión.

---

## Reglas parcialmente alineadas

### R-009 — Aislamiento estricto por sede
- **Estado actual:** parcialmente alineada
- **Gap concreto:** no todos los paths de listado/retrieval/mutación están garantizados 100% por scope server-side unificado.
- **Tarea técnica:** centralizar la resolución del scope efectivo y aplicarla a list/retrieve/create/update/bulk sin depender de parámetros del cliente.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\api\permissions.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** permiso / endpoint / test
- **Prioridad:** P0
- **Criterio de cierre verificable:** un actor con alcance por sede solo puede operar sobre recursos de su sede efectiva, incluso si el cliente intenta forzar otra sede.

### R-010 — Admin_Sede no escala privilegios
- **Estado actual:** parcialmente alineada
- **Gap concreto:** la restricción debe cubrir todos los caminos de mutación administrativa, incluidos imports y scripts internos.
- **Tarea técnica:** bloquear creación/promoción/reasignación administrativa desde cualquier superficie que no sea `superadmin`.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\serializers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\import_services.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\signals.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** permiso / servicio / test / auditoría
- **Prioridad:** P0
- **Criterio de cierre verificable:** `admin_sede` no puede crear, promover, transferir ni reasignar cuentas administrativas en ningún flujo.

### R-013 — Cierre automático de turnos expirados
- **Estado actual:** parcialmente alineada
- **Gap concreto:** falta el cierre automático completo y observable por job/servicio persistente.
- **Tarea técnica:** implementar un proceso de auto-cierre para turnos activos mayores a 12 horas y marcar el cierre como automático.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\management\commands\close_expired_turnos.py`
- **Tipo de cambio:** servicio / modelo / test / auditoría
- **Prioridad:** P1
- **Criterio de cierre verificable:** un turno activo con más de 12 horas se cierra automáticamente y queda registrado como auto-cierre.

### R-017 — Secuencia válida de accesos por usuario
- **Estado actual:** parcialmente alineada
- **Gap concreto:** la secuencia entrada/salida sigue repartida entre capas y todavía puede quedar expuesta a carreras.
- **Tarea técnica:** mover la lógica a un servicio canónico que atomice la transición y bloquee doble entrada, doble salida o salida sin entrada.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\serializers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\domain\services\access_flow_service.py`
- **Tipo de cambio:** servicio / endpoint / test
- **Prioridad:** P1
- **Criterio de cierre verificable:** el historial alterna correctamente entre entrada y salida sin secuencias imposibles.

### R-018 — Consistencia de equipos en ingreso y salida
- **Estado actual:** parcialmente alineada
- **Gap concreto:** la salida todavía no está garantizada como cierre exacto del mismo conjunto abierto más reciente.
- **Tarea técnica:** persistir o reconstruir la foto del conjunto abierto y comparar exactitud total al cerrar la salida.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\serializers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** modelo / servicio / test
- **Prioridad:** P1
- **Criterio de cierre verificable:** la salida solo se acepta si cierra exactamente el mismo conjunto de equipos del ingreso abierto más reciente.

### R-021 — OTP resistente a abuso y no enumeración
- **Estado actual:** parcialmente alineada
- **Gap concreto:** falta endurecer TTL, límite de intentos, rate limiting y respuestas no enumerables en todos los flujos OTP.
- **Tarea técnica:** hacer que el OTP sea de un solo uso, con expiración, límites por intento/solicitud y respuesta indistinguible para cuentas inexistentes.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\otp_services.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** servicio / endpoint / seguridad / test
- **Prioridad:** P0
- **Criterio de cierre verificable:** OTP expira, se invalida tras uso, limita solicitudes y no revela si la cuenta existe.

### R-023 — Históricos de acceso inmutables
- **Estado actual:** parcialmente alineada
- **Gap concreto:** falta un bloqueo canónico para edición destructiva y un queryset/manager que oculte eliminados por defecto.
- **Tarea técnica:** impedir `PATCH/PUT` sobre accesos históricos y consolidar soft-delete autorizado con manager/queryset estándar.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`
- **Tipo de cambio:** modelo / permiso / test / auditoría
- **Prioridad:** P1
- **Criterio de cierre verificable:** un acceso histórico no se puede editar; solo admite eliminación lógica autorizada.

### R-024 — Auditoría persistente obligatoria
- **Estado actual:** parcialmente alineada
- **Gap concreto:** no todas las mutaciones críticas generan todavía un evento persistente con actor, scope, resultado y diff.
- **Tarea técnica:** definir un pipeline de auditoría persistente y engancharlo a mutaciones críticas e intentos fallidos relevantes.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\signals.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_control_panel.py`
- **Tipo de cambio:** auditoría / servicio / test
- **Prioridad:** P1
- **Criterio de cierre verificable:** toda acción crítica deja un evento persistente con actor, rol efectivo, sede efectiva, acción, recurso, resultado, timestamp, IP y user-agent.

## Reglas pendientes

### R-004 — Equipos revisados no se borran físicamente
- **Estado actual:** pendiente
- **Gap concreto:** falta un bloqueo absoluto contra hard delete en equipos ya decididos administrativamente.
- **Tarea técnica:** reemplazar el borrado destructivo por soft-delete o inactivación auditada y denegar hard delete cuando el equipo ya tenga historial/revisión.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\models.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** modelo / endpoint / test / auditoría
- **Prioridad:** P0
- **Criterio de cierre verificable:** ningún equipo `APROBADO` o `RECHAZADO` puede desaparecer físicamente; solo se permite inactivación o eliminación lógica auditada.

### R-025 — Bulk actions restringidas y auditadas
- **Estado actual:** pendiente
- **Gap concreto:** no existe aún una política exhaustiva y canónica para operaciones masivas por elemento y por lote.
- **Tarea técnica:** crear un guard para bulk actions que valide cada ID contra el scope efectivo y escriba auditoría trazable por lote y/o por elemento.
- **Archivos probables a tocar:** `C:\Users\picos\Desktop\SADI\services\api\accesos\views.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\serializers.py`, `C:\Users\picos\Desktop\SADI\services\api\accesos\tests_security_hardening.py`
- **Tipo de cambio:** permiso / auditoría / test
- **Prioridad:** P0
- **Criterio de cierre verificable:** ninguna bulk action procesa elementos fuera del scope del actor ni pierde trazabilidad por lote.

---

## Notas de ejecución

- Las reglas **alineadas** no se reabren salvo regresión.
- Las reglas **parcialmente alineadas** son las que siguen bloqueando seguridad, trazabilidad o consistencia operativa.
- Las reglas **pendientes** son las que aún requieren implementación explícita.
- Antes de cerrar esta iteración, la validación mínima debe cubrir:
  - pruebas backend adversariales,
  - regresión de permisos,
  - control de turnos,
  - consistencia de accesos,
  - y auditoría persistente.

