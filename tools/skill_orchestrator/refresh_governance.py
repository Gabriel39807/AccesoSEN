from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PIPELINE = [
    "audit_skills.py",
    "build_manifest.py",
    "build_taxonomy.py",
    "build_packs.py",
    "build_index.py",
    "score_skills.py",
    "verify_governance.py",
]


def run(script_name: str) -> None:
    tools_dir = Path(__file__).parent
    script_path = tools_dir / script_name
    subprocess.run([sys.executable, str(script_path)], check=True)


def main() -> None:
    for script in PIPELINE:
        run(script)


if __name__ == "__main__":
    main()
