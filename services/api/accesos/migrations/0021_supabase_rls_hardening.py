from django.db import migrations


ROLE_CANDIDATES = ("anon", "authenticated")


def _existing_public_roles(cursor):
    cursor.execute(
        """
        SELECT rolname
        FROM pg_roles
        WHERE rolname IN ('anon', 'authenticated')
        ORDER BY rolname;
        """
    )
    return [row[0] for row in cursor.fetchall()]


def apply_rls_hardening(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    quote_name = schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        roles = _existing_public_roles(cursor)
        if not roles:
            return

        for role in roles:
            cursor.execute(f"REVOKE USAGE ON SCHEMA public FROM {quote_name(role)};")

        cursor.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
            """
        )
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            table_ref = f"public.{quote_name(table)}"
            cursor.execute(f"ALTER TABLE {table_ref} ENABLE ROW LEVEL SECURITY;")
            for role in roles:
                cursor.execute(f"REVOKE ALL ON TABLE {table_ref} FROM {quote_name(role)};")

        cursor.execute(
            """
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
            ORDER BY sequencename;
            """
        )
        sequences = [row[0] for row in cursor.fetchall()]
        for sequence in sequences:
            seq_ref = f"public.{quote_name(sequence)}"
            for role in roles:
                cursor.execute(f"REVOKE ALL ON SEQUENCE {seq_ref} FROM {quote_name(role)};")

        for role in roles:
            role_name = quote_name(role)
            cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {role_name};")
            cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {role_name};")
            cursor.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM {role_name};")


def rollback_rls_hardening(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    quote_name = schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        roles = _existing_public_roles(cursor)
        if not roles:
            return

        for role in roles:
            cursor.execute(f"GRANT USAGE ON SCHEMA public TO {quote_name(role)};")

        cursor.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
            """
        )
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            table_ref = f"public.{quote_name(table)}"
            cursor.execute(f"ALTER TABLE {table_ref} DISABLE ROW LEVEL SECURITY;")


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0020_cache_table_for_database_cache"),
    ]

    operations = [
        migrations.RunPython(apply_rls_hardening, reverse_code=rollback_rls_hardening),
    ]
