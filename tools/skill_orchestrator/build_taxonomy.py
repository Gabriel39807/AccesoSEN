from __future__ import annotations

import json
from pathlib import Path


DOMAIN_RULES = {
    "design": [
        "design",
        "ui",
        "frontend",
        "accessibility",
        "animation",
        "wireframe",
        "storybook",
        "responsive",
        "css",
        "component",
    ],
    "security": [
        "security",
        "auth",
        "oauth",
        "xss",
        "csrf",
        "injection",
        "threat",
        "secrets",
        "encryption",
        "zero trust",
    ],
    "testing": [
        "test",
        "testing",
        "e2e",
        "integration",
        "unit",
        "snapshot",
        "flaky",
        "mock",
        "coverage",
    ],
    "debugging": [
        "debug",
        "bug",
        "troubleshooting",
        "profil",
        "latency",
        "performance regression",
        "root cause",
        "incident",
    ],
    "deployment": [
        "deploy",
        "deployment",
        "docker",
        "kubernetes",
        "render",
        "vercel",
        "ci/cd",
        "github actions",
        "release",
        "devops",
    ],
    "backend_api": [
        "api",
        "backend",
        "graphql",
        "rest",
        "fastapi",
        "django",
        "express",
        "server",
        "microservice",
        "webhook",
    ],
    "data_ml": [
        "data",
        "ml",
        "model",
        "regression",
        "classification",
        "clustering",
        "cohort",
        "etl",
        "embedding",
        "rag",
        "vector",
        "nlp",
    ],
    "docs": [
        "docs",
        "documentation",
        "readme",
        "markdown",
        "changelog",
        "onboarding",
        "guide",
    ],
    "orchestration": [
        "orchestration",
        "agent",
        "workflow",
        "plan",
        "handoff",
        "autonomous",
        "multi-agent",
    ],
    "infra_ops": [
        "cloud",
        "aws",
        "azure",
        "gcp",
        "prometheus",
        "grafana",
        "monitor",
        "observability",
        "logging",
        "backup",
    ],
}

LEADS = {
    "design": "frontend-design",
    "security": "security",
    "testing": "testing",
    "debugging": "systematic-debugging",
    "deployment": "devops",
    "backend_api": "api-design",
    "data_ml": "deep-research",
    "docs": "docs-sync",
    "orchestration": "orchestration",
    "infra_ops": "observability",
}

BROAD_SKILLS = {
    "frontend-design",
    "design",
    "ui-ux-pro-max",
    "security",
    "testing",
    "devops",
    "api-design",
    "orchestration",
    "deep-research",
    "docs-sync",
    "observability",
}


def classify(desc: str, name: str) -> str:
    haystack = f"{name} {desc}".lower()
    scores = {
        domain: sum(1 for token in tokens if token in haystack)
        for domain, tokens in DOMAIN_RULES.items()
    }
    domain, score = max(scores.items(), key=lambda item: item[1])
    return domain if score > 0 else "general"


def main() -> None:
    audit = json.loads(
        (Path.cwd() / "artifacts" / "skill_orchestrator" / "skills_audit.json").read_text(
            encoding="utf-8"
        )
    )

    taxonomy = []
    grouped: dict[str, list[str]] = {}

    for record in audit["records"]:
        name = record.get("frontmatter_name") or record["dir_name"]
        desc = record.get("description") or ""
        domain = classify(desc, name)
        source = "system" if "\\.system\\" in record["path"] else "community"
        role = "lead" if name == LEADS.get(domain) else ("broad" if name in BROAD_SKILLS else "specialist")

        entry = {
            "name": name,
            "dir_name": record["dir_name"],
            "frontmatter_name": record.get("frontmatter_name"),
            "domain": domain,
            "role": role,
            "source": source,
            "issues": record.get("issues", []),
            "supports": record.get("referenced_skills", []),
        }
        taxonomy.append(entry)
        grouped.setdefault(domain, []).append(name)

    out_dir = Path.cwd() / "artifacts" / "skill_orchestrator"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "skills_taxonomy.json").write_text(
        json.dumps(
            {
                "summary": {domain: len(names) for domain, names in sorted(grouped.items())},
                "skills": taxonomy,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    md_lines = ["# Skills Taxonomy", ""]
    for domain, names in sorted(grouped.items()):
        md_lines.append(f"## {domain}")
        md_lines.append(f"- Count: {len(names)}")
        md_lines.append(f"- Lead: `{LEADS.get(domain, 'none')}`")
        sample = ", ".join(sorted(names)[:20])
        md_lines.append(f"- Sample: {sample}")
        md_lines.append("")

    (out_dir / "skills_taxonomy.md").write_text("\n".join(md_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
