from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0008_usuario_jornada"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="last_password_change_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="must_change_password",
            field=models.BooleanField(default=False),
        ),
    ]
