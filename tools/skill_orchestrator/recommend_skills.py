from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def score_pack(prompt: str, pack_name: str, pack: dict, aliases: dict[str, str]) -> int:
    score = 0
    lowered = prompt.lower()
    if any(alias == pack_name and re.search(rf"\b{re.escape(key)}\b", lowered) for key, alias in aliases.items()):
        score += 40
    for trigger in pack["triggers"]:
        if trigger.lower() in lowered:
            score += 25
    return score


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python recommend_skills.py \"prompt\"")

    prompt = " ".join(sys.argv[1:])
    base = Path.cwd() / "artifacts" / "skill_orchestrator"
    packs = load_json(base / "skill_packs.json")
    aliases = load_json(base / "skill_aliases.json")
    scores_path = base / "skills_scores.json"
    if not scores_path.exists():
        subprocess.run([sys.executable, str(Path(__file__).parent / "score_skills.py")], check=True)
    scores = load_json(scores_path)
    score_map = {item["name"]: item for item in scores}

    ranked = []
    for pack_name, pack in packs.items():
        s = score_pack(prompt, pack_name, pack, aliases)
        if s > 0:
            ranked.append((s, pack_name, pack))

    ranked.sort(reverse=True)
    if not ranked:
        result = {
            "prompt": prompt,
            "recommended_pack": None,
            "lead": None,
            "support": [],
            "reason": "No alias or trigger matched strongly.",
        }
    else:
        _, pack_name, pack = ranked[0]
        support = sorted(
            pack["support"],
            key=lambda name: score_map.get(name, {}).get("score", 0),
            reverse=True,
        )
        result = {
            "prompt": prompt,
            "recommended_pack": pack_name,
            "lead": pack["lead"],
            "support": support[:5],
            "reason": "Highest alias/trigger match with score-aware support ordering.",
        }

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
