"""Business HTTP views for auth, users, shifts and access records.

Responsibility:
- Expose DRF endpoints for critical S.A.D.I flows.
- Apply business rules and UI-friendly responses.
"""

from __future__ import annotations

import base64
import io
import logging
import secrets
import time
from datetime import date
from uuid import uuid4

import qrcode
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, connection, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .api_responses import error_response, ok_response
from .api.permissions import RequiresControlPanelSession, RequiresPermission, resolve_control_panel_session
from .domain.services.authorization import AuthorizationService
from .domain.services.email_domain_service import EmailDomainService
from .domain.services.policy_service import PolicyService
from .domain.services.qr_service import QRParseError, QRService
from .control_panel_support import (
    active_control_panel_session_payload,
    consume_control_panel_quota,
    control_panel_otp_cache_key,
    control_panel_passkey_cache_key,
    control_panel_quota_state,
    create_control_panel_session,
    ensure_control_panel_quota_response,
    json_safe,
    record_control_panel_audit,
    request_user_agent,
    require_control_panel_reason_response,
    require_control_panel_session_response,
    snapshot_model,
)
from .error_codes import ErrorCode
from .import_services import (
    ImportServiceError,
    cache_import_payload,
    count_distinct_error_rows,
    execute_aprendices_import,
    get_cached_import_payload,
    validate_excel,
)
from .jwt_views import (
    _cookie_mode_requested,
    _set_refresh_cookie,
    _strip_refresh_from_body_if_needed,
    issue_tokens_for_user,
)
from .metrics import incr as incr_metric
from .models import (
    Acceso,
    AllowedEmailDomain,
    BrandingPreset,
    ConfiguracionSistema,
    ControlPanelAuditEvent,
    ControlPanelQuotaCounter,
    ControlPanelSession,
    EmailChangeOTP,
    Equipo,
    Notificacion,
    Permission as RbacPermission,
    PasswordResetOTP,
    ProgramaFormacion,
    RefreshSession,
    Role,
    RolePermission,
    Sede,
    SedePolicy,
    TenantBrandingConfig,
    Turno,
    UserMembership,
    Usuario,
    WebAuthnCredential,
)
from .otp_services import (
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS,
    OTP_REQUEST_LOCK_SEC,
    OTP_REQUEST_WINDOW_SEC,
    create_otp_for_user,
    generate_otp_code,
    hash_code,
    send_control_panel_otp_email,
    send_password_reset_email,
)
from .permissions import IsAprendiz, IsGuarda, is_admin_role, is_admin_sede, is_superadmin
from .rate_limit import bump_with_lock, get_client_ip, get_lock_remaining, is_locked
from .serializers import (
    AccesoSerializer,
    AllowedEmailDomainSerializer,
    AprendizEmailChangeConfirmSerializer,
    AprendizEmailChangeRequestSerializer,
    AprendizPerfilSerializer,
    AprendizPerfilUpdateSerializer,
    BrandingPresetSerializer,
    ChangeInitialPasswordSerializer,
    ConfiguracionSistemaSerializer,
    ControlPanelSessionOtpVerifySerializer,
    ControlPanelSessionPasskeyVerifySerializer,
    EquipoRevisionSerializer,
    EquipoSerializer,
    GeminiStubSerializer,
    ImportAprendicesConfirmSerializer,
    ImportAprendicesValidateSerializer,
    NotificacionSerializer,
    PermissionSerializer,
    PasskeyAuthOptionsSerializer,
    PasskeyAuthVerifySerializer,
    PasskeyRegisterOptionsSerializer,
    PasskeyRegisterVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetVerifySerializer,
    ProgramaFormacionSerializer,
    RegistrarAccesoContingenciaSerializer,
    RegistrarAccesoDocumentoSerializer,
    RolePermissionSerializer,
    RoleSerializer,
    SedeSerializer,
    SedePolicySerializer,
    TenantBrandingConfigSerializer,
    TenantBrandingConfigUpdateSerializer,
    TurnoIniciarSerializer,
    TurnoSerializer,
    UsuarioSerializer,
    ValidarDocumentoSerializer,
)
from .webauthn_flow import (
    PASSKEY_AUTH_CHALLENGE_TTL,
    PASSKEY_REGISTER_CHALLENGE_TTL,
    resolve_webauthn_origin,
    resolve_webauthn_rp_id,
    webauthn_auth_cache_key,
    webauthn_register_cache_key,
)
from .webauthn_guards import control_panel_passkey_disabled_response, passkey_auth_disabled_response

CONTROL_PANEL_SESSION_TTL_SEC = max(60, int(getattr(settings, "CONTROL_PANEL_SESSION_TTL_SEC", 15 * 60) or 15 * 60))
CONTROL_PANEL_OTP_TTL_SEC = max(60, int(getattr(settings, "CONTROL_PANEL_OTP_TTL_SEC", 5 * 60) or 5 * 60))
MAX_ADMINS_PER_SEDE = 2
FILTER_ALL_VALUES = {"all", "todos", "todas", "*"}
TURNO_AUTO_CLOSE_OBSERVATION = "Cierre por tiempo limite alcanzado"
IDEMPOTENCY_TTL_SEC = max(60, int(getattr(settings, "IDEMPOTENCY_TTL_SEC", 600) or 600))
IDEMPOTENCY_LOCK_SEC = max(5, int(getattr(settings, "IDEMPOTENCY_LOCK_SEC", 30) or 30))
GEMINI_RATE_LIMIT_ATTEMPTS = max(1, int(getattr(settings, "GEMINI_RATE_LIMIT_ATTEMPTS", 10) or 10))
GEMINI_RATE_LIMIT_WINDOW_SEC = max(10, int(getattr(settings, "GEMINI_RATE_LIMIT_WINDOW_SEC", 60) or 60))
GEMINI_RATE_LIMIT_LOCK_SEC = max(10, int(getattr(settings, "GEMINI_RATE_LIMIT_LOCK_SEC", 60) or 60))
logger = logging.getLogger(__name__)


def _apply_branding_preset_to_config(*, preset: BrandingPreset, config: ConfiguracionSistema):
    tokens = dict(getattr(preset, "tokens_json", {}) or {})
    config.color_aprendiz_light = tokens.get("color_aprendiz_light", config.color_aprendiz_light)
    config.color_aprendiz_dark = tokens.get("color_aprendiz_dark", config.color_aprendiz_dark)
    config.color_admin_light = tokens.get("color_admin_light", config.color_admin_light)
    config.color_admin_dark = tokens.get("color_admin_dark", config.color_admin_dark)
    config.color_guarda_light = tokens.get("color_guarda_light", config.color_guarda_light)
    config.color_guarda_dark = tokens.get("color_guarda_dark", config.color_guarda_dark)
    config.save()


def _effective_config_payload(config: ConfiguracionSistema, *, preset: BrandingPreset | None = None):
    payload = ConfiguracionSistemaSerializer(config).data
    if preset is not None:
        tokens = dict(getattr(preset, "tokens_json", {}) or {})
        for key, value in tokens.items():
            payload[key] = value
        payload["branding_preset"] = preset.slug
    return payload


def _scope_sede_id(user: Usuario) -> int | None:
    if not user:
        return None
    return AuthorizationService.default_sede_id(user, role_code=_effective_role(user))


def _scope_sede_code(user: Usuario) -> str | None:
    if not user:
        return None
    sede = AuthorizationService.default_sede(user, role_code=_effective_role(user))
    code = getattr(sede, "code", None)
    return (code or "").strip() or None


def _scope_sede_obj(user: Usuario):
    if not user:
        return None
    return AuthorizationService.default_sede(user, role_code=_effective_role(user))


def _scope_sede(user: Usuario) -> str | None:
    # Compat helper: mantiene semantica previa (devuelve codigo)
    return _scope_sede_code(user)


def _is_admin_full_access(user: Usuario) -> bool:
    return bool(user and is_admin_role(user) and not is_admin_sede(user))


def _effective_role(user: Usuario | None) -> str:
    return AuthorizationService.runtime_role_for_user(user) if user else ""


def _has_role(user: Usuario | None, role_code: str) -> bool:
    if not user:
        return False
    return role_code in AuthorizationService.role_codes(user)


def _has_active_role(user: Usuario | None, role_code: str) -> bool:
    if not user:
        return False
    return AuthorizationService.runtime_role_for_user(user) == role_code


def _require_permission_response(user: Usuario | None, perm_code: str, *, message: str):
    if user and getattr(user, "is_authenticated", False) and AuthorizationService.has_perm(user, perm_code):
        return None
    return error_response(
        code=ErrorCode.PERMISSION_DENIED,
        message=message,
        status_code=status.HTTP_403_FORBIDDEN,
    )


def _same_sede_or_superadmin(actor: Usuario, target_sede: str | None) -> bool:
    if not actor:
        return False
    if _is_admin_full_access(actor):
        return True
    if not is_admin_sede(actor):
        return False
    actor_sede = _scope_sede_code(actor)
    if not actor_sede:
        return False
    return (target_sede or "").strip() == actor_sede


def _admin_sede_qs(qs, user: Usuario, field_name: str):
    if not is_admin_sede(user):
        return qs
    sede_id = _scope_sede_id(user)
    if not sede_id:
        return qs.none()
    return qs.filter(**{field_name: sede_id})


def _guard_can_use_sede(user: Usuario, sede: Sede | None) -> bool:
    if not user or not sede:
        return False
    if AuthorizationService.is_superadmin(user):
        return True

    primary_sede_id = _scope_sede_id(user)
    if primary_sede_id and int(primary_sede_id) == int(sede.id):
        return True

    membership = (
        UserMembership.objects.filter(
            user=user,
            is_active=True,
            role__code=Usuario.Rol.GUARDA,
            sede=sede,
        )
        .select_related("sede", "role")
        .first()
    )
    if not membership:
        return False

    policy = PolicyService.get_policy(sede)
    return bool(membership.can_switch_sede or policy.guards_can_switch_sede)


def _enforce_admin_sede_limit(target_sede_id: int | None, exclude_user_id: int | None = None) -> tuple[bool, int]:
    if not target_sede_id:
        return False, 0
    role_admin = Role.objects.filter(code=Usuario.Rol.ADMIN_SEDE).only("id").first()
    if not role_admin:
        return False, 0
    qs = UserMembership.objects.filter(
        role=role_admin,
        sede_id=target_sede_id,
        is_active=True,
    ).values("user_id")
    if exclude_user_id:
        qs = qs.exclude(user_id=exclude_user_id)
    current = qs.distinct().count()
    return current >= MAX_ADMINS_PER_SEDE, current


def _pick_query_param(request, names: list[str]) -> tuple[str | None, str | None]:
    for name in names:
        value = request.query_params.get(name, None)
        if value is None:
            continue
        clean = str(value).strip()
        if not clean:
            continue
        return clean, name
    return None, None


def _choice_codes_and_labels(choices) -> tuple[list[str], set[str]]:
    codes: list[str] = []
    labels: set[str] = set()
    for code, label in list(choices):
        codes.append(str(code))
        labels.add(str(label).strip().lower())
    return codes, labels


def _parse_choice_query_param(
    request,
    *,
    names: list[str],
    choices,
    field: str,
    allow_all: bool = False,
):
    raw, _ = _pick_query_param(request, names)
    if raw is None:
        return None

    lower = raw.lower()
    if lower in FILTER_ALL_VALUES:
        if allow_all:
            return None
        raise ValidationError({field: "El valor 'Todas' no es valido para este filtro."})

    valid_codes, label_values = _choice_codes_and_labels(choices)
    if raw in valid_codes:
        return raw

    if lower in label_values:
        raise ValidationError(
            {
                field: (
                    f"Valor invalido para {field}. Debes enviar el codigo tecnico, "
                    f"no la etiqueta visible. Valores permitidos: {', '.join(valid_codes)}."
                )
            }
        )

    raise ValidationError({field: f"Valor invalido. Valores permitidos: {', '.join(valid_codes)}."})


def _parse_int_query_param(request, *, names: list[str], field: str):
    raw, _ = _pick_query_param(request, names)
    if raw is None:
        return None

    lower = raw.lower()
    if lower in FILTER_ALL_VALUES:
        return None
    if not raw.isdigit():
        raise ValidationError({field: "Debe ser un numero entero positivo."})
    return int(raw)


def _parse_bool_query_param(request, *, names: list[str], field: str):
    raw, _ = _pick_query_param(request, names)
    if raw is None:
        return None
    lower = raw.lower()
    if lower in FILTER_ALL_VALUES:
        return None
    if lower not in {"true", "false"}:
        raise ValidationError({field: "Valor invalido. Usa true o false."})
    return lower == "true"


def _parse_date_query_param(request, *, names: list[str], field: str):
    raw, _ = _pick_query_param(request, names)
    if raw is None:
        return None
    lower = raw.lower()
    if lower in FILTER_ALL_VALUES:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({field: "Formato de fecha invalido. Usa YYYY-MM-DD."})


def _resolve_sede_code(raw: str, *, field: str = "sede_id") -> str | None:
    clean = str(raw or "").strip()
    if not clean:
        return None
    if clean.isdigit():
        sede = Sede.objects.filter(id=int(clean), is_active=True).first()
        return sede.code if sede else None
    sede = Sede.objects.filter(code__iexact=clean, is_active=True).first()
    if sede:
        return sede.code
    if Sede.objects.filter(name__iexact=clean, is_active=True).exists():
        raise ValidationError(
            {field: ("Valor invalido para sede. Debes enviar el codigo tecnico o id, no la etiqueta visible.")}
        )
    return None


def _parse_sede_query_param(request, user: Usuario, *, names: list[str], field: str = "sede_id"):
    actor_sede = _scope_sede_code(user)
    raw, _ = _pick_query_param(request, names)
    allowed_sede_ids = AuthorizationService.allowed_sede_ids(user)
    allowed_codes = set(Sede.objects.filter(id__in=allowed_sede_ids).values_list("code", flat=True))

    if is_admin_sede(user):
        # Admin de sede: backend decides scope. If there are multiple memberships,
        # allow machine filter only inside allowed set.
        if raw is None:
            if len(allowed_codes) == 1:
                return next(iter(allowed_codes))
            return None
        lower = raw.lower()
        if lower in FILTER_ALL_VALUES:
            if len(allowed_codes) == 1:
                return next(iter(allowed_codes))
            return None

        resolved = _resolve_sede_code(raw, field=field)
        if not resolved:
            valid_codes = list(Sede.objects.filter(is_active=True).order_by("code").values_list("code", flat=True))
            raise ValidationError({field: f"Sede invalida. Valores permitidos: {', '.join(valid_codes)}."})
        if allowed_codes and resolved not in allowed_codes:
            if len(allowed_codes) == 1:
                return next(iter(allowed_codes))
            return None
        return resolved

    if raw is None:
        return None
    lower = raw.lower()
    if lower in FILTER_ALL_VALUES:
        if is_superadmin(user):
            return None
        return actor_sede

    resolved = _resolve_sede_code(raw, field=field)
    if resolved:
        return resolved
    valid_codes = list(Sede.objects.filter(is_active=True).order_by("code").values_list("code", flat=True))
    raise ValidationError({field: f"Sede invalida. Valores permitidos: {', '.join(valid_codes)}."})


def _uniform_response_delay(start_ts: float, min_ms: int = 220):
    elapsed_ms = int((time.perf_counter() - start_ts) * 1000)
    remaining_ms = max(0, min_ms - elapsed_ms)
    if remaining_ms:
        time.sleep(remaining_ms / 1000.0)


def _idempotency_prepare(request, *, action: str) -> tuple[Response | None, str | None, str | None]:
    raw_key = str(request.headers.get("X-Idempotency-Key", "") or "").strip()
    if not raw_key:
        return None, None, None

    user_id = getattr(getattr(request, "user", None), "id", None)
    if not user_id:
        return None, None, None

    cache_key = f"sadi:idempotency:{action}:{user_id}:{raw_key}"
    lock_key = f"{cache_key}:lock"
    cached = cache.get(cache_key)
    if isinstance(cached, dict) and "status" in cached and "data" in cached:
        return Response(cached.get("data"), status=int(cached.get("status", status.HTTP_200_OK))), cache_key, None

    if not cache.add(lock_key, "1", timeout=IDEMPOTENCY_LOCK_SEC):
        cached = cache.get(cache_key)
        if isinstance(cached, dict) and "status" in cached and "data" in cached:
            return Response(cached.get("data"), status=int(cached.get("status", status.HTTP_200_OK))), cache_key, None
        return (
            error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Operacion en curso para la misma clave de idempotencia.",
                status_code=status.HTTP_409_CONFLICT,
            ),
            cache_key,
            None,
        )

    return None, cache_key, lock_key


def _idempotency_store_success(cache_key: str | None, response: Response):
    if not cache_key:
        return
    if int(getattr(response, "status_code", 500) or 500) >= 500:
        return
    cache.set(
        cache_key,
        {"status": int(response.status_code), "data": response.data},
        timeout=IDEMPOTENCY_TTL_SEC,
    )


def _idempotency_release(lock_key: str | None):
    if lock_key:
        cache.delete(lock_key)


def _gemini_stub_response(prompt: str) -> str:
    clean_prompt = " ".join((prompt or "").strip().split())
    preview = clean_prompt[:280]
    model = str(getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash") or "gemini-2.0-flash")
    return f"[stub:{model}] Respuesta simulada para: {preview}"


def _gemini_stub_with_retry(prompt: str) -> str:
    attempts = max(1, int(getattr(settings, "GEMINI_RETRY_ATTEMPTS", 2) or 2))
    timeout_sec = max(1, int(getattr(settings, "GEMINI_TIMEOUT_SEC", 12) or 12))
    backoff_ms = max(50, int(getattr(settings, "GEMINI_RETRY_BACKOFF_MS", 250) or 250))
    last_error: Exception | None = None

    for attempt in range(attempts):
        started = time.perf_counter()
        try:
            # Hook de prueba para validar timeout/backoff sin depender de red externa.
            if str(prompt or "").strip().lower() == "__simulate_timeout__":
                time.sleep(timeout_sec + 0.05)
            response = _gemini_stub_response(prompt)
            elapsed = time.perf_counter() - started
            if elapsed > float(timeout_sec):
                raise TimeoutError("gemini_stub_timeout")
            return response
        except TimeoutError as exc:
            last_error = exc
            if attempt + 1 >= attempts:
                break
            time.sleep((backoff_ms / 1000.0) * (2**attempt))

    raise TimeoutError("gemini_stub_timeout") from last_error


def _normalize_active_turnos(user: Usuario, *, lock_for_update: bool = False) -> list[Turno]:
    qs = Turno.objects.filter(guarda=user, activo=True).order_by("-inicio")
    if lock_for_update:
        qs = qs.select_for_update()
    now = timezone.now()
    active_turnos: list[Turno] = []
    for t in qs[:10]:
        if t.fin is not None:
            t.activo = False
            t.save(update_fields=["activo"])
            continue

        if t.is_expired:
            t.activo = False
            t.fin = _safe_fin(now, t.inicio)
            if not (t.cierre_observacion or "").strip():
                t.cierre_observacion = TURNO_AUTO_CLOSE_OBSERVATION
                t.save(update_fields=["activo", "fin", "cierre_observacion"])
            else:
                t.save(update_fields=["activo", "fin"])
            continue

        active_turnos.append(t)
    return active_turnos


def obtener_turno_activo(user):
    active_turnos = _normalize_active_turnos(user, lock_for_update=False)
    return active_turnos[0] if active_turnos else None


def _safe_fin(now, inicio):
    if inicio and now < inicio:
        return inicio
    return now


def _request_session_id(request) -> str | None:
    auth = getattr(request, "auth", None)
    if auth is None:
        return None
    if hasattr(auth, "get"):
        sid = str(auth.get("sid") or "").strip()
        return sid or None
    sid = str(getattr(auth, "sid", "") or "").strip()
    return sid or None


def _build_aprendiz_qr_value(user: Usuario, *, request=None) -> tuple[str, str]:
    qr_value, mode = QRService.build_aprendiz_qr_value(
        str(user.documento or "").strip(),
        sede=_scope_sede_obj(user),
        session_id=_request_session_id(request) if request is not None else None,
        user_id=getattr(user, "id", None),
    )
    return qr_value, mode


def _extract_documento_from_scan(raw_value: str, *, sede: Sede | None = None) -> str:
    return QRService.parse_document(raw_value, sede=sede).documento


def _find_user_for_password_reset(email: str = "") -> Usuario | None:
    if not email:
        return None
    return Usuario.objects.filter(email__iexact=email).first()


class HealthCheckView(APIView):
    """Healthcheck API for uptime monitoring.

    Runs a minimal database query (`SELECT 1`) to validate readiness.
    Intended for load balancers and monitoring probes.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """Return service/database status."""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            return error_response(
                code=ErrorCode.SERVER_ERROR,
                message="Healthcheck fallido: base de datos no disponible.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return ok_response({"status": "ok", "database": "ok", "service": "accesos"})


class PublicSedeListView(APIView):
    """Public list of active sedes for pre-login guard flows."""

    permission_classes = [AllowAny]

    def get(self, request):
        qs = Sede.objects.filter(is_active=True).order_by("name")
        return ok_response({"results": SedeSerializer(qs, many=True).data})


class ConfiguracionSistemaView(APIView):
    """Configuración global de marca blanca para frontend.

    GET:
        Público. Entrega nombre institucional y paleta por rol.
    PUT:
        Solo superusuario. Permite actualizar branding global.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        tenant_branding = TenantBrandingConfig.get_solo()
        cfg = ConfiguracionSistema.get_solo()
        payload = _effective_config_payload(cfg, preset=tenant_branding.branding_preset)
        return ok_response({"configuracion": payload})

    def put(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return error_response(
                code=ErrorCode.NOT_AUTHENTICATED,
                message="Debes iniciar sesion para modificar la configuracion.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        denied = _require_permission_response(
            user,
            "control_panel.branding.update",
            message="No tienes permisos para actualizar la configuracion global.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, user)
        if denied:
            return denied
        denied = require_control_panel_reason_response(request)
        if denied:
            return denied
        denied = ensure_control_panel_quota_response(user, ControlPanelQuotaCounter.Category.BRANDING)
        if denied:
            return denied

        cfg = ConfiguracionSistema.get_solo()
        before_json = snapshot_model(cfg, ConfiguracionSistemaSerializer)
        serializer = ConfiguracionSistemaSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        finalized = consume_control_panel_quota(user, ControlPanelQuotaCounter.Category.BRANDING)
        if finalized is None:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Se alcanzo la cuota diaria para branding.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=control_panel_quota_state(user, ControlPanelQuotaCounter.Category.BRANDING),
                field="quota",
            )
        record_control_panel_audit(
            request=request,
            category=ControlPanelQuotaCounter.Category.BRANDING,
            action=ControlPanelAuditEvent.Action.UPDATE,
            target_type="configuracion_sistema",
            target_id=cfg.pk,
            before_json=before_json,
            after_json=serializer.data,
        )
        return ok_response({"configuracion": serializer.data, "mensaje": "Configuracion actualizada correctamente."})


class ControlPanelSessionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session = resolve_control_panel_session(request)
        return ok_response(active_control_panel_session_payload(session))


class ControlPanelBrandingPresetListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_permission_response(
            request.user,
            "control_panel.branding.read",
            message="No tienes permisos para consultar presets de branding.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, request.user)
        if denied:
            return denied
        presets = BrandingPreset.objects.filter(is_active=True).order_by("name")
        return ok_response({"results": BrandingPresetSerializer(presets, many=True).data, "count": presets.count()})


class ControlPanelBrandingConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_permission_response(
            request.user,
            "control_panel.branding.read",
            message="No tienes permisos para consultar la configuracion de branding.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, request.user)
        if denied:
            return denied
        config = TenantBrandingConfig.get_solo()
        return ok_response({"configuracion": TenantBrandingConfigSerializer(config).data})

    def patch(self, request):
        denied = _require_permission_response(
            request.user,
            "control_panel.branding.update",
            message="No tienes permisos para actualizar la configuracion de branding.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, request.user)
        if denied:
            return denied
        denied = require_control_panel_reason_response(request)
        if denied:
            return denied
        denied = ensure_control_panel_quota_response(request.user, ControlPanelQuotaCounter.Category.BRANDING)
        if denied:
            return denied

        config = TenantBrandingConfig.get_solo()
        before_json = TenantBrandingConfigSerializer(config).data
        serializer = TenantBrandingConfigUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        preset = serializer.validated_data["branding_preset"]
        config.branding_preset = preset
        config.updated_by = request.user
        config.save(update_fields=["branding_preset", "updated_by", "updated_at"])
        _apply_branding_preset_to_config(preset=preset, config=ConfiguracionSistema.get_solo())
        after_json = TenantBrandingConfigSerializer(config).data

        finalized = consume_control_panel_quota(request.user, ControlPanelQuotaCounter.Category.BRANDING)
        if finalized is None:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Se alcanzo la cuota diaria para branding.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=control_panel_quota_state(request.user, ControlPanelQuotaCounter.Category.BRANDING),
                field="quota",
            )
        record_control_panel_audit(
            request=request,
            category=ControlPanelQuotaCounter.Category.BRANDING,
            action=ControlPanelAuditEvent.Action.UPDATE,
            target_type="tenant_branding_config",
            target_id=config.pk,
            before_json=before_json,
            after_json=after_json,
        )
        return ok_response({"configuracion": after_json, "mensaje": "Branding actualizado correctamente."})


class ControlPanelSessionCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session = resolve_control_panel_session(request)
        if session is None:
            return ok_response(active_control_panel_session_payload(None))
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        return ok_response({"active": False, "session": None, "mensaje": "Sesion del panel cerrada correctamente."})


class ControlPanelSessionRequestOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user: Usuario = request.user
        denied = _require_permission_response(
            user,
            "control_panel.session.open",
            message="No tienes permisos para abrir una sesion del panel de control.",
        )
        if denied:
            return denied
        if not user.email:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Tu cuenta no tiene un correo configurado para OTP.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="email",
            )

        ip = get_client_ip(request)
        user_key = [str(user.id), "control-panel-session"]
        ip_key = [ip, "control-panel-session"]
        if is_locked("otp-request-user", user_key) or is_locked("otp-request-ip", ip_key):
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user_limit = bump_with_lock(
            "otp-request-user", user_key, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
        )
        ip_limit = bump_with_lock(
            "otp-request-ip", ip_key, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
        )
        if user_limit["locked"] or ip_limit["locked"]:
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        request_id = uuid4().hex
        code = generate_otp_code()
        salt = secrets.token_hex(16)
        cache.set(
            control_panel_otp_cache_key(user.id, request_id),
            {
                "salt": salt,
                "code_hash": hash_code(salt, code),
                "attempts": 0,
                "ip": str(ip or ""),
                "user_agent": request_user_agent(request),
            },
            timeout=CONTROL_PANEL_OTP_TTL_SEC,
        )
        try:
            send_control_panel_otp_email(user.email, code)
        except ImproperlyConfigured:
            cache.delete(control_panel_otp_cache_key(user.id, request_id))
            logger.exception("control_panel_otp_email_misconfigured user_id=%s", user.id)
            return error_response(
                code=ErrorCode.NETWORK_ERROR,
                message="El servicio de correo OTP del panel no esta disponible.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            cache.delete(control_panel_otp_cache_key(user.id, request_id))
            logger.exception("control_panel_otp_email_failed user_id=%s", user.id)
            return error_response(
                code=ErrorCode.NETWORK_ERROR,
                message="No se pudo enviar el codigo OTP del panel.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return ok_response(
            {
                "request_id": request_id,
                "expires_in": CONTROL_PANEL_OTP_TTL_SEC,
                "delivery": {"channel": "email", "to": user.email},
            }
        )


class ControlPanelSessionVerifyOtpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user: Usuario = request.user
        denied = _require_permission_response(
            user,
            "control_panel.session.open",
            message="No tienes permisos para abrir una sesion del panel de control.",
        )
        if denied:
            return denied

        s = ControlPanelSessionOtpVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        key = control_panel_otp_cache_key(user.id, s.validated_data["request_id"])
        payload = cache.get(key) or {}
        if not payload:
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El codigo OTP del panel expiro. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        attempts = int(payload.get("attempts", 0) or 0)
        if attempts >= OTP_MAX_ATTEMPTS:
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(str(payload.get("salt", "")), s.validated_data["otp"]) != payload.get("code_hash"):
            payload["attempts"] = attempts + 1
            cache.set(key, payload, timeout=CONTROL_PANEL_OTP_TTL_SEC)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(key)
        session = create_control_panel_session(
            request,
            user,
            verified_by=ControlPanelSession.VerifiedBy.OTP,
            session_ttl_sec=CONTROL_PANEL_SESSION_TTL_SEC,
        )
        return ok_response(
            {
                **active_control_panel_session_payload(session),
                "mensaje": "Sesion del panel abierta correctamente.",
            }
        )


class ControlPanelSessionRequestPasskeyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not bool(getattr(settings, "WEBAUTHN_MOCK", True)):
            return control_panel_passkey_disabled_response()
        user: Usuario = request.user
        denied = _require_permission_response(
            user,
            "control_panel.session.open",
            message="No tienes permisos para abrir una sesion del panel de control.",
        )
        if denied:
            return denied
        credentials = list(user.webauthn_credentials.values("credential_id", "transports"))
        if not credentials:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="No tienes passkeys registradas para step-up auth.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        request_id = uuid4().hex
        challenge = secrets.token_urlsafe(32)
        cache.set(
            control_panel_passkey_cache_key(user.id, request_id),
            {"challenge": challenge},
            timeout=PASSKEY_AUTH_CHALLENGE_TTL,
        )
        return ok_response(
            {
                "request_id": request_id,
                "challenge": challenge,
                "rp_id": resolve_webauthn_rp_id(request),
                "timeout": 60000,
                "allow_credentials": credentials,
                "mock": bool(getattr(settings, "WEBAUTHN_MOCK", True)),
            }
        )


class ControlPanelSessionVerifyPasskeyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not bool(getattr(settings, "WEBAUTHN_MOCK", True)):
            return control_panel_passkey_disabled_response()
        user: Usuario = request.user
        denied = _require_permission_response(
            user,
            "control_panel.session.open",
            message="No tienes permisos para abrir una sesion del panel de control.",
        )
        if denied:
            return denied

        s = ControlPanelSessionPasskeyVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)
        key = control_panel_passkey_cache_key(user.id, s.validated_data["request_id"])
        payload = cache.get(key) or {}
        if not payload:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="El reto de autenticacion del panel expiro.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        if payload.get("challenge") != s.validated_data["challenge"]:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="Verificacion passkey invalida.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        credential = (
            WebAuthnCredential.objects.select_related("user")
            .filter(user=user, credential_id=s.validated_data["credential_id"])
            .first()
        )
        if credential is None:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="Credencial passkey invalida.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        credential.last_used_at = timezone.now()
        credential.sign_count = int(credential.sign_count or 0) + 1
        credential.save(update_fields=["last_used_at", "sign_count"])
        cache.delete(key)
        session = create_control_panel_session(
            request,
            user,
            verified_by=ControlPanelSession.VerifiedBy.PASSKEY,
            session_ttl_sec=CONTROL_PANEL_SESSION_TTL_SEC,
        )
        return ok_response(
            {
                **active_control_panel_session_payload(session),
                "mensaje": "Sesion del panel abierta correctamente.",
            }
        )


def _role_display_name(code: str) -> str:
    mapping = {
        Usuario.Rol.SUPERADMIN: "Superadmin",
        Usuario.Rol.ADMIN_SEDE: "Admin de sede",
        Usuario.Rol.GUARDA: "Guarda",
        Usuario.Rol.APRENDIZ: "Aprendiz",
    }
    return mapping.get(code, code)


def _sync_primary_membership_for_user(user: Usuario):
    if not user:
        return
    role_code = str(getattr(user, "rol", "") or "").strip()
    if not role_code:
        return

    role_obj, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": _role_display_name(role_code), "is_system": True},
    )
    target_sede = None if role_code == Usuario.Rol.SUPERADMIN else getattr(user, "sede_principal", None)

    UserMembership.objects.filter(user=user, is_primary=True).update(is_primary=False)
    membership, created = UserMembership.objects.get_or_create(
        user=user,
        role=role_obj,
        sede=target_sede,
        defaults={
            "is_primary": True,
            "is_active": True,
            "can_switch_sede": False,
        },
    )
    if not created:
        updates: list[str] = []
        if not membership.is_primary:
            membership.is_primary = True
            updates.append("is_primary")
        if not membership.is_active:
            membership.is_active = True
            updates.append("is_active")
        if updates:
            membership.save(update_fields=updates)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UsuarioSerializer(request.user).data
        data["requires_password_reset"] = bool(getattr(request.user, "force_password_reset", False))
        return ok_response({"usuario": data})


class AprendizPerfilView(APIView):
    permission_classes = [IsAuthenticated, IsAprendiz]

    def get(self, request):
        pending = (
            EmailChangeOTP.objects.filter(user=request.user, used_at__isnull=True, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        payload = AprendizPerfilSerializer(request.user).data
        payload["pending_email_change"] = pending.new_email if pending else None
        return ok_response({"perfil": payload})

    def patch(self, request):
        s = AprendizPerfilUpdateSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        user.telefono = s.validated_data.get("telefono", user.telefono)
        user.save(update_fields=["telefono"])

        pending = (
            EmailChangeOTP.objects.filter(user=request.user, used_at__isnull=True, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        payload = AprendizPerfilSerializer(user).data
        payload["pending_email_change"] = pending.new_email if pending else None
        return ok_response({"perfil": payload, "mensaje": "Perfil actualizado."})


class AprendizEmailChangeRequestView(APIView):
    permission_classes = [IsAuthenticated, IsAprendiz]

    def post(self, request):
        s = AprendizEmailChangeRequestSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        new_email = s.validated_data["new_email"]

        if (user.email or "").strip().lower() == new_email:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="El nuevo correo debe ser diferente al correo actual.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="new_email",
            )

        if Usuario.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Ese correo ya esta en uso por otra cuenta.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="new_email",
            )

        ip = get_client_ip(request)
        k_user = [str(user.id), "email-change"]
        k_ip = [ip, "email-change"]
        if is_locked("email-change-user", k_user) or is_locked("email-change-ip", k_ip):
            remaining = max(
                get_lock_remaining("email-change-user", k_user), get_lock_remaining("email-change-ip", k_ip)
            )
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        limit_user = bump_with_lock(
            "email-change-user", k_user, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
        )
        limit_ip = bump_with_lock(
            "email-change-ip", k_ip, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
        )
        if limit_user["locked"] or limit_ip["locked"]:
            remaining = max(int(limit_user.get("remaining_sec", 0)), int(limit_ip.get("remaining_sec", 0)))
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        code = generate_otp_code()
        salt = uuid4().hex
        EmailChangeOTP.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        EmailChangeOTP.objects.create(
            user=user,
            new_email=new_email,
            salt=salt,
            code_hash=hash_code(salt, code),
            expires_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        try:
            send_password_reset_email(new_email, code)
        except Exception:
            return error_response(
                code=ErrorCode.NETWORK_ERROR,
                message="No se pudo enviar el codigo OTP al nuevo correo.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return ok_response({"mensaje": "Enviamos un codigo OTP al nuevo correo."})


class AprendizEmailChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated, IsAprendiz]

    def post(self, request):
        s = AprendizEmailChangeConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        new_email = s.validated_data["new_email"]
        otp = s.validated_data["otp"]

        otp_obj = (
            EmailChangeOTP.objects.filter(user=user, new_email__iexact=new_email, used_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if not otp_obj:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp_obj.expires_at:
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El codigo OTP expiro. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if otp_obj.attempts >= OTP_MAX_ATTEMPTS:
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(otp_obj.salt, otp) != otp_obj.code_hash:
            otp_obj.attempts += 1
            otp_obj.save(update_fields=["attempts"])
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if Usuario.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Ese correo ya esta en uso por otra cuenta.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        domain_check = EmailDomainService.validate(
            email=new_email,
            role_code=AuthorizationService.default_role_for_user(user) or Usuario.Rol.APRENDIZ,
            sede=_scope_sede_obj(user),
        )
        if not domain_check.allowed:
            return error_response(
                code=domain_check.code or ErrorCode.EMAIL_DOMAIN_NOT_ALLOWED,
                message=domain_check.message or "Dominio de correo no permitido.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="new_email",
            )

        user.email = new_email
        user.save(update_fields=["email"])

        otp_obj.used_at = timezone.now()
        otp_obj.save(update_fields=["used_at"])
        EmailChangeOTP.objects.filter(user=user, used_at__isnull=True).exclude(id=otp_obj.id).update(
            used_at=timezone.now()
        )

        payload = AprendizPerfilSerializer(user).data
        payload["pending_email_change"] = None
        return ok_response({"perfil": payload, "mensaje": "Correo actualizado correctamente."})


class ChangeInitialPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChangeInitialPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        current_password = s.validated_data["current_password"]
        new_password = s.validated_data["new_password"]

        if not user.check_password(current_password):
            return error_response(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="La contraseña actual no es correcta.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.last_password_change_at = timezone.now()
        user.force_password_reset = False
        user.failed_lockouts_count = 0
        user.first_lockout_at = None
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "force_password_reset",
                "failed_lockouts_count",
                "first_lockout_at",
                "last_password_change_at",
            ]
        )
        return ok_response({"mensaje": "contraseña actualizada correctamente."})


class AprendizMiQRView(APIView):
    permission_classes = [IsAuthenticated, IsAprendiz]

    def get(self, request):
        user: Usuario = request.user
        if not user.documento:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No tienes documento configurado.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qr_value, qr_mode = _build_aprendiz_qr_value(user, request=request)
        except QRParseError as exc:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message=str(exc) or "No fue posible generar el QR en este momento.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        img = qrcode.make(qr_value)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        png_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
        return ok_response(
            {
                "qr_value": qr_value,
                "documento": user.documento,
                "algoritmo": f"qr-{str(qr_mode).lower()}",
                "qr_png_base64": png_b64,
            }
        )


class AprendizMiQRDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsAprendiz]

    def get(self, request):
        user: Usuario = request.user
        if not user.documento:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No tienes documento configurado.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qr_value, _ = _build_aprendiz_qr_value(user, request=request)
        except QRParseError as exc:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message=str(exc) or "No fue posible generar el QR en este momento.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        img = qrcode.make(qr_value)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type="image/png")
        response["Content-Disposition"] = f'attachment; filename="sadi-mi-qr-{user.documento}.png"'
        return response


class GuardiaEstadoActualView(APIView):
    permission_classes = [IsAuthenticated, IsGuarda]

    def get(self, request):
        turno = obtener_turno_activo(request.user)
        if not turno:
            return ok_response({"turno_activo": False, "turno": None})
        return ok_response({"turno_activo": True, "turno": TurnoSerializer(turno).data})


class LegacyPasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        ip = get_client_ip(request)

        user = _find_user_for_password_reset(email=email)
        if user:
            k_user = [str(user.id), PasswordResetOTP.Channel.EMAIL]
            k_ip = [ip, PasswordResetOTP.Channel.EMAIL]
            if is_locked("otp-request-user", k_user) or is_locked("otp-request-ip", k_ip):
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta más tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            limit_user = bump_with_lock(
                "otp-request-user", k_user, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
            )
            limit_ip = bump_with_lock(
                "otp-request-ip", k_ip, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
            )
            if limit_user["locked"] or limit_ip["locked"]:
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta más tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            otp_obj, code = create_otp_for_user(user)
            try:
                send_password_reset_email(user.email, code)
            except Exception:
                otp_obj.delete()
                return error_response(
                    code=ErrorCode.NETWORK_ERROR,
                    message="No se pudo enviar el codigo OTP. Verifica la configuracion de correo.",
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return ok_response({"mensaje": "Si el usuario existe, enviamos un código OTP."})


class LegacyPasswordResetVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        otp = s.validated_data["otp"]

        user = _find_user_for_password_reset(email=email)
        if not user:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=PasswordResetOTP.Channel.EMAIL)
            .order_by("-created_at")
            .first()
        )
        if not otp_obj:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp_obj.expires_at:
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El código OTP expiró. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if otp_obj.attempts >= OTP_MAX_ATTEMPTS:
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(otp_obj.salt, otp) != otp_obj.code_hash:
            otp_obj.attempts += 1
            otp_obj.save(update_fields=["attempts"])
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return ok_response()


class LegacyPasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        otp = s.validated_data["otp"]
        new_password = s.validated_data["new_password"]

        user = _find_user_for_password_reset(email=email)
        if not user:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=PasswordResetOTP.Channel.EMAIL)
            .order_by("-created_at")
            .first()
        )
        if not otp_obj:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp_obj.expires_at:
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El código OTP expiró. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if otp_obj.attempts >= OTP_MAX_ATTEMPTS:
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(otp_obj.salt, otp) != otp_obj.code_hash:
            otp_obj.attempts += 1
            otp_obj.save(update_fields=["attempts"])
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        otp_obj.used_at = timezone.now()
        otp_obj.save(update_fields=["used_at"])
        PasswordResetOTP.objects.filter(
            user=user, used_at__isnull=True, channel=PasswordResetOTP.Channel.EMAIL
        ).exclude(id=otp_obj.id).update(used_at=timezone.now())

        return ok_response()


class ControlPanelMutationMixin:
    control_panel_category: str | None = None
    control_panel_target_type: str | None = None

    def _control_panel_snapshot(self, instance):
        return json_safe(self.get_serializer(instance).data)

    def _control_panel_target_name(self) -> str:
        if self.control_panel_target_type:
            return self.control_panel_target_type
        model = getattr(getattr(self, "queryset", None), "model", None)
        return getattr(getattr(model, "_meta", None), "model_name", "resource")

    def _preflight_control_panel_mutation(self, request):
        denied = require_control_panel_reason_response(request)
        if denied:
            return denied
        return ensure_control_panel_quota_response(request.user, self.control_panel_category)

    def _finalize_control_panel_mutation(self, request, *, action: str, target_id, before_json, after_json):
        counter = consume_control_panel_quota(request.user, self.control_panel_category)
        if counter is None:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Se alcanzo la cuota diaria para {self.control_panel_category}.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=control_panel_quota_state(request.user, self.control_panel_category),
                field="quota",
            )
        record_control_panel_audit(
            request=request,
            category=self.control_panel_category,
            action=action,
            target_type=self._control_panel_target_name(),
            target_id=target_id,
            before_json=before_json,
            after_json=after_json,
        )
        return None

    def create(self, request, *args, **kwargs):
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.CREATE,
            target_id=serializer.data.get("id"),
            before_json=None,
            after_json=serializer.data,
        )
        if finalized:
            return finalized
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        before_json = self._control_panel_snapshot(instance)
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        if getattr(instance, "_prefetched_objects_cache", None):
            instance._prefetched_objects_cache = {}
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.UPDATE,
            target_id=serializer.data.get("id"),
            before_json=before_json,
            after_json=serializer.data,
        )
        if finalized:
            return finalized
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        before_json = self._control_panel_snapshot(instance)
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        target_id = getattr(instance, "id", None)
        self.perform_destroy(instance)
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.DELETE,
            target_id=target_id,
            before_json=before_json,
            after_json=None,
        )
        if finalized:
            return finalized
        return Response(status=status.HTTP_204_NO_CONTENT)


class SedeViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = SedeSerializer
    queryset = Sede.objects.all().order_by("name")
    permission_classes = [IsAuthenticated, RequiresPermission]
    control_panel_category = ControlPanelQuotaCounter.Category.SEDE_MANAGEMENT
    control_panel_target_type = "sede"
    permission_map = {
        "list": "sede.read",
        "retrieve": "sede.read",
        "create": "sede.manage",
        "update": "sede.manage",
        "partial_update": "sede.manage",
        "destroy": "sede.manage",
    }

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated(), RequiresPermission()]
        return [IsAuthenticated(), RequiresPermission(), RequiresControlPanelSession()]

    def get_queryset(self):
        qs = Sede.objects.all().order_by("name")
        user = getattr(self.request, "user", None)
        raw_include_inactive = str(self.request.query_params.get("include_inactive", "") or "").strip().lower()
        include_inactive = raw_include_inactive in {"1", "true", "yes", "on"}

        raw_active = self.request.query_params.get("active", None)
        active_filter = None
        if raw_active is not None:
            raw_active_clean = str(raw_active).strip().lower()
            if raw_active_clean not in {"true", "false"}:
                raise ValidationError({"active": "Valor invalido. Usa true o false."})
            active_filter = raw_active_clean == "true"

        if not user or not getattr(user, "is_authenticated", False):
            return qs.none()

        if is_superadmin(user):
            if include_inactive:
                return qs
            if active_filter is None:
                return qs.filter(is_active=True)
            return qs.filter(is_active=active_filter)

        allowed_sede_ids = AuthorizationService.allowed_sede_ids(user)
        if not allowed_sede_ids:
            return qs.none()
        scoped = qs.filter(id__in=allowed_sede_ids)
        if active_filter is False or include_inactive:
            raise ValidationError(
                {"active": ("Solo superadmin puede consultar sedes inactivas o usar include_inactive.")}
            )
        return scoped.filter(is_active=True)

    def destroy(self, request, *args, **kwargs):
        sede = self.get_object()
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        before_json = self._control_panel_snapshot(sede)
        if not sede.is_active:
            return ok_response({"sede": self.get_serializer(sede).data, "mensaje": "La sede ya estaba inactiva."})
        sede.is_active = False
        sede.save(update_fields=["is_active"])
        after_json = self._control_panel_snapshot(sede)
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.DELETE,
            target_id=sede.id,
            before_json=before_json,
            after_json=after_json,
        )
        if finalized:
            return finalized
        return ok_response({"sede": self.get_serializer(sede).data, "mensaje": "Sede desactivada correctamente."})


class RoleViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all().order_by("code")
    permission_classes = [IsAuthenticated, RequiresPermission, RequiresControlPanelSession]
    control_panel_category = ControlPanelQuotaCounter.Category.PERMISSIONS
    control_panel_target_type = "role"
    permission_map = {
        "list": "control_panel.permissions.read",
        "retrieve": "control_panel.permissions.read",
        "create": "control_panel.permissions.update",
        "update": "control_panel.permissions.update",
        "partial_update": "control_panel.permissions.update",
        "destroy": "control_panel.permissions.update",
    }

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        before_json = self._control_panel_snapshot(role)
        if role.is_system:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No se puede eliminar un rol del sistema.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="role",
            )
        if role.memberships.exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No se puede eliminar un rol con membresias activas.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="role",
            )
        role.delete()
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.DELETE,
            target_id=role.id,
            before_json=before_json,
            after_json=None,
        )
        if finalized:
            return finalized
        return Response(status=status.HTTP_204_NO_CONTENT)


class PermissionViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = PermissionSerializer
    queryset = RbacPermission.objects.all().order_by("code")
    permission_classes = [IsAuthenticated, RequiresPermission, RequiresControlPanelSession]
    control_panel_category = ControlPanelQuotaCounter.Category.PERMISSIONS
    control_panel_target_type = "permission"
    permission_map = {
        "list": "control_panel.permissions.read",
        "retrieve": "control_panel.permissions.read",
        "create": "control_panel.permissions.update",
        "update": "control_panel.permissions.update",
        "partial_update": "control_panel.permissions.update",
        "destroy": "control_panel.permissions.update",
    }

    def destroy(self, request, *args, **kwargs):
        permission_obj = self.get_object()
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        before_json = self._control_panel_snapshot(permission_obj)
        if permission_obj.role_permissions.exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No se puede eliminar un permiso ya asignado a roles.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="permission",
            )
        permission_obj.delete()
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.DELETE,
            target_id=permission_obj.id,
            before_json=before_json,
            after_json=None,
        )
        if finalized:
            return finalized
        return Response(status=status.HTTP_204_NO_CONTENT)


class RolePermissionViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = RolePermissionSerializer
    queryset = (
        RolePermission.objects.select_related("role", "permission")
        .all()
        .order_by("role__code", "permission__code", "scope")
    )
    permission_classes = [IsAuthenticated, RequiresPermission, RequiresControlPanelSession]
    control_panel_category = ControlPanelQuotaCounter.Category.PERMISSIONS
    control_panel_target_type = "role_permission"
    permission_map = {
        "list": "control_panel.permissions.read",
        "retrieve": "control_panel.permissions.read",
        "create": "control_panel.permissions.update",
        "update": "control_panel.permissions.update",
        "partial_update": "control_panel.permissions.update",
        "destroy": "control_panel.permissions.update",
    }


class SedePolicyViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = SedePolicySerializer
    queryset = SedePolicy.objects.select_related("sede").all().order_by("sede__name")
    permission_classes = [IsAuthenticated, RequiresPermission, RequiresControlPanelSession]
    control_panel_category = ControlPanelQuotaCounter.Category.POLICIES
    control_panel_target_type = "sede_policy"
    permission_map = {
        "list": "control_panel.policies.read",
        "retrieve": "control_panel.policies.read",
        "create": "control_panel.policies.update",
        "update": "control_panel.policies.update",
        "partial_update": "control_panel.policies.update",
        "destroy": "control_panel.policies.update",
    }


class AllowedEmailDomainViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = AllowedEmailDomainSerializer
    queryset = (
        AllowedEmailDomain.objects.select_related("role", "sede", "created_by")
        .all()
        .order_by(
            "domain",
            "role__code",
            "sede__code",
        )
    )
    permission_classes = [IsAuthenticated, RequiresPermission, RequiresControlPanelSession]
    control_panel_category = ControlPanelQuotaCounter.Category.DOMAINS
    control_panel_target_type = "allowed_email_domain"
    permission_map = {
        "list": "control_panel.domains.read",
        "retrieve": "control_panel.domains.read",
        "create": "control_panel.domains.update",
        "update": "control_panel.domains.update",
        "partial_update": "control_panel.domains.update",
        "destroy": "control_panel.domains.update",
    }

    def get_queryset(self):
        qs = super().get_queryset()

        domain = (self.request.query_params.get("domain") or "").strip().lower()
        if domain:
            qs = qs.filter(domain__icontains=domain)

        role = (self.request.query_params.get("role") or "").strip().lower()
        if role:
            qs = qs.filter(role__code=role)

        sede = (self.request.query_params.get("sede") or self.request.query_params.get("sede_id") or "").strip()
        if sede:
            if sede.isdigit():
                qs = qs.filter(sede_id=int(sede))
            elif sede.lower() not in FILTER_ALL_VALUES:
                qs = qs.filter(Q(sede__code__iexact=sede) | Q(sede__name__iexact=sede))

        is_active = _parse_bool_query_param(
            self.request,
            names=["is_active", "activo"],
            field="is_active",
        )
        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        scope = (self.request.query_params.get("scope") or "").strip().upper()
        if scope:
            if scope == AllowedEmailDomain.Scope.GLOBAL:
                qs = qs.filter(role__isnull=True, sede__isnull=True)
            elif scope == AllowedEmailDomain.Scope.SEDE:
                qs = qs.filter(role__isnull=True, sede__isnull=False)
            elif scope == AllowedEmailDomain.Scope.ROLE:
                qs = qs.filter(role__isnull=False, sede__isnull=True)
            elif scope == AllowedEmailDomain.Scope.ROLE_SEDE:
                qs = qs.filter(role__isnull=False, sede__isnull=False)
            else:
                raise ValidationError({"scope": ("Scope invalido. Valores permitidos: GLOBAL, SEDE, ROLE, ROLE_SEDE.")})

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ProgramaFormacionViewSet(ControlPanelMutationMixin, viewsets.ModelViewSet):
    serializer_class = ProgramaFormacionSerializer
    queryset = ProgramaFormacion.objects.all().order_by("name")
    permission_classes = [IsAuthenticated, RequiresPermission]
    control_panel_category = ControlPanelQuotaCounter.Category.PROGRAMS
    control_panel_target_type = "programa_formacion"
    permission_map = {
        "list": "sede.read",
        "retrieve": "sede.read",
        "create": "control_panel.programs.update",
        "update": "control_panel.programs.update",
        "partial_update": "control_panel.programs.update",
        "destroy": "control_panel.programs.update",
    }

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated(), RequiresPermission()]
        return [IsAuthenticated(), RequiresPermission(), RequiresControlPanelSession()]

    def get_queryset(self):
        qs = super().get_queryset()
        include_inactive = str(self.request.query_params.get("include_inactive", "") or "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        if include_inactive:
            return qs
        return qs.filter(is_active=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        previous_name = getattr(serializer.instance, "name", "")
        program = serializer.save(updated_by=self.request.user)
        if previous_name and previous_name.lower() != program.name.lower():
            Usuario.objects.filter(programa_formacion__iexact=previous_name).update(programa_formacion=program.name)

    def destroy(self, request, *args, **kwargs):
        program = self.get_object()
        denied = self._preflight_control_panel_mutation(request)
        if denied:
            return denied
        before_json = self._control_panel_snapshot(program)
        if Usuario.objects.filter(programa_formacion__iexact=program.name).exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No se puede eliminar un programa que ya esta asignado a usuarios. Desactivalo en su lugar.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="name",
            )
        target_id = program.id
        program.delete()
        finalized = self._finalize_control_panel_mutation(
            request,
            action=ControlPanelAuditEvent.Action.DELETE,
            target_id=target_id,
            before_json=before_json,
            after_json=None,
        )
        if finalized:
            return finalized
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditEventsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_permission_response(
            request.user,
            "control_panel.audit.read",
            message="No tienes permisos para consultar la auditoria.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, request.user)
        if denied:
            return denied

        events: list[dict] = []

        for event in (
            ControlPanelAuditEvent.objects.select_related("actor", "session").all().order_by("-created_at")[:50]
        ):
            events.append(
                {
                    "id": f"control-panel-{event.id}",
                    "type": f"control_panel.{event.category}.{event.action}",
                    "timestamp": event.created_at,
                    "actor": getattr(getattr(event, "actor", None), "username", None),
                    "detail": (f"{event.target_type}#{event.target_id or '-'} | motivo: {event.reason}"),
                    "sede": None,
                    "category": event.category,
                    "reason": event.reason,
                    "before": event.before_json,
                    "after": event.after_json,
                    "session_id": str(event.session_id) if event.session_id else None,
                }
            )

        for acceso in (
            Acceso.objects.filter(is_deleted=True, deleted_at__isnull=False)
            .select_related("deleted_by", "usuario", "sede")
            .order_by("-deleted_at")[:30]
        ):
            events.append(
                {
                    "id": f"acceso-soft-delete-{acceso.id}",
                    "type": "acceso.soft_delete",
                    "timestamp": acceso.deleted_at,
                    "actor": getattr(getattr(acceso, "deleted_by", None), "username", None),
                    "detail": f"Acceso #{acceso.id} de {getattr(acceso.usuario, 'username', acceso.usuario_id)}",
                    "sede": getattr(getattr(acceso, "sede", None), "code", None),
                }
            )

        for turno in (
            Turno.objects.exclude(cierre_observacion="")
            .select_related("guarda", "sede")
            .order_by("-fin", "-inicio")[:30]
        ):
            events.append(
                {
                    "id": f"turno-close-{turno.id}",
                    "type": "turno.closed",
                    "timestamp": turno.fin or turno.inicio,
                    "actor": getattr(getattr(turno, "guarda", None), "username", None),
                    "detail": f"Turno #{turno.id} cerrado: {turno.cierre_observacion}",
                    "sede": getattr(getattr(turno, "sede", None), "code", None),
                }
            )

        for session in (
            RefreshSession.objects.filter(revoked_at__isnull=False).select_related("user").order_by("-revoked_at")[:30]
        ):
            events.append(
                {
                    "id": f"session-revoked-{session.id}",
                    "type": "auth.session_revoked",
                    "timestamp": session.revoked_at,
                    "actor": getattr(getattr(session, "user", None), "username", None),
                    "detail": f"Sesion revocada para dispositivo {session.device_id}",
                    "sede": None,
                }
            )

        events.sort(key=lambda item: (item.get("timestamp") is not None, item.get("timestamp")), reverse=True)
        serialized_events = []
        for event in events[:100]:
            timestamp = event.get("timestamp")
            serialized_events.append(
                {
                    **event,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                }
            )

        return ok_response({"results": serialized_events, "count": len(serialized_events)})


class ControlPanelQuotaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        denied = _require_permission_response(
            request.user,
            "control_panel.limits.read",
            message="No tienes permisos para consultar las cuotas del panel.",
        )
        if denied:
            return denied
        denied = require_control_panel_session_response(request, request.user)
        if denied:
            return denied

        results = [
            control_panel_quota_state(request.user, category)
            for category in [
                ControlPanelQuotaCounter.Category.BRANDING,
                ControlPanelQuotaCounter.Category.DOMAINS,
                ControlPanelQuotaCounter.Category.POLICIES,
                ControlPanelQuotaCounter.Category.PERMISSIONS,
                ControlPanelQuotaCounter.Category.PROGRAMS,
                ControlPanelQuotaCounter.Category.SEDE_MANAGEMENT,
            ]
        ]
        return ok_response({"results": results, "count": len(results)})


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by("id")
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated, RequiresPermission]
    permission_map = {
        "list": "user.read",
        "retrieve": "user.read",
        "create": "user.create",
        "update": "user.update",
        "partial_update": "user.update",
        "destroy": "user.delete",
        "importar_aprendices_validar": "user.create",
        "importar_aprendices_confirmar": "user.create",
    }
    object_permission_map = {
        "retrieve": "user.read",
        "update": "user.update",
        "partial_update": "user.update",
        "destroy": "user.delete",
    }

    def get_queryset(self):
        qs = AuthorizationService.scoped_queryset(
            self.request.user,
            super().get_queryset(),
            resource="usuario",
        ).order_by("id")

        q = (self.request.query_params.get("q") or "").strip()
        rol = _parse_choice_query_param(
            self.request,
            names=["rol"],
            choices=Usuario.Rol.choices,
            field="rol",
        )
        estado = _parse_choice_query_param(
            self.request,
            names=["estado"],
            choices=Usuario.Estado.choices,
            field="estado",
        )
        sede_principal = _parse_sede_query_param(
            self.request,
            self.request.user,
            names=["sede_id", "sede_principal", "sede"],
            field="sede_id",
        )

        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(documento__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )

        if rol:
            qs = qs.filter(rol=rol)

        if estado:
            qs = qs.filter(estado=estado)

        if sede_principal:
            qs = qs.filter(sede_principal__code=sede_principal)

        return qs

    def _ensure_admin_role_scope(self, payload: dict, instance: Usuario | None = None):
        actor: Usuario = self.request.user
        if is_superadmin(actor):
            return None

        admin_roles = {Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE}
        target_role = payload.get("rol", getattr(instance, "rol", None))
        current_role = getattr(instance, "rol", None) if instance else None

        if target_role in admin_roles or current_role in admin_roles:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo SUPERADMIN puede crear, editar o eliminar cuentas administrativas.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _ensure_admin_sede_scope(self, payload: dict, instance: Usuario | None = None):
        actor: Usuario = self.request.user
        if not is_admin_sede(actor):
            return None

        actor_sede = _scope_sede(actor)
        if not actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Tu usuario ADMIN_SEDE no tiene sede configurada.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if instance and _scope_sede(instance) != actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo puedes gestionar usuarios de tu sede.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        rol = payload.get("rol")
        current_rol = getattr(instance, "rol", None) if instance else None
        if rol in {Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE} or current_rol in {
            Usuario.Rol.SUPERADMIN,
            Usuario.Rol.ADMIN_SEDE,
        }:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="ADMIN_SEDE no puede crear ni editar cuentas administrativas.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if not instance:
            requested_sede = str(payload.get("sede_principal") or "").strip()
            if requested_sede and requested_sede != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No puedes crear usuarios para otra sede diferente a la tuya.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            payload["sede_principal"] = actor_sede
        elif "sede_principal" in payload and str(payload.get("sede_principal") or actor_sede).strip() != actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No puedes mover usuarios fuera de tu sede.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _enforce_admin_role_capacity(self, payload: dict, instance: Usuario | None = None):
        target_role = payload.get("rol", getattr(instance, "rol", None))
        target_sede = payload.get("sede_principal", None)
        if target_sede is None and instance:
            target_sede_id = getattr(instance, "sede_principal_id", None)
            target_sede_code = _scope_sede_code(instance)
        else:
            if isinstance(target_sede, Sede):
                target_sede_id = target_sede.id
                target_sede_code = target_sede.code
            else:
                target_sede_code = str(target_sede or "").strip() or None
                target_sede_id = None
                if target_sede_code:
                    sede_obj = Sede.objects.filter(code__iexact=target_sede_code).first()
                    target_sede_id = getattr(sede_obj, "id", None)
        if target_role != Usuario.Rol.ADMIN_SEDE:
            return None
        blocked, current = _enforce_admin_sede_limit(target_sede_id, exclude_user_id=getattr(instance, "id", None))
        if blocked:
            return error_response(
                code=ErrorCode.MAX_ADMINS_PER_SEDE,
                message=f"La sede ya tiene {MAX_ADMINS_PER_SEDE} administradores.",
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"sede": target_sede_code, "limit": MAX_ADMINS_PER_SEDE, "current": current},
            )
        return None

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        role_scope_error = self._ensure_admin_role_scope(payload)
        if role_scope_error:
            return role_scope_error

        scoped_error = self._ensure_admin_sede_scope(payload)
        if scoped_error:
            return scoped_error

        limit_error = self._enforce_admin_role_capacity(payload)
        if limit_error:
            return limit_error
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        payload = request.data.copy()
        role_scope_error = self._ensure_admin_role_scope(payload, instance=instance)
        if role_scope_error:
            return role_scope_error

        scoped_error = self._ensure_admin_sede_scope(payload, instance=instance)
        if scoped_error:
            return scoped_error

        limit_error = self._enforce_admin_role_capacity(payload, instance=instance)
        if limit_error:
            return limit_error
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        payload = request.data.copy()
        role_scope_error = self._ensure_admin_role_scope(payload, instance=instance)
        if role_scope_error:
            return role_scope_error

        scoped_error = self._ensure_admin_sede_scope(payload, instance=instance)
        if scoped_error:
            return scoped_error

        limit_error = self._enforce_admin_role_capacity(payload, instance=instance)
        if limit_error:
            return limit_error
        serializer = self.get_serializer(instance, data=payload, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor: Usuario = request.user

        role_scope_error = self._ensure_admin_role_scope({}, instance=instance)
        if role_scope_error:
            return role_scope_error

        if is_admin_sede(actor):
            actor_sede = _scope_sede(actor)
            if not actor_sede or _scope_sede(instance) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes eliminar usuarios de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            if instance.rol not in {Usuario.Rol.GUARDA, Usuario.Rol.APRENDIZ}:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="ADMIN_SEDE solo puede eliminar guardas y aprendices de su sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = serializer.save()
        _sync_primary_membership_for_user(user)

    def perform_update(self, serializer):
        user = serializer.save()
        _sync_primary_membership_for_user(user)

    @action(detail=False, methods=["post"], url_path="importar-aprendices/validar", parser_classes=[MultiPartParser])
    def importar_aprendices_validar(self, request):
        s = ImportAprendicesValidateSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        require_sede = not is_admin_sede(request.user)
        default_sede = _scope_sede(request.user) if is_admin_sede(request.user) else None
        result = validate_excel(
            s.validated_data["file"],
            require_sede=require_sede,
            default_sede_code=default_sede,
        )
        import_id = uuid4().hex
        cache_import_payload(import_id, request.user.id, result.rows, result.errors)
        duplicates_in_file = [err for err in result.errors if err.get("code") == "DUPLICATE_IN_FILE"]

        return ok_response(
            {
                "import_id": import_id,
                "resumen": {
                    "validos": len(result.rows),
                    "errores": count_distinct_error_rows(result.errors),
                    "total": result.total_rows,
                    "duplicados_archivo": len(duplicates_in_file),
                },
                "errores": result.errors,
                "duplicates_in_file": duplicates_in_file,
                "preview": result.rows[:25],
                "row_numbers": [int(row.get("source_row") or 0) for row in result.rows],
            }
        )

    @action(detail=False, methods=["post"], url_path="importar-aprendices/confirmar")
    def importar_aprendices_confirmar(self, request):
        s = ImportAprendicesConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        payload = get_cached_import_payload(s.validated_data["import_id"])
        if not payload or payload.get("user_id") != request.user.id:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="La validación previa no existe o expiró. Vuelve a cargar el archivo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        rows = payload.get("rows", [])
        errors = payload.get("errors", [])
        allow_skip_file_duplicates = bool(s.validated_data.get("allow_skip_file_duplicates", False))
        duplicates_in_file = [err for err in errors if err.get("code") == "DUPLICATE_IN_FILE"]

        if duplicates_in_file and not allow_skip_file_duplicates:
            return error_response(
                code=ErrorCode.DUPLICATES_IN_FILE,
                message="Hay documentos duplicados dentro del archivo. Debes omitirlos para continuar.",
                status_code=status.HTTP_409_CONFLICT,
                detail={"duplicates_in_file": duplicates_in_file},
                field="Documento",
            )

        selected_row_numbers = s.validated_data.get("row_numbers")
        if selected_row_numbers:
            allowed_set = {int(v) for v in selected_row_numbers}
            rows = [row for row in rows if int(row.get("source_row") or 0) in allowed_set]
            errors = []

        if is_admin_sede(request.user):
            actor_sede = _scope_sede(request.user)
            if not actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Tu usuario ADMIN_SEDE no tiene sede configurada.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            invalid_rows = [idx + 2 for idx, row in enumerate(rows) if row.get("sede_principal") != actor_sede]
            if invalid_rows:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="El archivo contiene aprendices fuera de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"rows": invalid_rows[:20]},
                )

        try:
            result = execute_aprendices_import(
                rows=rows,
                imported_by=request.user,
                errors=errors,
            )
        except ImportServiceError as exc:
            return error_response(
                code=exc.code,
                message=exc.message,
                status_code=exc.status_code,
                detail=exc.detail,
                field=exc.field,
            )

        parts = []
        if result.created_count:
            parts.append(f"{result.created_count} creados")
        if result.skipped_count:
            parts.append(f"{result.skipped_count} omitidos")
        if result.failed_count:
            parts.append(f"{result.failed_count} fallidos")
        if result.errors_count:
            parts.append(f"{result.errors_count} con errores")
        resumen = ", ".join(parts) if parts else "Sin cambios"
        mensaje = (
            f"Importacion completada: {resumen}."
            if not result.errors_count
            else f"Importacion parcial: {resumen}. Revisa los detalles de errores."
        )

        return ok_response(
            {
                "mensaje": mensaje,
                "created": result.created_count,
                "updated": result.updated_count,
                "errors": result.errors_count,
                "skipped": result.skipped_count,
                "failed": result.failed_count,
                "processed": len(result.row_results),
                "row_results": result.row_results,
                "duplicates_conflicts": [r for r in result.row_results if r.get("code") == "DOCUMENT_EXISTS"],
            }
        )


class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated, RequiresPermission]
    permission_map = {
        "list": "notificacion.read",
        "retrieve": "notificacion.read",
        "leer": "notificacion.read",
        "create": "notificacion.write",
        "update": "notificacion.write",
        "partial_update": "notificacion.write",
        "destroy": "notificacion.write",
    }
    object_permission_map = {
        "retrieve": "notificacion.read",
        "leer": "notificacion.read",
        "update": "notificacion.write",
        "partial_update": "notificacion.write",
        "destroy": "notificacion.write",
    }
    allow_own_scope_actions = {"list", "retrieve", "leer"}
    queryset = Notificacion.objects.all()

    def get_queryset(self):
        user = self.request.user
        role_codes = list(AuthorizationService.runtime_role_codes(user) or AuthorizationService.role_codes(user))

        qs_user = Notificacion.objects.filter(user=user)
        qs_rol = Notificacion.objects.filter(user__isnull=True, rol_objetivo__in=role_codes)
        qs_global = Notificacion.objects.filter(user__isnull=True, rol_objetivo__isnull=True)
        qs = (qs_user | qs_rol | qs_global).distinct().order_by("-created_at")
        if is_admin_sede(user):
            sede = _scope_sede(user)
            if not sede:
                return Notificacion.objects.none()
            qs = qs.filter(Q(user__isnull=True) | Q(user__sede_principal__code=sede) | Q(user=user))
        return AuthorizationService.scoped_queryset(user, qs, resource="notificacion")

    @action(detail=True, methods=["patch"], url_path="leer")
    def leer(self, request, pk=None):
        obj = self.get_object()

        if not is_admin_role(request.user) and obj.user_id not in [None, request.user.id]:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No autorizado.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if is_admin_sede(request.user) and obj.user_id:
            actor_sede = _scope_sede(request.user)
            if not actor_sede or _scope_sede(obj.user) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No autorizado para notificaciones de otra sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        if obj.read_at is None:
            obj.read_at = timezone.now()
            obj.save(update_fields=["read_at"])

        return ok_response({"notificacion": NotificacionSerializer(obj).data})


class EquipoViewSet(viewsets.ModelViewSet):
    serializer_class = EquipoSerializer
    permission_classes = [IsAuthenticated, RequiresPermission]
    permission_map = {
        "list": "equipo.read",
        "retrieve": "equipo.read",
        "create": "equipo.create",
        "update": "equipo.update",
        "partial_update": "equipo.update",
        "destroy": "equipo.delete",
        "revisar": "equipo.review",
    }
    object_permission_map = {
        "retrieve": "equipo.read",
        "update": "equipo.update",
        "partial_update": "equipo.update",
        "destroy": "equipo.delete",
        "revisar": "equipo.review",
    }
    allow_own_scope_actions = {"list", "retrieve", "create", "update", "partial_update", "destroy"}
    queryset = Equipo.objects.all()

    def get_queryset(self):
        user = self.request.user
        qs = AuthorizationService.scoped_queryset(
            user,
            Equipo.objects.all(),
            resource="equipo",
        ).order_by("-creado_en")

        estado = _parse_choice_query_param(
            self.request,
            names=["estado"],
            choices=Equipo.Estado.choices,
            field="estado",
        )
        if estado:
            qs = qs.filter(estado=estado)

        sede_code = _parse_sede_query_param(
            self.request,
            user,
            names=["sede_id", "sede", "sede_principal"],
            field="sede_id",
        )
        if sede_code:
            qs = qs.filter(propietario__sede_principal__code=sede_code)

        aprendiz_id = _parse_int_query_param(
            self.request,
            names=["aprendiz_id", "propietario_id", "propietario"],
            field="aprendiz_id",
        )
        if aprendiz_id is not None:
            qs = qs.filter(propietario_id=aprendiz_id)

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(serial__icontains=q)
                | Q(marca__icontains=q)
                | Q(modelo__icontains=q)
                | Q(propietario__username__icontains=q)
                | Q(propietario__documento__icontains=q)
            )

        return qs

    def _ensure_admin_sede_equipo_payload_scope(self, payload: dict, equipo: Equipo):
        actor = self.request.user
        if not is_admin_sede(actor):
            return None

        actor_sede = _scope_sede(actor)
        if not actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Tu usuario ADMIN_SEDE no tiene sede configurada.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if _scope_sede(equipo.propietario) != actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo puedes gestionar equipos de tu sede.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if "propietario" in payload:
            owner_raw = str(payload.get("propietario") or "").strip()
            if not owner_raw.isdigit():
                return error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El campo propietario debe ser un id numerico.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    field="propietario",
                )
            propietario = Usuario.objects.filter(id=int(owner_raw)).first()
            if not propietario:
                return error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El propietario indicado no existe.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    field="propietario",
                )
            if _scope_sede(propietario) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No puedes mover equipos a propietarios de otra sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        return None

    def _update_as_aprendiz(self, request, partial: bool):
        user = request.user
        equipo = self.get_object()

        if equipo.propietario_id != user.id:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No puedes editar equipos de otro aprendiz.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if equipo.estado != Equipo.Estado.PENDIENTE:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo puedes editar equipos en estado PENDIENTE.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        payload = request.data.copy()
        for blocked in ["propietario", "estado", "motivo_rechazo", "revisado_por", "revisado_en"]:
            if blocked in payload:
                payload.pop(blocked)

        serializer = self.get_serializer(equipo, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save(propietario=user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        if is_admin_role(request.user):
            equipo = self.get_object()
            scope_error = self._ensure_admin_sede_equipo_payload_scope(request.data.copy(), equipo)
            if scope_error:
                return scope_error
            return super().update(request, *args, **kwargs)
        return self._update_as_aprendiz(request, partial=False)

    def partial_update(self, request, *args, **kwargs):
        if is_admin_role(request.user):
            equipo = self.get_object()
            scope_error = self._ensure_admin_sede_equipo_payload_scope(request.data.copy(), equipo)
            if scope_error:
                return scope_error
            return super().partial_update(request, *args, **kwargs)
        return self._update_as_aprendiz(request, partial=True)

    def create(self, request, *args, **kwargs):
        if _has_active_role(request.user, Usuario.Rol.APRENDIZ):
            policy = PolicyService.get_policy(_scope_sede_obj(request.user))
            max_equipos = int(policy.max_equipos_aprendiz or 4)
            total = Equipo.objects.filter(propietario=request.user).count()
            if total >= max_equipos:
                return error_response(
                    code=ErrorCode.EQUIPO_LIMIT_REACHED,
                    message=f"Solo puedes registrar hasta {max_equipos} equipos.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        rol = _effective_role(user)

        if rol == Usuario.Rol.APRENDIZ:
            policy = PolicyService.get_policy(_scope_sede_obj(user))
            max_equipos = int(policy.max_equipos_aprendiz or 4)
            total = Equipo.objects.filter(propietario=user).count()
            if total >= max_equipos:
                raise ValidationError({"equipos": f"Solo puedes registrar hasta {max_equipos} equipos."})
            try:
                serializer.save(propietario=user)
            except IntegrityError:
                raise ValidationError({"equipos": f"Solo puedes registrar hasta {max_equipos} equipos."})
            return

        propietario = serializer.validated_data.get("propietario", None)
        if not propietario:
            raise ValidationError(
                {"propietario": "Como usuario administrativo debes enviar el propietario (id del aprendiz)."}
            )
        if is_admin_sede(user):
            actor_sede = _scope_sede(user)
            if not actor_sede or _scope_sede(propietario) != actor_sede:
                raise ValidationError({"propietario": "Solo puedes registrar equipos para aprendices de tu sede."})

        try:
            equipo = serializer.save(propietario=propietario)
        except IntegrityError:
            raise ValidationError({"equipos": "No se puede registrar mas de 4 equipos para este aprendiz."})
        equipo.estado = Equipo.Estado.APROBADO
        equipo.motivo_rechazo = None
        equipo.revisado_por = user
        equipo.revisado_en = timezone.now()
        equipo.save(update_fields=["estado", "motivo_rechazo", "revisado_por", "revisado_en"])

    def destroy(self, request, *args, **kwargs):
        equipo = self.get_object()
        user = request.user

        if _has_active_role(user, Usuario.Rol.APRENDIZ):
            if equipo.propietario_id != user.id:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No puedes eliminar equipos de otro aprendiz.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            if equipo.estado != Equipo.Estado.PENDIENTE:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes eliminar equipos en estado PENDIENTE.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            return super().destroy(request, *args, **kwargs)

        if is_admin_sede(user):
            actor_sede = _scope_sede(user)
            if not actor_sede or _scope_sede(equipo.propietario) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes eliminar equipos de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        if not is_admin_role(user):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No autorizado.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["patch"], url_path="revisar")
    def revisar(self, request, pk=None):
        equipo = self.get_object()
        if is_admin_sede(request.user):
            actor_sede = _scope_sede(request.user)
            if not actor_sede or _scope_sede(equipo.propietario) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes revisar equipos de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        s = EquipoRevisionSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        estado = s.validated_data["estado"]
        motivo = s.validated_data.get("motivo_rechazo")

        equipo.estado = estado
        equipo.motivo_rechazo = motivo if estado == Equipo.Estado.RECHAZADO else None
        equipo.revisado_por = request.user
        equipo.revisado_en = timezone.now()
        equipo.save()

        return ok_response({"equipo": EquipoSerializer(equipo).data})


class TurnoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Turno.objects.all().order_by("-inicio")
    serializer_class = TurnoSerializer
    permission_classes = [IsAuthenticated, RequiresPermission]
    permission_map = {
        "list": "turno.read",
        "retrieve": "turno.read",
        "resumen": "turno.read",
        "actual": "turno.read",
        "iniciar": "turno.start",
        "reanudar": "turno.resume",
        "finalizar": "turno.end",
        "finalizar_admin": "turno.admin_end",
    }
    object_permission_map = {
        "retrieve": "turno.read",
        "resumen": "turno.read",
        "finalizar_admin": "turno.admin_end",
    }

    def get_queryset(self):
        user = self.request.user
        qs = AuthorizationService.scoped_queryset(
            user,
            Turno.objects.select_related("sede", "guarda").all(),
            resource="turno",
        ).order_by("-inicio")

        sede = _parse_sede_query_param(
            self.request,
            user,
            names=["sede_id", "sede"],
            field="sede_id",
        )
        if sede:
            qs = qs.filter(sede__code=sede)

        jornada = _parse_choice_query_param(
            self.request,
            names=["jornada"],
            choices=Turno.Jornada.choices,
            field="jornada",
        )
        if jornada:
            qs = qs.filter(jornada=jornada)

        activo = _parse_bool_query_param(
            self.request,
            names=["activo"],
            field="activo",
        )
        if activo is not None:
            qs = qs.filter(activo=activo)

        guardia_id = _parse_int_query_param(
            self.request,
            names=["guardia_id", "guarda_id", "guarda"],
            field="guardia_id",
        )
        if guardia_id is not None:
            qs = qs.filter(guarda_id=guardia_id)

        date_from = _parse_date_query_param(
            self.request,
            names=["date_from"],
            field="date_from",
        )
        if date_from is not None:
            qs = qs.filter(inicio__date__gte=date_from)

        date_to = _parse_date_query_param(
            self.request,
            names=["date_to"],
            field="date_to",
        )
        if date_to is not None:
            qs = qs.filter(inicio__date__lte=date_to)

        return qs

    @action(detail=False, methods=["post"], url_path="iniciar")
    def iniciar(self, request):
        s = TurnoIniciarSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        selected_sede: Sede = s.validated_data["sede"]
        if not _guard_can_use_sede(request.user, selected_sede):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para iniciar turno en esta sede.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                active_turnos = _normalize_active_turnos(request.user, lock_for_update=True)
                if active_turnos:
                    return error_response(
                        code=ErrorCode.TURNO_ALREADY_ACTIVE,
                        message="Ya tienes un turno activo.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                        extra={"turno": TurnoSerializer(active_turnos[0]).data},
                    )

                turno = Turno.objects.create(
                    guarda=request.user,
                    sede=selected_sede,
                    jornada=s.validated_data["jornada"],
                    inicio=timezone.now(),
                    activo=True,
                    fin=None,
                )
        except IntegrityError:
            turno_activo = (
                Turno.objects.filter(guarda=request.user, activo=True, fin__isnull=True).order_by("-inicio").first()
            )
            return error_response(
                code=ErrorCode.TURNO_ALREADY_ACTIVE,
                message="Ya tienes un turno activo.",
                status_code=status.HTTP_409_CONFLICT,
                extra={"turno": TurnoSerializer(turno_activo).data if turno_activo else None},
            )
        return ok_response({"turno": TurnoSerializer(turno).data}, status_code=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="reanudar")
    def reanudar(self, request):
        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="No tienes un turno activo para reanudar.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"turno": None},
            )
        return ok_response({"turno": TurnoSerializer(turno).data})

    @action(detail=False, methods=["post"], url_path="finalizar")
    def finalizar(self, request):
        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="No tienes un turno activo.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"turno": None},
            )

        now = timezone.now()
        turno.activo = False
        turno.fin = _safe_fin(now, turno.inicio)
        turno.save(update_fields=["activo", "fin"])

        return ok_response({"turno": TurnoSerializer(turno).data})

    @action(detail=False, methods=["get"], url_path="actual")
    def actual(self, request):
        turno = obtener_turno_activo(request.user)
        if not turno:
            return ok_response({"activo": False})
        payload = TurnoSerializer(turno).data
        payload.update({"permitido": True, "motivo": None})
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="finalizar_admin")
    def finalizar_admin(self, request, pk=None):
        turno = self.get_object()
        if is_admin_sede(request.user):
            actor_sede = _scope_sede(request.user)
            if not actor_sede or getattr(turno.sede, "code", None) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes cerrar turnos de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        if not turno.activo and turno.fin is not None:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="El turno ya estaba finalizado.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"turno": TurnoSerializer(turno).data},
            )

        now = timezone.now()
        turno.activo = False
        turno.fin = _safe_fin(now, turno.inicio)
        turno.save(update_fields=["activo", "fin"])

        return ok_response({"turno": TurnoSerializer(turno).data})

    @action(detail=True, methods=["get"], url_path="resumen")
    def resumen(self, request, pk=None):
        turno = self.get_object()
        user = request.user
        rol = _effective_role(user)

        if rol == "guarda" and turno.guarda_id != user.id:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No autorizado.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if is_admin_sede(user):
            actor_sede = _scope_sede(user)
            if not actor_sede or getattr(turno.sede, "code", None) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes ver turnos de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        qs = Acceso.objects.filter(turno=turno, is_deleted=False)
        ingresos = qs.filter(tipo=Acceso.Tipo.INGRESO).count()
        salidas = qs.filter(tipo=Acceso.Tipo.SALIDA).count()

        return ok_response(
            {
                "turno": TurnoSerializer(turno).data,
                "resumen": {"ingresos": ingresos, "salidas": salidas, "total": ingresos + salidas},
            }
        )


class AccesoViewSet(viewsets.ModelViewSet):
    serializer_class = AccesoSerializer
    permission_classes = [IsAuthenticated, RequiresPermission]
    queryset = Acceso.objects.all()
    allow_own_scope_actions = {"mis_accesos", "estado"}
    permission_map = {
        "list": "acceso.read",
        "retrieve": "acceso.read",
        "create": "acceso.create",
        "update": "acceso.read",
        "partial_update": "acceso.read",
        "destroy": "acceso.delete",
        "registrar_contingencia": "acceso.create",
        "validar_documento": "acceso.scan",
        "registrar_por_documento": "acceso.scan",
        "stats": "acceso.stats",
        "mis_accesos": "acceso.read",
        "estado": "acceso.read",
    }
    object_permission_map = {
        "retrieve": "acceso.read",
        "update": "acceso.read",
        "partial_update": "acceso.read",
        "destroy": "acceso.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = (
            AuthorizationService.scoped_queryset(
                user,
                Acceso.objects.filter(is_deleted=False),
                resource="acceso",
            )
            .select_related("turno", "turno__guarda", "turno__sede", "usuario", "registrado_por", "sede")
            .prefetch_related("equipos")
            .order_by("-fecha")
        )

        tipo = _parse_choice_query_param(
            self.request,
            names=["tipo"],
            choices=Acceso.Tipo.choices,
            field="tipo",
        )
        if tipo:
            qs = qs.filter(tipo=tipo)

        sede = _parse_sede_query_param(
            self.request,
            user,
            names=["sede_id", "sede"],
            field="sede_id",
        )
        if sede:
            qs = qs.filter(sede__code=sede)

        aprendiz_id = _parse_int_query_param(
            self.request,
            names=["aprendiz_id", "usuario_id", "usuario"],
            field="aprendiz_id",
        )
        if aprendiz_id is not None:
            qs = qs.filter(usuario_id=aprendiz_id)

        guardia_id = _parse_int_query_param(
            self.request,
            names=["guardia_id", "guarda_id"],
            field="guardia_id",
        )
        if guardia_id is not None:
            qs = qs.filter(turno__guarda_id=guardia_id)

        registrado_por_id = _parse_int_query_param(
            self.request,
            names=["registrado_por_id", "registrado_por"],
            field="registrado_por_id",
        )
        if registrado_por_id is not None:
            qs = qs.filter(registrado_por_id=registrado_por_id)

        date_from = _parse_date_query_param(
            self.request,
            names=["date_from"],
            field="date_from",
        )
        if date_from is not None:
            qs = qs.filter(fecha__date__gte=date_from)

        date_to = _parse_date_query_param(
            self.request,
            names=["date_to"],
            field="date_to",
        )
        if date_to is not None:
            qs = qs.filter(fecha__date__lte=date_to)

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(usuario__documento__icontains=q)
                | Q(usuario__username__icontains=q)
                | Q(usuario__first_name__icontains=q)
                | Q(usuario__last_name__icontains=q)
                | Q(equipos__serial__icontains=q)
                | Q(equipos__marca__icontains=q)
                | Q(equipos__modelo__icontains=q)
            ).distinct()

        return qs

    def _ensure_admin_sede_acceso_payload_scope(self, payload: dict):
        actor = self.request.user
        if not is_admin_sede(actor):
            return None
        actor_sede = _scope_sede(actor)
        if not actor_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Tu usuario ADMIN_SEDE no tiene sede configurada.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if "usuario" in payload:
            raw = str(payload.get("usuario") or "").strip()
            if not raw.isdigit():
                return error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El campo aprendiz_id debe ser un id numerico.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    field="aprendiz_id",
                )
            aprendiz = Usuario.objects.filter(id=int(raw)).first()
            if not aprendiz:
                return error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El aprendiz indicado no existe.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    field="aprendiz_id",
                )
            if _scope_sede(aprendiz) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes asociar accesos a aprendices de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        return None

    def _validar_equipos_ingreso(self, aprendiz: Usuario, equipos: list[Equipo]):
        for eq in equipos:
            if eq.propietario_id != aprendiz.id:
                raise ValidationError({"equipos": "Uno de los equipos no pertenece al aprendiz."})
            if eq.estado != Equipo.Estado.APROBADO:
                raise ValidationError({"equipos": "Uno de los equipos no está aprobado."})

        for eq in equipos:
            ultimo_eq = Acceso.objects.filter(equipos=eq).order_by("-fecha").first()
            if ultimo_eq and ultimo_eq.tipo == Acceso.Tipo.INGRESO:
                raise ValidationError({"equipos": f"El equipo {eq.serial} ya tiene un ingreso activo."})

    def _validar_salida_equipos_vs_ultimo_ingreso(self, ultimo_ingreso: Acceso, equipos_enviados: list[Equipo]):
        ingreso_ids = sorted(list(ultimo_ingreso.equipos.values_list("id", flat=True)))
        enviados_ids = sorted([e.id for e in equipos_enviados])

        if ingreso_ids and not equipos_enviados:
            raise ValidationError(
                {"equipos": "Salida inválida: debes seleccionar los mismos equipos del último ingreso."}
            )

        if (not ingreso_ids) and equipos_enviados:
            raise ValidationError({"equipos": "Salida inválida: el último ingreso no tenía equipos."})

        if equipos_enviados and ingreso_ids != enviados_ids:
            raise ValidationError(
                {"equipos": "Los equipos en la salida deben coincidir exactamente con los del último ingreso."}
            )

    def _validar_sede_salida(self, *, ultimo_ingreso: Acceso, sede_operativa: Sede):
        if not ultimo_ingreso.sede_id or not sede_operativa:
            return
        if ultimo_ingreso.sede_id != sede_operativa.id:
            raise ValidationError(
                {"sede": "La salida debe registrarse en la misma sede del ultimo ingreso del aprendiz."}
            )

    def _resolve_contingency_sede(
        self,
        *,
        actor: Usuario,
        aprendiz: Usuario,
        requested_sede: Sede | None,
        ultimo: Acceso | None,
        tipo: str,
    ) -> Sede:
        actor_is_admin_sede = is_admin_sede(actor)
        actor_sede = _scope_sede_obj(actor) if actor_is_admin_sede else None
        aprendiz_sede_code = _scope_sede(aprendiz)
        aprendiz_sede = Sede.objects.filter(code=aprendiz_sede_code).first() if aprendiz_sede_code else None

        if actor_is_admin_sede and not actor_sede:
            raise ValidationError({"sede": "Tu usuario ADMIN_SEDE no tiene sede configurada."})
        if actor_is_admin_sede and requested_sede and actor_sede and requested_sede.id != actor_sede.id:
            raise ValidationError({"sede": "Solo puedes registrar contingencias dentro de tu sede."})
        if actor_is_admin_sede and aprendiz_sede and actor_sede and aprendiz_sede.id != actor_sede.id:
            raise ValidationError({"usuario": "Solo puedes registrar contingencias para aprendices de tu sede."})

        if tipo == Acceso.Tipo.SALIDA and ultimo and ultimo.sede_id:
            resolved = ultimo.sede
            if requested_sede and requested_sede.id != resolved.id:
                raise ValidationError({"sede": "La salida debe registrarse en la misma sede del ultimo ingreso."})
        else:
            resolved = actor_sede or requested_sede or aprendiz_sede

        if not resolved:
            raise ValidationError({"sede": "Debes indicar la sede del acceso de contingencia."})

        if aprendiz_sede and resolved.id != aprendiz_sede.id:
            raise ValidationError({"sede": "La sede del acceso debe coincidir con la sede del aprendiz."})

        return resolved

    def _record_contingency_access_audit(
        self,
        *,
        request,
        acceso: Acceso,
        motivo: str,
        aprendiz: Usuario,
        sede: Sede,
        equipos: list[Equipo],
    ):
        ControlPanelAuditEvent.objects.create(
            actor=getattr(request, "user", None),
            session=getattr(request, "control_panel_session", None) or resolve_control_panel_session(request),
            action=ControlPanelAuditEvent.Action.CREATE,
            category=ControlPanelAuditEvent.Category.SEDE_MANAGEMENT,
            target_type="acceso_contingencia",
            target_id=str(acceso.id),
            before_json=None,
            after_json={
                "acceso_id": acceso.id,
                "usuario_id": getattr(aprendiz, "id", None),
                "tipo": acceso.tipo,
                "sede_id": getattr(sede, "id", None),
                "equipos": [eq.id for eq in equipos],
                "motivo": motivo,
            },
            reason=motivo,
            ip_address=str(get_client_ip(request) or ""),
        )

    def create(self, request, *args, **kwargs):
        replay_response, idem_cache_key, idem_lock_key = _idempotency_prepare(request, action="acceso.create")
        if replay_response is not None:
            return replay_response

        def _finish(response: Response):
            _idempotency_store_success(idem_cache_key, response)
            _idempotency_release(idem_lock_key)
            return response

        request_user = request.user
        rol = _effective_role(request_user)

        if rol != Usuario.Rol.GUARDA:
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="El flujo operativo solo puede ejecutarse desde un turno activo de guarda. Usa contingencia para excepciones.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        turno = obtener_turno_activo(request_user)
        if not turno:
            return _finish(
                error_response(
                    code=ErrorCode.TURNO_REQUIRED,
                    message="Debes iniciar turno antes de registrar accesos.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )
        sede = turno.sede
        if not sede:
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No tienes una sede operativa para registrar accesos.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        aprendiz = serializer.validated_data["usuario"]
        tipo = serializer.validated_data["tipo"]
        equipos_enviados = serializer.validated_data.get("equipos", [])
        if _scope_sede(aprendiz) != getattr(sede, "code", None):
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes registrar accesos operativos para aprendices de tu sede activa.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message="Salida sin ingreso previo.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if ultimo is not None and ultimo.tipo == tipo:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message=f"Doble {tipo}.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if tipo == Acceso.Tipo.INGRESO and equipos_enviados:
            self._validar_equipos_ingreso(aprendiz, list(equipos_enviados))

        if tipo == Acceso.Tipo.SALIDA:
            if not ultimo or ultimo.tipo != Acceso.Tipo.INGRESO:
                return _finish(
                    error_response(
                        code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                        message="Salida inválida: el último registro no es un ingreso.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                )
            try:
                self._validar_sede_salida(ultimo_ingreso=ultimo, sede_operativa=sede)
            except ValidationError as exc:
                return _finish(
                    error_response(
                        code=ErrorCode.VALIDATION_ERROR,
                        message=str(exc.detail.get("sede", ["Salida invalida."])[0]),
                        status_code=status.HTTP_400_BAD_REQUEST,
                        field="sede",
                    )
                )
            self._validar_salida_equipos_vs_ultimo_ingreso(ultimo, list(equipos_enviados))

        acceso = serializer.save(registrado_por=request_user, turno=turno, sede=sede)
        if equipos_enviados:
            acceso.equipos.set(list(equipos_enviados))
        logger.info(
            "audit_access_created actor_id=%s actor_role=%s acceso_id=%s aprendiz_id=%s tipo=%s sede_id=%s",
            getattr(request_user, "id", None),
            rol,
            acceso.id,
            getattr(aprendiz, "id", None),
            tipo,
            getattr(sede, "id", None),
        )

        incr_metric("acceso_create_success_total")
        return _finish(ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED))

    def update(self, request, *args, **kwargs):
        return error_response(
            code=ErrorCode.PERMISSION_DENIED,
            message="Los accesos historicos no se pueden editar.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return error_response(
            code=ErrorCode.PERMISSION_DENIED,
            message="Los accesos historicos no se pueden editar.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["post"], url_path="registrar_contingencia")
    def registrar_contingencia(self, request):
        replay_response, idem_cache_key, idem_lock_key = _idempotency_prepare(
            request, action="acceso.registrar_contingencia"
        )
        if replay_response is not None:
            return replay_response

        def _finish(response: Response):
            _idempotency_store_success(idem_cache_key, response)
            _idempotency_release(idem_lock_key)
            return response

        request_user = request.user
        rol = _effective_role(request_user)
        if rol not in [Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE]:
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo administradores pueden registrar accesos de contingencia.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        serializer = RegistrarAccesoContingenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        documento = serializer.validated_data["documento"]
        tipo = serializer.validated_data["tipo"]
        motivo = serializer.validated_data["motivo"]
        requested_sede = serializer.validated_data.get("sede")
        equipos_ids = serializer.validated_data.get("equipos", [])
        equipos = list(Equipo.objects.filter(id__in=equipos_ids)) if equipos_ids else []

        aprendiz = Usuario.objects.filter(documento=documento).first()
        if not aprendiz:
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="Documento no registrado.",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            )

        if not _has_role(aprendiz, Usuario.Rol.APRENDIZ):
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El documento no pertenece a un aprendiz.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message="Salida sin ingreso previo.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if ultimo is not None and ultimo.tipo == tipo:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message=f"Doble {tipo}.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        try:
            sede = self._resolve_contingency_sede(
                actor=request_user,
                aprendiz=aprendiz,
                requested_sede=requested_sede,
                ultimo=ultimo,
                tipo=tipo,
            )
        except ValidationError as exc:
            detail = getattr(exc, "detail", {})
            field = next(iter(detail.keys()), "sede") if isinstance(detail, dict) and detail else "sede"
            message = detail.get(field, ["Solicitud invalida."])[0] if isinstance(detail, dict) else str(exc)
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=str(message),
                    status_code=status.HTTP_400_BAD_REQUEST,
                    field=field,
                )
            )

        if tipo == Acceso.Tipo.INGRESO and equipos:
            self._validar_equipos_ingreso(aprendiz, list(equipos))

        if tipo == Acceso.Tipo.SALIDA:
            if not ultimo or ultimo.tipo != Acceso.Tipo.INGRESO:
                return _finish(
                    error_response(
                        code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                        message="Salida invalida: el ultimo registro no es un ingreso.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                )
            try:
                self._validar_sede_salida(ultimo_ingreso=ultimo, sede_operativa=sede)
            except ValidationError as exc:
                return _finish(
                    error_response(
                        code=ErrorCode.VALIDATION_ERROR,
                        message=str(exc.detail.get("sede", ["Salida invalida."])[0]),
                        status_code=status.HTTP_400_BAD_REQUEST,
                        field="sede",
                    )
                )
            self._validar_salida_equipos_vs_ultimo_ingreso(ultimo, list(equipos))

        acceso = Acceso.objects.create(
            usuario=aprendiz,
            tipo=tipo,
            fecha=timezone.now(),
            sede=sede,
            turno=None,
            registrado_por=request_user,
        )
        if equipos:
            acceso.equipos.set(list(equipos))

        self._record_contingency_access_audit(
            request=request,
            acceso=acceso,
            motivo=motivo,
            aprendiz=aprendiz,
            sede=sede,
            equipos=equipos,
        )
        logger.warning(
            "audit_access_contingency_created actor_id=%s actor_role=%s acceso_id=%s aprendiz_id=%s tipo=%s sede_id=%s motivo=%s",
            getattr(request_user, "id", None),
            rol,
            acceso.id,
            getattr(aprendiz, "id", None),
            tipo,
            getattr(sede, "id", None),
            motivo,
        )
        incr_metric("acceso_contingencia_success_total")
        return _finish(ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED))

    @action(detail=False, methods=["post"], url_path="validar_documento")
    def validar_documento(self, request):
        if not _has_active_role(request.user, Usuario.Rol.GUARDA):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para validar documentos.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        s = ValidarDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="Debes iniciar turno para validar y registrar accesos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        scan_sede = turno.sede
        if not scan_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes una sede operativa para validar documentos.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        try:
            documento = _extract_documento_from_scan(s.validated_data["documento"], sede=scan_sede)
        except QRParseError as exc:
            if getattr(exc, "code", "") == "expired":
                return error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="QR expirado. Genera uno nuevo.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message=str(exc) or "QR o codigo de barras invalido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        aprendiz = Usuario.objects.filter(documento=documento).first()
        if not aprendiz:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Documento no registrado.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if not _has_role(aprendiz, Usuario.Rol.APRENDIZ):
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="El documento no pertenece a un aprendiz.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if getattr(aprendiz, "estado", None) == Usuario.Estado.BLOQUEADO:
            return error_response(
                code=ErrorCode.ACCOUNT_DISABLED_SECURITY,
                message="El aprendiz está bloqueado.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if _scope_sede(aprendiz) != getattr(scan_sede, "code", None):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo puedes validar documentos de aprendices de tu sede activa.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()
        estado = "dentro" if (ultimo and ultimo.tipo == Acceso.Tipo.INGRESO) else "fuera"
        equipos_aprobados = Equipo.objects.filter(propietario=aprendiz, estado=Equipo.Estado.APROBADO).order_by(
            "-creado_en"
        )

        return ok_response(
            {
                "estado": estado,
                "aprendiz": UsuarioSerializer(aprendiz).data,
                "equipos": EquipoSerializer(equipos_aprobados, many=True).data,
                "turno": TurnoSerializer(turno).data if turno else None,
            }
        )

    @action(detail=False, methods=["post"], url_path="registrar_por_documento")
    def registrar_por_documento(self, request):
        replay_response, idem_cache_key, idem_lock_key = _idempotency_prepare(request, action="acceso.scan")
        if replay_response is not None:
            return replay_response

        def _finish(response: Response):
            _idempotency_store_success(idem_cache_key, response)
            _idempotency_release(idem_lock_key)
            return response

        if not _has_active_role(request.user, Usuario.Rol.GUARDA):
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No tienes permisos para registrar accesos por documento.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )
        s = RegistrarAccesoDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        turno = obtener_turno_activo(request.user)
        if not turno:
            return _finish(
                error_response(
                    code=ErrorCode.TURNO_REQUIRED,
                    message="Debes iniciar turno antes de registrar accesos.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )
        scan_sede = turno.sede
        if not scan_sede:
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No tienes una sede operativa para registrar accesos.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        try:
            documento = _extract_documento_from_scan(s.validated_data["documento"], sede=scan_sede)
        except QRParseError as exc:
            if getattr(exc, "code", "") == "expired":
                return _finish(
                    error_response(
                        code=ErrorCode.VALIDATION_ERROR,
                        message="QR expirado. Genera uno nuevo.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                )
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=str(exc) or "QR o codigo de barras invalido.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )
        tipo = s.validated_data["tipo"]
        equipos_ids = s.validated_data.get("equipos", [])
        equipos = list(Equipo.objects.filter(id__in=equipos_ids)) if equipos_ids else []

        aprendiz = Usuario.objects.filter(documento=documento).first()
        if not aprendiz:
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="Documento no registrado.",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            )

        if not _has_role(aprendiz, Usuario.Rol.APRENDIZ):
            return _finish(
                error_response(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="El documento no pertenece a un aprendiz.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if _scope_sede(aprendiz) != getattr(scan_sede, "code", None):
            return _finish(
                error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes registrar accesos operativos para aprendices de tu sede activa.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
            )

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message="Salida sin ingreso previo.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if ultimo is not None and ultimo.tipo == tipo:
            return _finish(
                error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message=f"Doble {tipo}.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            )

        if tipo == Acceso.Tipo.INGRESO and equipos:
            self._validar_equipos_ingreso(aprendiz, list(equipos))

        if tipo == Acceso.Tipo.SALIDA:
            if not ultimo or ultimo.tipo != Acceso.Tipo.INGRESO:
                return _finish(
                    error_response(
                        code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                        message="Salida inválida: el último registro no es un ingreso.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                )
            try:
                self._validar_sede_salida(ultimo_ingreso=ultimo, sede_operativa=scan_sede)
            except ValidationError as exc:
                return _finish(
                    error_response(
                        code=ErrorCode.VALIDATION_ERROR,
                        message=str(exc.detail.get("sede", ["Salida invalida."])[0]),
                        status_code=status.HTTP_400_BAD_REQUEST,
                        field="sede",
                    )
                )
            self._validar_salida_equipos_vs_ultimo_ingreso(ultimo, list(equipos))

        acceso = Acceso.objects.create(
            usuario=aprendiz,
            tipo=tipo,
            fecha=timezone.now(),
            sede=scan_sede,
            turno=turno,
            registrado_por=request.user,
        )
        if equipos:
            acceso.equipos.set(list(equipos))
        logger.info(
            "audit_access_created_scan actor_id=%s acceso_id=%s aprendiz_id=%s tipo=%s sede_id=%s",
            getattr(request.user, "id", None),
            acceso.id,
            getattr(aprendiz, "id", None),
            tipo,
            getattr(scan_sede, "id", None),
        )

        incr_metric("acceso_scan_success_total")
        return _finish(ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED))

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        if not _has_active_role(request.user, Usuario.Rol.GUARDA):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para ver estadisticas de escaneo.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="No tienes turno activo.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"stats": None},
            )

        qs = Acceso.objects.filter(turno=turno, is_deleted=False)
        ingresos = qs.filter(tipo=Acceso.Tipo.INGRESO).count()
        salidas = qs.filter(tipo=Acceso.Tipo.SALIDA).count()

        return ok_response(
            {
                "turno": {"id": turno.id, "sede": turno.sede, "jornada": turno.jornada},
                "stats": {"ingresos": ingresos, "salidas": salidas, "total": ingresos + salidas},
            }
        )

    @action(detail=False, methods=["get"], url_path="mis_accesos")
    def mis_accesos(self, request):
        if not _has_active_role(request.user, Usuario.Rol.APRENDIZ):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Este endpoint es exclusivo para aprendices.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        qs = Acceso.objects.filter(usuario=request.user, is_deleted=False).order_by("-fecha")[:100]
        return Response(AccesoSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="estado")
    def estado(self, request):
        if not _has_active_role(request.user, Usuario.Rol.APRENDIZ):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Este endpoint es exclusivo para aprendices.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        ultimo = Acceso.objects.filter(usuario=request.user, is_deleted=False).order_by("-fecha").first()
        if not ultimo:
            return ok_response(
                {
                    "estado": "SIN_REGISTROS",
                    "ultimo_tipo": None,
                    "ultima_fecha": None,
                }
            )

        estado = "DENTRO" if ultimo.tipo == Acceso.Tipo.INGRESO else "FUERA"
        return ok_response(
            {
                "estado": estado,
                "ultimo_tipo": ultimo.tipo,
                "ultima_fecha": ultimo.fecha,
            }
        )

    def destroy(self, request, *args, **kwargs):
        acceso = self.get_object()
        if acceso.is_deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        acceso.soft_delete(by_user=request.user)
        logger.warning(
            "audit_access_soft_deleted actor_id=%s acceso_id=%s aprendiz_id=%s",
            getattr(request.user, "id", None),
            acceso.id,
            getattr(acceso.usuario, "id", None),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


def _role_allowed_for_expected(actual_role: str | None, expected_role: str | None) -> bool:
    if not expected_role:
        return True
    if expected_role == "admin":
        return actual_role in {Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE}
    return actual_role == expected_role


def _latest_password_reset_otp(user: Usuario):
    return (
        PasswordResetOTP.objects.filter(
            user=user,
            used_at__isnull=True,
            channel=PasswordResetOTP.Channel.EMAIL,
        )
        .order_by("-created_at")
        .first()
    )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        started = time.perf_counter()
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        ip = get_client_ip(request)
        user = _find_user_for_password_reset(email=email)

        ip_key = [ip, "password-reset"]
        if is_locked("otp-request-ip", ip_key):
            remaining = get_lock_remaining("otp-request-ip", ip_key)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        ip_limit = bump_with_lock(
            "otp-request-ip", ip_key, OTP_MAX_REQUESTS * 3, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
        )
        if ip_limit["locked"]:
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": int(ip_limit.get("remaining_sec", 0))},
            )

        if user:
            user_key = [str(user.id), "password-reset"]
            if is_locked("otp-request-user", user_key):
                remaining = get_lock_remaining("otp-request-user", user_key)
                _uniform_response_delay(started)
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta mas tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={"seconds_remaining": remaining},
                )

            user_limit = bump_with_lock(
                "otp-request-user", user_key, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC
            )
            if user_limit["locked"]:
                _uniform_response_delay(started)
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta mas tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={"seconds_remaining": int(user_limit.get("remaining_sec", 0))},
                )

            PasswordResetOTP.objects.filter(
                user=user,
                used_at__isnull=True,
                channel=PasswordResetOTP.Channel.EMAIL,
            ).update(used_at=timezone.now())
            otp_obj, code = create_otp_for_user(user)
            try:
                send_password_reset_email(user.email, code)
            except ImproperlyConfigured:
                otp_obj.delete()
                _uniform_response_delay(started)
                logger.exception("password_reset_email_misconfigured user_id=%s", user.id)
                return error_response(
                    code=ErrorCode.NETWORK_ERROR,
                    message="El servicio de correo OTP no esta disponible.",
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except Exception:
                otp_obj.delete()
                _uniform_response_delay(started)
                logger.exception("password_reset_email_failed user_id=%s", user.id)
                return error_response(
                    code=ErrorCode.NETWORK_ERROR,
                    message="No se pudo enviar el codigo OTP. Verifica la configuracion de correo.",
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        _uniform_response_delay(started)
        return ok_response({"mensaje": "Si el usuario existe, enviamos un codigo OTP."})


class PasswordResetVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        started = time.perf_counter()
        s = PasswordResetVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        otp = s.validated_data["otp"]
        ip = get_client_ip(request)
        ip_key = [ip, email]
        user = _find_user_for_password_reset(email=email)

        if is_locked("otp-verify-ip", ip_key):
            remaining = get_lock_remaining("otp-verify-ip", ip_key)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiados intentos. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        if not user:
            bump_with_lock("otp-verify-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = _latest_password_reset_otp(user)
        if not otp_obj:
            bump_with_lock("otp-verify-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp_obj.expires_at:
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El codigo OTP expiro. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if otp_obj.attempts >= OTP_MAX_ATTEMPTS:
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(otp_obj.salt, otp) != otp_obj.code_hash:
            otp_obj.attempts += 1
            otp_obj.save(update_fields=["attempts"])
            bump_with_lock("otp-verify-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        _uniform_response_delay(started)
        return ok_response()


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        started = time.perf_counter()
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data.get("email", "")
        otp = s.validated_data["otp"]
        new_password = s.validated_data["new_password"]
        ip = get_client_ip(request)
        ip_key = [ip, email]
        user = _find_user_for_password_reset(email=email)

        if is_locked("otp-confirm-ip", ip_key):
            remaining = get_lock_remaining("otp-confirm-ip", ip_key)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiados intentos. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        if not user:
            bump_with_lock("otp-confirm-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = _latest_password_reset_otp(user)
        if not otp_obj:
            bump_with_lock("otp-confirm-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp_obj.expires_at:
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_EXPIRED,
                message="El codigo OTP expiro. Solicita uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if otp_obj.attempts >= OTP_MAX_ATTEMPTS:
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_TOO_MANY_ATTEMPTS,
                message="Demasiados intentos con OTP. Solicita uno nuevo.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if hash_code(otp_obj.salt, otp) != otp_obj.code_hash:
            otp_obj.attempts += 1
            otp_obj.save(update_fields=["attempts"])
            bump_with_lock("otp-confirm-ip", ip_key, OTP_MAX_ATTEMPTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            _uniform_response_delay(started)
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El codigo OTP no es valido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.force_password_reset = False
        user.failed_lockouts_count = 0
        user.first_lockout_at = None
        user.last_password_change_at = timezone.now()
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "force_password_reset",
                "failed_lockouts_count",
                "first_lockout_at",
                "last_password_change_at",
            ]
        )

        otp_obj.used_at = timezone.now()
        otp_obj.save(update_fields=["used_at"])
        PasswordResetOTP.objects.filter(
            user=user,
            used_at__isnull=True,
            channel=PasswordResetOTP.Channel.EMAIL,
        ).exclude(id=otp_obj.id).update(used_at=timezone.now())
        _uniform_response_delay(started)
        return ok_response()


class PasskeyRegisterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = PasskeyRegisterOptionsSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        request_id = uuid4().hex
        challenge = secrets.token_urlsafe(32)
        cache.set(
            webauthn_register_cache_key(user.id, request_id),
            {"challenge": challenge, "nickname": s.validated_data.get("nickname", "")},
            timeout=PASSKEY_REGISTER_CHALLENGE_TTL,
        )

        payload = {
            "request_id": request_id,
            "challenge": challenge,
            "rp": {"name": getattr(settings, "WEBAUTHN_RP_NAME", "SADI"), "id": resolve_webauthn_rp_id(request)},
            "origin": resolve_webauthn_origin(request),
            "user": {
                "id": str(user.id),
                "name": user.username,
                "displayName": f"{user.first_name} {user.last_name}".strip() or user.username,
            },
            "timeout": 60000,
            "attestation": "none",
            "exclude_credentials": list(user.webauthn_credentials.values("credential_id")),
            "mock": bool(getattr(settings, "WEBAUTHN_MOCK", True)),
        }
        return ok_response(payload)


class PasskeyRegisterVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = PasskeyRegisterVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        user: Usuario = request.user
        request_id = s.validated_data["request_id"]
        key = webauthn_register_cache_key(user.id, request_id)
        saved = cache.get(key) or {}
        if not saved:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="El reto de registro expiro. Intenta de nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        challenge = saved.get("challenge")
        if challenge != s.validated_data["challenge"]:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="Verificacion passkey invalida.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        credential, _created = WebAuthnCredential.objects.update_or_create(
            user=user,
            credential_id=s.validated_data["credential_id"],
            defaults={
                "public_key": s.validated_data.get("public_key", ""),
                "sign_count": s.validated_data.get("sign_count", 0),
                "transports": s.validated_data.get("transports"),
                "aaguid": s.validated_data.get("aaguid", ""),
                "nickname": s.validated_data.get("nickname") or saved.get("nickname", ""),
                "last_used_at": timezone.now(),
            },
        )
        cache.delete(key)
        return ok_response(
            {
                "credential": {
                    "id": credential.id,
                    "credential_id": credential.credential_id,
                    "nickname": credential.nickname,
                    "created_at": credential.created_at,
                }
            }
        )


class PasskeyAuthOptionsView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not bool(getattr(settings, "WEBAUTHN_MOCK", True)):
            return passkey_auth_disabled_response()

        s = PasskeyAuthOptionsSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        login_identifier = (s.validated_data.get("username", "") or "").strip().lower()
        user = None
        if login_identifier:
            user = Usuario.objects.filter(username__iexact=login_identifier).first()
            if not user:
                user = Usuario.objects.filter(email__iexact=login_identifier).first()
        allow_credentials = []
        if user:
            allow_credentials = list(user.webauthn_credentials.values("credential_id", "transports"))

        request_id = uuid4().hex
        challenge = secrets.token_urlsafe(32)
        cache.set(
            webauthn_auth_cache_key(request_id),
            {
                "challenge": challenge,
                "username": login_identifier,  # compatibilidad con payloads previos
                "login_identifier": login_identifier,
                "expected_role": s.validated_data.get("expected_role"),
            },
            timeout=PASSKEY_AUTH_CHALLENGE_TTL,
        )
        return ok_response(
            {
                "request_id": request_id,
                "challenge": challenge,
                "rp_id": resolve_webauthn_rp_id(request),
                "timeout": 60000,
                "allow_credentials": allow_credentials,
                "mock": bool(getattr(settings, "WEBAUTHN_MOCK", True)),
            }
        )


class PasskeyAuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not bool(getattr(settings, "WEBAUTHN_MOCK", True)):
            return passkey_auth_disabled_response()

        s = PasskeyAuthVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        request_id = s.validated_data["request_id"]
        key = webauthn_auth_cache_key(request_id)
        payload = cache.get(key) or {}
        if not payload:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="El reto de autenticacion expiro.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if payload.get("challenge") != s.validated_data["challenge"]:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="Verificacion passkey invalida.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        credential = (
            WebAuthnCredential.objects.select_related("user")
            .filter(credential_id=s.validated_data["credential_id"])
            .first()
        )
        if not credential:
            return error_response(
                code=ErrorCode.PASSKEY_INVALID,
                message="Credencial passkey invalida.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user: Usuario = credential.user
        expected_identifier = (payload.get("login_identifier") or payload.get("username") or "").strip().lower()
        if expected_identifier:
            username_ok = (user.username or "").strip().lower() == expected_identifier
            email_ok = (user.email or "").strip().lower() == expected_identifier
            if not (username_ok or email_ok):
                return error_response(
                    code=ErrorCode.PASSKEY_INVALID,
                    message="Credencial passkey invalida.",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

        expected_role = s.validated_data.get("expected_role") or payload.get("expected_role")
        resolved_login_role = AuthorizationService.resolve_login_role(user, expected_role)
        if getattr(user, "estado", None) == Usuario.Estado.BLOQUEADO:
            return error_response(
                code=ErrorCode.ACCOUNT_DISABLED_SECURITY,
                message="Tu cuenta esta deshabilitada por seguridad.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if getattr(user, "force_password_reset", False):
            return error_response(
                code=ErrorCode.PASSWORD_RESET_REQUIRED,
                message="Debes recuperar la contrasena antes de volver a iniciar sesion.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if not _role_allowed_for_expected(resolved_login_role, expected_role):
            return error_response(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Credenciales invalidas para este modulo.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        credential.last_used_at = timezone.now()
        credential.sign_count = int(credential.sign_count or 0) + 1
        credential.save(update_fields=["last_used_at", "sign_count"])
        cache.delete(key)
        tokens = issue_tokens_for_user(
            user,
            request=request,
            role_code=resolved_login_role,
            rotate_guard_session=True,
        )
        response = Response(tokens, status=status.HTTP_200_OK)
        if _cookie_mode_requested(request):
            refresh_token = str(tokens.get("refresh", "") or "").strip()
            if refresh_token:
                _set_refresh_cookie(response, refresh_token)
            _strip_refresh_from_body_if_needed(request=request, payload=response.data)
        return response


class GeminiStubView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not bool(getattr(settings, "GEMINI_ENABLED", False)):
            return error_response(
                code=ErrorCode.AI_FEATURE_DISABLED,
                message="La funcionalidad de IA no esta habilitada en este entorno.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        user_id = str(getattr(request.user, "id", "") or "anon")
        ip = str(get_client_ip(request) or "unknown")
        rate_limit_attempts = max(
            1,
            int(
                getattr(settings, "GEMINI_RATE_LIMIT_ATTEMPTS", GEMINI_RATE_LIMIT_ATTEMPTS)
                or GEMINI_RATE_LIMIT_ATTEMPTS
            ),
        )
        rate_limit_window_sec = max(
            10,
            int(
                getattr(settings, "GEMINI_RATE_LIMIT_WINDOW_SEC", GEMINI_RATE_LIMIT_WINDOW_SEC)
                or GEMINI_RATE_LIMIT_WINDOW_SEC
            ),
        )
        rate_limit_lock_sec = max(
            10,
            int(
                getattr(settings, "GEMINI_RATE_LIMIT_LOCK_SEC", GEMINI_RATE_LIMIT_LOCK_SEC)
                or GEMINI_RATE_LIMIT_LOCK_SEC
            ),
        )

        by_user = bump_with_lock(
            "gemini-user",
            [user_id],
            rate_limit_attempts,
            rate_limit_window_sec,
            rate_limit_lock_sec,
        )
        if by_user.get("locked"):
            remaining_sec = int(by_user.get("remaining_sec", 0) or 0)
            logger.warning("gemini_stub_rate_limited user_id=%s ip=%s remaining_sec=%s", user_id, ip, remaining_sec)
            incr_metric("gemini_stub_rate_limited_total")
            return error_response(
                code=ErrorCode.AI_RATE_LIMITED,
                message="Demasiadas solicitudes de IA. Intenta nuevamente en unos segundos.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining_sec},
            )

        by_ip = bump_with_lock(
            "gemini-ip",
            [ip],
            rate_limit_attempts * 2,
            rate_limit_window_sec,
            rate_limit_lock_sec,
        )
        if by_ip.get("locked"):
            remaining_sec = int(by_ip.get("remaining_sec", 0) or 0)
            logger.warning("gemini_stub_rate_limited_ip user_id=%s ip=%s remaining_sec=%s", user_id, ip, remaining_sec)
            incr_metric("gemini_stub_rate_limited_total")
            return error_response(
                code=ErrorCode.AI_RATE_LIMITED,
                message="Demasiadas solicitudes de IA. Intenta nuevamente en unos segundos.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining_sec},
            )

        serializer = GeminiStubSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = serializer.validated_data["prompt"]
        started = time.perf_counter()
        try:
            output = _gemini_stub_with_retry(prompt)
        except TimeoutError:
            logger.warning("gemini_stub_timeout user_id=%s ip=%s prompt_len=%s", user_id, ip, len(prompt))
            incr_metric("gemini_stub_timeout_total")
            return error_response(
                code=ErrorCode.UPSTREAM_TIMEOUT,
                message="El proveedor de IA no respondio a tiempo.",
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            )

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gemini_stub_success user_id=%s ip=%s prompt_len=%s latency_ms=%s",
            user_id,
            ip,
            len(prompt),
            elapsed_ms,
        )
        incr_metric("gemini_stub_requests_total")
        return ok_response(
            {
                "provider": "gemini",
                "model": str(getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")),
                "stub": True,
                "output": output,
                "latency_ms": elapsed_ms,
            }
        )
