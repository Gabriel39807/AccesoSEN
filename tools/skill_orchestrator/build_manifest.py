from __future__ import annotations

import json
from pathlib import Path


MANIFEST = {
    "precedence_rules": [
        ".system skills override community variants when names or scopes collide",
        "broad meta-skills route work to narrow specialists instead of duplicating instructions",
        "Codex-native tool semantics override imported Claude/Cursor/Gemini workflow instructions",
        "community imported skills are supporting specialists unless explicitly requested by the user",
    ],
    "clusters": {
        "orchestration": {
            "lead": ["orchestration"],
            "support": [
                "agent-orchestration-planner",
                "ai-agent-orchestrator",
                "plan-work",
                "session-handoff",
                "autonomous-skill",
            ],
        },
        "design": {
            "lead": ["frontend-design"],
            "support": [
                "design",
                "ui-ux-pro-max",
                "design-to-component-translator",
                "design-system-creation",
                "responsive-web-design",
                "accessibility-auditor",
                "animation-micro-interaction-pack",
            ],
        },
        "code_review": {
            "lead": ["code-review-analysis"],
            "support": [
                "security-pr-checklist-skill",
                "static-code-analysis",
                "repo-structure-linter",
                "open-source-maintainer",
            ],
        },
        "debugging": {
            "lead": ["systematic-debugging"],
            "support": [
                "bug-triage",
                "debugging-strategies",
                "performance-regression-debugging",
                "container-debugging",
                "network-debugging",
                "mobile-app-debugging",
            ],
        },
        "security": {
            "lead": ["security"],
            "support": [
                "api-security-hardener",
                "input-validation-sanitization-auditor",
                "sql-injection-prevention",
                "xss-prevention",
                "csrf-protection",
                "secure-headers-csp-builder",
                "threat-model-generator",
            ],
        },
        "testing": {
            "lead": ["testing"],
            "support": [
                "unit-test-generator",
                "integration-test-builder",
                "e2e-test-builder",
                "frontend-testing",
                "test-automation-framework",
                "flaky-test-detective",
            ],
        },
        "api_backend": {
            "lead": ["api-design"],
            "support": [
                "api-endpoint-generator",
                "api-contract-normalizer",
                "api-error-handling",
                "api-pagination",
                "api-rate-limiting",
                "rest-api-design",
            ],
        },
        "deployment": {
            "lead": ["devops"],
            "support": [
                "render-deploy",
                "vercel-deploy",
                "deployment-automation",
                "docker-containerization",
                "kubernetes-deployment",
                "github-actions-pipeline-creator",
            ],
        },
        "docs": {
            "lead": ["docs-sync"],
            "support": [
                "readme-generator",
                "api-docs-generator",
                "codebase-summarizer",
                "developer-onboarding",
                "troubleshooting-guide",
            ],
        },
    },
}


def main() -> None:
    out_dir = Path.cwd() / "artifacts" / "skill_orchestrator"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "skill_manifest.json").write_text(
        json.dumps(MANIFEST, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
