from __future__ import annotations

import json
from pathlib import Path


ISSUE_PENALTIES = {
    "hardcoded_claude_paths": 15,
    "claude_slash_commands": 10,
    "non_codex_interaction_api": 20,
    "non_codex_permission_model": 10,
    "other_ai_platform_references": 8,
    "anthropic_specific_wording": 5,
}

ROLE_BONUS = {
    "lead": 15,
    "broad": 5,
    "specialist": 10,
}

SOURCE_BONUS = {
    "system": 20,
    "community": 5,
}


def main() -> None:
    base = Path.cwd() / "artifacts" / "skill_orchestrator"
    taxonomy = json.loads((base / "skills_taxonomy.json").read_text(encoding="utf-8"))

    scored = []
    for skill in taxonomy["skills"]:
        score = 100
        score += ROLE_BONUS.get(skill["role"], 0)
        score += SOURCE_BONUS.get(skill["source"], 0)
        for issue in skill["issues"]:
            score -= ISSUE_PENALTIES.get(issue, 0)
        score = max(0, min(100, score))

        scored.append(
            {
                **skill,
                "score": score,
                "priority": (
                    "high" if score >= 85 else "medium" if score >= 65 else "low"
                ),
            }
        )

    scored.sort(key=lambda item: (-item["score"], item["name"]))

    (base / "skills_scores.json").write_text(
        json.dumps(scored, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    lines = ["# Skill Scores", ""]
    for skill in scored[:100]:
        lines.append(
            f"- `{skill['name']}`: {skill['score']} ({skill['priority']}, {skill['domain']}, {skill['role']})"
        )
    (base / "skills_scores.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
