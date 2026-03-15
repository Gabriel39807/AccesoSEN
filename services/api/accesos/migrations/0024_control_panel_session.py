from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from uuid import uuid4


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0023_control_panel_permission_seed"),
    ]

    operations = [
        migrations.CreateModel(
            name="ControlPanelSession",
            fields=[
                ("id", models.UUIDField(default=uuid4, editable=False, primary_key=True, serialize=False)),
                ("verified_by", models.CharField(choices=[("otp", "OTP"), ("passkey", "Passkey")], max_length=20)),
                ("granted_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("ip_address", models.CharField(blank=True, default="", max_length=64)),
                ("user_agent", models.CharField(blank=True, default="", max_length=255)),
                ("scope_snapshot", models.JSONField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="control_panel_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-granted_at"],
            },
        ),
        migrations.AddIndex(
            model_name="controlpanelsession",
            index=models.Index(fields=["user", "expires_at"], name="accesos_con_user_id_43b90d_idx"),
        ),
        migrations.AddIndex(
            model_name="controlpanelsession",
            index=models.Index(fields=["user", "revoked_at"], name="accesos_con_user_id_72dfd9_idx"),
        ),
    ]
