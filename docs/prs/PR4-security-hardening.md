# PR4 - Security Hardening

- Commit: `29ffea0`
- Scope: endurecimiento de seguridad operativa y auth.

## Descripcion
- `DEFAULT_SUPERADMIN_AUTO_CREATE` configurable.
- Logs de eventos de login/lockout/OTP.
- `SECURITY.md`.
- `dependabot.yml` para monitoreo de dependencias.

## Checklist
- [x] Mejoras AppSec en auth/otp.
- [x] Politica de seguridad documentada.
- [x] Dependabot habilitado.

## Riesgos
- Bajo: cambios no rompen contrato API.

## Pruebas
- Login/OTP tests existentes.

## Rollback
```bash
git revert 29ffea0
```
