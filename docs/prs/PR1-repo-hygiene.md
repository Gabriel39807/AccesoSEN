# PR1 - Repo Hygiene

- Commit: `561e2c6`
- Scope: limpiar artefactos versionados y estandarizar base del repo.

## Descripcion
- Eliminado `services/api/venv` del indice de git.
- `.gitignore` reforzado para monorepo.
- Agregados `.editorconfig`, `.gitattributes`, `CONTRIBUTING.md`, `CODEOWNERS`, `LICENSE`.

## Checklist
- [x] Sin artefactos locales versionados.
- [x] Convenciones de contribucion documentadas.
- [x] Archivos base de consistencia agregados.

## Riesgos
- Bajo: commit grande por eliminacion de muchos archivos del venv.

## Pruebas
- `git status` limpio despues del commit.

## Rollback
```bash
git revert 561e2c6
```
