from rest_framework import serializers
from .models import Usuario, Acceso, Equipo, Turno
from .models import Notificacion, PasswordResetOTP
from .otp_services import normalize_phone_e164


def password_policy_errors(password: str) -> list[str]:
    errors: list[str] = []
    if len(password) < 8:
        errors.append("La contrasena debe tener minimo 8 caracteres.")
    if not any(c.isupper() for c in password):
        errors.append("La contrasena debe incluir al menos 1 mayuscula.")
    if not any(c.islower() for c in password):
        errors.append("La contrasena debe incluir al menos 1 minuscula.")
    if not any(c.isdigit() for c in password):
        errors.append("La contrasena debe incluir al menos 1 numero.")
    if all(c.isalnum() for c in password):
        errors.append("La contrasena debe incluir al menos 1 caracter especial.")
    return errors

# =========================
# USUARIOS
# =========================
class UsuarioSerializer(serializers.ModelSerializer):
    # ✅ para crear/editar desde Admin (no se devuelve nunca)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=4)

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
                password = "1234"  # fallback simple (puedes cambiarlo)
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
    class Meta:
        model = Turno
        fields = ["id", "guarda", "sede", "jornada", "inicio", "fin", "activo"]
        read_only_fields = ["guarda", "inicio", "fin", "activo"]


class TurnoIniciarSerializer(serializers.Serializer):
    sede = serializers.ChoiceField(choices=Turno.Sede.choices)
    jornada = serializers.ChoiceField(choices=Turno.Jornada.choices)


# =========================
# ACCESOS
# =========================
class AccesoSerializer(serializers.ModelSerializer):
    equipos = serializers.PrimaryKeyRelatedField(queryset=Equipo.objects.all(), many=True, required=False)

    class Meta:
        model = Acceso
        fields = ["id", "usuario", "fecha", "tipo", "sede", "registrado_por", "turno", "equipos"]
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
        return value.strip()


class RegistrarAccesoDocumentoSerializer(serializers.Serializer):
    documento = serializers.CharField(max_length=30)
    tipo = serializers.ChoiceField(choices=Acceso.Tipo.choices)
    equipos = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, allow_empty=True)

    def validate_documento(self, value):
        return value.strip()


# --- NUEVO: Notificaciones + Password Reset ---


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "titulo", "mensaje", "data", "created_at", "read_at", "rol_objetivo", "user"]
        read_only_fields = ["created_at", "read_at"]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)
    channel = serializers.ChoiceField(
        choices=PasswordResetOTP.Channel.choices,
        default=PasswordResetOTP.Channel.EMAIL,
        required=False,
    )

    def validate_email(self, value):
        return value.strip().lower()

    def validate_telefono(self, value):
        if not value:
            return ""
        return normalize_phone_e164(value)

    def validate(self, attrs):
        channel = attrs.get("channel", PasswordResetOTP.Channel.EMAIL)
        email = (attrs.get("email") or "").strip().lower()
        telefono = (attrs.get("telefono") or "").strip()
        if channel == PasswordResetOTP.Channel.WHATSAPP:
            if not telefono and not email:
                raise serializers.ValidationError({"telefono": "Telefono o correo son obligatorios para WhatsApp."})
        else:
            if not email:
                raise serializers.ValidationError({"email": "El correo es obligatorio para este canal."})
        attrs["email"] = email
        attrs["telefono"] = telefono
        return attrs


class PasswordResetVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)
    otp = serializers.CharField(min_length=5, max_length=5)
    channel = serializers.ChoiceField(
        choices=PasswordResetOTP.Channel.choices,
        default=PasswordResetOTP.Channel.EMAIL,
        required=False,
    )

    def validate_email(self, value):
        return value.strip().lower()

    def validate_telefono(self, value):
        if not value:
            return ""
        return normalize_phone_e164(value)

    def validate_otp(self, value):
        return value.strip()

    def validate(self, attrs):
        channel = attrs.get("channel", PasswordResetOTP.Channel.EMAIL)
        email = (attrs.get("email") or "").strip().lower()
        telefono = (attrs.get("telefono") or "").strip()
        if channel == PasswordResetOTP.Channel.WHATSAPP:
            if not telefono and not email:
                raise serializers.ValidationError({"telefono": "Telefono o correo son obligatorios para WhatsApp."})
        else:
            if not email:
                raise serializers.ValidationError({"email": "El correo es obligatorio para este canal."})
        attrs["email"] = email
        attrs["telefono"] = telefono
        return attrs


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)
    otp = serializers.CharField(min_length=5, max_length=5)
    new_password = serializers.CharField(min_length=8, max_length=128)
    channel = serializers.ChoiceField(
        choices=PasswordResetOTP.Channel.choices,
        default=PasswordResetOTP.Channel.EMAIL,
        required=False,
    )

    def validate_email(self, value):
        return value.strip().lower()

    def validate_telefono(self, value):
        if not value:
            return ""
        return normalize_phone_e164(value)

    def validate_otp(self, value):
        return value.strip()

    def validate_new_password(self, value):
        value = value.strip()
        errors = password_policy_errors(value)
        if errors:
            raise serializers.ValidationError(errors[0])
        return value

    def validate(self, attrs):
        channel = attrs.get("channel", PasswordResetOTP.Channel.EMAIL)
        email = (attrs.get("email") or "").strip().lower()
        telefono = (attrs.get("telefono") or "").strip()
        if channel == PasswordResetOTP.Channel.WHATSAPP:
            if not telefono and not email:
                raise serializers.ValidationError({"telefono": "Telefono o correo son obligatorios para WhatsApp."})
        else:
            if not email:
                raise serializers.ValidationError({"email": "El correo es obligatorio para este canal."})
        attrs["email"] = email
        attrs["telefono"] = telefono
        return attrs


class ImportAprendicesValidateSerializer(serializers.Serializer):
    file = serializers.FileField()


class ImportAprendicesConfirmSerializer(serializers.Serializer):
    import_id = serializers.CharField(max_length=128)


class ChangeInitialPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(min_length=4, max_length=128)
    new_password = serializers.CharField(min_length=8, max_length=128)

    def validate_new_password(self, value):
        value = value.strip()
        errors = password_policy_errors(value)
        if errors:
            raise serializers.ValidationError(errors[0])
        return value
