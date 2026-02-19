# PR3 - CI y Calidad

- Commit: `d7ba769`
- Scope: pipeline CI + pytest/coverage + estabilidad de build web.

## Descripcion
- Workflow de GitHub Actions para backend/web/mobile.
- Integracion pytest + coverage en backend.
- `check.sh` y `check.cmd` alineados a CI.
- Ajuste en flujo `password-recovery` para pasar `next build`.

## Checklist
- [x] CI en `dev/main`.
- [x] Coverage backend con umbral inicial.
- [x] Build web validado.

## Riesgos
- Medio: se mantiene deuda de tipado (`any`) con mitigacion temporal en lint.

## Pruebas
- `cmd /c check.cmd`

## Rollback
```bash
git revert d7ba769
```
