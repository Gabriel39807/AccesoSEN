import re

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.utils import timezone
from django.db.models import Q, F
from datetime import timedelta
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


HEX_COLOR_VALIDATOR = RegexValidator(
    regex=r"^#[0-9A-Fa-f]{6}$",
    message="El color debe estar en formato hexadecimal #RRGGBB.",
)


class ConfiguracionSistema(models.Model):
    """
    Configuración global de marca blanca para frontend.

    Es un singleton: siempre se guarda con `pk=1`, por lo que solo existe
    un registro activo para toda la plataforma.
    """

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    nombre_institucion = models.CharField(max_length=120, default="Institución")

    color_aprendiz_light = models.CharField(max_length=7, default="#14B8A6", validators=[HEX_COLOR_VALIDATOR])
    color_aprendiz_dark = models.CharField(max_length=7, default="#0F766E", validators=[HEX_COLOR_VALIDATOR])

    color_admin_light = models.CharField(max_length=7, default="#3B82F6", validators=[HEX_COLOR_VALIDATOR])
    color_admin_dark = models.CharField(max_length=7, default="#1E3A8A", validators=[HEX_COLOR_VALIDATOR])

    color_guarda_light = models.CharField(max_length=7, default="#F59E0B", validators=[HEX_COLOR_VALIDATOR])
    color_guarda_dark = models.CharField(max_length=7, default="#B45309", validators=[HEX_COLOR_VALIDATOR])

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración del sistema"
        verbose_name_plural = "Configuración del sistema"

    @classmethod
    def get_solo(cls) -> "ConfiguracionSistema":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        # Fuerza singleton por clave primaria fija.
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Configuración: {self.nombre_institucion}"


class Role(models.Model):
    code = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Permission(models.Model):
    code = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class RolePermission(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = "GLOBAL", "Global"
        SEDE = "SEDE", "Sede"
        OWN = "OWN", "Propio"

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="role_permissions")
    scope = models.CharField(max_length=10, choices=Scope.choices, default=Scope.OWN)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["role__code", "permission__code", "scope"]
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission", "scope"],
                name="uniq_role_permission_scope",
            ),
        ]

    def __str__(self):
        return f"{self.role.code}:{self.permission.code}:{self.scope}"


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


class UserMembership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name="memberships", null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="memberships")
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    can_switch_sede = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "role__code", "sede__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "sede", "role"],
                name="uniq_membership_user_sede_role",
            ),
            models.UniqueConstraint(
                fields=["user", "role"],
                condition=Q(is_primary=True),
                name="uniq_primary_membership_per_user_role",
            ),
        ]

    def __str__(self):
        sede_code = getattr(self.sede, "code", None) or "GLOBAL"
        return f"{self.user_id}:{self.role.code}:{sede_code}"


class SedePolicy(models.Model):
    class QrMode(models.TextChoices):
        PLAIN = "PLAIN", "Plain"
        SIGNED = "SIGNED", "Signed"
        DUAL = "DUAL", "Dual"

    sede = models.OneToOneField(Sede, on_delete=models.CASCADE, related_name="policy")
    max_equipos_aprendiz = models.PositiveIntegerField(default=4)
    guards_can_switch_sede = models.BooleanField(default=False)
    qr_mode = models.CharField(max_length=10, choices=QrMode.choices, default=QrMode.DUAL)
    require_equipo_approval = models.BooleanField(default=True)
    access_requires_active_turno = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sede__code"]

    def __str__(self):
        return f"Policy({self.sede.code})"


class AllowedEmailDomain(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = "GLOBAL", "Global"
        SEDE = "SEDE", "Sede"
        ROLE = "ROLE", "Rol"
        ROLE_SEDE = "ROLE_SEDE", "Rol + sede"

    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="allowed_email_domains",
        null=True,
        blank=True,
    )
    sede = models.ForeignKey(
        Sede,
        on_delete=models.CASCADE,
        related_name="allowed_email_domains",
        null=True,
        blank=True,
    )
    domain = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_allowed_email_domains",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["role__code", "sede__code", "domain"]
        constraints = [
            models.UniqueConstraint(
                fields=["domain"],
                condition=Q(role__isnull=True, sede__isnull=True),
                name="uniq_allowed_domain_global",
            ),
            models.UniqueConstraint(
                fields=["domain", "sede"],
                condition=Q(role__isnull=True, sede__isnull=False),
                name="uniq_allowed_domain_sede",
            ),
            models.UniqueConstraint(
                fields=["domain", "role"],
                condition=Q(role__isnull=False, sede__isnull=True),
                name="uniq_allowed_domain_role",
            ),
            models.UniqueConstraint(
                fields=["domain", "role", "sede"],
                condition=Q(role__isnull=False, sede__isnull=False),
                name="uniq_allowed_domain_role_sede",
            ),
        ]

    def clean(self):
        domain = (self.domain or "").strip().lower().replace("@", "")
        domain_re = re.compile(
            r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
        )
        if not domain_re.fullmatch(domain):
            raise ValidationError(
                {
                    "domain": (
                        "Dominio invalido. Usa solo dominio sin @, por ejemplo: empresa.com."
                    )
                }
            )
        self.domain = domain

    @property
    def scope(self) -> str:
        if self.role_id and self.sede_id:
            return self.Scope.ROLE_SEDE
        if self.role_id and not self.sede_id:
            return self.Scope.ROLE
        if not self.role_id and self.sede_id:
            return self.Scope.SEDE
        return self.Scope.GLOBAL

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        role_code = getattr(self.role, "code", None) or "GLOBAL"
        sede_code = getattr(self.sede, "code", None) or "GLOBAL"
        return f"{role_code}:{sede_code}:{self.domain}"


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

    _ALLOWED_STATE_TRANSITIONS = {
        Estado.PENDIENTE: {Estado.PENDIENTE, Estado.APROBADO, Estado.RECHAZADO},
        Estado.APROBADO: {Estado.APROBADO},
        Estado.RECHAZADO: {Estado.RECHAZADO},
    }

    def clean(self):
        if self.pk:
            previous_estado = (
                type(self).objects.filter(pk=self.pk).values_list("estado", flat=True).first()
            )
            if previous_estado:
                allowed = self._ALLOWED_STATE_TRANSITIONS.get(previous_estado, {previous_estado})
                if self.estado not in allowed:
                    raise ValidationError(
                        {"estado": "Transicion de estado no permitida para este equipo."}
                    )

        if self.estado == self.Estado.RECHAZADO and not (self.motivo_rechazo or "").strip():
            raise ValidationError({"motivo_rechazo": "Debes indicar el motivo de rechazo."})

        if self.estado != self.Estado.RECHAZADO:
            self.motivo_rechazo = None

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

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
    cierre_observacion = models.CharField(max_length=255, blank=True, default="")

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
            models.UniqueConstraint(
                fields=["guarda"],
                condition=Q(activo=True, fin__isnull=True),
                name="unique_active_turno_per_guarda",
            ),
        ]

    @property
    def is_expired(self) -> bool:
        if self.fin is not None or self.inicio is None:
            return False
        return timezone.now() - self.inicio > timedelta(hours=12)

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
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accesos_eliminados",
    )

    def clean(self):
        if self.turno_id:
            if self.turno and not self.turno.activo:
                raise ValidationError({"turno": "El turno asociado no esta activo."})
            if self.sede_id and self.turno and self.turno.sede_id != self.sede_id:
                raise ValidationError({"sede": "La sede del acceso debe coincidir con la sede del turno."})

    def save(self, *args, **kwargs):
        if self.turno_id and not self.sede_id and self.turno:
            self.sede = self.turno.sede
        self.full_clean()
        return super().save(*args, **kwargs)

    def soft_delete(self, *, by_user: Usuario | None = None):
        if self.is_deleted:
            return
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = by_user
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

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
    role_code = models.CharField(max_length=20, blank=True, default="")
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
            models.Index(fields=["user", "role_code"], name="accesos_ref_user_rol_a1f86f_idx"),
            models.Index(fields=["user", "expires_at"]),
            models.Index(fields=["device_id", "expires_at"]),
            models.Index(fields=["revoked_at"]),
        ]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"RefreshSession(user={self.user_id}, device={self.device_id}, active={self.is_active})"


class ControlPanelSession(models.Model):
    class VerifiedBy(models.TextChoices):
        OTP = "otp", "OTP"
        PASSKEY = "passkey", "Passkey"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="control_panel_sessions",
    )
    verified_by = models.CharField(max_length=20, choices=VerifiedBy.choices)
    granted_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=255, blank=True, default="")
    scope_snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-granted_at"]
        indexes = [
            models.Index(fields=["user", "expires_at"], name="accesos_con_user_id_43b90d_idx"),
            models.Index(fields=["user", "revoked_at"], name="accesos_con_user_id_72dfd9_idx"),
        ]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and timezone.now() < self.expires_at

    def __str__(self):
        return f"ControlPanelSession(user={self.user_id}, verified_by={self.verified_by}, active={self.is_active})"


class ControlPanelAuditEvent(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"

    class Category(models.TextChoices):
        BRANDING = "branding", "Branding"
        DOMAINS = "domains", "Domains"
        POLICIES = "policies", "Policies"
        PERMISSIONS = "permissions", "Permissions"
        SEDE_MANAGEMENT = "sede_management", "Sede Management"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="control_panel_audit_events",
    )
    session = models.ForeignKey(
        ControlPanelSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    category = models.CharField(max_length=40, choices=Category.choices)
    target_type = models.CharField(max_length=80)
    target_id = models.CharField(max_length=80, blank=True, default="")
    before_json = models.JSONField(null=True, blank=True)
    after_json = models.JSONField(null=True, blank=True)
    reason = models.TextField()
    ip_address = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category", "created_at"], name="accesos_cpa_cat_fba2ea_idx"),
            models.Index(fields=["actor", "created_at"], name="accesos_cpa_actor_f0d103_idx"),
            models.Index(fields=["session", "created_at"], name="accesos_cpa_session_f1a6f4_idx"),
        ]

    def __str__(self):
        return f"ControlPanelAuditEvent(actor={self.actor_id}, action={self.action}, category={self.category})"


class ControlPanelQuotaCounter(models.Model):
    class Category(models.TextChoices):
        BRANDING = "branding", "Branding"
        DOMAINS = "domains", "Domains"
        POLICIES = "policies", "Policies"
        PERMISSIONS = "permissions", "Permissions"
        SEDE_MANAGEMENT = "sede_management", "Sede Management"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="control_panel_quota_counters",
    )
    category = models.CharField(max_length=40, choices=Category.choices)
    window_start = models.DateField()
    count = models.PositiveIntegerField(default=0)
    last_action_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-window_start", "category"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "category", "window_start"],
                name="unique_control_panel_quota_window",
            )
        ]
        indexes = [
            models.Index(fields=["user", "window_start"], name="accesos_cpq_user_52377a_idx"),
            models.Index(fields=["category", "window_start"], name="accesos_cpq_cat_b53b4c_idx"),
        ]

    def __str__(self):
        return (
            f"ControlPanelQuotaCounter(user={self.user_id}, category={self.category}, "
            f"window_start={self.window_start}, count={self.count})"
        )


class BrandingPreset(models.Model):
    slug = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=80)
    tokens_json = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            BrandingPreset.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)

    def __str__(self):
        return f"BrandingPreset({self.slug})"


class TenantBrandingConfig(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    branding_preset = models.ForeignKey(
        BrandingPreset,
        on_delete=models.PROTECT,
        related_name="tenant_configs",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_branding_updates",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant branding config"
        verbose_name_plural = "Tenant branding config"

    @classmethod
    def get_solo(cls):
        preset = BrandingPreset.objects.filter(is_default=True, is_active=True).order_by("name").first()
        if preset is None:
            preset = BrandingPreset.objects.filter(is_active=True).order_by("name").first()
        if preset is None:
            preset = BrandingPreset.objects.create(
                slug="sadi-default",
                name="SADI Default",
                is_active=True,
                is_default=True,
                tokens_json={
                    "color_aprendiz_light": "#14B8A6",
                    "color_aprendiz_dark": "#0F766E",
                    "color_admin_light": "#3B82F6",
                    "color_admin_dark": "#1E3A8A",
                    "color_guarda_light": "#F59E0B",
                    "color_guarda_dark": "#B45309",
                },
            )
        obj, _ = cls.objects.get_or_create(pk=1, defaults={"branding_preset": preset})
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"TenantBrandingConfig(preset={self.branding_preset_id})"


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
