# Security Audit - 2026-02-23

Scope audited:
- `services/api/accesos/*`
- `services/api/accesosen_api/*`

Threat model used:
- malicious API clients
- ID tampering
- concurrent requests / replay attempts

## Verified Findings (Code-Backed)

### Critical

1) Distributed cache safety in production was not enforced
- Evidence:
  - `services/api/accesosen_api/base.py:66` (`LocMemCache` fallback)
  - `services/api/accesosen_api/base.py:225` (`CACHES` setup)
- Risk:
  - OTP/rate-limit/replay protections become per-process in multi-worker deploys.
- Fix implemented:
  - Redis cache support via `REDIS_URL` (`services/api/accesosen_api/base.py:51-64`)
  - fail-fast guard in production if LocMem is used (`services/api/accesosen_api/base.py:71-82`, `:266-269`)

2) QR replay race condition (non-atomic replay key write)
- Evidence:
  - replay protection function at `services/api/accesos/domain/services/qr_service.py:109`
  - now uses atomic cache add at `services/api/accesos/domain/services/qr_service.py:112`
- Risk:
  - two concurrent scans of same token can pass if replay key set is non-atomic.
- Fix implemented:
  - switched replay lock to atomic `cache.add(...)` (`services/api/accesos/domain/services/qr_service.py:112`)

3) Access log deletion authorization too permissive for guard
- Evidence:
  - access viewset now wired to mandatory RBAC map:
    - `services/api/accesos/views.py:1924` (`AccesoViewSet`)
    - `services/api/accesos/views.py:1926` (`permission_classes = [IsAuthenticated, RequiresPermission]`)
    - `services/api/accesos/views.py:1929` (`permission_map`)
    - `services/api/accesos/views.py:2478` (`destroy` soft-delete)
- Risk:
  - unauthorized destructive operations on historical access logs.
- Fix implemented:
  - `destroy` requires `acceso.delete` permission (deny by default).
  - new migration seeds `acceso.delete` only for `superadmin` and `admin_sede`:
    - `services/api/accesos/migrations/0018_acceso_delete_permission_seed.py:10`

4) Turn start concurrency handling (TOCTOU) not fully controlled
- Evidence:
  - turno normalize helper:
    - `services/api/accesos/views.py:405` (`_normalize_active_turnos`)
  - transactional start + controlled integrity conflict:
    - `services/api/accesos/views.py:1784` (`iniciar`)
    - `services/api/accesos/views.py:1797` (`transaction.atomic`)
    - `services/api/accesos/views.py:1815` (`except IntegrityError`)
- Risk:
  - race between "check active turno" and create could produce 500 or duplicate attempts.
- Fix implemented:
  - atomic start flow
  - controlled `TURNO_ALREADY_ACTIVE` response on integrity conflict (409)

### High

5) Action-level SEDE permission evaluation denied legitimate scoped actions
- Evidence:
  - `AuthorizationService.has_perm` now supports action-level SEDE checks without object (`services/api/accesos/domain/services/authorization.py:165-174`)
- Risk:
  - inconsistent authorization behavior, accidental false-denies and ad-hoc bypasses.
- Fix implemented:
  - allow SEDE permission at action-level only if user has active sede membership.

6) Legacy `user.rol` used in business paths (drift vs membership authority)
- Evidence and fixes:
  - admin_sede quota now membership-based:
    - `services/api/accesos/views.py:222-236`
  - notifications role filter now membership-based:
    - `services/api/accesos/views.py:1389-1395`
  - email domain checks now use effective role resolver:
    - `services/api/accesos/views.py:751`
    - `services/api/accesos/serializers.py:256`
  - serializer role checks switched from legacy field to membership:
    - `services/api/accesos/serializers.py:306`
    - `services/api/accesos/serializers.py:367`

### Medium

7) Rate-limit counter bump not atomic under concurrency
- Evidence:
  - atomic add/incr now at `services/api/accesos/rate_limit.py:51-56`
- Risk:
  - counter inaccuracies under parallel brute-force attempts.
- Fix implemented:
  - `cache.add` + `cache.incr` with fallback.

## Checklist Verification Notes

- `WEBAUTHN_MOCK`: FOUND at `services/api/accesosen_api/base.py:264`.
- Production guard for `WEBAUTHN_MOCK=true`: implemented at `services/api/accesosen_api/base.py:79-82`.
- QR payload includes signed/session-bound claims:
  - `sid`, `uid`, `nonce`, `exp` at `services/api/accesos/domain/services/qr_service.py:83-87`.

## Patch Set Applied

Modified:
- `services/api/accesosen_api/base.py`
- `services/api/accesos/domain/services/qr_service.py`
- `services/api/accesos/rate_limit.py`
- `services/api/accesos/api/permissions.py`
- `services/api/accesos/domain/services/authorization.py`
- `services/api/accesos/views.py`
- `services/api/accesos/serializers.py`
- `services/api/accesos/tests.py`

Added:
- `services/api/accesos/migrations/0018_acceso_delete_permission_seed.py`

## Automated Tests Added/Updated

New/updated tests:
- `services/api/accesos/tests.py:1248`
  - `test_guarda_cannot_delete_acceso_log`
- `services/api/accesos/tests.py:1262`
  - `TurnoConcurrencySafetyTests`
- `services/api/accesos/tests.py:1312`
  - `LegacyRolePrecedenceTests`
- Existing security coverage retained:
  - `test_qr_signed_replay_attempt_is_blocked` (`services/api/accesos/tests.py:1192`)
  - `test_requires_permission_denies_when_permission_map_missing` (`services/api/accesos/tests.py:1164`)

## Validation Run

Executed:
- `./.venv/Scripts/python manage.py check`
- `./.venv/Scripts/python manage.py test accesos.tests`

Result:
- `check`: OK
- backend test suite (`accesos.tests`): OK

## Backward Compatibility / Deprecation Notes

- Legacy role field `Usuario.rol` still exists for compatibility and migration safety.
- Authorization runtime uses membership as authority in critical paths.
- Delete behavior for access logs is now stricter (guard denied by default).

## Remaining Risks / TODOs

1) Legacy compatibility path in JWT auth
- `services/api/accesos/auth_jwt.py` still allows tokens without `sid` (compat mode).
- Recommendation: deprecate and disable sid-less token acceptance on a defined date.

2) Remaining legacy-role references
- Some non-critical/update paths still read `Usuario.rol` for compatibility.
- Recommendation: complete staged deprecation by moving all role checks to membership resolver.

3) Viewset modularization
- API router imports wrappers that re-export from monolithic `views.py`.
- Recommendation: finish split to dedicated viewset modules to reduce regression surface.

