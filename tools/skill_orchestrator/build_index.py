from __future__ import annotations

import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    base = Path.cwd() / "artifacts" / "skill_orchestrator"
    taxonomy = load_json(base / "skills_taxonomy.json")
    aliases = load_json(base / "skill_aliases.json")
    packs = load_json(base / "skill_packs.json")

    by_name = {}
    by_domain: dict[str, list[str]] = {}
    by_role: dict[str, list[str]] = {}

    for skill in taxonomy["skills"]:
        name = skill["name"]
        by_name[name] = skill
        by_domain.setdefault(skill["domain"], []).append(name)
        by_role.setdefault(skill["role"], []).append(name)

    index = {
        "by_name": by_name,
        "by_domain": {k: sorted(v) for k, v in by_domain.items()},
        "by_role": {k: sorted(v) for k, v in by_role.items()},
        "aliases": aliases,
        "packs": packs,
    }

    (base / "skills_index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    lines = ["# Skills Index", ""]
    lines.append("## Domains")
    for domain, names in sorted(index["by_domain"].items()):
        lines.append(f"- `{domain}`: {len(names)}")
    lines.append("")
    lines.append("## Roles")
    for role, names in sorted(index["by_role"].items()):
        lines.append(f"- `{role}`: {len(names)}")
    lines.append("")
    lines.append("## Aliases")
    for alias, pack in sorted(aliases.items()):
        lines.append(f"- `{alias}` -> `{pack}`")

    (base / "skills_index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
