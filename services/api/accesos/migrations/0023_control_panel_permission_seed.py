from django.db import migrations


PERMISSIONS = [
    ("control_panel.read", "Ver panel de control"),
    ("control_panel.session.open", "Abrir sesion reforzada del panel de control"),
    ("control_panel.audit.read", "Ver auditoria del panel de control"),
    ("control_panel.branding.read", "Ver configuracion de branding"),
    ("control_panel.branding.update", "Actualizar configuracion de branding"),
    ("control_panel.domains.read", "Ver dominios permitidos del panel"),
    ("control_panel.domains.update", "Actualizar dominios permitidos del panel"),
    ("control_panel.policies.read", "Ver politicas del panel"),
    ("control_panel.policies.update", "Actualizar politicas del panel"),
    ("control_panel.permissions.read", "Ver permisos y asignaciones del panel"),
    ("control_panel.permissions.update", "Actualizar permisos y asignaciones del panel"),
    ("control_panel.limits.read", "Ver limites del panel"),
    ("control_panel.limits.update", "Actualizar limites del panel"),
]

SUPERADMIN_ASSIGNMENTS = [
    ("control_panel.read", "GLOBAL"),
    ("control_panel.session.open", "GLOBAL"),
    ("control_panel.audit.read", "GLOBAL"),
    ("control_panel.branding.read", "GLOBAL"),
    ("control_panel.branding.update", "GLOBAL"),
    ("control_panel.domains.read", "GLOBAL"),
    ("control_panel.domains.update", "GLOBAL"),
    ("control_panel.policies.read", "GLOBAL"),
    ("control_panel.policies.update", "GLOBAL"),
    ("control_panel.permissions.read", "GLOBAL"),
    ("control_panel.permissions.update", "GLOBAL"),
    ("control_panel.limits.read", "GLOBAL"),
    ("control_panel.limits.update", "GLOBAL"),
]


def seed_control_panel_permissions(apps, schema_editor):
    Permission = apps.get_model("accesos", "Permission")
    Role = apps.get_model("accesos", "Role")
    RolePermission = apps.get_model("accesos", "RolePermission")

    permission_objects = {}
    for code, name in PERMISSIONS:
        perm, _ = Permission.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": ""},
        )
        permission_objects[code] = perm

    superadmin = Role.objects.filter(code="superadmin").first()
    if not superadmin:
        return

    for perm_code, scope in SUPERADMIN_ASSIGNMENTS:
        perm = permission_objects.get(perm_code) or Permission.objects.filter(code=perm_code).first()
        if not perm:
            continue
        RolePermission.objects.get_or_create(
            role=superadmin,
            permission=perm,
            scope=scope,
        )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):
    dependencies = [
        ("accesos", "0022_refreshsession_role_code"),
    ]

    operations = [
        migrations.RunPython(seed_control_panel_permissions, reverse_code=noop_reverse),
    ]
