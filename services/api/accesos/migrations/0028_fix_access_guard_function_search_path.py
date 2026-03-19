from django.db import migrations


SET_FUNCTION_SEARCH_PATH_SQL = """
CREATE OR REPLACE FUNCTION accesos_validate_acceso_turno()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;
"""


def set_function_search_path(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(SET_FUNCTION_SEARCH_PATH_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0027_access_invariants_hardening"),
    ]

    operations = [
        migrations.RunPython(set_function_search_path, reverse_code=migrations.RunPython.noop),
    ]
