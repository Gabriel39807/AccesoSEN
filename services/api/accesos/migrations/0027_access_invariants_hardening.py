from django.db import migrations


ACCESO_TURNO_GUARDS_SQL = """
CREATE OR REPLACE FUNCTION accesos_validate_acceso_turno()
RETURNS trigger AS $$
DECLARE
    turno_sede_id bigint;
    turno_activo boolean;
    turno_fin timestamp with time zone;
BEGIN
    IF NEW.turno_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT sede_id, activo, fin
      INTO turno_sede_id, turno_activo, turno_fin
      FROM accesos_turno
     WHERE id = NEW.turno_id;

    IF turno_sede_id IS NULL THEN
        RAISE EXCEPTION 'El turno asociado no existe.';
    END IF;

    IF turno_activo IS DISTINCT FROM TRUE OR turno_fin IS NOT NULL THEN
        RAISE EXCEPTION 'El turno asociado no esta activo.';
    END IF;

    IF NEW.sede_id IS NULL THEN
        NEW.sede_id := turno_sede_id;
    ELSIF NEW.sede_id <> turno_sede_id THEN
        RAISE EXCEPTION 'La sede del acceso debe coincidir con la sede del turno.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_acceso_turno ON accesos_acceso;
CREATE TRIGGER trg_validate_acceso_turno
BEFORE INSERT OR UPDATE OF turno_id, sede_id
ON accesos_acceso
FOR EACH ROW
EXECUTE FUNCTION accesos_validate_acceso_turno();
"""


DROP_ACCESO_TURNO_GUARDS_SQL = """
DROP TRIGGER IF EXISTS trg_validate_acceso_turno ON accesos_acceso;
DROP FUNCTION IF EXISTS accesos_validate_acceso_turno();
"""


def create_acceso_turno_guards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(ACCESO_TURNO_GUARDS_SQL)


def drop_acceso_turno_guards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(DROP_ACCESO_TURNO_GUARDS_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0026_branding_presets_and_tenant_config"),
    ]

    operations = [
        migrations.RunPython(create_acceso_turno_guards, reverse_code=drop_acceso_turno_guards),
    ]
