from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


PRESETS = [
    {
        "slug": "sadi-classic",
        "name": "SADI Classic",
        "is_default": True,
        "tokens_json": {
            "color_aprendiz_light": "#14B8A6",
            "color_aprendiz_dark": "#0F766E",
            "color_admin_light": "#3B82F6",
            "color_admin_dark": "#1E3A8A",
            "color_guarda_light": "#F59E0B",
            "color_guarda_dark": "#B45309",
        },
    },
    {
        "slug": "forest-campus",
        "name": "Forest Campus",
        "is_default": False,
        "tokens_json": {
            "color_aprendiz_light": "#22C55E",
            "color_aprendiz_dark": "#166534",
            "color_admin_light": "#0EA5E9",
            "color_admin_dark": "#075985",
            "color_guarda_light": "#F97316",
            "color_guarda_dark": "#9A3412",
        },
    },
    {
        "slug": "sunset-grid",
        "name": "Sunset Grid",
        "is_default": False,
        "tokens_json": {
            "color_aprendiz_light": "#06B6D4",
            "color_aprendiz_dark": "#155E75",
            "color_admin_light": "#EF4444",
            "color_admin_dark": "#991B1B",
            "color_guarda_light": "#EAB308",
            "color_guarda_dark": "#854D0E",
        },
    },
]


def seed_branding_presets(apps, schema_editor):
    BrandingPreset = apps.get_model("accesos", "BrandingPreset")
    ConfiguracionSistema = apps.get_model("accesos", "ConfiguracionSistema")
    TenantBrandingConfig = apps.get_model("accesos", "TenantBrandingConfig")

    preset_map = {}
    for preset_data in PRESETS:
        preset, _ = BrandingPreset.objects.get_or_create(
            slug=preset_data["slug"],
            defaults={
                "name": preset_data["name"],
                "tokens_json": preset_data["tokens_json"],
                "is_active": True,
                "is_default": preset_data["is_default"],
            },
        )
        preset_map[preset.slug] = preset

    if BrandingPreset.objects.filter(is_default=True).count() == 0:
        default_preset = preset_map["sadi-classic"]
        default_preset.is_default = True
        default_preset.save(update_fields=["is_default"])

    default_preset = BrandingPreset.objects.filter(is_default=True).first() or preset_map["sadi-classic"]
    config, _ = ConfiguracionSistema.objects.get_or_create(pk=1)
    for key, value in default_preset.tokens_json.items():
        setattr(config, key, value)
    config.save()

    TenantBrandingConfig.objects.get_or_create(pk=1, defaults={"branding_preset": default_preset})


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0025_control_panel_audit_and_quota"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BrandingPreset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=80)),
                ("tokens_json", models.JSONField(default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="TenantBrandingConfig",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "branding_preset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="tenant_configs",
                        to="accesos.brandingpreset",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tenant_branding_updates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Tenant branding config",
                "verbose_name_plural": "Tenant branding config",
            },
        ),
        migrations.RunPython(seed_branding_presets, reverse_code=noop_reverse),
    ]
