# Skill Activation Guide

## Goal

Make Codex choose complementary skills instead of stacking broad meta-skills.

## Activation Model

1. Detect the dominant domain.
2. Map the request to a pack alias.
3. Activate exactly one lead skill.
4. Pull 0-N support skills only for missing capability.

## Aliases

- `frontend`, `ui`, `ux` -> `design_web_ui`
- `design-system`, `brand` -> `design_system_brand`
- `bugfix`, `incident` -> `debug_fullstack`
- `review`, `pr-review` -> `review_security`
- `tests` -> `testing_feature`
- `api`, `backend` -> `api_delivery`
- `deploy`, `release` -> `deploy_release`
- `docs` -> `docs_alignment`

## Guardrails

- Never run `frontend-design`, `design`, and `ui-ux-pro-max` as co-equal leads.
- Never let `testing` and `code-review-analysis` both act as review leads.
- Prefer `.system` skills where available on naming collisions.
- Imported community skills should usually be support layers.
