from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accesos", "0007_usuario_session_fields_passwordresetotp_channel_and_importaudit"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="jornada",
            field=models.CharField(
                blank=True,
                choices=[("MANANA", "Manana"), ("TARDE", "Tarde"), ("NOCHE", "Noche")],
                max_length=20,
                null=True,
            ),
        ),
    ]
