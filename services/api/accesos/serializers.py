import re
import secrets

from django.conf import settings
from rest_framework import serializers
from accesos.domain.services.email_domain_service import EmailDomainService
from accesos.domain.services.authorization import AuthorizationService
from accesos.domain.services.policy_service import PolicyService
from .error_codes import ErrorCode
from .models import (
    Acceso,
    AllowedEmailDomain,
    BrandingPreset,
    ConfiguracionSistema,
    Equipo,
    Notificacion,
    Permission as RbacPermission,
    Role,
    RolePermission,
    Sede,
    SedePolicy,
    TenantBrandingConfig,
    Turno,
    Usuario,
)


def password_policy_errors(password: str) -> list[str]:
    errors: list[str] = []
    if len(password) < 8:
        errors.append("La contraseña debe tener minimo 8 caracteres.")
    if not any(c.isupper() for c in password):
        errors.append("La contraseña debe incluir al menos 1 mayuscula.")
    if not any(c.islower() for c in password):
        errors.append("La contraseña debe incluir al menos 1 minuscula.")
    if not any(c.isdigit() for c in password):
        errors.append("La contraseña debe incluir al menos 1 numero.")
    if all(c.isalnum() for c in password):
        errors.append("La contraseña debe incluir al menos 1 caracter especial.")
    return errors


PHONE_10_RE = re.compile(r"^\d{10}$")
DOCUMENT_6_TO_10_RE = re.compile(r"^\d{6,10}$")
SCANNED_DOCUMENT_MAX_LEN = 512


def validatePhone10(value, *, required: bool = False) -> str:
    raw = "" if value is None else str(value)
    clean = raw.strip()
    if not clean:
        if required:
            raise serializers.ValidationError("El telefono debe tener exactamente 10 digitos.")
        return ""
    if not PHONE_10_RE.fullmatch(clean):
        raise serializers.ValidationError("El telefono debe tener exactamente 10 digitos.")
    return clean


def validateDocument6to10(value, *, required: bool = False) -> str:
    raw = "" if value is None else str(value)
    clean = raw.strip()
    if not clean:
        if required:
            raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
        return ""
    if not DOCUMENT_6_TO_10_RE.fullmatch(clean):
        raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
    return clean


def normalize_phone(value: str) -> str:
    return validatePhone10(value, required=False)


def is_numeric_document(value: str) -> bool:
    try:
        validateDocument6to10(value, required=True)
    except serializers.ValidationError:
        return False
    return True


def is_signed_scan_token(value: str) -> bool:
    value = (value or "").strip().upper()
    return value.startswith("SADI1:") or value.startswith("SADI1B64:")


def user_has_role(user: Usuario | None, role_code: str) -> bool:
    if not user:
        return False
    return role_code in AuthorizationService.role_codes(user)


def _raise_domain_policy_error(*, field: str, message: str):
    raise serializers.ValidationError(
        {
            field: [message],
            "code": ErrorCode.EMAIL_DOMAIN_NOT_ALLOWED,
        }
    )


# =========================
# USUARIOS
# =========================
class SedeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sede
        fields = ["id", "code", "name", "is_active", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name", "is_system", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_code(self, value):
        clean = (value or "").strip().lower()
        if not clean:
            raise serializers.ValidationError("Debes indicar el codigo del rol.")
        return clean


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RbacPermission
        fields = ["id", "code", "name", "description", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_code(self, value):
        clean = (value or "").strip().lower()
        if not clean:
            raise serializers.ValidationError("Debes indicar el codigo del permiso.")
        return clean


class RolePermissionSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(slug_field="code", queryset=Role.objects.all())
    permission = serializers.SlugRelatedField(slug_field="code", queryset=RbacPermission.objects.all())
    role_name = serializers.CharField(source="role.name", read_only=True)
    permission_name = serializers.CharField(source="permission.name", read_only=True)

    class Meta:
        model = RolePermission
        fields = ["id", "role", "role_name", "permission", "permission_name", "scope", "created_at"]
        read_only_fields = ["id", "created_at", "role_name", "permission_name"]


class AllowedEmailDomainSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Role.objects.all(),
        allow_null=True,
        required=False,
    )
    sede = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Sede.objects.all(),
        allow_null=True,
        required=False,
    )
    scope = serializers.SerializerMethodField(read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    sede_name = serializers.CharField(source="sede.name", read_only=True, allow_null=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True, allow_null=True)

    class Meta:
        model = AllowedEmailDomain
        fields = [
            "id",
            "domain",
            "scope",
            "role",
            "role_name",
            "sede",
            "sede_name",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "role_name", "sede_name", "scope", "created_by"]
        validators = []

    def validate_domain(self, value):
        clean = EmailDomainService.normalize_domain(value)
        if not clean or "." not in clean:
            raise serializers.ValidationError("Debes indicar un dominio valido, por ejemplo empresa.com.")
        if " " in clean:
            raise serializers.ValidationError("El dominio no puede contener espacios.")
        domain_re = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
        if not domain_re.fullmatch(clean):
            raise serializers.ValidationError("Dominio invalido. Usa formato tipo empresa.com.")
        return clean

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = attrs.get("role", getattr(self.instance, "role", None))
        sede = attrs.get("sede", getattr(self.instance, "sede", None))
        domain = attrs.get("domain", getattr(self.instance, "domain", None))
        if not domain:
            raise serializers.ValidationError({"domain": "Debes indicar un dominio."})

        qs = AllowedEmailDomain.objects.filter(domain=domain, role=role, sede=sede)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({"domain": "Ya existe una regla para ese dominio con el mismo alcance."})
        return attrs

    def get_scope(self, obj):
        return getattr(obj, "scope", AllowedEmailDomain.Scope.GLOBAL)


class SedePolicySerializer(serializers.ModelSerializer):
    sede = serializers.SlugRelatedField(slug_field="code", queryset=Sede.objects.all())
    sede_name = serializers.CharField(source="sede.name", read_only=True)

    class Meta:
        model = SedePolicy
        fields = [
            "id",
            "sede",
            "sede_name",
            "max_equipos_aprendiz",
            "guards_can_switch_sede",
            "qr_mode",
            "require_equipo_approval",
            "access_requires_active_turno",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "sede_name"]

    @staticmethod
    def _is_production() -> bool:
        return str(getattr(settings, "CURRENT_DJANGO_ENV", "development") or "").strip().lower() == "production"

    def _apply_canonical_policy(self, validated_data: dict):
        validated_data["max_equipos_aprendiz"] = 4
        validated_data["access_requires_active_turno"] = True
        if self._is_production():
            validated_data["qr_mode"] = SedePolicy.QrMode.SIGNED
        return validated_data

    def validate_max_equipos_aprendiz(self, value):
        if int(value or 0) != 4:
            raise serializers.ValidationError("La politica aprobada fija el maximo en 4 equipos por aprendiz.")
        return 4

    def validate_access_requires_active_turno(self, value):
        if value is not True:
            raise serializers.ValidationError("El flujo operativo siempre requiere turno activo.")
        return True

    def validate_qr_mode(self, value):
        normalized = str(value or SedePolicy.QrMode.SIGNED).strip().upper()
        if self._is_production() and normalized != SedePolicy.QrMode.SIGNED:
            raise serializers.ValidationError("En produccion solo se permite QR firmado (SIGNED).")
        return normalized

    def create(self, validated_data):
        return super().create(self._apply_canonical_policy(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_canonical_policy(validated_data))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        effective = PolicyService.get_policy(instance.sede)
        data["max_equipos_aprendiz"] = effective.max_equipos_aprendiz
        data["qr_mode"] = effective.qr_mode
        data["access_requires_active_turno"] = effective.access_requires_active_turno
        return data


class ConfiguracionSistemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionSistema
        fields = [
            "nombre_institucion",
            "color_aprendiz_light",
            "color_aprendiz_dark",
            "color_admin_light",
            "color_admin_dark",
            "color_guarda_light",
            "color_guarda_dark",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class BrandingPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandingPreset
        fields = ["id", "slug", "name", "tokens_json", "is_active", "is_default", "created_at"]
        read_only_fields = ["id", "created_at"]


class TenantBrandingConfigSerializer(serializers.ModelSerializer):
    branding_preset = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    branding_preset_name = serializers.CharField(source="branding_preset.name", read_only=True)
    tokens = serializers.SerializerMethodField()
    updated_by = serializers.CharField(source="updated_by.username", read_only=True, allow_null=True)

    class Meta:
        model = TenantBrandingConfig
        fields = [
            "branding_preset",
            "branding_preset_name",
            "tokens",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = fields

    def get_tokens(self, obj):
        return dict(getattr(getattr(obj, "branding_preset", None), "tokens_json", {}) or {})


class TenantBrandingConfigUpdateSerializer(serializers.Serializer):
    branding_preset = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=BrandingPreset.objects.filter(is_active=True),
    )


class UsuarioSerializer(serializers.ModelSerializer):
    # ✅ para crear/editar desde Admin (no se devuelve nunca)
    username = serializers.CharField(required=True, allow_blank=False, max_length=150)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=8, max_length=20)
    sede_principal = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Sede.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Usuario
        fields = [
            "id",
            "username",
            "email",
            "password",  # ✅
            "rol",
            "first_name",
            "last_name",
            "documento",
            "estado",
            "sede_principal",
            "jornada",
            "programa_formacion",
            "telefono",
            "must_change_password",
        ]
        read_only_fields = ["must_change_password"]

    def validate_email(self, value):
        value = (value or "").strip().lower()
        if (
            value
            and Usuario.objects.filter(email__iexact=value).exclude(id=getattr(self.instance, "id", None)).exists()
        ):
            raise serializers.ValidationError("El correo ya esta registrado.")
        return value

    def validate_username(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Debes escribir un nombre de usuario.")
        if not re.match(r"^[A-Za-z0-9_@.+-]+$", value):
            raise serializers.ValidationError(
                "El nombre de usuario solo permite letras, numeros y los simbolos _ @ . + -"
            )
        if Usuario.objects.filter(username__iexact=value).exclude(id=getattr(self.instance, "id", None)).exists():
            raise serializers.ValidationError("Este nombre de usuario ya esta en uso.")
        return value

    def validate_documento(self, value):
        return validateDocument6to10(value, required=False)

    def validate_telefono(self, value):
        return validatePhone10(value, required=False)

    def validate(self, attrs):
        role_code = attrs.get("rol") or getattr(self.instance, "rol", None) or Usuario.Rol.APRENDIZ
        sede = attrs.get("sede_principal")
        if sede is None:
            sede = getattr(self.instance, "sede_principal", None)

        if "email" in attrs:
            email = attrs.get("email")
            if email:
                result = EmailDomainService.validate(
                    email=email,
                    role_code=role_code,
                    sede=sede,
                )
                if not result.allowed:
                    _raise_domain_policy_error(
                        field="email",
                        message=result.message or "Dominio de correo no permitido.",
                    )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        auto_password = False

        # Si NO mandan password, por default lo ponemos como los últimos 4 del documento (si existe)
        if password is None:
            password = secrets.token_urlsafe(18)
            auto_password = True

        user = Usuario(**validated_data)
        user.set_password(password)
        user.must_change_password = auto_password
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # si mandan password en PATCH/PUT, lo cambia
        if password:
            instance.set_password(password)

        instance.save()
        return instance


class AprendizPerfilSerializer(serializers.ModelSerializer):
    sede_principal = serializers.SlugRelatedField(slug_field="code", read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "documento",
            "rol",
            "estado",
            "sede_principal",
            "jornada",
            "programa_formacion",
            "telefono",
            "must_change_password",
            "force_password_reset",
        ]


class AprendizPerfilUpdateSerializer(serializers.Serializer):
    telefono = serializers.CharField(required=True, allow_blank=False, max_length=10)

    def validate_telefono(self, value):
        return validatePhone10(value, required=True)

    def validate(self, attrs):
        if "telefono" not in attrs:
            raise serializers.ValidationError({"telefono": "Debes enviar el telefono."})
        return attrs


class AprendizEmailChangeRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()

    def validate_new_email(self, value):
        value = value.strip().lower()
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if user and getattr(user, "is_authenticated", False):
            result = EmailDomainService.validate(
                email=value,
                role_code=AuthorizationService.default_role_for_user(user) or Usuario.Rol.APRENDIZ,
                sede=AuthorizationService.default_sede(user),
            )
            if not result.allowed:
                _raise_domain_policy_error(
                    field="new_email",
                    message=result.message or "Dominio de correo no permitido.",
                )
        return value


class AprendizEmailChangeConfirmSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
    otp = serializers.CharField(min_length=5, max_length=5)

    def validate_new_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        return value.strip()


# =========================
# EQUIPOS
# =========================
class EquipoSerializer(serializers.ModelSerializer):
    # ✅ Para que admin pueda setear propietario (si lo manda)
    # - si NO lo manda, intentamos tomar request.user (aprendiz creando su equipo)
    propietario = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Equipo
        fields = [
            "id",
            "propietario",
            "serial",
            "marca",
            "modelo",
            "estado",
            "motivo_rechazo",
            "revisado_por",
            "revisado_en",
            "creado_en",
        ]
        # 👇 OJO: si tu backend setea estado automáticamente según rol, déjalo read_only
        read_only_fields = ["estado", "motivo_rechazo", "revisado_por", "revisado_en", "creado_en"]

    def validate_propietario(self, value):
        if value is None:
            return value
        # opcional: solo aprendices pueden ser propietarios
        if not user_has_role(value, Usuario.Rol.APRENDIZ):
            raise serializers.ValidationError("El propietario del equipo debe ser un aprendiz.")
        return value

    def create(self, validated_data):
        # si no mandan propietario, usamos el usuario autenticado (modo aprendiz)
        if not validated_data.get("propietario"):
            req = self.context.get("request")
            if req and req.user and req.user.is_authenticated:
                validated_data["propietario"] = req.user
            else:
                raise serializers.ValidationError({"propietario": "Este campo es obligatorio."})

        return super().create(validated_data)


class EquipoRevisionSerializer(serializers.Serializer):
    # para aprobar/rechazar desde admin
    estado = serializers.ChoiceField(choices=[Equipo.Estado.APROBADO, Equipo.Estado.RECHAZADO])
    motivo_rechazo = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)


# =========================
# TURNOS
# =========================
class TurnoSerializer(serializers.ModelSerializer):
    sede = serializers.SlugRelatedField(slug_field="code", queryset=Sede.objects.filter(is_active=True))
    sede_name = serializers.CharField(source="sede.name", read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Turno
        fields = [
            "id",
            "guarda",
            "sede",
            "sede_name",
            "jornada",
            "inicio",
            "fin",
            "activo",
            "cierre_observacion",
            "is_expired",
        ]
        read_only_fields = ["guarda", "inicio", "fin", "activo", "cierre_observacion", "is_expired"]


class TurnoIniciarSerializer(serializers.Serializer):
    sede = serializers.SlugRelatedField(slug_field="code", queryset=Sede.objects.filter(is_active=True))
    jornada = serializers.ChoiceField(choices=Turno.Jornada.choices)


# =========================
# ACCESOS
# =========================
class AccesoSerializer(serializers.ModelSerializer):
    equipos = serializers.PrimaryKeyRelatedField(queryset=Equipo.objects.all(), many=True, required=False)
    sede = serializers.SlugRelatedField(slug_field="code", read_only=True)
    sede_name = serializers.CharField(source="sede.name", read_only=True)

    class Meta:
        model = Acceso
        fields = ["id", "usuario", "fecha", "tipo", "sede", "sede_name", "registrado_por", "turno", "equipos"]
        read_only_fields = ["fecha", "sede", "registrado_por", "turno"]

    def validate(self, data):
        usuario = data.get("usuario")
        tipo = data.get("tipo")

        if usuario is None:
            raise serializers.ValidationError({"usuario": "Este campo es obligatorio."})

        if not user_has_role(usuario, Usuario.Rol.APRENDIZ):
            raise serializers.ValidationError({"usuario": "Solo se pueden registrar accesos para aprendices."})

        ultimo = Acceso.objects.filter(usuario=usuario, is_deleted=False).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            raise serializers.ValidationError("No puedes registrar una salida sin una entrada previa.")

        if ultimo is not None and ultimo.tipo == tipo:
            raise serializers.ValidationError(f"No puedes registrar dos '{tipo}' seguidos.")

        return data


class ValidarDocumentoSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=SCANNED_DOCUMENT_MAX_LEN)

    def validate_documento(self, value):
        value = (value or "").strip()
        if value and not is_numeric_document(value) and not is_signed_scan_token(value):
            raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
        return value


class RegistrarAccesoDocumentoSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=SCANNED_DOCUMENT_MAX_LEN)
    tipo = serializers.ChoiceField(choices=Acceso.Tipo.choices)
    equipos = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, allow_empty=True)

    def validate_documento(self, value):
        value = (value or "").strip()
        if value and not is_numeric_document(value) and not is_signed_scan_token(value):
            raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
        return value


class RegistrarAccesoContingenciaSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=30)
    tipo = serializers.ChoiceField(choices=Acceso.Tipo.choices)
    equipos = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, allow_empty=True)
    sede = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Sede.objects.all(),
        required=False,
        allow_null=True,
    )
    motivo = serializers.CharField(max_length=255)

    def validate_documento(self, value):
        return validateDocument6to10(value, required=True)

    def validate_motivo(self, value):
        clean = str(value or "").strip()
        if not clean:
            raise serializers.ValidationError("Debes indicar el motivo de la contingencia.")
        return clean


# --- NUEVO: Notificaciones + Password Reset ---


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "titulo", "mensaje", "data", "created_at", "read_at", "rol_objetivo", "user"]
        read_only_fields = ["created_at", "read_at"]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(min_length=5, max_length=5)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        return value.strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(min_length=5, max_length=5)
    new_password = serializers.CharField(min_length=8, max_length=20)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_otp(self, value):
        return value.strip()

    def validate_new_password(self, value):
        value = value.strip()
        if len(value) > 20:
            raise serializers.ValidationError("La contrasena debe tener maximo 20 caracteres.")
        errors = password_policy_errors(value)
        if errors:
            raise serializers.ValidationError(errors[0])
        return value


class ImportAprendicesValidateSerializer(serializers.Serializer):
    file = serializers.FileField()


class ImportAprendicesConfirmSerializer(serializers.Serializer):
    import_id = serializers.CharField(max_length=128)
    allow_skip_file_duplicates = serializers.BooleanField(required=False, default=False)
    row_numbers = serializers.ListField(
        child=serializers.IntegerField(min_value=2),
        required=False,
        allow_empty=False,
    )


class ChangeInitialPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(min_length=4, max_length=20)
    new_password = serializers.CharField(min_length=8, max_length=20)

    def validate_new_password(self, value):
        value = value.strip()
        errors = password_policy_errors(value)
        if errors:
            raise serializers.ValidationError(errors[0])
        return value


class PasskeyRegisterOptionsSerializer(serializers.Serializer):
    nickname = serializers.CharField(required=False, allow_blank=True, max_length=120)


class PasskeyRegisterVerifySerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=120)
    challenge = serializers.CharField(max_length=512)
    credential_id = serializers.CharField(max_length=512)
    public_key = serializers.CharField(required=False, allow_blank=True)
    sign_count = serializers.IntegerField(required=False, min_value=0)
    transports = serializers.ListField(
        child=serializers.CharField(max_length=40),
        required=False,
        allow_empty=True,
    )
    aaguid = serializers.CharField(required=False, allow_blank=True, max_length=64)
    nickname = serializers.CharField(required=False, allow_blank=True, max_length=120)

    def validate_credential_id(self, value):
        return value.strip()


class PasskeyAuthOptionsSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)
    auth_transport = serializers.ChoiceField(choices=["cookie"], required=False)

    def validate_username(self, value):
        return value.strip().lower()


class PasskeyAuthVerifySerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=120)
    challenge = serializers.CharField(max_length=512)
    credential_id = serializers.CharField(max_length=512)
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)
    auth_transport = serializers.ChoiceField(choices=["cookie"], required=False)

    def validate_credential_id(self, value):
        return value.strip()


class ControlPanelSessionOtpVerifySerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=120)
    otp = serializers.CharField(min_length=5, max_length=5)

    def validate_otp(self, value):
        return value.strip()


class ControlPanelSessionPasskeyVerifySerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=120)
    challenge = serializers.CharField(max_length=512)
    credential_id = serializers.CharField(max_length=512)

    def validate_credential_id(self, value):
        return value.strip()


class GeminiStubSerializer(serializers.Serializer):
    prompt = serializers.CharField(min_length=1, max_length=3000)
    temperature = serializers.FloatField(required=False, min_value=0.0, max_value=2.0, default=0.2)

    def validate_prompt(self, value):
        clean = (value or "").strip()
        if not clean:
            raise serializers.ValidationError("El prompt no puede estar vacio.")
        return clean
