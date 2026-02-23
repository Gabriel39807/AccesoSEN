from django.conf import settings
from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0018_acceso_delete_permission_seed"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="allowedemaildomain",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="created_allowed_email_domains",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="allowedemaildomain",
            name="updated_at",
            field=models.DateTimeField(default=timezone.now),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="allowedemaildomain",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name="allowedemaildomain",
            name="role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name="allowed_email_domains",
                to="accesos.role",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="allowedemaildomain",
            name="uniq_allowed_domain_role_sede_domain",
        ),
        migrations.AddConstraint(
            model_name="allowedemaildomain",
            constraint=models.UniqueConstraint(
                condition=Q(role__isnull=True, sede__isnull=True),
                fields=("domain",),
                name="uniq_allowed_domain_global",
            ),
        ),
        migrations.AddConstraint(
            model_name="allowedemaildomain",
            constraint=models.UniqueConstraint(
                condition=Q(role__isnull=True, sede__isnull=False),
                fields=("domain", "sede"),
                name="uniq_allowed_domain_sede",
            ),
        ),
        migrations.AddConstraint(
            model_name="allowedemaildomain",
            constraint=models.UniqueConstraint(
                condition=Q(role__isnull=False, sede__isnull=True),
                fields=("domain", "role"),
                name="uniq_allowed_domain_role",
            ),
        ),
        migrations.AddConstraint(
            model_name="allowedemaildomain",
            constraint=models.UniqueConstraint(
                condition=Q(role__isnull=False, sede__isnull=False),
                fields=("domain", "role", "sede"),
                name="uniq_allowed_domain_role_sede",
            ),
        ),
    ]
