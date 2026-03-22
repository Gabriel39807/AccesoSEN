# SADI — BUSINESS_RULES_V3

## Propósito
Este documento fija el catálogo final de reglas de SADI con criterio de producción.
No mezcla decisiones de negocio con estado de implementación.
No contiene backlog técnico.

---

## Convenciones de lectura

### Política aprobada
Es la regla que el sistema debe obedecer.
Es la fuente normativa.
No depende de que hoy esté bien implementada.

### Estado actual / alineación con implementación
Describe cómo está hoy el backend respecto de la política aprobada.
Valores usados en este documento:
- **Alineada**
- **Alineada parcialmente**
- **Desalineada hoy**
- **No implementada**
- **Implementada en lugar incorrecto**

### Evidencia
Toda evidencia apunta a rutas relativas del repo, no absolutas.

### Clasificación
Cada regla pertenece a una sola categoría principal:
- Regla de negocio
- Regla de autorización/permisos
- Regla de seguridad
- Regla de auditoría/trazabilidad
- Invariante de dominio
- Restricción técnica
- Requisito funcional

---

## Decisiones cerradas

1. **Máximo de equipos por aprendiz**: política global fija de **4**.
2. **Acceso sin turno**: prohibido en el flujo operativo; contingencia separada.
3. **Fuente de verdad de roles**: `UserMembership + RolePermission`, migración por fases.
4. **QR productivo**: `SIGNED` obligatorio.
5. **Admins por sede**: máximo **2 `admin_sede` activos** por sede.

---

## Catálogo final de reglas v3

### R-001 — Máximo 4 equipos activos por aprendiz
- **Categoría:** Regla de negocio
- **Descripción formal:** Un aprendiz tiene un tope global de equipos activos asociados.
- **Actores afectados:** Aprendiz, Admin_Sede, Superadmin
- **Alcance:** Alta, importación, restauración y reactivación de equipos
- **Precondiciones:** Usuario con rol efectivo `aprendiz`
- **Regla exacta:** Un aprendiz no puede tener más de **4 equipos activos** asociados simultáneamente.
- **Justificación:** Simplifica el control patrimonial y evita contradicciones de política.
- **Criticidad:** Alta
- **Enforcement esperado:** Base de datos + Backend transaccional
- **Política aprobada:** Límite global fijo = 4.
- **Estado actual / alineación con implementación:** **Desalineada hoy**. El backend mezcla política dinámica por sede con hard-cap fijo en modelo y DB.
- **Evidencia:** `services/api/accesos/models.py`, `services/api/accesos/domain/services/policy_service.py`, `services/api/accesos/migrations/0017_hardening_constraints_and_soft_delete.py`
- **Riesgo si no se implementa:** Inconsistencias, bypass parcial y errores de concurrencia.
- **Ejemplos válidos:** Aprendiz con 3 equipos crea el cuarto.
- **Ejemplos inválidos:** Aprendiz con 4 equipos intenta crear el quinto.
- **Observaciones de implementación:** Contar solo equipos activos/no eliminados.

### R-002 — Transiciones válidas de estado de equipo
- **Categoría:** Regla de negocio
- **Descripción formal:** El equipo sigue un ciclo de vida finito con transiciones explícitas.
- **Actores afectados:** Aprendiz, Admin_Sede, Superadmin
- **Alcance:** Revisión y mantenimiento de equipos
- **Precondiciones:** Equipo existente
- **Regla exacta:** `PENDIENTE -> APROBADO | RECHAZADO`; `APROBADO` y `RECHAZADO` son terminales; `RECHAZADO` exige motivo.
- **Justificación:** Evita reescritura arbitraria del historial administrativo.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional
- **Política aprobada:** El state machine es cerrado y terminal.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/models.py`
- **Riesgo si no se implementa:** Estados imposibles y arbitrariedad administrativa.
- **Ejemplos válidos:** `PENDIENTE -> APROBADO`
- **Ejemplos inválidos:** `APROBADO -> PENDIENTE`
- **Observaciones de implementación:** No permitir reapertura silenciosa.

### R-003 — Aprendiz solo modifica equipos pendientes
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** El aprendiz solo puede alterar equipos propios mientras no hayan sido decididos administrativamente.
- **Actores afectados:** Aprendiz
- **Alcance:** Edición y eliminación de equipos
- **Precondiciones:** El equipo pertenece al aprendiz autenticado
- **Regla exacta:** El aprendiz solo puede editar o eliminar equipos propios con estado `PENDIENTE`.
- **Justificación:** Los equipos aprobados/rechazados pasan a histórico administrativo.
- **Criticidad:** Alta
- **Enforcement esperado:** Permisos/autorización + Backend transaccional
- **Política aprobada:** Solo equipos pendientes y propios.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Manipulación posterior de equipos ya revisados.
- **Ejemplos válidos:** Editar un equipo propio pendiente.
- **Ejemplos inválidos:** Borrar un equipo propio aprobado.
- **Observaciones de implementación:** Validar ownership y estado en backend, nunca en frontend.

### R-004 — Equipos revisados no se borran físicamente
- **Categoría:** Regla de auditoría/trazabilidad
- **Descripción formal:** Los equipos con decisión administrativa no pueden desaparecer físicamente del historial.
- **Actores afectados:** Admin_Sede, Superadmin
- **Alcance:** Eliminación de equipos
- **Precondiciones:** Equipo con estado `APROBADO` o `RECHAZADO`
- **Regla exacta:** Un equipo `APROBADO` o `RECHAZADO` no puede borrarse físicamente. Si el negocio exige retiro, debe pasar a estado inactivo o eliminación lógica auditada.
- **Justificación:** Preserva trazabilidad patrimonial y administrativa.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Auditoría
- **Política aprobada:** Solo eliminación lógica o inactivación.
- **Estado actual / alineación con implementación:** **Desalineada hoy**
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Pérdida de evidencia y ruptura histórica.
- **Ejemplos válidos:** Marcar equipo revisado como inactivo.
- **Ejemplos inválidos:** Eliminar físicamente un equipo aprobado.
- **Observaciones de implementación:** Si hay historial asociado, el bloqueo debe ser absoluto.

### R-005 — Máximo 2 admins_sede activos por sede
- **Categoría:** Regla de negocio
- **Descripción formal:** Cada sede tiene una superficie de privilegio administrativo limitada.
- **Actores afectados:** Superadmin, Admin_Sede
- **Alcance:** Creación, activación, reasignación y reemplazo de admins por sede
- **Precondiciones:** Sede válida
- **Regla exacta:** Cada sede puede tener como máximo **2 usuarios con rol efectivo `admin_sede` activos** simultáneamente.
- **Justificación:** Continuidad operativa mínima sin inflar privilegios locales.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional
- **Política aprobada:** Máximo 2 admins_sede activos por sede.
- **Estado actual / alineación con implementación:** **Desalineada hoy**. El código mantiene otro límite y no corresponde a la política aprobada.
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Exceso de administradores locales y menor accountability.
- **Ejemplos válidos:** Sede con 1 admin principal y 1 suplente.
- **Ejemplos inválidos:** Crear un tercer admin_sede activo en la misma sede.
- **Observaciones de implementación:** La activación/reactivación cuenta para el límite.

### R-006 — Fuente única de verdad para permisos y alcance
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** La autorización runtime depende exclusivamente del modelo canónico de memberships.
- **Actores afectados:** Todos
- **Alcance:** Endpoints, servicios, jobs y tareas administrativas
- **Precondiciones:** Usuario autenticado
- **Regla exacta:** Toda decisión runtime de permisos y alcance debe derivarse exclusivamente de `UserMembership + RolePermission`. `Usuario.rol` y `Usuario.sede_principal` no pueden usarse para autorización runtime.
- **Justificación:** Elimina drift entre modelo legacy y permisos efectivos.
- **Criticidad:** Alta
- **Enforcement esperado:** Permisos/autorización + Backend transaccional
- **Política aprobada:** Migración por fases hacia memberships como única fuente.
- **Estado actual / alineación con implementación:** **Desalineada hoy**
- **Evidencia:** `services/api/accesos/domain/services/authorization.py`, `services/api/accesos/signals.py`, `services/api/accesos/models.py`
- **Riesgo si no se implementa:** Escalamiento o denegación accidental por drift.
- **Ejemplos válidos:** Membership activa autoriza; legacy no influye.
- **Ejemplos inválidos:** `Usuario.rol` otorga acceso sin membership válida.
- **Observaciones de implementación:** Mantener el documento honesto: esto sigue en migración.

### R-007 — Forma válida de memberships por rol
- **Categoría:** Restricción técnica
- **Descripción formal:** El modelo de membership no puede almacenar combinaciones semánticamente inválidas.
- **Actores afectados:** Todos
- **Alcance:** Alta, edición, migración e importación de memberships
- **Precondiciones:** Membership a persistir
- **Regla exacta:** `superadmin -> sede IS NULL`; `admin_sede|guarda|aprendiz -> sede IS NOT NULL`.
- **Justificación:** Elimina estados imposibles.
- **Criticidad:** Alta
- **Enforcement esperado:** Base de datos
- **Política aprobada:** La combinación rol/sede debe ser consistente.
- **Estado actual / alineación con implementación:** **No implementada**
- **Evidencia:** `services/api/accesos/models.py`
- **Riesgo si no se implementa:** Memberships corruptas e indeterminación de scope.
- **Ejemplos válidos:** Membership de guarda con sede.
- **Ejemplos inválidos:** Membership de superadmin con sede.
- **Observaciones de implementación:** Debe ser check constraint, no solo validación de serializer.

### R-008 — Fail secure por defecto
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** Los endpoints sensibles deben negar acceso si no existe mapeo explícito.
- **Actores afectados:** Todos
- **Alcance:** Todo endpoint sensible
- **Precondiciones:** Solicitud autenticada o anónima a recurso sensible
- **Regla exacta:** Toda ruta sensible sin mapeo explícito de permisos debe negar acceso.
- **Justificación:** La omisión nunca puede abrir permisos.
- **Criticidad:** Alta
- **Enforcement esperado:** Permisos/autorización
- **Política aprobada:** Denegar por defecto.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/domain/services/authorization.py`
- **Riesgo si no se implementa:** Exposición accidental de operaciones sensibles.
- **Ejemplos válidos:** Endpoint nuevo sin permiso retorna denegación.
- **Ejemplos inválidos:** Endpoint nuevo abierto por default.
- **Observaciones de implementación:** Política global, no excepciones ad hoc.

### R-009 — Aislamiento estricto por sede
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** El actor scoped por sede no puede salir de su sede efectiva.
- **Actores afectados:** Admin_Sede, Guarda
- **Alcance:** List, retrieve, create, update, delete y bulk
- **Precondiciones:** Membership activa con sede
- **Regla exacta:** Un actor con alcance por sede solo puede operar sobre recursos de su sede efectiva. Parámetros del cliente no amplían ni alteran el alcance.
- **Justificación:** Previene fuga cross-sede.
- **Criticidad:** Alta
- **Enforcement esperado:** Permisos/autorización + Backend transaccional
- **Política aprobada:** El scope lo decide el backend.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/views.py`, `services/api/accesos/api/permissions.py`
- **Riesgo si no se implementa:** Fuga de datos entre sedes.
- **Ejemplos válidos:** Admin_Sede A gestiona solo datos de A.
- **Ejemplos inválidos:** Admin_Sede A envía `sede_id=B` y obtiene alcance adicional.
- **Observaciones de implementación:** La sede efectiva debe resolverse server-side.

### R-010 — Admin_Sede no escala privilegios
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** El administrador local no puede alterar la jerarquía administrativa.
- **Actores afectados:** Admin_Sede
- **Alcance:** Gestión de usuarios, memberships y acciones masivas
- **Precondiciones:** Actor autenticado como `admin_sede`
- **Regla exacta:** `admin_sede` no puede crear, promover, transferir ni reasignar cuentas administrativas.
- **Justificación:** Evita escalamiento horizontal y vertical.
- **Criticidad:** Alta
- **Enforcement esperado:** Permisos/autorización
- **Política aprobada:** Solo superadmin administra privilegios administrativos.
- **Estado actual / alineación con implementación:** **Parcial**
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Toma de control local indebida.
- **Ejemplos válidos:** Admin_Sede crea guarda.
- **Ejemplos inválidos:** Admin_Sede crea otro admin_sede.
- **Observaciones de implementación:** También aplica a imports y scripts internos.

### R-011 — Un solo turno activo por guarda
- **Categoría:** Regla de negocio
- **Descripción formal:** El guarda no puede operar con múltiples turnos abiertos.
- **Actores afectados:** Guarda
- **Alcance:** Inicio/cierre de turno
- **Precondiciones:** Guarda habilitado
- **Regla exacta:** Un guarda no puede tener más de un turno activo simultáneo.
- **Justificación:** Traza operativa inequívoca.
- **Criticidad:** Alta
- **Enforcement esperado:** Base de datos + Backend transaccional
- **Política aprobada:** Constraint duro + validación transaccional.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/models.py`, `services/api/accesos/tests_security_hardening.py`
- **Riesgo si no se implementa:** Ambigüedad de operación y sede.
- **Ejemplos válidos:** Inicia un turno con ninguno activo.
- **Ejemplos inválidos:** Inicia otro sin cerrar el actual.
- **Observaciones de implementación:** Prueba concurrente obligatoria.

### R-012 — Coherencia temporal y de estado del turno
- **Categoría:** Regla de validación de datos
- **Descripción formal:** El turno debe mantener consistencia entre timestamps y estado.
- **Actores afectados:** Guarda, Admin_Sede, Superadmin
- **Alcance:** Persistencia de turnos
- **Precondiciones:** Turno nuevo o actualizado
- **Regla exacta:** `fin >= inicio`; `activo=true => fin is null`; `activo=false => fin is not null`.
- **Justificación:** Evita estados imposibles.
- **Criticidad:** Alta
- **Enforcement esperado:** Base de datos
- **Política aprobada:** Estado y timestamps deben ser coherentes.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/models.py`
- **Riesgo si no se implementa:** Corrupción temporal del histórico.
- **Ejemplos válidos:** Turno cerrado con fin posterior al inicio.
- **Ejemplos inválidos:** Turno activo con fin informado.
- **Observaciones de implementación:** No depender solo de lógica de vista.

### R-013 — Cierre automático de turnos expirados
- **Categoría:** Requisito funcional
- **Descripción formal:** Los turnos excesivamente largos deben cerrarse por política operativa.
- **Actores afectados:** Guarda, Admin_Sede
- **Alcance:** Operación de turnos
- **Precondiciones:** Turno activo con duración mayor al máximo permitido
- **Regla exacta:** Un turno activo con más de 12 horas debe cerrarse automáticamente por el sistema y quedar marcado como cierre automático.
- **Justificación:** Evita turnos zombie.
- **Criticidad:** Media
- **Enforcement esperado:** Backend transaccional + Auditoría
- **Política aprobada:** Auto-cierre operativo a 12 horas.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Turnos abiertos indefinidamente.
- **Ejemplos válidos:** Sistema cierra turno vencido y registra motivo.
- **Ejemplos inválidos:** Turno de 20h sigue activo.
- **Observaciones de implementación:** Esto es política operativa, no un invariante puro de DB.

### R-014 — Acceso operativo requiere turno activo
- **Categoría:** Regla de negocio
- **Descripción formal:** Todo acceso operativo del guarda está respaldado por un turno activo.
- **Actores afectados:** Guarda
- **Alcance:** Registro operativo de entrada/salida
- **Precondiciones:** Guarda autenticado
- **Regla exacta:** Un guarda no puede registrar accesos sin un turno activo válido en la sede objetivo.
- **Justificación:** Sin turno no existe contexto operativo verificable.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Base de datos
- **Política aprobada:** El flujo operativo nunca admite acceso sin turno.
- **Estado actual / alineación con implementación:** **Desalineada hoy**
- **Evidencia:** `services/api/accesos/views.py`, `services/api/accesos/migrations/0027_access_invariants_hardening.py`
- **Riesgo si no se implementa:** Accesos apócrifos.
- **Ejemplos válidos:** Guarda con turno registra entrada.
- **Ejemplos inválidos:** Guarda sin turno registra salida.
- **Observaciones de implementación:** La contingencia no debe reutilizar el mismo endpoint.

### R-015 — Flujo de contingencia separado para accesos excepcionales
- **Categoría:** Requisito funcional
- **Descripción formal:** Los accesos excepcionales sin turno operativo se gestionan en un flujo separado.
- **Actores afectados:** Admin_Sede, Superadmin
- **Alcance:** Contingencias operativas extraordinarias
- **Precondiciones:** Imposibilidad operativa del flujo normal; sede obligatoria
- **Regla exacta:** El acceso excepcional sin turno solo puede registrarse mediante un flujo de contingencia separado, con motivo tipificado obligatorio, actor autorizado, sede obligatoria, marcador de origen `CONTINGENCIA` y auditoría persistente obligatoria.
- **Justificación:** Permite contingencia sin contaminar el dominio operativo.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Auditoría
- **Política aprobada:** Contingencia separada, no mezclada con el flujo normal.
- **Estado actual / alineación con implementación:** **Desalineada hoy**
- **Evidencia:** La excepción hoy está mezclada en flujos existentes.
- **Riesgo si no se implementa:** Ambigüedad del histórico y abuso administrativo.
- **Ejemplos válidos:** Admin_Sede registra contingencia por caída de scanner con motivo obligatorio.
- **Ejemplos inválidos:** Usar el endpoint operativo normal sin turno y sin marca de contingencia.
- **Observaciones de implementación:** Debe quedar visible en reportes y auditoría.

### R-016 — Consistencia sede-turno-acceso
- **Categoría:** Regla de negocio
- **Descripción formal:** El acceso respaldado por turno debe coincidir con la sede del turno.
- **Actores afectados:** Guarda, Admin_Sede, Superadmin
- **Alcance:** Persistencia de accesos con turno
- **Precondiciones:** Acceso con `turno_id`
- **Regla exacta:** Si un acceso referencia un turno, `Acceso.sede` debe coincidir exactamente con `Turno.sede`.
- **Justificación:** Evita contaminación cross-sede.
- **Criticidad:** Alta
- **Enforcement esperado:** Base de datos + Backend transaccional
- **Política aprobada:** Sede del acceso y sede del turno deben coincidir.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/models.py`, `services/api/accesos/migrations/0027_access_invariants_hardening.py`
- **Riesgo si no se implementa:** Historial corrupto entre sedes.
- **Ejemplos válidos:** Acceso y turno comparten sede.
- **Ejemplos inválidos:** Turno sede A, acceso sede B.
- **Observaciones de implementación:** También validar imports y scripts internos.

### R-017 — Secuencia válida de accesos por usuario
- **Categoría:** Invariante de dominio
- **Descripción formal:** El historial de presencia debe alternar lógicamente entre entrada y salida.
- **Actores afectados:** Guarda, Aprendiz
- **Alcance:** Registro de accesos
- **Precondiciones:** Usuario objetivo válido
- **Regla exacta:** No puede existir doble entrada consecutiva, doble salida consecutiva, ni salida sin entrada previa abierta.
- **Justificación:** Mantiene coherencia del historial operativo.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional
- **Política aprobada:** La secuencia debe ser alternante y coherente.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/views.py`, `services/api/accesos/serializers.py`
- **Riesgo si no se implementa:** Historial imposible.
- **Ejemplos válidos:** ENTRADA -> SALIDA
- **Ejemplos inválidos:** ENTRADA -> ENTRADA
- **Observaciones de implementación:** Unificar la lógica en un solo servicio de dominio.

### R-018 — Consistencia de equipos en ingreso y salida
- **Categoría:** Invariante de dominio
- **Descripción formal:** Los equipos registrados en una salida deben corresponder al conjunto ingresado.
- **Actores afectados:** Aprendiz, Guarda
- **Alcance:** Registro de accesos con equipos
- **Precondiciones:** Acceso con equipos
- **Regla exacta:** En el ingreso solo pueden asociarse equipos propios y aprobados; la salida debe cerrar exactamente el mismo conjunto del ingreso abierto más reciente.
- **Justificación:** Trazabilidad patrimonial completa.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional
- **Política aprobada:** El conjunto de equipos debe permanecer consistente entre entrada y salida.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Entradas/salidas patrimoniales falsas.
- **Ejemplos válidos:** Sale con los mismos 2 equipos con los que entró.
- **Ejemplos inválidos:** Sale con 1 de 2, o con equipo distinto.
- **Observaciones de implementación:** Validar ownership y estado al momento del commit.

### R-019 — QR firmado obligatorio en producción
- **Categoría:** Regla de seguridad
- **Descripción formal:** El canal QR productivo exige garantías criptográficas y anti-replay.
- **Actores afectados:** Aprendiz, Guarda
- **Alcance:** Generación y validación QR
- **Precondiciones:** Ambiente productivo
- **Regla exacta:** En producción, la política de QR debe ser `SIGNED`. Un QR válido requiere firma verificable, sesión válida, expiración vigente y nonce único no reutilizado.
- **Justificación:** Reduce suplantación y replay.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Restricción técnica
- **Política aprobada:** `SIGNED` obligatorio.
- **Estado actual / alineación con implementación:** **Desalineada hoy** si se permite `PLAIN/DUAL` en el entorno productivo.
- **Evidencia:** `services/api/accesos/domain/services/qr_service.py`, `services/api/accesos/domain/services/policy_service.py`
- **Riesgo si no se implementa:** Falsa seguridad del sistema.
- **Ejemplos válidos:** QR firmado vigente y nonce nuevo.
- **Ejemplos inválidos:** QR expirado, firma alterada, nonce repetido.
- **Observaciones de implementación:** Verificar cache compartido como prerrequisito de despliegue.

### R-020 — Documento plano no equivale a QR firmado
- **Categoría:** Regla de seguridad
- **Descripción formal:** La entrada manual por documento es una modalidad de menor confianza.
- **Actores afectados:** Guarda, Admin_Sede
- **Alcance:** Registro manual excepcional
- **Precondiciones:** Política explícita distinta al modo productivo estándar
- **Regla exacta:** El ingreso por documento plano no se considera equivalente de seguridad al QR firmado y solo puede habilitarse por política explícita fuera de producción estándar o por transición controlada.
- **Justificación:** Evita que una modalidad débil degrade la promesa de seguridad.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional
- **Política aprobada:** No equiparar documento plano con QR firmado.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/domain/services/policy_service.py`
- **Riesgo si no se implementa:** Bypass operativo del canal seguro.
- **Ejemplos válidos:** Modo transitorio explícito y auditado.
- **Ejemplos inválidos:** Operar indefinidamente en DUAL como si fuera seguro.
- **Observaciones de implementación:** Separar reporting por modo de registro.

### R-021 — OTP resistente a abuso y no enumeración
- **Categoría:** Regla de seguridad
- **Descripción formal:** Todo OTP debe ser temporal, limitado y no enumerable.
- **Actores afectados:** Aprendiz, cualquier usuario autenticable
- **Alcance:** Reset password, cambio de email y flujos equivalentes
- **Precondiciones:** Solicitud OTP
- **Regla exacta:** Todo OTP expira, limita intentos, limita solicitudes, es de un solo uso y no revela si la cuenta existe o no.
- **Justificación:** Mitiga takeover y enumeración.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Restricción técnica + Auditoría
- **Política aprobada:** OTP con TTL, límites y no enumeración.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/otp_services.py`, `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Brute force, reuso y enumeración.
- **Ejemplos válidos:** OTP correcto dentro de TTL, primer uso.
- **Ejemplos inválidos:** OTP expirado o ya usado.
- **Observaciones de implementación:** Dos confirms simultáneos deben resolverse de forma atómica.

### R-022 — Sesiones seguras con rotación y revocación
- **Categoría:** Regla de seguridad
- **Descripción formal:** Los refresh tokens no pueden ser reutilizables ni sobrevivir sin control a cambios de estado.
- **Actores afectados:** Todos
- **Alcance:** Login, refresh, logout y logout-all
- **Precondiciones:** Sesión autenticada
- **Regla exacta:** Todo refresh token debe almacenarse hasheado, rotarse al uso y quedar revocado al reemplazo o cierre de sesión.
- **Justificación:** Mitiga secuestro de sesión.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Base de datos
- **Política aprobada:** Rotación y revocación obligatorias.
- **Estado actual / alineación con implementación:** **Alineada**
- **Evidencia:** `services/api/accesos/jwt_views.py`, `services/api/accesos/auth_jwt.py`
- **Riesgo si no se implementa:** Reuso de tokens antiguos.
- **Ejemplos válidos:** Un refresh invalida el anterior.
- **Ejemplos inválidos:** El mismo refresh funciona dos veces.
- **Observaciones de implementación:** Mantener pruebas de carrera de refresh.

### R-023 — Históricos de acceso inmutables
- **Categoría:** Regla de auditoría/trazabilidad
- **Descripción formal:** Los accesos históricos no se corrigen por edición destructiva.
- **Actores afectados:** Admin_Sede, Superadmin, Guarda
- **Alcance:** Accesos persistidos
- **Precondiciones:** Acceso histórico existente
- **Regla exacta:** Un acceso histórico no puede editarse; solo admite eliminación lógica autorizada.
- **Justificación:** Preserva evidencia operativa.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Auditoría
- **Política aprobada:** Inmutabilidad histórica + soft-delete autorizado.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/models.py`, `services/api/accesos/views.py`
- **Riesgo si no se implementa:** Manipulación histórica o fugas de registros eliminados.
- **Ejemplos válidos:** Soft-delete autorizado.
- **Ejemplos inválidos:** PATCH sobre acceso histórico.
- **Observaciones de implementación:** Crear manager/queryset canónico que excluya eliminados por defecto.

### R-024 — Auditoría persistente obligatoria
- **Categoría:** Regla de auditoría/trazabilidad
- **Descripción formal:** Toda mutación crítica del dominio debe producir un evento persistente de auditoría.
- **Actores afectados:** Todos los roles con capacidad crítica
- **Alcance:** Roles, sedes, equipos, turnos, accesos, OTP sensibles, bulk actions, branding/control panel
- **Precondiciones:** Acción crítica ejecutada o intentada
- **Regla exacta:** Toda acción crítica debe registrar actor, rol efectivo, sede efectiva, acción, recurso, resultado, timestamp, IP, user-agent y diff cuando aplique.
- **Justificación:** Sin auditoría persistente no hay accountability real.
- **Criticidad:** Alta
- **Enforcement esperado:** Auditoría
- **Política aprobada:** Eventos persistentes obligatorios.
- **Estado actual / alineación con implementación:** **Alineada parcialmente**
- **Evidencia:** `services/api/accesos/models.py`, `services/api/accesos/tests_control_panel.py`
- **Riesgo si no se implementa:** Imposibilidad de investigación seria.
- **Ejemplos válidos:** Cambio de rol genera evento persistente.
- **Ejemplos inválidos:** Soft-delete de acceso deja solo log.
- **Observaciones de implementación:** Los logs son complementarios, no sustitutivos.

### R-025 — Bulk actions restringidas y auditadas
- **Categoría:** Regla de autorización/permisos
- **Descripción formal:** Las operaciones masivas no pueden ampliar alcance ni omitir trazabilidad.
- **Actores afectados:** Admin_Sede, Superadmin
- **Alcance:** Endpoints y jobs masivos
- **Precondiciones:** Bulk action habilitada
- **Regla exacta:** Toda bulk action debe validar cada elemento contra el scope efectivo del actor y debe generar auditoría trazable por lote y/o por elemento.
- **Justificación:** Un fallo aquí escala el impacto del incidente.
- **Criticidad:** Alta
- **Enforcement esperado:** Backend transaccional + Auditoría
- **Política aprobada:** Validación por elemento + trazabilidad.
- **Estado actual / alineación con implementación:** **No formalizada**
- **Evidencia:** No se encontró política exhaustiva equivalente
- **Riesgo si no se implementa:** Incidente masivo cross-sede.
- **Ejemplos válidos:** Aprobar lote de equipos todos dentro de la sede y scope.
- **Ejemplos inválidos:** Lote con IDs de varias sedes procesado en una sola llamada.
- **Observaciones de implementación:** Si no puedes validarlo por elemento, no lo expongas.

---

## Reglas desalineadas con implementación actual

Estas reglas tienen política aprobada clara, pero hoy no están alineadas con el backend:

1. **R-001** — Máximo 4 equipos activos por aprendiz.
2. **R-005** — Máximo 2 admins_sede activos por sede.
3. **R-006** — Fuente única de verdad para permisos y alcance.
4. **R-014 / R-015** — Acceso operativo con turno activo y contingencia separada.
5. **R-019** — QR firmado obligatorio en producción.

---

## Nota final
Este documento congela la política.
El backlog técnico se debe producir aparte, 1:1 con estas reglas.
