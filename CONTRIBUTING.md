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
