import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0006_turno_turno_fin_gte_inicio_or_null_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="active_session_id",
            field=models.UUIDField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="last_guard_login_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="telefono",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="passwordresetotp",
            name="channel",
            field=models.CharField(
                choices=[("email", "Email"), ("whatsapp", "WhatsApp")],
                default="email",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="AprendizImportAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_count", models.PositiveIntegerField(default=0)),
                ("updated_count", models.PositiveIntegerField(default=0)),
                ("total_rows", models.PositiveIntegerField(default=0)),
                ("errors_count", models.PositiveIntegerField(default=0)),
                (
                    "imported_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="aprendiz_import_audits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
