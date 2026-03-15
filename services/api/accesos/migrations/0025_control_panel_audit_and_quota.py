from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0024_control_panel_session"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ControlPanelAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("create", "Create"), ("update", "Update"), ("delete", "Delete")], max_length=20)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("branding", "Branding"),
                            ("domains", "Domains"),
                            ("policies", "Policies"),
                            ("permissions", "Permissions"),
                            ("sede_management", "Sede Management"),
                        ],
                        max_length=40,
                    ),
                ),
                ("target_type", models.CharField(max_length=80)),
                ("target_id", models.CharField(blank=True, default="", max_length=80)),
                ("before_json", models.JSONField(blank=True, null=True)),
                ("after_json", models.JSONField(blank=True, null=True)),
                ("reason", models.TextField()),
                ("ip_address", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="control_panel_audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to="accesos.controlpanelsession",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="ControlPanelQuotaCounter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("branding", "Branding"),
                            ("domains", "Domains"),
                            ("policies", "Policies"),
                            ("permissions", "Permissions"),
                            ("sede_management", "Sede Management"),
                        ],
                        max_length=40,
                    ),
                ),
                ("window_start", models.DateField()),
                ("count", models.PositiveIntegerField(default=0)),
                ("last_action_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="control_panel_quota_counters",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-window_start", "category"],
            },
        ),
        migrations.AddConstraint(
            model_name="controlpanelquotacounter",
            constraint=models.UniqueConstraint(
                fields=("user", "category", "window_start"),
                name="unique_control_panel_quota_window",
            ),
        ),
        migrations.AddIndex(
            model_name="controlpanelauditevent",
            index=models.Index(fields=["category", "created_at"], name="accesos_cpa_cat_fba2ea_idx"),
        ),
        migrations.AddIndex(
            model_name="controlpanelauditevent",
            index=models.Index(fields=["actor", "created_at"], name="accesos_cpa_actor_f0d103_idx"),
        ),
        migrations.AddIndex(
            model_name="controlpanelauditevent",
            index=models.Index(fields=["session", "created_at"], name="accesos_cpa_session_f1a6f4_idx"),
        ),
        migrations.AddIndex(
            model_name="controlpanelquotacounter",
            index=models.Index(fields=["user", "window_start"], name="accesos_cpq_user_52377a_idx"),
        ),
        migrations.AddIndex(
            model_name="controlpanelquotacounter",
            index=models.Index(fields=["category", "window_start"], name="accesos_cpq_cat_b53b4c_idx"),
        ),
    ]
