# Contributing

## Branching
- Base branch for integration: `dev`
- Production releases merge from `dev` to `main` only after CI green.

## Commit style
Use Conventional Commits:
- `feat(scope): ...`
- `fix(scope): ...`
- `chore(scope): ...`
- `docs(scope): ...`
- `refactor(scope): ...`
- `test(scope): ...`

Examples:
- `feat(api): add health and readiness endpoints`
- `fix(web): handle 403 with explicit user message`

## Pull request checklist
- [ ] Scope is small and reviewable.
- [ ] Includes tests or explicit test notes.
- [ ] Includes rollback instructions.
- [ ] No secrets or local artifacts committed.
- [ ] CI passes.

## Repo hygiene
- Keep `.env`, virtualenvs, `node_modules`, `.next`, `.expo`, and zip artifacts out of git.
- If historical cleanup is required, follow `docs/repo-history-cleanup.md`.

## Local quality checks
- Backend lint: `cd services/api && .\.venv\Scripts\python.exe -m ruff check accesos accesosen_api`
- Backend format check: `cd services/api && .\.venv\Scripts\python.exe -m black --check accesos/auth_jwt.py accesos/jwt_views.py accesos/rate_limit.py accesos/otp_services.py`
- Backend tests: `cd services/api && .\.venv\Scripts\python.exe -m pytest --cov=accesos --cov-report=term-missing --cov-fail-under=30`
- Web lint: `cd apps/web && npm run lint`
- Web typecheck: `cd apps/web && npm run typecheck`
- Web build: `cd apps/web && npm run build`
- Mobile lint: `cd apps/mobile-rn && npm run lint`
- Mobile typecheck: `cd apps/mobile-rn && npm run typecheck`

## Rollback guide
1. Revert the offending commit: `git revert <commit_sha>`
2. Re-run `check.cmd`/`check.sh`
3. Push revert commit to `dev`
