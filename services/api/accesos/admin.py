from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Acceso, Equipo, Turno


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
        "is_staff",
        "is_active",
    )
    list_filter = ("rol", "estado", "is_staff", "is_active")
    search_fields = ("username", "email", "documento", "first_name", "last_name", "programa_formacion", "telefono")

    fieldsets = UserAdmin.fieldsets + (
        ("SADI", {"fields": ("rol", "documento", "sede_principal", "jornada", "programa_formacion", "telefono", "estado")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("SADI", {"fields": ("rol", "documento", "sede_principal", "jornada", "programa_formacion", "telefono", "estado")}),
    )


@admin.register(Acceso)
class AccesoAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "usuario_documento", "tipo", "sede", "fecha", "registrado_por", "turno")
    list_filter = ("tipo", "sede", "fecha")
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
    list_filter = ("sede", "jornada", "activo")
    search_fields = ("guarda__username", "guarda__documento")
    autocomplete_fields = ("guarda",)
