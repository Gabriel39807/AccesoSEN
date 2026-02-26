from django.db import migrations


def create_cache_table(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor not in {"postgresql", "sqlite"}:
        return

    with schema_editor.connection.cursor() as cursor:
        if vendor == "postgresql":
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS django_cache (
                    cache_key varchar(255) PRIMARY KEY,
                    value text NOT NULL,
                    expires timestamp with time zone NOT NULL
                );
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS django_cache_expires
                ON django_cache (expires);
                """
            )
            return

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS django_cache (
                cache_key varchar(255) NOT NULL PRIMARY KEY,
                value text NOT NULL,
                expires datetime NOT NULL
            );
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS django_cache_expires
            ON django_cache (expires);
            """
        )


def drop_cache_table(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor not in {"postgresql", "sqlite"}:
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS django_cache;")


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0019_allowedemaildomain_global_policy"),
    ]

    operations = [
        migrations.RunPython(create_cache_table, reverse_code=drop_cache_table),
    ]
