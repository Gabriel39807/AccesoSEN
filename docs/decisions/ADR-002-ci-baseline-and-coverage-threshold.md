# ADR-002: CI baseline and test coverage threshold

- Status: Accepted
- Date: 2026-02-19

## Context
The repository had no GitHub Actions pipeline and mixed quality status across apps. Enforcing strict lint/type gates immediately would block delivery due pre-existing debt.

## Decision
- Introduce CI for backend, web and mobile.
- Backend uses `pytest` + coverage with an initial fail-under threshold of `30%`.
- Web lint temporarily disables `@typescript-eslint/no-explicit-any` from CLI in CI while debt is reduced incrementally.

## Consequences
- CI becomes actionable immediately.
- Quality floor exists and can be ratcheted up over time.
- Technical debt remains visible and documented instead of silently ignored.
