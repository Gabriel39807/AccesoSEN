# Cambios SADI - 2026-02-15

## Resumen
Se implementaron mejoras de estabilidad, seguridad y consistencia en backend + web + mobile, manteniendo endpoints existentes y agregando endpoints compatibles para reanudacion de turno, errores estandar y carga masiva de aprendices.

## Lista de cambios
- JWT y sesion guarda:
  - `SadiTokenObtainPairView/Serializer` con codigos de error estandar.
  - Sesion activa unica para guarda (`active_session_id`) para evitar multiples sesiones sin control.
  - Refresh token habilitado en cliente web/mobile con reintento automatico.
- Turnos guarda:
  - Nuevo `GET /api/guardia/estado-actual/`.
  - Nuevo `POST /api/turnos/reanudar/` idempotente.
  - Se conserva `GET /api/turnos/actual/` compatible.
- Errores UI-friendly:
  - Nuevo formato estandar backend `{code,message,detail,field}`.
  - Se mantiene compatibilidad con `permitido/motivo`.
  - Catalogo inicial aplicado en login, OTP, turnos y accesos.
- OTP:
  - OTP de 5 digitos, expiracion 5 minutos, limite de intentos, limite de solicitudes.
  - Canal `email` y `whatsapp` desacoplado por servicio (`otp_services.py`).
  - Invalidacion de OTP restante tras confirmacion exitosa.
- Importacion masiva Excel (2 fases):
  - Validacion previa: `POST /api/usuarios/importar-aprendices/validar/`.
  - Confirmacion: `POST /api/usuarios/importar-aprendices/confirmar/`.
  - Reglas: columnas exactas, obligatorios, correo institucional `*.sena.edu.co`, duplicados en archivo.
  - Upsert por documento (actualiza o crea aprendiz).
  - Auditoria persistente (`AprendizImportAudit`).
- Validaciones criticas:
  - Reglas de entrada/salida/equipos reforzadas y codificadas.
  - Requiere turno activo para operaciones del guarda.

## Riesgos
- Se agregaron campos nuevos en `Usuario` y `PasswordResetOTP`; requiere aplicar migraciones.
- Si no se instala `openpyxl`, la validacion de Excel fallara.
- El canal WhatsApp queda preparado por adapter; para produccion se debe configurar proveedor real.

## Pasos para probar
1. Backend:
   - Instalar dependencias (`openpyxl` incluida).
   - Ejecutar migraciones.
   - Verificar login: credenciales invalidas y lock temporal.
   - Verificar reanudacion: iniciar turno, cerrar app, volver y consultar `/api/guardia/estado-actual/` + `/api/turnos/reanudar/`.
   - Verificar OTP email/whatsapp con codigos y limites.
   - Probar importacion en 2 fases con archivo valido e invalido.
2. Mobile/Web:
   - Expirar token de acceso y confirmar refresh automatico.
   - Validar mensajes por `code` en errores comunes.

## Evidencia de validacion
- `python -m py_compile` sobre archivos backend modificados: OK.
- `npx tsc --noEmit` en `apps/web`: OK.
- `npx tsc --noEmit` en `apps/mobile-rn`: OK.
- `manage.py check`/tests Django no ejecutados por entorno local sin Django instalado en venv actual.
