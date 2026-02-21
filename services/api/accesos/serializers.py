import re
import secrets

from rest_framework import serializers
from accesos.domain.services.email_domain_service import EmailDomainService
from .models import Sede, Usuario, Acceso, Equipo, Turno
from .models import Notificacion


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

# =========================
# USUARIOS
# =========================
class SedeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sede
        fields = ["id", "code", "name", "is_active", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]


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
        if value and Usuario.objects.filter(email__iexact=value).exclude(id=getattr(self.instance, "id", None)).exists():
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
                    raise serializers.ValidationError({"email": result.message or "Dominio de correo no permitido."})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        auto_password = False

        # Si NO mandan password, por default lo ponemos como los últimos 4 del documento (si existe)
        if password is None:
            doc = (validated_data.get("documento") or "").strip()
            if len(doc) >= 6:
                password = doc[-6:]
            elif len(doc) >= 4:
                password = doc[-4:]
            else:
                password = f"Sadi!{secrets.token_urlsafe(8)[:10]}"
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
                role_code=getattr(user, "rol", Usuario.Rol.APRENDIZ),
                sede=getattr(user, "sede_principal", None),
            )
            if not result.allowed:
                raise serializers.ValidationError(result.message or "Dominio de correo no permitido.")
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
        if getattr(value, "rol", None) != Usuario.Rol.APRENDIZ:
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

    class Meta:
        model = Turno
        fields = ["id", "guarda", "sede", "sede_name", "jornada", "inicio", "fin", "activo"]
        read_only_fields = ["guarda", "inicio", "fin", "activo"]


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

        if getattr(usuario, "rol", None) != Usuario.Rol.APRENDIZ:
            raise serializers.ValidationError({"usuario": "Solo se pueden registrar accesos para aprendices."})

        ultimo = Acceso.objects.filter(usuario=usuario).order_by("-fecha").first()

        if ultimo is None and tipo == Acceso.Tipo.SALIDA:
            raise serializers.ValidationError("No puedes registrar una salida sin una entrada previa.")

        if ultimo is not None and ultimo.tipo == tipo:
            raise serializers.ValidationError(f"No puedes registrar dos '{tipo}' seguidos.")

        return data


class ValidarDocumentoSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=30)

    def validate_documento(self, value):
        value = (value or "").strip()
        if value and not is_numeric_document(value) and not is_signed_scan_token(value):
            raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
        return value


class RegistrarAccesoDocumentoSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=30)
    tipo = serializers.ChoiceField(choices=Acceso.Tipo.choices)
    equipos = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, allow_empty=True)

    def validate_documento(self, value):
        value = (value or "").strip()
        if value and not is_numeric_document(value) and not is_signed_scan_token(value):
            raise serializers.ValidationError("El documento debe tener entre 6 y 10 digitos.")
        return value


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

    def validate_username(self, value):
        return value.strip().lower()


class PasskeyAuthVerifySerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=120)
    challenge = serializers.CharField(max_length=512)
    credential_id = serializers.CharField(max_length=512)
    expected_role = serializers.ChoiceField(choices=["admin", "guarda", "aprendiz"], required=False)

    def validate_credential_id(self, value):
        return value.strip()
