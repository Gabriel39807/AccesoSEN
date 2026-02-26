# SADI "Sistema De Acceso Digital Institucional"

[![CI](https://github.com/Gabriel39807/S.A.D.I/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Gabriel39807/S.A.D.I/actions/workflows/ci.yml)

Sistema de control de accesos institucional con:
- Backend: Django + DRF (`services/api`)
- Frontend web: Next.js (`apps/web`)
- Mobile: Expo React Native (`apps/mobile-rn`)

## Arquitectura resumida
- `apps/web` y `apps/mobile-rn` consumen la API REST.
- Access JWT corto + refresh token por dispositivo (hash en backend, rotacion y revocacion).
- Flujos OTP por correo para recuperacion/cambio de correo.
- Roles principales: `superadmin`, `admin_sede`, `guarda`, `aprendiz`.

Diagrama textual:
```
[Web Next.js] ------\
                     >---- [Django + DRF API] ---- [PostgreSQL]
[Mobile Expo RN] ---/              |
                                   +---- [Redis cache/rate-limit]
```

## Quickstart local (sin Docker)
### 1) API
```bash
cd services/api
cp .env.example .env
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2) Web
```bash
cd apps/web
cp .env.example .env
npm ci
npm run dev
```

### 3) Mobile
```bash
cd apps/mobile-rn
cp .env.example .env
npm ci
npx expo start
```

## Quickstart local (Docker Compose)
```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
docker compose build api web
docker compose up -d
```

API: `http://localhost:8000`  
Web: `http://localhost:3000`

Migraciones y superusuario (contenedor API):
```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

## Produccion (resumen)
1. Configurar `services/api/.env` con `DJANGO_ENV=production` y secretos reales.
2. Build + up:
```bash
docker compose build api web
docker compose up -d
```
3. Validar:
```bash
curl http://localhost:8000/health/
curl http://localhost:8000/ready/
```

Guia completa: `docs/deploy-production.md`

## Variables de entorno clave
### API (`services/api/.env`)
- `DJANGO_ENV`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_*`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `EMAIL_*`
- `JWT_*`
- `REFRESH_TOKEN_PEPPER`
- `GUARDA_SINGLE_ACTIVE_SESSION`

Perfiles sugeridos:
- `development`: `DJANGO_DEBUG=true`, SQLite o Postgres local, `WEBAUTHN_MOCK=true`.
- `test`: SQLite temporal + `DJANGO_SECRET_KEY` efimera (usado por pytest/CI).
- `production`: `DJANGO_DEBUG=false`, Postgres obligatorio, `REDIS_URL` configurado, `WEBAUTHN_MOCK=false`.

### Web (`apps/web/.env`)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL` (opcional, si usas `supabase-js`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (opcional, nunca `service_role`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (opcional, fallback legacy)

### Mobile (`apps/mobile-rn/.env`)
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL` (opcional, si usas `supabase-js`)
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (opcional, nunca `service_role`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (opcional, fallback legacy)

## Calidad y chequeos
```bash
cmd /c check.cmd
```
o
```bash
bash ./check.sh
```

Comandos granulares:
```bash
# Backend (Windows)
cd services/api
.\.venv\Scripts\python.exe -m ruff check accesos accesosen_api
.\.venv\Scripts\python.exe -m black --check accesos/auth_jwt.py accesos/jwt_views.py accesos/rate_limit.py accesos/otp_services.py
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30
```

```bash
# Web
cd apps/web
npm ci
npm run lint
npm run typecheck
npm run build
```

```bash
# Mobile
cd apps/mobile-rn
npm ci
npm run lint
npm run typecheck
```

## Troubleshooting
- Error de conexion desde mobile:
  - revisa `EXPO_PUBLIC_API_URL` con la IP real de tu maquina.
- Login falla fuera de tu red:
  - verifica que `NEXT_PUBLIC_API_URL` y `EXPO_PUBLIC_API_URL` apunten al backend publico, no a `localhost` ni directo a `*.supabase.co`.
- 401/423 en login:
  - valida bloqueo temporal/rate limits y expiracion JWT.
- Sesion biometrica no disponible en mobile:
  - verifica que el telefono tenga biometria configurada y que exista un login previo para ese dispositivo.
- `ready` en 503:
  - revisar DB/cache y variables de entorno.

## Flujo biometrico mobile
- Login normal: `POST /api/auth/login/` (compatible con `/api/token/`) y guarda `refresh` en `SecureStore`.
- Entrar con huella: valida biometria local, luego usa `POST /api/auth/refresh/` con `device_id`.
- Logout por dispositivo: `POST /api/auth/logout/`.
- Logout global: `POST /api/auth/logout-all/`.

Prueba E2E recomendada:
1. Inicia sesion normal en mobile (aprendiz o guarda) y cierra la app.
2. Reabre la app y entra con "Entrar con huella".
3. Verifica que puedes consumir endpoints protegidos.
4. Ejecuta logout (o logout-all) y confirma que un refresh posterior devuelve 401.

## Seguridad
Consulta `SECURITY.md` para politica de reporte.

## RBAC y politicas dinamicas (BD)
El backend ahora soporta autorizacion data-driven con estos modelos:
- `Role`
- `Permission`
- `RolePermission` (scope: `GLOBAL | SEDE | OWN`)
- `UserMembership` (usuario + rol + sede)
- `SedePolicy` (max equipos, QR mode, turno activo, etc.)
- `AllowedEmailDomain` (dominios permitidos por rol/sede)

La migracion `0014_rbac_policies_and_domains` crea y siembra:
- roles base (`superadmin`, `admin_sede`, `guarda`, `aprendiz`)
- permisos base y matriz inicial de scopes
- memberships primarias desde `Usuario.rol`
- policy por sede (defaults)
- dominios de correo permitidos por rol (incluye compatibilidad inicial)

## OpenAPI / Swagger
- JSON OpenAPI: `http://localhost:8000/api/openapi.json`
- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`

## Seeds institucionales
Puedes sembrar sedes por perfil sin tocar codigo:
```bash
cd services/api
python manage.py seed_institution --profile generic
```
Perfiles disponibles:
- `generic` -> `sede-1` ... `sede-4`
- `sena` -> sedes institucionales historicas (solo si se requiere branding especifico)
