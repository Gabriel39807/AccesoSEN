# Security Policy

## Supported versions
- `dev`: active hardening branch.
- `main`: production release branch.

## Reporting a vulnerability
Please do not open public issues for security vulnerabilities.

Report privately to project maintainers with:
- impact summary
- reproduction steps
- affected endpoints/modules
- suggested fix (optional)

Response targets:
- acknowledgement: within 72 hours
- triage decision: within 7 days
- fix release timing: based on severity (P0/P1 first)

## Security baseline in this repository
- JWT access/refresh with rotation enabled.
- OTP expiration, attempt limits and request limits.
- Login rate limiting by user and IP.
- Structured API error responses without leaking sensitive internals.
- Production settings enforce secure cookies, HSTS, frame/content hardening.
