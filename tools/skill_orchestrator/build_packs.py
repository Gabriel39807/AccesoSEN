from __future__ import annotations

import json
from pathlib import Path


PACKS = {
    "design_web_ui": {
        "lead": "frontend-design",
        "support": [
            "design",
            "ui-ux-pro-max",
            "design-to-component-translator",
            "responsive-web-design",
            "accessibility-auditor",
            "animation-micro-interaction-pack",
            "color-accessibility",
            "dark-mode-implementer",
        ],
        "triggers": [
            "landing page",
            "dashboard ui",
            "component design",
            "frontend redesign",
            "hero section",
            "responsive page",
        ],
    },
    "design_system_brand": {
        "lead": "design",
        "support": [
            "design-system-creation",
            "design-md",
            "design-handoff",
            "information-architecture",
            "interaction-design",
            "wireframe-prototyping",
        ],
        "triggers": [
            "design system",
            "brand identity",
            "tokens",
            "component library",
            "style guide",
        ],
    },
    "debug_fullstack": {
        "lead": "systematic-debugging",
        "support": [
            "bug-triage",
            "debugging-strategies",
            "root-cause-analysis",
            "troubleshooting-guide",
            "log-analysis",
            "error-tracking",
        ],
        "triggers": [
            "bug",
            "failing build",
            "unexpected behavior",
            "investigate error",
            "root cause",
        ],
    },
    "review_security": {
        "lead": "code-review-analysis",
        "support": [
            "security-pr-checklist-skill",
            "static-code-analysis",
            "security",
            "input-validation-sanitization-auditor",
            "api-security-hardener",
        ],
        "triggers": [
            "review this pr",
            "security review",
            "audit this change",
            "code review",
        ],
    },
    "testing_feature": {
        "lead": "testing",
        "support": [
            "unit-test-generator",
            "integration-test-builder",
            "frontend-testing",
            "e2e-test-builder",
            "coverage-strategist",
        ],
        "triggers": [
            "add tests",
            "increase coverage",
            "integration test",
            "e2e",
            "unit tests",
        ],
    },
    "api_delivery": {
        "lead": "api-design",
        "support": [
            "api-endpoint-generator",
            "api-contract-normalizer",
            "api-error-handling",
            "api-pagination",
            "api-rate-limiting",
            "openapi-generator",
        ],
        "triggers": [
            "build api",
            "new endpoint",
            "rest api",
            "openapi",
            "crud endpoint",
        ],
    },
    "deploy_release": {
        "lead": "devops",
        "support": [
            "deployment-automation",
            "render-deploy",
            "vercel-deploy",
            "docker-containerization",
            "kubernetes-deployment",
            "github-actions-pipeline-creator",
        ],
        "triggers": [
            "deploy this",
            "go live",
            "release",
            "ci cd",
            "render",
            "vercel",
        ],
    },
    "docs_alignment": {
        "lead": "docs-sync",
        "support": [
            "readme-generator",
            "api-docs-generator",
            "codebase-summarizer",
            "developer-onboarding",
            "jsdoc-typescript-docs",
        ],
        "triggers": [
            "update docs",
            "write readme",
            "document api",
            "onboarding docs",
        ],
    },
}


ALIASES = {
    "frontend": "design_web_ui",
    "ui": "design_web_ui",
    "ux": "design_web_ui",
    "design-system": "design_system_brand",
    "brand": "design_system_brand",
    "bugfix": "debug_fullstack",
    "incident": "debug_fullstack",
    "review": "review_security",
    "pr-review": "review_security",
    "tests": "testing_feature",
    "api": "api_delivery",
    "backend": "api_delivery",
    "deploy": "deploy_release",
    "release": "deploy_release",
    "docs": "docs_alignment",
}


def main() -> None:
    out_dir = Path.cwd() / "artifacts" / "skill_orchestrator"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "skill_packs.json").write_text(
        json.dumps(PACKS, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (out_dir / "skill_aliases.json").write_text(
        json.dumps(ALIASES, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    md = ["# Skill Packs", ""]
    for name, pack in PACKS.items():
        md.append(f"## {name}")
        md.append(f"- Lead: `{pack['lead']}`")
        md.append(f"- Support: {', '.join(f'`{s}`' for s in pack['support'])}")
        md.append(f"- Triggers: {', '.join(f'`{t}`' for t in pack['triggers'])}")
        md.append("")
    (out_dir / "skill_packs.md").write_text("\n".join(md), encoding="utf-8")


if __name__ == "__main__":
    main()
