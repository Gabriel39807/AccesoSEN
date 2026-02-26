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
from .api.permissions import RequiresPermission
from .domain.services.authorization import AuthorizationService
from .domain.services.email_domain_service import EmailDomainService
from .domain.services.policy_service import PolicyService
from .domain.services.qr_service import QRParseError, QRService
from .error_codes import ErrorCode
from .import_services import (
    ImportServiceError,
    cache_import_payload,
    execute_aprendices_import,
    get_cached_import_payload,
    validate_excel,
)
from .jwt_views import issue_tokens_for_user
from .models import (
    Acceso,
    AllowedEmailDomain,
    ConfiguracionSistema,
    EmailChangeOTP,
    Equipo,
    Notificacion,
    Permission as RbacPermission,
    PasswordResetOTP,
    RefreshSession,
    Role,
    RolePermission,
    Sede,
    SedePolicy,
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
    send_password_reset_email,
)
from .permissions import IsAdmin, IsAprendiz, IsGuarda, IsSuperAdmin, is_admin_role, is_admin_sede, is_superadmin
from .rate_limit import bump_with_lock, get_client_ip, get_lock_remaining, is_locked
from .serializers import (
    AccesoSerializer,
    AllowedEmailDomainSerializer,
    AprendizEmailChangeConfirmSerializer,
    AprendizEmailChangeRequestSerializer,
    AprendizPerfilSerializer,
    AprendizPerfilUpdateSerializer,
    ChangeInitialPasswordSerializer,
    ConfiguracionSistemaSerializer,
    EquipoRevisionSerializer,
    EquipoSerializer,
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
    RegistrarAccesoDocumentoSerializer,
    RolePermissionSerializer,
    RoleSerializer,
    SedeSerializer,
    SedePolicySerializer,
    TurnoIniciarSerializer,
    TurnoSerializer,
    UsuarioSerializer,
    ValidarDocumentoSerializer,
)

PASSKEY_REGISTER_CHALLENGE_TTL = 10 * 60
PASSKEY_AUTH_CHALLENGE_TTL = 5 * 60
MAX_ADMINS_PER_SEDE = 4
FILTER_ALL_VALUES = {"all", "todos", "todas", "*"}
TURNO_AUTO_CLOSE_OBSERVATION = "Cierre por tiempo limite alcanzado"
logger = logging.getLogger(__name__)


def _webauthn_register_cache_key(user_id: int, request_id: str) -> str:
    return f"sadi:webauthn:register:{user_id}:{request_id}"


def _webauthn_auth_cache_key(request_id: str) -> str:
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


def _resolve_webauthn_rp_id(request) -> str:
    configured = str(getattr(settings, "WEBAUTHN_RP_ID", "") or "").strip()
    if configured:
        return configured
    return _request_host_without_port(request)


def _resolve_webauthn_origin(request) -> str:
    configured = str(getattr(settings, "WEBAUTHN_ORIGIN", "") or "").strip()
    if configured:
        return configured
    return _request_origin(request)


def _scope_sede_id(user: Usuario) -> int | None:
    if not user:
        return None
    return getattr(user, "sede_principal_id", None)


def _scope_sede_code(user: Usuario) -> str | None:
    if not user:
        return None
    sede = getattr(user, "sede_principal", None)
    code = getattr(sede, "code", None)
    return (code or "").strip() or None


def _scope_sede(user: Usuario) -> str | None:
    # Compat helper: mantiene semantica previa (devuelve codigo)
    return _scope_sede_code(user)


def _is_admin_full_access(user: Usuario) -> bool:
    return bool(user and is_admin_role(user) and not is_admin_sede(user))


def _effective_role(user: Usuario | None) -> str:
    return AuthorizationService.default_role_for_user(user) if user else ""


def _has_role(user: Usuario | None, role_code: str) -> bool:
    if not user:
        return False
    return role_code in AuthorizationService.role_codes(user)


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
            {
                field: (
                    "Valor invalido para sede. Debes enviar el codigo tecnico o id, no la etiqueta visible."
                )
            }
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
        sede=getattr(user, "sede_principal", None),
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


class ConfiguracionSistemaView(APIView):
    """Configuración global de marca blanca para frontend.

    GET:
        Público. Entrega nombre institucional y paleta por rol.
    PUT:
        Solo superusuario. Permite actualizar branding global.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        cfg = ConfiguracionSistema.get_solo()
        payload = ConfiguracionSistemaSerializer(cfg).data
        return ok_response({"configuracion": payload})

    def put(self, request):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return error_response(
                code=ErrorCode.NOT_AUTHENTICATED,
                message="Debes iniciar sesion para modificar la configuracion.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not bool(getattr(user, "is_superuser", False)):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Solo un superusuario puede actualizar la configuracion global.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        cfg = ConfiguracionSistema.get_solo()
        serializer = ConfiguracionSistemaSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok_response({"configuracion": serializer.data, "mensaje": "Configuracion actualizada correctamente."})


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
            remaining = max(get_lock_remaining("email-change-user", k_user), get_lock_remaining("email-change-ip", k_ip))
            return error_response(
                code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                message="Demasiadas solicitudes. Intenta mas tarde.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"seconds_remaining": remaining},
            )

        limit_user = bump_with_lock("email-change-user", k_user, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
        limit_ip = bump_with_lock("email-change-ip", k_ip, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
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
            sede=getattr(user, "sede_principal", None),
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
        EmailChangeOTP.objects.filter(user=user, used_at__isnull=True).exclude(id=otp_obj.id).update(used_at=timezone.now())

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

            limit_user = bump_with_lock("otp-request-user", k_user, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            limit_ip = bump_with_lock("otp-request-ip", k_ip, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
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
        PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=PasswordResetOTP.Channel.EMAIL).exclude(id=otp_obj.id).update(
            used_at=timezone.now()
        )

        return ok_response()


class SedeViewSet(viewsets.ModelViewSet):
    serializer_class = SedeSerializer
    queryset = Sede.objects.all().order_by("name")
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated(), IsSuperAdmin()]

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
            if active_filter is False:
                return qs.none()
            return qs.filter(is_active=True)

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
            return scoped.filter(is_active=True)
        return scoped.filter(is_active=True)

    def destroy(self, request, *args, **kwargs):
        sede = self.get_object()
        if not sede.is_active:
            return ok_response({"sede": self.get_serializer(sede).data, "mensaje": "La sede ya estaba inactiva."})
        sede.is_active = False
        sede.save(update_fields=["is_active"])
        return ok_response({"sede": self.get_serializer(sede).data, "mensaje": "Sede desactivada correctamente."})


class RoleViewSet(viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    queryset = Role.objects.all().order_by("code")
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
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
        return Response(status=status.HTTP_204_NO_CONTENT)


class PermissionViewSet(viewsets.ModelViewSet):
    serializer_class = PermissionSerializer
    queryset = RbacPermission.objects.all().order_by("code")
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def destroy(self, request, *args, **kwargs):
        permission_obj = self.get_object()
        if permission_obj.role_permissions.exists():
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="No se puede eliminar un permiso ya asignado a roles.",
                status_code=status.HTTP_400_BAD_REQUEST,
                field="permission",
            )
        permission_obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RolePermissionViewSet(viewsets.ModelViewSet):
    serializer_class = RolePermissionSerializer
    queryset = RolePermission.objects.select_related("role", "permission").all().order_by("role__code", "permission__code", "scope")
    permission_classes = [IsAuthenticated, IsSuperAdmin]


class SedePolicyViewSet(viewsets.ModelViewSet):
    serializer_class = SedePolicySerializer
    queryset = SedePolicy.objects.select_related("sede").all().order_by("sede__name")
    permission_classes = [IsAuthenticated, IsSuperAdmin]


class AllowedEmailDomainViewSet(viewsets.ModelViewSet):
    serializer_class = AllowedEmailDomainSerializer
    queryset = AllowedEmailDomain.objects.select_related("role", "sede", "created_by").all().order_by(
        "domain",
        "role__code",
        "sede__code",
    )
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        qs = super().get_queryset()

        domain = (self.request.query_params.get("domain") or "").strip().lower()
        if domain:
            qs = qs.filter(domain__icontains=domain)

        role = (self.request.query_params.get("role") or "").strip().lower()
        if role:
            qs = qs.filter(role__code=role)

        sede = (
            self.request.query_params.get("sede")
            or self.request.query_params.get("sede_id")
            or ""
        ).strip()
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
                raise ValidationError(
                    {
                        "scope": (
                            "Scope invalido. Valores permitidos: "
                            "GLOBAL, SEDE, ROLE, ROLE_SEDE."
                        )
                    }
                )

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AuditEventsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        events: list[dict] = []

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
            RefreshSession.objects.filter(revoked_at__isnull=False)
            .select_related("user")
            .order_by("-revoked_at")[:30]
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


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by("id")
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

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

        result = validate_excel(s.validated_data["file"])
        import_id = uuid4().hex
        cache_import_payload(import_id, request.user.id, result.rows, result.errors)

        return ok_response(
            {
                "import_id": import_id,
                "resumen": {
                    "validos": len(result.rows),
                    "errores": len(result.errors),
                    "total": len(result.rows) + len(result.errors),
                },
                "errores": result.errors,
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
        if result.updated_count:
            parts.append(f"{result.updated_count} actualizados")
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
            }
        )


class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notificacion.objects.all()

    def get_queryset(self):
        user = self.request.user
        role_codes = list(AuthorizationService.role_codes(user))

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

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

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
    permission_classes = [IsAuthenticated]
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

    def get_permissions(self):
        if self.action == "create":
            if is_admin_role(self.request.user):
                return [IsAuthenticated(), IsAdmin()]
            return [IsAuthenticated(), IsAprendiz()]

        if self.action == "revisar":
            return [IsAuthenticated(), IsAdmin()]

        if self.action in ["update", "partial_update"]:
            if is_admin_role(self.request.user):
                return [IsAuthenticated(), IsAdmin()]
            return [IsAuthenticated(), IsAprendiz()]

        if self.action == "destroy":
            if is_admin_role(self.request.user):
                return [IsAuthenticated(), IsAdmin()]
            return [IsAuthenticated(), IsAprendiz()]

        return [IsAuthenticated()]

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
        if _has_role(request.user, Usuario.Rol.APRENDIZ):
            policy = PolicyService.get_policy(getattr(request.user, "sede_principal", None))
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
            policy = PolicyService.get_policy(getattr(user, "sede_principal", None))
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
            raise ValidationError({"propietario": "Como usuario administrativo debes enviar el propietario (id del aprendiz)."})
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

        if _has_role(user, Usuario.Rol.APRENDIZ):
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
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["iniciar", "finalizar", "actual", "reanudar"]:
            return [IsAuthenticated(), IsGuarda()]
        if self.action == "finalizar_admin":
            return [IsAuthenticated(), IsAdmin()]

        if is_admin_role(self.request.user):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsGuarda()]

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
            turno_activo = Turno.objects.filter(guarda=request.user, activo=True, fin__isnull=True).order_by("-inicio").first()
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
        "update": "acceso.delete",
        "partial_update": "acceso.delete",
        "destroy": "acceso.delete",
        "validar_documento": "acceso.scan",
        "registrar_por_documento": "acceso.scan",
        "stats": "acceso.stats",
        "mis_accesos": "acceso.read",
        "estado": "acceso.read",
    }
    object_permission_map = {
        "retrieve": "acceso.read",
        "update": "acceso.delete",
        "partial_update": "acceso.delete",
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
            raise ValidationError({"equipos": "Salida inválida: debes seleccionar los mismos equipos del último ingreso."})

        if (not ingreso_ids) and equipos_enviados:
            raise ValidationError({"equipos": "Salida inválida: el último ingreso no tenía equipos."})

        if equipos_enviados and ingreso_ids != enviados_ids:
            raise ValidationError({"equipos": "Los equipos en la salida deben coincidir exactamente con los del último ingreso."})

    def create(self, request, *args, **kwargs):
        request_user = request.user
        rol = _effective_role(request_user)

        if rol not in [Usuario.Rol.SUPERADMIN, Usuario.Rol.ADMIN_SEDE, Usuario.Rol.GUARDA]:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para registrar accesos.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        turno = None
        sede = None

        if rol == Usuario.Rol.GUARDA:
            turno = obtener_turno_activo(request_user)
            guarda_sede = getattr(request_user, "sede_principal", None)
            policy = PolicyService.get_policy(turno.sede if turno else guarda_sede)
            if policy.access_requires_active_turno and not turno:
                return error_response(
                    code=ErrorCode.TURNO_REQUIRED,
                    message="Debes iniciar turno antes de registrar accesos.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            sede = turno.sede if turno else guarda_sede
            if not sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="No tienes una sede operativa para registrar accesos.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        elif is_admin_sede(request_user):
            sede = getattr(request_user, "sede_principal", None)
            if not sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Tu usuario ADMIN_SEDE no tiene sede configurada.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        aprendiz = serializer.validated_data["usuario"]
        tipo = serializer.validated_data["tipo"]
        equipos_enviados = serializer.validated_data.get("equipos", [])
        if is_admin_sede(request_user):
            actor_sede = _scope_sede(request_user)
            if _scope_sede(aprendiz) != actor_sede:
                return error_response(
                    code=ErrorCode.PERMISSION_DENIED,
                    message="Solo puedes registrar accesos para aprendices de tu sede.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            return error_response(
                code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                message="Salida sin ingreso previo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if ultimo is not None and ultimo.tipo == tipo:
            return error_response(
                code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                message=f"Doble {tipo}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if tipo == Acceso.Tipo.INGRESO and equipos_enviados:
            self._validar_equipos_ingreso(aprendiz, list(equipos_enviados))

        if tipo == Acceso.Tipo.SALIDA:
            if not ultimo or ultimo.tipo != Acceso.Tipo.INGRESO:
                return error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message="Salida inválida: el último registro no es un ingreso.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            sede = ultimo.sede
            turno = ultimo.turno
            if is_admin_sede(request_user):
                actor_sede = _scope_sede(request_user)
                if getattr(ultimo.sede, "code", None) != actor_sede:
                    return error_response(
                        code=ErrorCode.PERMISSION_DENIED,
                        message="Solo puedes registrar salidas de tu sede.",
                        status_code=status.HTTP_403_FORBIDDEN,
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

        return ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        scope_error = self._ensure_admin_sede_acceso_payload_scope(request.data.copy())
        if scope_error:
            return scope_error
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        scope_error = self._ensure_admin_sede_acceso_payload_scope(request.data.copy())
        if scope_error:
            return scope_error
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="validar_documento")
    def validar_documento(self, request):
        if not _has_role(request.user, Usuario.Rol.GUARDA):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para validar documentos.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        s = ValidarDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        turno = obtener_turno_activo(request.user)
        default_sede = getattr(request.user, "sede_principal", None)
        policy = PolicyService.get_policy(turno.sede if turno else default_sede)
        if policy.access_requires_active_turno and not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="Debes iniciar turno para validar y registrar accesos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        scan_sede = turno.sede if turno else default_sede
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

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()
        estado = "dentro" if (ultimo and ultimo.tipo == Acceso.Tipo.INGRESO) else "fuera"
        equipos_aprobados = Equipo.objects.filter(propietario=aprendiz, estado=Equipo.Estado.APROBADO).order_by("-creado_en")

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
        if not _has_role(request.user, Usuario.Rol.GUARDA):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para registrar accesos por documento.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        s = RegistrarAccesoDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        turno = obtener_turno_activo(request.user)
        default_sede = getattr(request.user, "sede_principal", None)
        policy = PolicyService.get_policy(turno.sede if turno else default_sede)
        if policy.access_requires_active_turno and not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="Debes iniciar turno antes de registrar accesos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        scan_sede = turno.sede if turno else default_sede
        if not scan_sede:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes una sede operativa para registrar accesos.",
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
        tipo = s.validated_data["tipo"]
        equipos_ids = s.validated_data.get("equipos", [])
        equipos = list(Equipo.objects.filter(id__in=equipos_ids)) if equipos_ids else []

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

        ultimo = Acceso.objects.filter(usuario=aprendiz, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            return error_response(
                code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                message="Salida sin ingreso previo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if ultimo is not None and ultimo.tipo == tipo:
            return error_response(
                code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                message=f"Doble {tipo}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if tipo == Acceso.Tipo.INGRESO and equipos:
            self._validar_equipos_ingreso(aprendiz, list(equipos))

        if tipo == Acceso.Tipo.SALIDA:
            if not ultimo or ultimo.tipo != Acceso.Tipo.INGRESO:
                return error_response(
                    code=ErrorCode.ACCESO_INCONSISTENTE_EQUIPO,
                    message="Salida inválida: el último registro no es un ingreso.",
                    status_code=status.HTTP_400_BAD_REQUEST,
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

        return ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        if not _has_role(request.user, Usuario.Rol.GUARDA):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para ver estadisticas de escaneo.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        turno = obtener_turno_activo(request.user)
        default_sede = getattr(request.user, "sede_principal", None)
        policy = PolicyService.get_policy(turno.sede if turno else default_sede)
        if policy.access_requires_active_turno and not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="No tienes turno activo.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"stats": None},
            )
        if not turno:
            return ok_response(
                {
                    "turno": None,
                    "stats": {"ingresos": 0, "salidas": 0, "total": 0},
                }
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
        if not _has_role(request.user, Usuario.Rol.APRENDIZ):
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="Este endpoint es exclusivo para aprendices.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        qs = Acceso.objects.filter(usuario=request.user, is_deleted=False).order_by("-fecha")[:100]
        return Response(AccesoSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="estado")
    def estado(self, request):
        if not _has_role(request.user, Usuario.Rol.APRENDIZ):
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

        ip_limit = bump_with_lock("otp-request-ip", ip_key, OTP_MAX_REQUESTS * 3, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
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

            user_limit = bump_with_lock("otp-request-user", user_key, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
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
            except Exception:
                otp_obj.delete()
                _uniform_response_delay(started)
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
            _webauthn_register_cache_key(user.id, request_id),
            {"challenge": challenge, "nickname": s.validated_data.get("nickname", "")},
            timeout=PASSKEY_REGISTER_CHALLENGE_TTL,
        )

        payload = {
            "request_id": request_id,
            "challenge": challenge,
            "rp": {"name": getattr(settings, "WEBAUTHN_RP_NAME", "SADI"), "id": _resolve_webauthn_rp_id(request)},
            "origin": _resolve_webauthn_origin(request),
            "user": {"id": str(user.id), "name": user.username, "displayName": f"{user.first_name} {user.last_name}".strip() or user.username},
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
        key = _webauthn_register_cache_key(user.id, request_id)
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
            allow_credentials = list(
                user.webauthn_credentials.values("credential_id", "transports")
            )

        request_id = uuid4().hex
        challenge = secrets.token_urlsafe(32)
        cache.set(
            _webauthn_auth_cache_key(request_id),
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
                "rp_id": _resolve_webauthn_rp_id(request),
                "timeout": 60000,
                "allow_credentials": allow_credentials,
                "mock": bool(getattr(settings, "WEBAUTHN_MOCK", True)),
            }
        )


class PasskeyAuthVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasskeyAuthVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        request_id = s.validated_data["request_id"]
        key = _webauthn_auth_cache_key(request_id)
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
        if not _role_allowed_for_expected(_effective_role(user), expected_role):
            return error_response(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Credenciales invalidas para este modulo.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        credential.last_used_at = timezone.now()
        credential.sign_count = int(credential.sign_count or 0) + 1
        credential.save(update_fields=["last_used_at", "sign_count"])
        cache.delete(key)
        tokens = issue_tokens_for_user(user, request=request, rotate_guard_session=True)
        return Response(tokens, status=status.HTTP_200_OK)
