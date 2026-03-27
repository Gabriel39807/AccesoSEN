import re
import unicodedata

from django.db import migrations, models


PROGRAM_PERMISSIONS = [
    ("control_panel.programs.read", "Ver programas aceptados del panel"),
    ("control_panel.programs.update", "Actualizar programas aceptados del panel"),
]


def normalize_program_name(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_value).strip().lower()


def seed_program_permissions_and_catalog(apps, schema_editor):
    Permission = apps.get_model("accesos", "Permission")
    Role = apps.get_model("accesos", "Role")
    RolePermission = apps.get_model("accesos", "RolePermission")
    ProgramaFormacion = apps.get_model("accesos", "ProgramaFormacion")
    Usuario = apps.get_model("accesos", "Usuario")

    permission_objects = {}
    for code, name in PROGRAM_PERMISSIONS:
        perm, _ = Permission.objects.get_or_create(code=code, defaults={"name": name, "description": ""})
        permission_objects[code] = perm

    superadmin = Role.objects.filter(code="superadmin").first()
    if superadmin:
        for perm_code in ["control_panel.programs.read", "control_panel.programs.update"]:
            perm = permission_objects.get(perm_code) or Permission.objects.filter(code=perm_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=superadmin, permission=perm, scope="GLOBAL")

    seen: set[str] = set()
    for raw_name in (
        Usuario.objects.exclude(programa_formacion__isnull=True)
        .exclude(programa_formacion__exact="")
        .values_list("programa_formacion", flat=True)
    ):
        clean_name = re.sub(r"\s+", " ", str(raw_name or "")).strip()
        normalized = normalize_program_name(clean_name)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ProgramaFormacion.objects.get_or_create(
            normalized_name=normalized,
            defaults={"name": clean_name, "is_active": True},
        )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0031_sqlite_equipo_hard_cap_triggers"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProgramaFormacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("normalized_name", models.CharField(editable=False, max_length=120, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="created_programas_formacion",
                        to="accesos.usuario",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="updated_programas_formacion",
                        to="accesos.usuario",
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.RunPython(seed_program_permissions_and_catalog, reverse_code=noop_reverse),
    ]
