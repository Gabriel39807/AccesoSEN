# Env Matrix Operativa

Fecha: 2026-03-17

## Web

- `NEXT_PUBLIC_API_URL`
  - Obligatoria
  - Base URL oficial de la API para el release actual
- `NEXT_DISABLE_EDGE_AUTH_GUARD`
  - Solo para testing local controlado
  - Nunca habilitar en release

## Backend

- `DJANGO_ENV`
  - `development` o `production`
- `DJANGO_SECRET_KEY`
  - Obligatoria
- `DJANGO_ALLOWED_HOSTS`
  - Obligatoria en release
- `CORS_ALLOWED_ORIGINS`
  - Debe incluir el host real del frontend
- `CSRF_TRUSTED_ORIGINS`
  - Debe incluir el host HTTPS real del frontend
- `DATABASE_URL` o configuracion equivalente
  - Obligatoria en release
- `DATABASE_SQLITE_NAME`
  - Solo soporte operativo local para smoke/integracion aislada
- `WEBAUTHN_MOCK`
  - `false` en cualquier entorno que pretenda parecerse a release

## Mobile

- `EXPO_PUBLIC_API_URL`
  - Obligatoria si mobile entra en el alcance del release

## Reglas

- Ninguna app debe depender de hosts hardcodeados.
- Los smoke integrados deben usar variables reales del entorno de prueba.
- Una prueba mockeada no sustituye una corrida con esta matriz aplicada.
