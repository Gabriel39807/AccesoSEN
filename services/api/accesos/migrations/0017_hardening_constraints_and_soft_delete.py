from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


MAX_EQUIPOS_TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION accesos_check_max_equipos()
RETURNS trigger AS $$
BEGIN
    IF NEW.propietario_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF (SELECT COUNT(*) FROM accesos_equipo WHERE propietario_id = NEW.propietario_id) >= 4 THEN
            RAISE EXCEPTION 'No se pueden registrar mas de 4 equipos por aprendiz.';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.propietario_id <> OLD.propietario_id THEN
            IF (SELECT COUNT(*) FROM accesos_equipo WHERE propietario_id = NEW.propietario_id) >= 4 THEN
                RAISE EXCEPTION 'No se pueden registrar mas de 4 equipos por aprendiz.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_max_equipos ON accesos_equipo;
CREATE TRIGGER trg_check_max_equipos
BEFORE INSERT OR UPDATE OF propietario_id
ON accesos_equipo
FOR EACH ROW
EXECUTE FUNCTION accesos_check_max_equipos();
"""


DROP_MAX_EQUIPOS_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS trg_check_max_equipos ON accesos_equipo;
DROP FUNCTION IF EXISTS accesos_check_max_equipos();
"""


def create_max_equipos_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(MAX_EQUIPOS_TRIGGER_SQL)


def drop_max_equipos_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(DROP_MAX_EQUIPOS_TRIGGER_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0016_configuracionsistema"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="acceso",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="acceso",
            name="deleted_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="accesos_eliminados",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="acceso",
            name="is_deleted",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddConstraint(
            model_name="turno",
            constraint=models.UniqueConstraint(
                condition=Q(activo=True, fin__isnull=True),
                fields=("guarda",),
                name="unique_active_turno_per_guarda",
            ),
        ),
        migrations.RunPython(create_max_equipos_trigger, reverse_code=drop_max_equipos_trigger),
    ]
