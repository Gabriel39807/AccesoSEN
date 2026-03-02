# 🛡️ S.A.D.I — Sistema de Control de Acceso y Activos "Sistema de Acceso Digital Institucional"

<p align="center">
  <img src="https://img.shields.io/badge/Estado-En%20Desarrollo-green" />
  <img src="https://img.shields.io/badge/Backend-Django%20%2B%20DRF-blue" />
  <img src="https://img.shields.io/badge/Web-Next.js-black" />
  <img src="https://img.shields.io/badge/Mobile-Expo%20React%20Native-purple" />
  <a href="https://github.com/Gabriel39807/S.A.D.I/actions/workflows/ci.yml">
    <img src="https://github.com/Gabriel39807/S.A.D.I/actions/workflows/ci.yml/badge.svg?branch=dev" />
  </a>
</p>

---

## 📌 Descripción

**S.A.D.I (Sistema de Acceso Digital Institucional)** es una plataforma institucional para controlar y auditar accesos, diseñada como solución integral:

- 👨‍🎓 Aprendices
- 👮 Personal de Seguridad
- 🛠️ Administradores
- 💻 Equipos tecnológicos

Incluye registro de **entradas/salidas**, gestión de **equipos**, **turnos**, y flujos de **autenticación segura** con OTP.

---

## 🎯 Objetivos

- Controlar ingreso y salida de personas.
- Registrar y auditar equipos tecnológicos.
- Gestionar turnos del personal de seguridad.
- Autenticación segura (JWT + refresh por dispositivo) y recuperación con OTP.
- Mejorar trazabilidad, seguridad y control institucional.

---

## 🏗️ Arquitectura del Proyecto

```text
SADI/
│
├── services/
│   └── api/              # Backend Django + DRF
│
├── apps/
│   ├── web/              # Frontend Web (Next.js)
│   └── mobile-rn/        # App móvil (Expo React Native)
│
└── README.md
```
## 🔄 Flujo General
```text
[Web Next.js] ------\
                     >---- [Django + DRF API] ---- [PostgreSQL]
[Mobile Expo RN] ---/              |
                                   +---- [Redis cache/rate-limit]
```
- Web y Mobile consumen la API REST
- JWT corto + refresh token por dispositivo (hash, rotación y revocación)
- OTP por correo para recuperación/cambio de correo
- Roles: `superadmin`, `admin_sede`, `guarda`, `aprendiz`

---

## 👥 Roles del Sistema

### 🛠️ Administrador
- Gestión de usuarios / sedes (según rol)
- Gestión de equipos
- Gestión de turnos
- Estadísticas y auditoría operativa

### 👮 Personal de Seguridad
- Inicio y cierre de turno
- Registro entrada/salida (QR o manual)
- Alertas e historial
- Validación operativa en punto de control

### 👨‍🎓 Aprendiz
- Registro y administración de equipos
- Consulta de historial
- Perfil / cambio de contraseña
- Notificaciones

---

## 🔐 Autenticación y Seguridad
- Inicio de sesión por rol
- Bloqueo temporal / rate limit
- OTP por correo (recuperación)
- Refresh token por dispositivo y logout por dispositivo/global

### 📱 Flujo biométrico (Mobile)
- Login normal: `POST /api/auth/login/` y guarda refresh en `SecureStore`
- Huella: biometría local + `POST /api/auth/refresh/` con `device_id`
- Logout dispositivo: `POST /api/auth/logout/`
- Logout global: `POST /api/auth/logout-all/`

---

## 💻 Tecnologías

## 🔙 Backend
- Python + Django + DRF
- PostgreSQL (prod) / SQLite (dev)
- Redis (cache / rate-limit)

## 🌐 Web
- Next.js
- Lint + typecheck + build en flujo de calidad

## 📱 Mobile
- Expo React Native
- Lint + typecheck

---

# 🚀 Instalación (Quickstart)

1) 🔙 API (sin Docker)

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

API: http://localhost:8000

2) 🌐 Web

```bash
cd apps/web
cp .env.example .env
npm ci
npm run dev
```
Web: http://localhost:3000

3) 📱 Mobile

```bash
cd apps/mobile-rn
cp .env.example .env
npm ci
npx expo start
```

---

# 🐳 Docker Compose (local)

```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
docker compose build api web
docker compose up -d
```
API: http://localhost:8000

Web: http://localhost:3000

Migraciones + superusuario:

```bash
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

# 🏭 Producción (resumen)

1. Configura services/api/.env con DJANGO_ENV=production + secretos reales 
2. Build + up:

```bash
docker compose build api web
docker compose up -d
```

3. Validación:

```bash
curl http://localhost:8000/health/
curl http://localhost:8000/ready/
```

Guía: docs/deploy-production.md

## 🔑 Variables de Entorno (claves)

### API — `services/api/.env`
- `DJANGO_ENV`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`
- `DATABASE_*`
- `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- `EMAIL_*`, `JWT_*`
- `REFRESH_TOKEN_PEPPER`
- `GUARDA_SINGLE_ACTIVE_SESSION`

📄 Template Supabase (DB): `services/api/env.supabase.production.example`

---

### Web — `apps/web/.env`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_TIMEOUT_MS` (opcional)
- Variables opcionales Supabase (si aplica)

---

### Mobile — `apps/mobile-rn/.env`
- `EXPO_PUBLIC_API_URL`
- Variables opcionales Supabase (si aplica)

---

## 📚 OpenAPI / Swagger
- OpenAPI JSON: `http://localhost:8000/api/openapi.json`
- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`

---
# 🧩 Seeds institucionales

```bash
cd services/api
python manage.py seed_institution --profile generic
```

Perfiles:

`generic` -> `sede-1` ... `sede-4`

`sena` -> sedes institucionales históricas (si se requiere branding)

# ✅ Calidad y chequeos

Ejecución rápida:

```bash
cmd /c check.cmd
```
O
```bash
bash ./check.sh
```
## 🧯 Troubleshooting

- Mobile no conecta: revisa `EXPO_PUBLIC_API_URL` y usa la IP real de tu máquina
- Login falla fuera de red: URLs no deben apuntar a `localhost`
- 401/423: bloqueo temporal / rate limits / expiración JWT
- `ready` 503: revisar DB/cache/variables

---

## 🧱 RBAC y políticas dinámicas (BD)

**Modelos:**
- `Role`, `Permission`, `RolePermission` (scope: `GLOBAL | SEDE | OWN`)
- `UserMembership`, `SedePolicy`, `AllowedEmailDomain`

**Nota:**
- La migración `0014_rbac_policies_and_domains` crea roles base, permisos, memberships y policies

---

## 🔐 Seguridad
- Consulta `SECURITY.md` para política de reporte

---

## 👨‍💻 Autores
- Gabriel Santiago Pico Santos
- Juan Sebastián Mora Benítez
