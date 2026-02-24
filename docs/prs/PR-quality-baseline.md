# PR: Quality Baseline (dev)

## Scope
Stabilize quality gates without changing business features:
- Repository hygiene checks/documentation
- Backend lint + format + additional edge tests
- Web/mobile explicit typecheck steps
- CI pipeline hardening

## Changes
- Added backend lint/format toolchain:
  - `services/api/pyproject.toml` (`ruff` + `black` config)
  - `services/api/requirements.txt` includes `ruff` and `black`
  - Black check is scoped to auth/session/rate-limit modules to avoid high-risk repo-wide reformat in this baseline pass.
- Extended backend tests (`services/api/accesos/tests.py`) for:
  - Invalid `sid` JWT rejection
  - `SALIDA` without prior `INGRESO`
  - `Turno` with `fin < inicio` DB constraint
  - Expired OTP verification rejection
- Added TypeScript typecheck scripts:
  - `apps/web/package.json`
  - `apps/mobile-rn/package.json`
- Updated quality runners:
  - `check.sh`
  - `check.cmd`
- Updated CI:
  - `.github/workflows/ci.yml` adds backend ruff/black + web/mobile typecheck
- Documentation:
  - `README.md` adds CI badge, architecture diagram, and granular validation commands
  - `CONTRIBUTING.md` adds local quality commands and rollback guide
  - `docs/repo-history-cleanup.md` adds safe `git filter-repo` procedure

## Risks
- Backend ruff/black gates may surface pre-existing style debt in future code additions.
- Web lint still carries a temporary `no-explicit-any` override in `apps/web/package.json` until gradual typing cleanup is completed.

## Validation
1. `cmd /c check.cmd` (Windows) or `bash ./check.sh` (Unix-like)
2. `docker compose up --build`
3. Open:
   - API health: `http://localhost:8000/health/`
   - Web app: `http://localhost:3000`

## Rollback
1. `git revert <commit_sha>`
2. Re-run `check.cmd` / `check.sh`
3. Push revert commit to `dev`
