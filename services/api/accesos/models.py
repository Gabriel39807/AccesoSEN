from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import Q, F
from uuid import uuid4


class Sede(models.Model):
    code = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        ADMIN_SEDE = "admin_sede", "Admin de sede"
        GUARDA = "guarda", "Guarda"
        APRENDIZ = "aprendiz", "Aprendiz"

    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.APRENDIZ)
    sede_principal = models.ForeignKey(
        Sede,
        on_delete=models.SET_NULL,
        related_name="usuarios",
        null=True,
        blank=True,
    )

    programa_formacion = models.CharField(max_length=100, null=True, blank=True)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    class Jornada(models.TextChoices):
        MAÑANA = "MAÑANA", "MAÑANA"
        TARDE = "TARDE", "Tarde"
        NOCHE = "NOCHE", "Noche"

    jornada = models.CharField(max_length=20, choices=Jornada.choices, null=True, blank=True)

    # QR / código de barras = número de documento
    documento = models.CharField(max_length=30, unique=True, null=True, blank=True)

    class Estado(models.TextChoices):
        ACTIVO = "activo", "Activo"
        BLOQUEADO = "bloqueado", "Bloqueado"

    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.ACTIVO)
    active_session_id = models.UUIDField(null=True, blank=True, default=None)
    last_guard_login_at = models.DateTimeField(null=True, blank=True)
    must_change_password = models.BooleanField(default=False)
    last_password_change_at = models.DateTimeField(null=True, blank=True)
    failed_lockouts_count = models.PositiveIntegerField(default=0)
    first_lockout_at = models.DateTimeField(null=True, blank=True)
    force_password_reset = models.BooleanField(default=False)


class Equipo(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADO = "aprobado", "Aprobado"
        RECHAZADO = "rechazado", "Rechazado"

    propietario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="equipos")
    serial = models.CharField(max_length=100, unique=True)
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=100)

    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    revisado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name="equipos_revisados"
    )
    revisado_en = models.DateTimeField(null=True, blank=True)
    motivo_rechazo = models.CharField(max_length=255, null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.serial} - {self.marca} {self.modelo} ({self.estado})"


class Turno(models.Model):
    class Jornada(models.TextChoices):
        MAÑANA = "MAÑANA", "Mañana"
        TARDE = "TARDE", "Tarde"
        NOCHE = "NOCHE", "Noche"

    guarda = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="turnos")
    sede = models.ForeignKey(Sede, on_delete=models.PROTECT, related_name="turnos")
    jornada = models.CharField(max_length=20, choices=Jornada.choices)

    # ✅ más controlable que auto_now_add
    inicio = models.DateTimeField(default=timezone.now)
    fin = models.DateTimeField(null=True, blank=True)

    activo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(fin__isnull=True) | Q(fin__gte=F("inicio")),
                name="turno_fin_gte_inicio_or_null",
            ),
            models.CheckConstraint(
                condition=(Q(activo=True, fin__isnull=True) | Q(activo=False, fin__isnull=False)),
                name="turno_activo_fin_coherente",
            ),
        ]

        
    def __str__(self):
        sede_label = self.sede.name if self.sede_id else "Sin sede"
        return f"Turno {self.guarda.username} - {sede_label} - {self.jornada} ({'activo' if self.activo else 'finalizado'})"


class Acceso(models.Model):
    class Tipo(models.TextChoices):
        INGRESO = "ingreso", "Ingreso"
        SALIDA = "salida", "Salida"

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="accesos")
    fecha = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=10, choices=Tipo.choices)

    # auditoría / contexto
    registrado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name="accesos_registrados"
    )
    turno = models.ForeignKey(Turno, on_delete=models.SET_NULL, null=True, blank=True, related_name="accesos")
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, null=True, blank=True, related_name="accesos")

    equipos = models.ManyToManyField(Equipo, blank=True, related_name="accesos")

    def __str__(self):
        return f"{self.usuario.username} - {self.tipo} - {self.fecha}"


class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        INFO = "INFO", "Info"
        WARNING = "WARNING", "Warning"
        URGENT = "URGENT", "Urgent"

    # Puede ser para un usuario específico (user) o para un rol (rol_objetivo)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificaciones",
        null=True,
        blank=True,
    )

    rol_objetivo = models.CharField(
        max_length=20,
        choices=Usuario.Rol.choices,
        null=True,
        blank=True,
        help_text="Si es null, aplica a todos los roles (si user también es null, es global).",
    )

    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.INFO)
    titulo = models.CharField(max_length=120)
    mensaje = models.TextField()
    data = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        target = self.user_id if self.user_id else (self.rol_objetivo or "ALL")
        return f"[{self.tipo}] {self.titulo} -> {target}"


class PasswordResetOTP(models.Model):
    """
    OTP de 6 dígitos para recuperación de contraseña.
    Guardamos hash (no OTP plano), expiración, intentos y uso.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_otps",
    )

    salt = models.CharField(max_length=64)
    code_hash = models.CharField(max_length=128)

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"

    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.EMAIL)

    expires_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "expires_at"]),
        ]
        ordering = ["-created_at"]

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def __str__(self):
        return f"OTP(user={self.user_id}, exp={self.expires_at}, used={bool(self.used_at)})"


class EmailChangeOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_change_otps",
    )
    new_email = models.EmailField()
    salt = models.CharField(max_length=64)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "new_email", "expires_at"])]
        ordering = ["-created_at"]

    def __str__(self):
        return f"EmailChangeOTP(user={self.user_id}, new_email={self.new_email}, used={bool(self.used_at)})"


class WebAuthnCredential(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="webauthn_credentials",
    )
    credential_id = models.CharField(max_length=512, unique=True)
    public_key = models.TextField(blank=True, default="")
    sign_count = models.PositiveIntegerField(default=0)
    transports = models.JSONField(null=True, blank=True)
    aaguid = models.CharField(max_length=64, blank=True, default="")
    nickname = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"WebAuthnCredential(user={self.user_id}, credential_id={self.credential_id[:20]})"


class RefreshSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="refresh_sessions",
    )
    device_id = models.CharField(max_length=128)
    refresh_token_hash = models.CharField(max_length=128, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    replaced_by = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replaces",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "device_id"]),
            models.Index(fields=["user", "expires_at"]),
            models.Index(fields=["device_id", "expires_at"]),
            models.Index(fields=["revoked_at"]),
        ]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"RefreshSession(user={self.user_id}, device={self.device_id}, active={self.is_active})"


class AprendizImportAudit(models.Model):
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="aprendiz_import_audits",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    total_rows = models.PositiveIntegerField(default=0)
    errors_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ImportAudit(by={self.imported_by_id}, created={self.created_count}, updated={self.updated_count})"
