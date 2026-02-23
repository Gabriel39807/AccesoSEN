from django.db import migrations


def seed_acceso_delete_permission(apps, schema_editor):
    Permission = apps.get_model("accesos", "Permission")
    Role = apps.get_model("accesos", "Role")
    RolePermission = apps.get_model("accesos", "RolePermission")

    perm, _ = Permission.objects.get_or_create(
        code="acceso.delete",
        defaults={
            "name": "Eliminar accesos",
            "description": "Permite baja logica (soft delete) de registros de acceso.",
        },
    )

    for role_code, scope in (("superadmin", "GLOBAL"), ("admin_sede", "SEDE")):
        role = Role.objects.filter(code=role_code).first()
        if not role:
            continue
        RolePermission.objects.get_or_create(
            role=role,
            permission=perm,
            scope=scope,
        )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0017_hardening_constraints_and_soft_delete"),
    ]

    operations = [
        migrations.RunPython(seed_acceso_delete_permission, reverse_code=noop_reverse),
    ]
