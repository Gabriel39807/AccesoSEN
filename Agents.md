# AGENTS.md — Guía de trabajo para Agentes de IA (S.A.D.I)

## 0) Objetivo
Mejorar el proyecto S.A.D.I para que sea **estable**, **bonito** y **funcional**, sin cambiar su esencia:
- Control de acceso (personas + equipos)
- Roles: Administrador / Aprendiz / Personal de Seguridad
- Backend Django/DRF + PostgreSQL
- Frontend Web React
- App móvil React Native (Expo)

El agente tiene libertad para proponer y aplicar mejoras, pero solo se aceptan cambios que cumplan los **criterios de aceptación**.

---

## 1) Principios no negociables (No tocar sin aprobación explícita)
El agente NO puede cambiar sin aprobación previa:

1. Stack principal (Django/DRF, PostgreSQL, React, Expo)
2. Modelo de roles y permisos (Administrador, Aprendiz, Guarda)
3. Contratos API existentes (endpoints, campos, formatos) **salvo compatibilidad garantizada**
4. Semántica del negocio:
   - No permitir salida sin una entrada válida (si aplica la regla actual del negocio)
   - No permitir inconsistencias de equipos vs accesos (equipo sale/entra sin correspondencia)  
5. Estructura general del repo (no re-arquitecturas tipo “clean architecture” o microservicios)

Si el agente cree que debe tocar algo de esto:
- Debe detenerse, etiquetar el cambio como **PROPUESTA ARQUITECTÓNICA** y pedir aprobación.

---

## 2) Libertad permitida (Con control)
El agente PUEDE:

### 2.1 Estabilidad
- Corregir bugs
- Mejorar validaciones
- Corregir flujos rotos
- Manejo robusto de errores en frontend/móvil

### 2.2 Calidad de código
- Refactors localizados (archivos grandes, duplicación, nombres, separación de responsabilidades)
- Mejoras de legibilidad y consistencia

### 2.3 Performance
- Optimizar consultas ORM (select_related/prefetch_related, evitar N+1)
- Paginación y filtros eficientes
- Evitar renders/re-fetches innecesarios en React/RN

### 2.4 UX/UI (Bonito pero sin “rediseñar todo”)
- Mejorar consistencia visual
- Mejor feedback (loading/error/empty states)
- Accesibilidad básica (labels, contraste razonable, focus)
- Componentización si reduce caos

### 2.5 Seguridad
- Endurecer permisos
- Validar inputs
- Evitar exposición de datos
- Mejorar manejo de tokens/sesión
- Rate limiting / protección contra abuso si es viable

---

## 3) Criterios de aceptación (Gates)
Ningún cambio se considera “listo” si no cumple:

### Backend
- No rompe endpoints existentes
- No rompe serialización esperada por frontend
- Mantiene permisos correctos por rol
- Incluye tests cuando se modifica lógica de negocio
- No introduce migraciones peligrosas (no reescribir migraciones aplicadas)

### Frontend Web / Mobile
- No rompe navegación principal
- Manejo correcto de estados:
  - loading
  - error
  - vacío
  - éxito
- No hardcodear URLs (usar env/config)
- Sin logs de debug (console.log/print) en producción

### General
- No introducir dependencias “porque sí”
- Cambios deben ser explicables y auditables

---

## 4) Trabajo por etapas (Obligatorio)
El agente debe trabajar en este orden:

1) **Diagnóstico**
- Lista de fallos reales detectados (no supuestos)
- Riesgo e impacto

2) **Plan**
- Checklist de cambios, priorizado

3) **Implementación**
- Cambios en bloques pequeños y revisables
- Cada bloque con explicación de qué y por qué

4) **Validación**
- Cómo probar (pasos exactos)
- Qué tests corrieron / se añadieron

---

## 5) Breaking Changes (Regla estricta)
Si un cambio rompe compatibilidad (API, DB, UI flow):
- Debe marcarse como **BREAKING CHANGE**
- Debe proponer alternativa compatible
- No puede aplicarse sin aprobación explícita

---

## 6) Reporte obligatorio por cada entrega
Cada PR/entrega debe incluir:

- Resumen (1–3 líneas)
- Lista de cambios
- Riesgos
- Pasos para probar
- Evidencia (tests/validaciones)

---

## 7) Política de suposiciones
Prohibido asumir:
- Campos que no existan
- Endpoints que no existan
- Reglas del negocio no confirmadas

Si falta info:
- El agente debe buscar en el código del repo y basarse en eso.
- Si sigue incierto, debe proponer opciones y detenerse.

---

## 8) Enfoque “Estable primero”
Prioridad:
1) Bugs y consistencia del negocio
2) Seguridad y permisos
3) Performance
4) UX/UI (sin rediseño masivo)
5) Refactors estéticos

---

## 9) Recordatorio final
Libertad ≠ reescribir el proyecto.
La meta es: **mejor sin sorpresas**.
