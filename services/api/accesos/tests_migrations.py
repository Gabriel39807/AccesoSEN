from __future__ import annotations

import importlib

from django.apps import apps as global_apps
from django.db import connection

from .models import Role, UserMembership
from .tests_support import BaseApiTest


class MembershipRuntimeShapeMigrationTests(BaseApiTest):
    def test_normalize_membership_runtime_shapes_merges_inferred_sede_duplicates(self):
        user = self.create_user(
            username="migration_guard",
            password="Passw0rd!",
            rol="guarda",
            sede_principal="sede-1",
            email="migration.guard@sadi.test",
        )
        role_guard = Role.objects.get(code="guarda")
        target = UserMembership.objects.get(user=user, role=role_guard, sede__code="sede-1")
        UserMembership.objects.filter(pk=target.pk).update(
            is_primary=False,
            is_active=False,
            can_switch_sede=False,
        )
        if connection.vendor == "sqlite":
            with connection.cursor() as cursor:
                cursor.execute("DROP TRIGGER IF EXISTS accesos_membership_role_shape_insert;")
                cursor.execute("DROP TRIGGER IF EXISTS accesos_membership_role_shape_update;")
        duplicate = UserMembership.objects.create(
            user=user,
            role=role_guard,
            sede=None,
            is_primary=True,
            is_active=True,
            can_switch_sede=True,
        )

        migration = importlib.import_module("accesos.migrations.0029_membership_runtime_shape_hardening")

        migration.normalize_membership_runtime_shapes(global_apps, None)
        migration.normalize_membership_runtime_shapes(global_apps, None)

        self.assertFalse(UserMembership.objects.filter(pk=duplicate.pk).exists())
        memberships = UserMembership.objects.filter(user=user, role=role_guard)
        self.assertEqual(memberships.count(), 1)
        target.refresh_from_db()
        self.assertEqual(target.sede.code, "sede-1")
        self.assertTrue(target.is_primary)
        self.assertTrue(target.is_active)
        self.assertTrue(target.can_switch_sede)

    def test_normalize_membership_runtime_shapes_skips_unresolved_sede_without_crashing(self):
        user = self.create_user(
            username="migration_orphan",
            password="Passw0rd!",
            rol="aprendiz",
            sede_principal=None,
            email="migration.orphan@sadi.test",
            documento="9988776655",
        )
        role_aprendiz = Role.objects.get(code="aprendiz")

        UserMembership.objects.filter(user=user, role=role_aprendiz).delete()
        if connection.vendor == "sqlite":
            with connection.cursor() as cursor:
                cursor.execute("DROP TRIGGER IF EXISTS accesos_membership_role_shape_insert;")
                cursor.execute("DROP TRIGGER IF EXISTS accesos_membership_role_shape_update;")

        unresolved = UserMembership.objects.create(
            user=user,
            role=role_aprendiz,
            sede=None,
            is_primary=True,
            is_active=True,
            can_switch_sede=False,
        )

        migration = importlib.import_module("accesos.migrations.0029_membership_runtime_shape_hardening")

        with self.assertLogs("accesos.migrations.0029_membership_runtime_shape_hardening", level="WARNING") as captured:
            migration.normalize_membership_runtime_shapes(global_apps, None)

        unresolved.refresh_from_db()
        self.assertIsNone(unresolved.sede_id)
        self.assertTrue(unresolved.is_active)
        self.assertIn("Skipping legacy memberships with unresolved sede", captured.output[0])
