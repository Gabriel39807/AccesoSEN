import hashlib
from datetime import date, timedelta

from django.conf import settings
from django.db import transaction
from django.forms.models import model_to_dict
from django.utils import timezone
from rest_framework import status

from .api.permissions import resolve_control_panel_session
from .api_responses import error_response
from .domain.services.authorization import AuthorizationService
from .error_codes import ErrorCode
from .models import ControlPanelAuditEvent, ControlPanelQuotaCounter, ControlPanelSession, Usuario
from .rate_limit import get_client_ip


def control_panel_otp_cache_key(user_id: int, request_id: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{request_id}".encode("utf-8")).hexdigest()
    return f"sadi:control-panel:otp:{digest}"


def control_panel_passkey_cache_key(user_id: int, request_id: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{request_id}".encode("utf-8")).hexdigest()
    return f"sadi:control-panel:passkey:{digest}"


def control_panel_reason(request) -> str:
    raw_reason = str(request.headers.get("X-Control-Panel-Reason", "") or "").strip()
    if not raw_reason:
        raw_reason = str(request.query_params.get("reason", "") or "").strip()
    return raw_reason


def require_control_panel_reason_response(request):
    reason = control_panel_reason(request)
    if reason:
        return None
    return error_response(
        code=ErrorCode.VALIDATION_ERROR,
        message="Debes indicar un motivo del cambio en X-Control-Panel-Reason.",
        status_code=status.HTTP_400_BAD_REQUEST,
        field="reason",
    )


def json_safe(value):
    if isinstance(value, dict):
        return {str(key): json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return value
    return value


def snapshot_model(instance, serializer_class=None):
    if instance is None:
        return None
    if serializer_class is not None:
        return json_safe(serializer_class(instance).data)
    return json_safe(model_to_dict(instance))


def control_panel_category_limit(category: str) -> int:
    setting_by_category = {
        ControlPanelQuotaCounter.Category.BRANDING: ("CONTROL_PANEL_BRANDING_DAILY_LIMIT", 10),
        ControlPanelQuotaCounter.Category.DOMAINS: ("CONTROL_PANEL_DOMAINS_DAILY_LIMIT", 5),
        ControlPanelQuotaCounter.Category.POLICIES: ("CONTROL_PANEL_POLICIES_DAILY_LIMIT", 3),
        ControlPanelQuotaCounter.Category.PERMISSIONS: ("CONTROL_PANEL_PERMISSIONS_DAILY_LIMIT", 2),
        ControlPanelQuotaCounter.Category.PROGRAMS: ("CONTROL_PANEL_PROGRAMS_DAILY_LIMIT", 5),
        ControlPanelQuotaCounter.Category.SEDE_MANAGEMENT: ("CONTROL_PANEL_SEDE_DAILY_LIMIT", 5),
    }
    setting_name, default = setting_by_category.get(category, ("CONTROL_PANEL_GENERIC_DAILY_LIMIT", 1))
    return max(1, int(getattr(settings, setting_name, default) or default))


def control_panel_quota_state(user: Usuario, category: str):
    limit = control_panel_category_limit(category)
    today = timezone.localdate()
    counter = ControlPanelQuotaCounter.objects.filter(user=user, category=category, window_start=today).first()
    used = int(getattr(counter, "count", 0) or 0)
    remaining = max(0, limit - used)
    return {
        "category": category,
        "limit": limit,
        "used": used,
        "remaining": remaining,
        "window_start": today.isoformat(),
        "last_action_at": (
            getattr(counter, "last_action_at", None).isoformat() if getattr(counter, "last_action_at", None) else None
        ),
    }


def ensure_control_panel_quota_response(user: Usuario, category: str):
    state = control_panel_quota_state(user, category)
    if state["used"] < state["limit"]:
        return None
    return error_response(
        code=ErrorCode.VALIDATION_ERROR,
        message=f"Se alcanzo la cuota diaria para {category}.",
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=state,
        field="quota",
    )


def consume_control_panel_quota(user: Usuario, category: str):
    today = timezone.localdate()
    with transaction.atomic():
        counter, _ = ControlPanelQuotaCounter.objects.select_for_update().get_or_create(
            user=user,
            category=category,
            window_start=today,
            defaults={"count": 0},
        )
        limit = control_panel_category_limit(category)
        if counter.count >= limit:
            return None
        counter.count += 1
        counter.last_action_at = timezone.now()
        counter.save(update_fields=["count", "last_action_at"])
        return counter


def record_control_panel_audit(
    *,
    request,
    category: str,
    action: str,
    target_type: str,
    target_id,
    before_json,
    after_json,
):
    session = getattr(request, "control_panel_session", None) or resolve_control_panel_session(request)
    return ControlPanelAuditEvent.objects.create(
        actor=getattr(request, "user", None),
        session=session,
        action=action,
        category=category,
        target_type=target_type,
        target_id=str(target_id or ""),
        before_json=json_safe(before_json),
        after_json=json_safe(after_json),
        reason=control_panel_reason(request),
        ip_address=str(get_client_ip(request) or ""),
    )


def request_user_agent(request) -> str:
    return str(request.META.get("HTTP_USER_AGENT", "") or "").strip()


def active_control_panel_session_payload(session: ControlPanelSession | None) -> dict:
    if not session:
        return {"active": False, "session": None}
    return {
        "active": True,
        "session": {
            "id": str(session.id),
            "verified_by": session.verified_by,
            "granted_at": session.granted_at.isoformat() if session.granted_at else None,
            "expires_at": session.expires_at.isoformat() if session.expires_at else None,
            "last_used_at": session.last_used_at.isoformat() if session.last_used_at else None,
        },
    }


def revoke_active_control_panel_sessions(user: Usuario):
    if not user:
        return
    ControlPanelSession.objects.filter(
        user=user,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(revoked_at=timezone.now())


def create_control_panel_session(
    request,
    user: Usuario,
    *,
    verified_by: str,
    session_ttl_sec: int,
) -> ControlPanelSession:
    revoke_active_control_panel_sessions(user)
    runtime_role = AuthorizationService.runtime_role_for_user(user)
    return ControlPanelSession.objects.create(
        user=user,
        verified_by=verified_by,
        expires_at=timezone.now() + timedelta(seconds=session_ttl_sec),
        ip_address=str(get_client_ip(request) or ""),
        user_agent=request_user_agent(request),
        scope_snapshot={
            "runtime_role": runtime_role,
            "permissions": sorted(list(AuthorizationService.role_codes(user))),
        },
    )


def require_control_panel_session_response(request, user: Usuario | None):
    session = resolve_control_panel_session(request)
    if session is not None:
        return None
    return error_response(
        code=ErrorCode.PERMISSION_DENIED,
        message="Se requiere una sesion reforzada vigente del panel de control.",
        status_code=status.HTTP_403_FORBIDDEN,
    )
