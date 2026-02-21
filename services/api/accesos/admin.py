from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Acceso, EmailChangeOTP, Equipo, PasswordResetOTP, RefreshSession, Sede, Turno, Usuario, WebAuthnCredential


@admin.register(Sede)
class SedeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "rol",
        "documento",
        "sede_principal",
        "jornada",
        "programa_formacion",
        "telefono",
        "estado",
        "force_password_reset",
        "is_staff",
        "is_active",
    )
    list_filter = ("rol", "estado", "force_password_reset", "is_staff", "is_active")
    search_fields = ("username", "email", "documento", "first_name", "last_name", "programa_formacion", "telefono")

    fieldsets = UserAdmin.fieldsets + (
        (
            "SADI",
            {
                "fields": (
                    "rol",
                    "documento",
                    "sede_principal",
                    "jornada",
                    "programa_formacion",
                    "telefono",
                    "estado",
                    "failed_lockouts_count",
                    "first_lockout_at",
                    "force_password_reset",
                )
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("SADI", {"fields": ("rol", "documento", "sede_principal", "jornada", "programa_formacion", "telefono", "estado")}),
    )


@admin.register(Acceso)
class AccesoAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "usuario_documento", "tipo", "sede", "fecha", "registrado_por", "turno")
    list_filter = ("tipo", "sede__code", "fecha")
    search_fields = ("usuario__username", "usuario__documento", "registrado_por__username")
    autocomplete_fields = ("usuario", "registrado_por", "turno")
    filter_horizontal = ("equipos",)

    def usuario_documento(self, obj):
        return getattr(obj.usuario, "documento", "")
    usuario_documento.short_description = "Documento"


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = ("serial", "propietario", "estado", "marca", "modelo", "creado_en")
    list_filter = ("estado", "marca")
    search_fields = ("serial", "propietario__username", "propietario__documento")
    autocomplete_fields = ("propietario", "revisado_por")


@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = ("guarda", "sede", "jornada", "inicio", "fin", "activo")
    list_filter = ("sede__code", "jornada", "activo")
    search_fields = ("guarda__username", "guarda__documento")
    autocomplete_fields = ("guarda",)


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "channel", "expires_at", "attempts", "used_at", "created_at")
    list_filter = ("channel", "used_at", "expires_at")
    search_fields = ("user__username", "user__email")
    autocomplete_fields = ("user",)


@admin.register(EmailChangeOTP)
class EmailChangeOTPAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "new_email", "expires_at", "attempts", "used_at", "created_at")
    list_filter = ("used_at", "expires_at")
    search_fields = ("user__username", "new_email")
    autocomplete_fields = ("user",)


@admin.register(WebAuthnCredential)
class WebAuthnCredentialAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "credential_id", "sign_count", "created_at", "last_used_at")
    search_fields = ("user__username", "credential_id")
    autocomplete_fields = ("user",)


@admin.register(RefreshSession)
class RefreshSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "device_id", "created_at", "last_used_at", "expires_at", "revoked_at")
    list_filter = ("revoked_at", "expires_at", "created_at")
    search_fields = ("user__username", "user__email", "device_id")
    autocomplete_fields = ("user", "replaced_by")
