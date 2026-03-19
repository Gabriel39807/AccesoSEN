from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)

PATTERNS = {
    "claude_path": re.compile(r"~\/\.claude|\.claude\/skills|claude code", re.IGNORECASE),
    "claude_command": re.compile(r"(^|\s)/(plugin|code-review|ui-ux-pro-max|[a-z0-9:_-]+)", re.IGNORECASE),
    "ask_user_question": re.compile(r"AskUserQuestion", re.IGNORECASE),
    "anthropic_tooling": re.compile(r"\bclaude\b|anthropic", re.IGNORECASE),
    "non_codex_permissions": re.compile(r"permission-mode|bypassPermissions|acceptEdits", re.IGNORECASE),
    "other_ai_brand": re.compile(
        r"\b(cursor|windsurf|kiro|trae|gemini|copilot|openclaw|claude desktop)\b",
        re.IGNORECASE,
    ),
    "external_skill_refs": re.compile(r"`([a-z0-9:_-]+)`", re.IGNORECASE),
}


@dataclass
class SkillRecord:
    path: str
    dir_name: str
    frontmatter_name: str | None
    description: str | None
    issues: list[str]
    referenced_skills: list[str]


def parse_frontmatter(text: str) -> dict[str, Any]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    raw = match.group(1)
    data: dict[str, Any] = {}
    current_key: str | None = None
    for line in raw.splitlines():
        if not line.strip():
            continue
        if re.match(r"^[A-Za-z0-9_-]+:", line):
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            data[key] = value
            current_key = key
        elif current_key and line.startswith("  "):
            data[current_key] = f"{data[current_key]} {line.strip()}".strip()
    return data


def audit_skill(skill_md: Path, installed_names: set[str]) -> SkillRecord:
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    frontmatter = parse_frontmatter(text)
    body = text

    issues: list[str] = []
    if PATTERNS["claude_path"].search(body):
        issues.append("hardcoded_claude_paths")
    if PATTERNS["claude_command"].search(body):
        issues.append("claude_slash_commands")
    if PATTERNS["ask_user_question"].search(body):
        issues.append("non_codex_interaction_api")
    if PATTERNS["anthropic_tooling"].search(body):
        issues.append("anthropic_specific_wording")
    if PATTERNS["non_codex_permissions"].search(body):
        issues.append("non_codex_permission_model")
    if PATTERNS["other_ai_brand"].search(body):
        issues.append("other_ai_platform_references")

    refs = sorted(
        {
            ref
            for ref in PATTERNS["external_skill_refs"].findall(body)
            if ref in installed_names and ref != skill_md.parent.name
        }
    )

    return SkillRecord(
        path=str(skill_md),
        dir_name=skill_md.parent.name,
        frontmatter_name=frontmatter.get("name"),
        description=frontmatter.get("description"),
        issues=issues,
        referenced_skills=refs,
    )


def main() -> None:
    skills_root = Path.home() / ".codex" / "skills"
    out_dir = Path.cwd() / "artifacts" / "skill_orchestrator"
    out_dir.mkdir(parents=True, exist_ok=True)

    skill_files = sorted(skills_root.rglob("SKILL.md"))
    installed_names = {path.parent.name for path in skill_files}

    records = [audit_skill(path, installed_names) for path in skill_files]

    by_frontmatter = defaultdict(list)
    for record in records:
        if record.frontmatter_name:
            by_frontmatter[record.frontmatter_name].append(record.dir_name)

    duplicate_frontmatter = {
        name: dirs for name, dirs in sorted(by_frontmatter.items()) if len(dirs) > 1
    }

    issue_counts = Counter(issue for record in records for issue in record.issues)

    overlap_keywords = defaultdict(list)
    for record in records:
        desc = (record.description or "").lower()
        for keyword in (
            "frontend",
            "design",
            "review",
            "security",
            "testing",
            "orchestration",
            "debug",
            "deployment",
            "auth",
            "performance",
        ):
            if keyword in desc:
                overlap_keywords[keyword].append(record.dir_name)

    report = {
        "skills_root": str(skills_root),
        "skill_count": len(records),
        "issue_counts": issue_counts,
        "duplicate_frontmatter_names": duplicate_frontmatter,
        "overlap_keywords": {k: sorted(v) for k, v in overlap_keywords.items() if len(v) > 1},
        "records": [asdict(record) for record in records],
    }

    (out_dir / "skills_audit.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    summary_lines = [
        f"Skills audited: {len(records)}",
        "",
        "Issue counts:",
    ]
    for issue, count in sorted(issue_counts.items()):
        summary_lines.append(f"- {issue}: {count}")

    summary_lines.append("")
    summary_lines.append("Duplicate frontmatter names:")
    if duplicate_frontmatter:
        for name, dirs in duplicate_frontmatter.items():
            summary_lines.append(f"- {name}: {', '.join(dirs)}")
    else:
        summary_lines.append("- none")

    summary_lines.append("")
    summary_lines.append("High-overlap categories:")
    for keyword, dirs in sorted(report["overlap_keywords"].items()):
        summary_lines.append(f"- {keyword}: {len(dirs)} skills")

    (out_dir / "skills_audit_summary.md").write_text(
        "\n".join(summary_lines) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
