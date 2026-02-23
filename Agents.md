# SADI – Agents Architecture & Responsibility Guide

## Overview

SADI (Sistema de Acceso Digital Institucional) is a multi-tenant, multi-sede access and asset control system.

The system enforces strict backend-driven RBAC and domain isolation.

This document defines:

- System agents
- Their permissions
- Invariants
- Security rules
- Domain constraints
- Non-negotiable backend guarantees

This file serves as a contract between business logic and implementation.

---

# 1. Core Agents

## 1.1 Superadmin

Scope: Global

Capabilities:
- Full CRUD over all resources
- Create / delete sedes
- Assign roles
- Approve or reject equipos
- View and manage all accesos
- Manage turnos globally

Restrictions:
- Must not bypass audit logging
- Critical destructive actions must be logged

Security Requirements:
- Must be protected by strict authentication
- Should support optional 2FA (recommended)

---

## 1.2 Admin_Sede

Scope: Single Sede

Capabilities:
- Manage guardas and aprendices within own sede
- Approve/reject equipos within own sede
- View and manage accesos in own sede
- Manage turnos within own sede

Restrictions:
- Cannot create other admins
- Cannot access data from other sedes
- Cannot escalate privileges

Backend Guarantees:
- All queryset filtering must enforce sede isolation
- No frontend-only enforcement allowed

---

## 1.3 Guarda (Mobile)

Scope: Active Turno + Assigned Sede

Capabilities:
- Start turno
- End turno
- Scan QR codes
- Register entrada/salida
- Select associated equipo

Restrictions:
- Cannot register access without active turno
- Cannot operate outside turno.sede
- Cannot modify historical accesos

Critical Invariants:
- Only one active turno per guarda
- Turno must be explicitly closed or auto-expired

---

## 1.4 Aprendiz (Web + Mobile)

Scope: Self

Capabilities:
- Manage up to 4 equipos
- View own access history
- Generate dynamic QR
- Update profile (phone + email)
- Change password
- Verify email via OTP

Restrictions:
- Cannot access other users' data
- Cannot exceed 4 equipos
- Can edit/delete equipo only if status == PENDIENTE

Security Requirements:
- QR must be cryptographically signed
- QR must expire
- OTP must have rate limiting
- Session handling must support multi-device securely

---

# 2. Domain Invariants (Non-Negotiable)

1. Max 4 equipos per aprendiz (DB-level enforcement)
2. Only 1 active turno per guarda
3. No acceso without active turno
4. Acceso.sede must match turno.sede
5. Strict sede isolation
6. No implicit permission defaults
7. All role evaluation must use UserMembership as source of truth
8. Soft-delete for critical historical entities (Acceso recommended)

---

# 3. Security Architecture

## 3.1 Role System

- UserMembership is the single source of truth
- No legacy role fallback allowed
- Permission evaluation must fail securely

## 3.2 QR System

QR must contain:
- user_id
- session_id or device_id
- expiration timestamp
- nonce
- signature (HMAC or asymmetric)

Replay attacks must be impossible.

## 3.3 OTP

- Expiration time
- Max attempts
- Rate limiting
- Audit log of failures

---

# 4. Technical Standards

- Fail securely by default
- No permissive defaults
- No implicit access
- All business rules enforced in backend
- DB constraints for critical invariants
- Automated tests for privilege escalation attempts

---

# 5. Definition of “Production Ready”

The system is considered production-ready when:

- No cross-sede data leakage is possible
- No privilege escalation is possible
- All invariants are DB-enforced
- All endpoints require explicit permission mapping
- Critical operations are audited
- QR replay is impossible
- OTP brute-force is mitigated
- Test coverage includes adversarial cases

---

End of document.