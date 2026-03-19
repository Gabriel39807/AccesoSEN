# Skill Governance Runbook

## Purpose

Keep the global Codex skill ecosystem coherent as new skills are added.

## Standard Workflow

1. Install or modify skills.
2. Run `tools/skill_orchestrator/audit_skills.py`.
3. Run `tools/skill_orchestrator/build_taxonomy.py`.
4. Run `tools/skill_orchestrator/build_packs.py`.
5. Run `tools/skill_orchestrator/build_index.py`.
6. Run `tools/skill_orchestrator/verify_governance.py`.
7. If collisions appear, run `tools/skill_orchestrator/resolve_collisions.py`.
8. If non-Codex patterns appear, run `tools/skill_orchestrator/normalize_skills.py`.

## Enforcement Rules

- No duplicate frontmatter names unless intentionally versioned and documented.
- Broad skills must not compete as co-leads for the same pack.
- Imported community skills are support by default unless promoted intentionally.
- Skills with known compatibility issues must contain the Codex compatibility layer.

## Key Artifacts

- `artifacts/skill_orchestrator/skills_audit.json`
- `artifacts/skill_orchestrator/skills_taxonomy.json`
- `artifacts/skill_orchestrator/skill_packs.json`
- `artifacts/skill_orchestrator/skill_aliases.json`
- `artifacts/skill_orchestrator/skills_index.json`
- `artifacts/skill_orchestrator/governance_verification.md`
