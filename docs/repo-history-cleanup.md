# Repo History Cleanup (if secrets/artifacts were ever committed)

This repository already ignores local environments and artifacts.  
If old commits still contain sensitive files (`.env`, `venv`, `node_modules`, `*.zip`), use this controlled process.

## 1) Mirror clone (safe workspace)
```bash
git clone --mirror https://github.com/Gabriel39807/S.A.D.I.git sadi-cleanup.git
cd sadi-cleanup.git
```

## 2) Remove sensitive paths from history
Examples:
```bash
git filter-repo --path-glob "*.env" --invert-paths
git filter-repo --path-glob "*/.env*" --invert-paths
git filter-repo --path "services/api/.venv" --invert-paths
git filter-repo --path "apps/web/src.zip" --invert-paths
git filter-repo --path "apps/mobile-rn/app.zip" --invert-paths
```

Or in one command:
```bash
git filter-repo ^
  --path-glob "*.env" --path-glob "*/.env*" ^
  --path "services/api/.venv" ^
  --path "apps/web/src.zip" ^
  --path "apps/mobile-rn/app.zip" ^
  --invert-paths
```

## 3) Force push rewritten history
```bash
git push --force --all
git push --force --tags
```

## 4) Rotate exposed credentials
- Rotate SMTP passwords, JWT secret, database passwords, Twilio keys, and any API tokens.
- Invalidate old refresh sessions when applicable.

## 5) Team sync after rewrite
All collaborators must re-clone or hard reset local clones:
```bash
git fetch origin
git reset --hard origin/dev
```

Do this only with team approval; rewriting history is destructive for existing clones.
