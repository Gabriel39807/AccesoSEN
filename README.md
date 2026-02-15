# 🛡️ S.A.D.I - Sistema de Administración y Control de Ingresos  


<p align="center">
  <img src="https://img.shields.io/badge/Estado-En%20Desarrollo-green">
  <img src="https://img.shields.io/badge/Backend-Django-blue">
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB">
  <img src="https://img.shields.io/badge/Mobile-React%20Native-purple">
  <img src="https://img.shields.io/badge/License-Academic-orange">
</p>

---

## 📌 Descripción del Proyecto

**S.A.D.I (Sistema de Administración y Control de Ingresos)** es una plataforma integral desarrollada para el **SENA Tunja - CEGAFE**, que permite gestionar y controlar el acceso de:

- 👨‍🎓 Aprendices
- 👮 Personal de Seguridad
- 🛠️ Administradores
- 💻 Equipos tecnológicos

El sistema permite registrar **entradas, salidas, equipos tecnológicos, turnos del personal de seguridad y alertas en tiempo real**, garantizando seguridad, trazabilidad y control institucional.

---

# 🎯 Objetivos

- Controlar el ingreso y salida de personas.
- Registrar equipos tecnológicos.
- Gestionar turnos del personal de seguridad.
- Implementar autenticación segura con recuperación de contraseña.
- Mejorar la trazabilidad y seguridad del centro de formación.

---

# 🏗️ Arquitectura del Proyecto

```text
SADI/
│
├── services/
│   └── api/              # Backend Django + DRF
│
├── apps/
│   ├── web/              # Frontend Web (Next.js)
│   └── mobile-rn/        # App móvil (React Native + Expo)
│
└── README.md
```


---
# 🔄 Flujo General

- Cliente (Web / Mobile) →
- API REST (Django + DRF) →
- Base de datos PostgreSQL →
- Respuesta autenticada vía JWT

---

# 👥 Roles del Sistema

## 🛠️ Administrador
- Gestión de usuarios
- Gestión de equipos
- Gestión de turnos
- Control de accesos
- Visualización de estadísticas
- Panel administrativo avanzado

---

## 👮 Personal de Seguridad
- Inicio y cierre de turno
- Escaneo QR (persona o equipo)
- Registro de entrada/salida
- Visualización de alertas
- Historial de accesos
- Validación de carnet

---

## 👨‍🎓 Aprendiz
- Registro de equipos tecnológicos
- Consulta de historial de ingresos/salidas
- Perfil personal
- Cambio de contraseña
- Notificaciones
- Soporte y ayuda

---

# 🔐 Sistema de Autenticación

- Inicio de sesión por rol
- Bloqueo por intentos fallidos
- Recuperación de contraseña por código OTP (5 dígitos)
- Cambio obligatorio de contraseña inicial
- Validación de seguridad:
  - Mínimo 8 caracteres
  - 1 mayúscula
  - 1 número
- Control de acceso por rol

---

# 💻 Tecnologías Utilizadas

## 🔙 Backend
- Python 3
- Django
- Django REST Framework
- JWT Authentication
- PostgreSQL
- SQLite (desarrollo)

## 🌐 Frontend Web
- React
- Next.js
- TailwindCSS
- Axios
- React Router

## 📱 Aplicación Móvil
- React Native
- Expo
- Expo Camera (QR Scanner)
- AsyncStorage

## ⚙️ DevOps & Herramientas
- Git & GitHub
- Postman
- VSCode / Cursor
- Figma (UI/UX)
- Lovable (Diseño UI)

---

# 📊 Funcionalidades Principales

### ✅ Control de Acceso
- Escaneo QR
- Validación de carnet
- Registro manual por documento
- Confirmación visual de acceso autorizado/denegado

### 💻 Gestión de Equipos
- Registro de equipo
- Edición de información
- Eliminación
- Estado (Dentro/Fuera del SENA)
- Foto opcional del serial

### 🕒 Gestión de Turnos
- Turno Mañana / Tarde / Noche
- Cierre automático de turno
- Registro de actividad del guardia

### 📈 Paneles con Estadísticas
- Equipos registrados
- Personas dentro
- Alertas recientes
- Registros recientes

---

# 🚀 Instalación del Proyecto

## 🔙 Backend (Django)

```bash
cd services/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Servidor por defecto:

```cpp
http://127.0.0.1:8000/
```
## 🌐 Frontend Web (Next.js)

```bash
cd apps/web
npm install
npm run dev
```
```arduino
http://localhost:3000
```

## 📱 App Móvil (Expo)

```bash
cd apps/mobile-rn
npm install
npx expo start
```

## 🔑 Variables de Entorno (Backend)

Archivo .env:

```bash
DEBUG=True
SECRET_KEY=your_secret_key
DATABASE_NAME=sadi
DATABASE_USER=postgres
DATABASE_PASSWORD=******
DATABASE_HOST=localhost
DATABASE_PORT=5433
```

---

# 📸 Módulos del Sistema

## 🔐 Autenticación

- Login Administrador  
- Login Aprendiz  
- Login Guardia  
- Recuperación de contraseña  
- Verificación OTP  
- Cambio de contraseña  

---

## 👮 Panel de Seguridad

- Escanear QR  
- Digitar documento  
- Checklist de equipos  
- Confirmación de acceso  
- Alertas  

---

## 👨‍🎓 Panel Aprendiz

- Mis Equipos  
- Historial  
- Perfil  
- Soporte  
- Notificaciones  

---

# 🛡️ Seguridad Implementada

- JWT Authentication  
- Protección contra intentos fallidos  
- Bloqueo temporal de cuenta  
- Validación de contraseña fuerte  
- Control de acceso por rol  
- Verificación de turno activo  

---

# 📌 Estado Actual del Proyecto

✔ Backend funcional  
✔ Frontend Web funcional  
✔ App móvil funcional  
✔ Control de accesos operativo  
✔ Registro de equipos operativo  
✔ Gestión de turnos implementada  

🔄 Mejoras en UI/UX  
🔄 Optimización de rendimiento  
🔄 Preparación para producción  

---

# 🗺️ Próximas Mejoras

- Implementación de CI/CD
- Tests unitarios y de integración
- Sistema de auditoría avanzada
- Despliegue en entorno cloud
  
---

# 📍 Centro de Formación

**SENA - Tunja**  
Centro de Gestión Administrativa y Fortalecimiento Empresarial (CEGAFE)  
Año: 2026 

---

# 👨‍💻 Autor

**Gabriel Santiago Pico Santos**  
**Juan Sebastian Mora Benitez**

Proyecto académico SENA 2026  
Análisis y Desarrollo de Software  
