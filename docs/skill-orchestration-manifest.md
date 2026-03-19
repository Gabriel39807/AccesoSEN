# Skill Orchestration Manifest

## Intent

Make 400+ skills cooperate under Codex by enforcing a lead/support model.

## Lead Skills

- Orchestration: `orchestration`
- Design/UI: `frontend-design`
- Code review: `code-review-analysis`
- Debugging: `systematic-debugging`
- Security: `security`
- Testing: `testing`
- API/backend: `api-design`
- Deployment: `devops`
- Documentation: `docs-sync`

## Support Rules

- Use support skills only when they narrow the problem.
- Never let two broad skills co-own the same task.
- Imported Claude-oriented skills become supporting specialists unless the user explicitly names them.
- `.system` wins over community duplicates.

## Collision Handling

- Duplicate `skill-creator` frontmatter exists.
- Keep `.system/skill-creator` as canonical.
- Treat the community variant as `skill-creator-community` and secondary unless explicitly requested.

## Codex Adaptation Layer

- Legacy `.claude` paths are interpreted as skill-local or `~/.codex/skills/...`.
- Slash commands are treated as labels or examples, not required commands.
- Anthropic-only interaction primitives are replaced with normal Codex questioning.
- Claude permission model guidance is ignored in favor of Codex tool policy.

## Taxonomy

- Full machine-readable taxonomy: `artifacts/skill_orchestrator/skills_taxonomy.json`
- Human summary: `artifacts/skill_orchestrator/skills_taxonomy.md`
