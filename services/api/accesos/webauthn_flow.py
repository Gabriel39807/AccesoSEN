from django.conf import settings

PASSKEY_REGISTER_CHALLENGE_TTL = 10 * 60
PASSKEY_AUTH_CHALLENGE_TTL = 5 * 60


def webauthn_register_cache_key(user_id: int, request_id: str) -> str:
    return f"sadi:webauthn:register:{user_id}:{request_id}"


def webauthn_auth_cache_key(request_id: str) -> str:
    return f"sadi:webauthn:auth:{request_id}"


def _request_host_without_port(request) -> str:
    if request is None:
        return ""
    host = str(request.get_host() or "").strip()
    if not host:
        return ""
    return host.split(":")[0].strip()


def _request_origin(request) -> str:
    if request is None:
        return ""
    host = str(request.get_host() or "").strip()
    if not host:
        return ""
    proto = str(request.META.get("HTTP_X_FORWARDED_PROTO", "") or "").split(",")[0].strip().lower()
    if proto not in {"http", "https"}:
        proto = str(getattr(request, "scheme", "http") or "http").lower()
    return f"{proto}://{host}"


def resolve_webauthn_rp_id(request) -> str:
    configured = str(getattr(settings, "WEBAUTHN_RP_ID", "") or "").strip()
    if configured:
        return configured
    return _request_host_without_port(request)


def resolve_webauthn_origin(request) -> str:
    configured = str(getattr(settings, "WEBAUTHN_ORIGIN", "") or "").strip()
    if configured:
        return configured
    return _request_origin(request)
