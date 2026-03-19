from __future__ import annotations

import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    base = Path.cwd() / "artifacts" / "skill_orchestrator"
    audit = load_json(base / "skills_audit.json")
    taxonomy = load_json(base / "skills_taxonomy.json")
    manifest = load_json(base / "skill_manifest.json")
    aliases = load_json(base / "skill_aliases.json")
    packs = load_json(base / "skill_packs.json")

    errors: list[str] = []
    warnings: list[str] = []

    skill_names = {entry["name"] for entry in taxonomy["skills"]}
    dir_names = {entry.get("dir_name", entry["name"]) for entry in taxonomy["skills"]}
    frontmatter_names = {}
    for entry in taxonomy["skills"]:
        fm = entry.get("frontmatter_name")
        if not fm:
            continue
        frontmatter_names.setdefault(fm, []).append(entry["name"])

    duplicate_frontmatter = {k: v for k, v in frontmatter_names.items() if len(set(v)) > 1}
    if duplicate_frontmatter:
        for name, owners in sorted(duplicate_frontmatter.items()):
            errors.append(f"Duplicate frontmatter name `{name}` in {owners}")

    for cluster_name, cluster in manifest["clusters"].items():
        for lead in cluster["lead"]:
            if lead not in skill_names and lead not in dir_names:
                errors.append(f"Manifest cluster `{cluster_name}` lead `{lead}` not installed")
        for support in cluster["support"]:
            if support not in skill_names and support not in dir_names:
                warnings.append(f"Manifest cluster `{cluster_name}` support `{support}` not installed")

    for pack_name, pack in packs.items():
        if pack["lead"] not in skill_names and pack["lead"] not in dir_names:
            errors.append(f"Pack `{pack_name}` lead `{pack['lead']}` not installed")
        for support in pack["support"]:
            if support not in skill_names and support not in dir_names:
                warnings.append(f"Pack `{pack_name}` support `{support}` not installed")

    for alias, pack_name in aliases.items():
        if pack_name not in packs:
            errors.append(f"Alias `{alias}` points to missing pack `{pack_name}`")

    exempt_from_compat_layer = {"codex-skill-router"}
    problematic = {
        (record.get("frontmatter_name") or record["dir_name"]): record
        for record in audit["records"]
        if record["issues"]
    }
    for name, record in problematic.items():
        if name in exempt_from_compat_layer:
            continue
        if "## Codex Compatibility Layer" not in Path(record["path"]).read_text(
            encoding="utf-8", errors="replace"
        ):
            errors.append(f"Skill `{name}` has issues but no Codex compatibility layer")

    lines = ["# Governance Verification", ""]
    lines.append(f"- Skills indexed: {len(skill_names)}")
    lines.append(f"- Packs: {len(packs)}")
    lines.append(f"- Aliases: {len(aliases)}")
    lines.append("")
    lines.append("## Errors")
    if errors:
        lines.extend(f"- {e}" for e in errors)
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Warnings")
    if warnings:
        lines.extend(f"- {w}" for w in warnings)
    else:
        lines.append("- none")

    (base / "governance_verification.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (base / "governance_verification.json").write_text(
        json.dumps({"errors": errors, "warnings": warnings}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
