from __future__ import annotations

from pathlib import Path


def patch_frontmatter_name(path: Path, old: str, new: str, description_prefix: str) -> bool:
    text = path.read_text(encoding="utf-8", errors="replace")
    if f"name: {new}" in text:
        return False
    if f"name: {old}" not in text:
        return False

    text = text.replace(f"name: {old}", f"name: {new}", 1)

    marker = "description:"
    if marker in text and description_prefix not in text:
        idx = text.find(marker)
        line_end = text.find("\n", idx)
        current = text[idx:line_end]
        text = text.replace(current, f'{current} {description_prefix}', 1)

    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    skills_root = Path.home() / ".codex" / "skills"

    patched = []

    community_skill_creator = skills_root / "skill-creator" / "SKILL.md"
    if patch_frontmatter_name(
        community_skill_creator,
        "skill-creator",
        "skill-creator-community",
        "[Community variant; prefer .system/skill-creator unless explicitly requested.]",
    ):
        patched.append(str(community_skill_creator))

    collision_report = Path.cwd() / "artifacts" / "skill_orchestrator" / "collision_resolution.md"
    collision_report.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Collision Resolution",
        "",
        "## Applied",
    ]
    if patched:
        lines.extend(f"- Patched `{path}`" for path in patched)
    else:
        lines.append("- No changes were needed")

    lines += [
        "",
        "## Policy",
        "",
        "- `.system/skill-creator` remains canonical.",
        "- `skill-creator-community` remains available as a secondary variant.",
    ]
    collision_report.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
