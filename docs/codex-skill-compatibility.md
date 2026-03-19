# Codex Skill Compatibility Strategy

## Goal

Adapt a mixed global skill set to Codex without breaking upstream intent.

## Rules

1. Do not rewrite 400+ skills blindly.
2. Prefer a Codex compatibility layer over bespoke per-skill logic.
3. Patch only high-signal incompatibilities:
   - `~/.claude/...` hardcoded paths
   - Anthropic-only interaction APIs like `AskUserQuestion`
   - Claude slash-command assumptions
   - non-Codex permission model guidance
4. Leave domain expertise intact.
5. Resolve collisions by precedence, not deletion.

## Precedence

1. `.system` skills remain authoritative.
2. Native Codex-oriented skills win over imported Claude-oriented variants when scopes overlap.
3. Imported skills keep their domain-specific assets and references.
4. Broad meta-skills should route to narrower specialists instead of duplicating instructions.

## Orchestration Model

1. Discovery layer:
   - match by explicit user mention
   - then by domain keywords
   - then by tool/provider constraints
2. Conflict layer:
   - if multiple skills overlap, pick one lead skill and treat others as supporting references
3. Execution layer:
   - one orchestrator skill governs decomposition
   - worker skills handle narrow subproblems
4. Safety layer:
   - Codex tool semantics override imported tool instructions

## Initial Deliverables

1. Skill audit report
2. Orchestration manifest
3. Safe normalization pass for imported non-Codex skills
