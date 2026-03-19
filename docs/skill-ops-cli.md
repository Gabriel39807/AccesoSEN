# Skill Ops CLI

## Commands

- Refresh full governance:
  - `python tools/skill_orchestrator/refresh_governance.py`
- Score all skills:
  - `python tools/skill_orchestrator/score_skills.py`
- Recommend skills for a prompt:
  - `python tools/skill_orchestrator/recommend_skills.py "build a responsive landing page"`

## Expected Flow

1. Run refresh after installs or edits.
2. Run scoring when you want to inspect priority and confidence.
3. Run recommendation when a task is ambiguous and you want a lead/support proposal.
