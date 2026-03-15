from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0021_supabase_rls_hardening"),
    ]

    operations = [
        migrations.AddField(
            model_name="refreshsession",
            name="role_code",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddIndex(
            model_name="refreshsession",
            index=models.Index(fields=["user", "role_code"], name="accesos_ref_user_rol_a1f86f_idx"),
        ),
    ]
