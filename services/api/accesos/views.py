from __future__ import annotations

import base64
import io
import re
from uuid import uuid4

import qrcode
from django.db import transaction
from django.db.models import Q
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
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
from .error_codes import ErrorCode
from .import_services import cache_import_payload, get_cached_import_payload, validate_excel
from .models import Acceso, AprendizImportAudit, Equipo, Notificacion, PasswordResetOTP, Turno, Usuario
from .otp_services import (
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS,
    OTP_REQUEST_LOCK_SEC,
    OTP_REQUEST_WINDOW_SEC,
    create_otp_for_user,
    hash_code,
    send_otp,
)
from .permissions import IsAdmin, IsAprendiz, IsGuarda
from .rate_limit import bump_with_lock, get_client_ip, is_locked
from .serializers import (
    AccesoSerializer,
    ChangeInitialPasswordSerializer,
    EquipoRevisionSerializer,
    EquipoSerializer,
    ImportAprendicesConfirmSerializer,
    ImportAprendicesValidateSerializer,
    NotificacionSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PasswordResetVerifySerializer,
    RegistrarAccesoDocumentoSerializer,
    TurnoIniciarSerializer,
    TurnoSerializer,
    UsuarioSerializer,
    ValidarDocumentoSerializer,
)


def obtener_turno_activo(user):
    qs = Turno.objects.filter(guarda=user, activo=True).order_by("-inicio")
    for t in qs[:5]:
        if t.fin is None:
            return t
        t.activo = False
        t.save(update_fields=["activo"])
    return None


def _safe_fin(now, inicio):
    if inicio and now < inicio:
        return inicio
    return now


def _initial_password_from_documento(documento: str, digits: int = 6) -> str:
    doc = (documento or "").strip()
    if len(doc) >= digits:
        return doc[-digits:]
    if len(doc) >= 4:
        return doc[-4:]
    return "1234"


def _build_aprendiz_qr_value(user: Usuario) -> str:
    payload = {
        "typ": "aprendiz_qr",
        "uid": user.id,
        "doc": user.documento,
        "ts": int(timezone.now().timestamp()),
    }
    token = signing.dumps(payload, salt="sadi.aprendiz.qr")
    return f"SADI1:{token}"


def _extract_documento_from_scan(raw_value: str) -> str:
    raw = (raw_value or "").strip()
    if not raw:
        return ""

    if raw.startswith("SADI1:"):
        token = raw[6:]
        data = signing.loads(token, salt="sadi.aprendiz.qr", max_age=60 * 60 * 24 * 365)
        if not isinstance(data, dict) or data.get("typ") != "aprendiz_qr" or not data.get("doc"):
            raise ValidationError({"documento": "QR invalido."})
        return str(data["doc"]).strip()

    digits_only = re.sub(r"[^\d]", "", raw)
    return digits_only or raw


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ok_response({"usuario": UsuarioSerializer(request.user).data})


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
        user.save(update_fields=["password", "must_change_password", "last_password_change_at"])
        return ok_response({"mensaje": "Contrasena actualizada correctamente."})


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

        qr_value = _build_aprendiz_qr_value(user)
        img = qrcode.make(qr_value)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        png_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
        return ok_response(
            {
                "qr_value": qr_value,
                "documento": user.documento,
                "algoritmo": "django-signing+timestamp",
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

        qr_value = _build_aprendiz_qr_value(user)
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


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data["email"]
        channel = s.validated_data.get("channel", PasswordResetOTP.Channel.EMAIL)
        ip = get_client_ip(request)

        user = Usuario.objects.filter(email__iexact=email).first()
        if user:
            k_user = [str(user.id), channel]
            k_ip = [ip, channel]
            if is_locked("otp-request-user", k_user) or is_locked("otp-request-ip", k_ip):
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta más tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            if channel == PasswordResetOTP.Channel.WHATSAPP and not user.telefono:
                return ok_response({"mensaje": "Si el usuario existe, enviamos un código OTP."})

            limit_user = bump_with_lock("otp-request-user", k_user, OTP_MAX_REQUESTS, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            limit_ip = bump_with_lock("otp-request-ip", k_ip, OTP_MAX_REQUESTS * 2, OTP_REQUEST_WINDOW_SEC, OTP_REQUEST_LOCK_SEC)
            if limit_user["locked"] or limit_ip["locked"]:
                return error_response(
                    code=ErrorCode.ACCOUNT_LOCKED_15MIN,
                    message="Demasiadas solicitudes. Intenta más tarde.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            otp_obj, code = create_otp_for_user(user, channel)
            try:
                send_otp(channel, user, code)
            except Exception:
                otp_obj.delete()
                return error_response(
                    code=ErrorCode.NETWORK_ERROR,
                    message="No se pudo enviar el codigo OTP. Verifica la configuracion de correo.",
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        return ok_response({"mensaje": "Si el usuario existe, enviamos un código OTP."})


class PasswordResetVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetVerifySerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data["email"]
        otp = s.validated_data["otp"]
        channel = s.validated_data.get("channel", PasswordResetOTP.Channel.EMAIL)

        user = Usuario.objects.filter(email__iexact=email).first()
        if not user:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=channel)
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


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        email = s.validated_data["email"]
        otp = s.validated_data["otp"]
        new_password = s.validated_data["new_password"]
        channel = s.validated_data.get("channel", PasswordResetOTP.Channel.EMAIL)

        user = Usuario.objects.filter(email__iexact=email).first()
        if not user:
            return error_response(
                code=ErrorCode.OTP_INVALID,
                message="El código OTP no es válido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        otp_obj = (
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=channel)
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
        PasswordResetOTP.objects.filter(user=user, used_at__isnull=True, channel=channel).exclude(id=otp_obj.id).update(
            used_at=timezone.now()
        )

        return ok_response()


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by("id")
    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        qs = super().get_queryset().order_by("id")

        q = (self.request.query_params.get("q") or "").strip()
        rol = (self.request.query_params.get("rol") or "").strip()
        estado = (self.request.query_params.get("estado") or "").strip()
        sede_principal = (self.request.query_params.get("sede_principal") or "").strip()

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
            qs = qs.filter(sede_principal=sede_principal)

        return qs

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
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for row in rows:
                user = Usuario.objects.filter(documento=row["documento"]).first()
                if user:
                    user.first_name = row["first_name"]
                    user.last_name = row["last_name"]
                    user.email = row["email"]
                    user.telefono = row["telefono"]
                    user.sede_principal = row["sede_principal"]
                    user.jornada = row["jornada"]
                    user.programa_formacion = row["programa_formacion"]
                    user.rol = Usuario.Rol.APRENDIZ
                    user.save(
                        update_fields=[
                            "first_name",
                            "last_name",
                            "email",
                            "telefono",
                            "sede_principal",
                            "jornada",
                            "programa_formacion",
                            "rol",
                        ]
                    )
                    updated_count += 1
                else:
                    created = Usuario.objects.create(
                        username=row["documento"],
                        first_name=row["first_name"],
                        last_name=row["last_name"],
                        email=row["email"],
                        telefono=row["telefono"],
                        documento=row["documento"],
                        sede_principal=row["sede_principal"],
                        jornada=row["jornada"],
                        programa_formacion=row["programa_formacion"],
                        rol=Usuario.Rol.APRENDIZ,
                        estado=Usuario.Estado.ACTIVO,
                        must_change_password=True,
                    )
                    created.set_password(_initial_password_from_documento(row["documento"], digits=6))
                    created.save(update_fields=["password"])
                    created_count += 1

            AprendizImportAudit.objects.create(
                imported_by=request.user,
                total_rows=len(rows) + len(errors),
                created_count=created_count,
                updated_count=updated_count,
                errors_count=len(errors),
            )

        return ok_response(
            {
                "created": created_count,
                "updated": updated_count,
                "errors": len(errors),
            }
        )


class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notificacion.objects.all()

    def get_queryset(self):
        user = self.request.user
        rol = getattr(user, "rol", None)

        qs_user = Notificacion.objects.filter(user=user)
        qs_rol = Notificacion.objects.filter(user__isnull=True, rol_objetivo=rol)
        qs_global = Notificacion.objects.filter(user__isnull=True, rol_objetivo__isnull=True)

        return (qs_user | qs_rol | qs_global).distinct().order_by("-created_at")

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["patch"], url_path="leer")
    def leer(self, request, pk=None):
        obj = self.get_object()

        if getattr(request.user, "rol", None) != "admin" and obj.user_id not in [None, request.user.id]:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No autorizado.",
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
        rol = getattr(user, "rol", None)

        if rol == "admin":
            qs = Equipo.objects.all().order_by("-creado_en")
        elif rol == "aprendiz":
            qs = Equipo.objects.filter(propietario=user).order_by("-creado_en")
        else:
            qs = Equipo.objects.none()

        estado = (self.request.query_params.get("estado") or "").strip()
        if estado:
            qs = qs.filter(estado=estado)

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
            rol = getattr(self.request.user, "rol", None)
            if rol == "admin":
                return [IsAuthenticated(), IsAdmin()]
            return [IsAuthenticated(), IsAprendiz()]

        if self.action in ["update", "partial_update", "destroy", "revisar"]:
            return [IsAuthenticated(), IsAdmin()]

        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        rol = getattr(user, "rol", None)

        if rol == "aprendiz":
            serializer.save(propietario=user)
            return

        propietario = serializer.validated_data.get("propietario", None)
        if not propietario:
            raise ValidationError({"propietario": "Como admin debes enviar el propietario (id del aprendiz)."})

        equipo = serializer.save(propietario=propietario)
        equipo.estado = Equipo.Estado.APROBADO
        equipo.motivo_rechazo = None
        equipo.revisado_por = user
        equipo.revisado_en = timezone.now()
        equipo.save()

    @action(detail=True, methods=["patch"], url_path="revisar")
    def revisar(self, request, pk=None):
        equipo = self.get_object()
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

        rol = getattr(self.request.user, "rol", None)
        if rol == "admin":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated(), IsGuarda()]

    def get_queryset(self):
        user = self.request.user
        rol = getattr(user, "rol", None)

        if rol == "admin":
            qs = Turno.objects.all().order_by("-inicio")
        else:
            qs = Turno.objects.filter(guarda=user).order_by("-inicio")

        sede = (self.request.query_params.get("sede") or "").strip()
        if sede:
            qs = qs.filter(sede=sede)

        jornada = (self.request.query_params.get("jornada") or "").strip()
        if jornada:
            qs = qs.filter(jornada=jornada)

        activo = (self.request.query_params.get("activo") or "").strip().lower()
        if activo in ["true", "false"]:
            qs = qs.filter(activo=(activo == "true"))

        return qs

    @action(detail=False, methods=["post"], url_path="iniciar")
    def iniciar(self, request):
        s = TurnoIniciarSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        turno_activo = obtener_turno_activo(request.user)
        if turno_activo:
            return error_response(
                code=ErrorCode.TURNO_ALREADY_ACTIVE,
                message="Ya tienes un turno activo.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"turno": TurnoSerializer(turno_activo).data},
            )

        turno = Turno.objects.create(
            guarda=request.user,
            sede=s.validated_data["sede"],
            jornada=s.validated_data["jornada"],
            inicio=timezone.now(),
            activo=True,
            fin=None,
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
        rol = getattr(user, "rol", None)

        if rol == "guarda" and turno.guarda_id != user.id:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No autorizado.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        qs = Acceso.objects.filter(turno=turno)
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
    permission_classes = [IsAuthenticated]
    queryset = Acceso.objects.all()

    def get_queryset(self):
        user = self.request.user
        rol = getattr(user, "rol", None)

        qs = (
            Acceso.objects.all()
            .select_related("turno", "turno__guarda", "usuario", "registrado_por")
            .prefetch_related("equipos")
            .order_by("-fecha")
        )

        if rol == "admin":
            pass
        elif rol == "guarda":
            qs = qs.filter(turno__guarda=user)
        elif rol == "aprendiz":
            qs = qs.filter(usuario=user)
        else:
            qs = qs.none()

        tipo = (self.request.query_params.get("tipo") or "").strip()
        if tipo:
            qs = qs.filter(tipo=tipo)

        sede = (self.request.query_params.get("sede") or "").strip()
        if sede:
            qs = qs.filter(sede=sede)

        usuario_id = (self.request.query_params.get("usuario") or "").strip()
        if usuario_id.isdigit():
            qs = qs.filter(usuario_id=int(usuario_id))

        reg_id = (self.request.query_params.get("registrado_por") or "").strip()
        if reg_id.isdigit():
            qs = qs.filter(registrado_por_id=int(reg_id))

        date_from = (self.request.query_params.get("date_from") or "").strip()
        if date_from:
            qs = qs.filter(fecha__date__gte=date_from)

        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_to:
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

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            rol = getattr(self.request.user, "rol", None)
            if rol == "admin":
                return [IsAuthenticated(), IsAdmin()]
            return [IsAuthenticated(), IsGuarda()]

        if self.action in ["validar_documento", "registrar_por_documento", "stats"]:
            return [IsAuthenticated(), IsGuarda()]

        if self.action in ["mis_accesos", "estado"]:
            return [IsAuthenticated(), IsAprendiz()]

        return [IsAuthenticated()]

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
        rol = getattr(request_user, "rol", None)

        if rol not in ["admin", "guarda"]:
            return error_response(
                code=ErrorCode.PERMISSION_DENIED,
                message="No tienes permisos para registrar accesos.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        turno = None
        sede = None

        if rol == "guarda":
            turno = obtener_turno_activo(request_user)
            if not turno:
                return error_response(
                    code=ErrorCode.TURNO_REQUIRED,
                    message="Debes iniciar turno antes de registrar accesos.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            sede = turno.sede

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        aprendiz = serializer.validated_data["usuario"]
        tipo = serializer.validated_data["tipo"]
        equipos_enviados = serializer.validated_data.get("equipos", [])

        ultimo = Acceso.objects.filter(usuario=aprendiz).order_by("-fecha").first()

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
            self._validar_salida_equipos_vs_ultimo_ingreso(ultimo, list(equipos_enviados))

        acceso = serializer.save(registrado_por=request_user, turno=turno, sede=sede)
        if equipos_enviados:
            acceso.equipos.set(list(equipos_enviados))

        return ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="validar_documento")
    def validar_documento(self, request):
        s = ValidarDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            documento = _extract_documento_from_scan(s.validated_data["documento"])
        except SignatureExpired:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="QR expirado. Genera uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except (BadSignature, ValidationError):
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="QR o codigo de barras invalido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="Debes iniciar turno para validar y registrar accesos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        aprendiz = Usuario.objects.filter(documento=documento).first()
        if not aprendiz:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Documento no registrado.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if getattr(aprendiz, "rol", None) != Usuario.Rol.APRENDIZ:
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

        ultimo = Acceso.objects.filter(usuario=aprendiz).order_by("-fecha").first()
        estado = "dentro" if (ultimo and ultimo.tipo == Acceso.Tipo.INGRESO) else "fuera"
        equipos_aprobados = Equipo.objects.filter(propietario=aprendiz, estado=Equipo.Estado.APROBADO).order_by("-creado_en")

        return ok_response(
            {
                "estado": estado,
                "aprendiz": UsuarioSerializer(aprendiz).data,
                "equipos": EquipoSerializer(equipos_aprobados, many=True).data,
                "turno": TurnoSerializer(turno).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="registrar_por_documento")
    def registrar_por_documento(self, request):
        s = RegistrarAccesoDocumentoSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        try:
            documento = _extract_documento_from_scan(s.validated_data["documento"])
        except SignatureExpired:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="QR expirado. Genera uno nuevo.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except (BadSignature, ValidationError):
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="QR o codigo de barras invalido.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        tipo = s.validated_data["tipo"]
        equipos_ids = s.validated_data.get("equipos", [])
        equipos = list(Equipo.objects.filter(id__in=equipos_ids)) if equipos_ids else []

        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="Debes iniciar turno antes de registrar accesos.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        aprendiz = Usuario.objects.filter(documento=documento).first()
        if not aprendiz:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="Documento no registrado.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if getattr(aprendiz, "rol", None) != Usuario.Rol.APRENDIZ:
            return error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="El documento no pertenece a un aprendiz.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        ultimo = Acceso.objects.filter(usuario=aprendiz).order_by("-fecha").first()

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
            sede=turno.sede,
            turno=turno,
            registrado_por=request.user,
        )
        if equipos:
            acceso.equipos.set(list(equipos))

        return ok_response({"acceso": AccesoSerializer(acceso).data}, status_code=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        turno = obtener_turno_activo(request.user)
        if not turno:
            return error_response(
                code=ErrorCode.TURNO_REQUIRED,
                message="No tienes turno activo.",
                status_code=status.HTTP_400_BAD_REQUEST,
                extra={"stats": None},
            )

        qs = Acceso.objects.filter(turno=turno)
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
        qs = Acceso.objects.filter(usuario=request.user).order_by("-fecha")[:100]
        return Response(AccesoSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="estado")
    def estado(self, request):
        ultimo = Acceso.objects.filter(usuario=request.user).order_by("-fecha").first()
        estado = "dentro" if (ultimo and ultimo.tipo == Acceso.Tipo.INGRESO) else "fuera"
        return ok_response({"estado": estado})
