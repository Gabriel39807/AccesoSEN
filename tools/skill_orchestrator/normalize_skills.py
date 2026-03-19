from __future__ import annotations

import json
from pathlib import Path


PREAMBLE = """## Codex Compatibility Layer

Use these rules when this skill runs inside Codex:

- Treat references to `Claude`, `Claude Code`, Anthropic-only APIs, or `.claude/...` paths as legacy guidance.
- Resolve skill-local assets relative to this skill directory first, then to `~/.codex/skills/<skill-name>/...`.
- Treat slash commands like `/foo` as workflow labels, not literal Codex commands, unless the command exists in the current environment.
- Replace `AskUserQuestion` style instructions with a concise direct user question only when strictly necessary.
- Ignore non-Codex permission models such as `acceptEdits`, `bypassPermissions`, or Claude-specific approval semantics; use Codex tool policies instead.
- If this skill references another installed skill, use it as supporting context only when it narrows scope or adds missing capability.

"""

ISSUES_TO_PATCH = {
    "hardcoded_claude_paths",
    "claude_slash_commands",
    "non_codex_interaction_api",
    "non_codex_permission_model",
    "other_ai_platform_references",
    "anthropic_specific_wording",
}


def inject_preamble(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="replace")
    if "## Codex Compatibility Layer" in text:
        return False

    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            insert_at = end + len("\n---\n")
            updated = text[:insert_at] + "\n" + PREAMBLE + text[insert_at:]
        else:
            updated = PREAMBLE + text
    else:
        updated = PREAMBLE + text

    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    report_path = Path.cwd() / "artifacts" / "skill_orchestrator" / "skills_audit.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))

    patched: list[str] = []
    for record in report["records"]:
        issues = set(record["issues"])
        if not issues.intersection(ISSUES_TO_PATCH):
            continue
        path = Path(record["path"])
        if inject_preamble(path):
            patched.append(str(path))

    out_dir = Path.cwd() / "artifacts" / "skill_orchestrator"
    (out_dir / "patched_skills.json").write_text(
        json.dumps({"patched_count": len(patched), "patched": patched}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
