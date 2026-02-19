# ADR-001: Settings strategy and environment separation

- Status: Accepted
- Date: 2026-02-19

## Context
The API used a single `settings.py` file with development defaults and production-unsafe values (`DEBUG=True`, wildcard hosts, hardcoded secret fallback).

## Decision
Adopt environment-based settings split:
- `accesosen_api/base.py`
- `accesosen_api/development.py`
- `accesosen_api/production.py`
- Dispatcher in `accesosen_api/settings.py` using `DJANGO_ENV`.

Additional decisions:
- Development defaults to SQLite for easier onboarding.
- Production requires explicit `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS`.
- Security flags are hardened in production module.

## Consequences
- Local setup remains simple.
- Production requires explicit env configuration but is safer by default.
- Existing `DJANGO_SETTINGS_MODULE=accesosen_api.settings` remains compatible.
