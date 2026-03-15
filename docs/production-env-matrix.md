# Production Environment Matrix

Fecha base: 2026-03-15

## Backend API

| Variable | Obligatoria | Valor esperado |
| --- | --- | --- |
| `DJANGO_ENV` | Si | `production` |
| `DJANGO_DEBUG` | Si | `false` |
| `DJANGO_SECRET_KEY` | Si | secreto largo y aleatorio |
| `DJANGO_ALLOWED_HOSTS` | Si | dominio real de API |
| `DATABASE_URL` | Si | PostgreSQL productivo |
| `DATABASE_SSLMODE` | Si | `require` |
| `DATABASE_USE_PGBOUNCER` | Recomendado | `true` si usas pooler |
| `CACHE_BACKEND` | Si | `database` o `redis` |
| `CORS_ALLOWED_ORIGINS` | Si | frontend web HTTPS real |
| `CSRF_TRUSTED_ORIGINS` | Si | frontend web HTTPS real |
| `REFRESH_TOKEN_PEPPER` | Si | secreto separado |
| `WEBAUTHN_RP_ID` | Si | dominio real de login |
| `WEBAUTHN_ORIGIN` | Si | origen HTTPS del frontend |
| `EMAIL_HOST_USER` | Si | cuenta SMTP real |
| `EMAIL_HOST_PASSWORD` | Si | app password / secreto real |
| `DEFAULT_FROM_EMAIL` | Si | remitente valido |
| `DEFAULT_SUPERADMIN_AUTO_CREATE` | Si | `false` en produccion estable |

## Web

| Variable | Obligatoria | Valor esperado |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Si | URL publica real de la API |
| `NEXT_PUBLIC_AUTH_COOKIE_MODE` | Si | `true` |
| `NEXT_PUBLIC_INSTITUTION_NAME` | Si | nombre institucional real |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Recomendado | correo de soporte real |
| `NEXT_PUBLIC_SEDE_LABEL` | Recomendado | etiqueta institucional |

## Mobile

| Variable | Obligatoria | Valor esperado |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Si | URL publica real de la API |
| `EXPO_PUBLIC_INSTITUTION_NAME` | Si | nombre institucional real |
| `EXPO_PUBLIC_SEDE_LABEL` | Recomendado | etiqueta institucional |

## Coherencias obligatorias

- `NEXT_PUBLIC_API_URL` y `EXPO_PUBLIC_API_URL` deben apuntar a la misma API productiva.
- `WEBAUTHN_RP_ID` y `WEBAUTHN_ORIGIN` deben corresponder al frontend web final.
- `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` deben cubrir exactamente el frontend web real.
- Si el login web usa cookies de refresh, el frontend debe servir sobre HTTPS real.
