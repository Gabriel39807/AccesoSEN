from datetime import timedelta
from uuid import uuid4

from django.utils import timezone
from rest_framework import status

from .import_services import ImportServiceError, execute_aprendices_import
from .models import AllowedEmailDomain, EmailChangeOTP, Role, Usuario
from .otp_services import hash_code
from .tests_support import BaseApiTest


class GlobalAllowedDomainPolicyTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        AllowedEmailDomain.objects.all().delete()
        self.superadmin = self.create_user(
            username="domain_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="domain.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.admin_sede = self.create_user(
            username="domain_admin_sede",
            password="Passw0rd!",
            rol="admin_sede",
            email="domain.admin@sadi.test",
            is_staff=True,
            is_superuser=False,
            sede_principal="sede-1",
        )
        self.aprendiz = self.create_user(
            username="domain_aprendiz",
            password="Passw0rd!",
            rol="aprendiz",
            documento="5050505050",
            email="domain.aprendiz@sadi.test",
            sede_principal="sede-1",
        )

    def _create_global_rule(self, domain: str):
        AllowedEmailDomain.objects.create(
            domain=domain,
            role=None,
            sede=None,
            is_active=True,
            created_by=self.superadmin,
        )

    def _user_payload(self, *, username: str, email: str, documento: str, rol: str = "aprendiz"):
        return {
            "username": username,
            "password": "Passw0rd!",
            "first_name": "Nombre",
            "last_name": "Apellido",
            "email": email,
            "documento": documento,
            "rol": rol,
            "estado": "activo",
            "sede_principal": "sede-1",
        }

    def test_global_rule_enforced_for_user_create_email_change_confirm_and_bulk_import(self):
        self._create_global_rule("empresax.com")

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        allowed_create = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="allowed_domain_user",
                email="allowed@empresax.com",
                documento="6060606060",
            ),
            format="json",
        )
        self.assertEqual(allowed_create.status_code, status.HTTP_201_CREATED, allowed_create.data)

        rejected_create = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="rejected_domain_user",
                email="blocked@gmail.com",
                documento="6161616161",
            ),
            format="json",
        )
        self.assertEqual(rejected_create.status_code, status.HTTP_400_BAD_REQUEST, rejected_create.data)
        self.assertEqual(rejected_create.data.get("code"), "EMAIL_DOMAIN_NOT_ALLOWED")

        self.auth(self.aprendiz.documento, "Passw0rd!", expected_role="aprendiz")
        salt = uuid4().hex
        EmailChangeOTP.objects.create(
            user=self.aprendiz,
            new_email="nuevo@empresax.com",
            salt=salt,
            code_hash=hash_code(salt, "12345"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        confirm_ok = self.client.post(
            "/api/aprendiz/perfil/email-change/confirm/",
            {"new_email": "nuevo@empresax.com", "otp": "12345"},
            format="json",
        )
        self.assertEqual(confirm_ok.status_code, status.HTTP_200_OK, confirm_ok.data)

        salt_blocked = uuid4().hex
        EmailChangeOTP.objects.create(
            user=self.aprendiz,
            new_email="nuevo@gmail.com",
            salt=salt_blocked,
            code_hash=hash_code(salt_blocked, "54321"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        confirm_blocked = self.client.post(
            "/api/aprendiz/perfil/email-change/confirm/",
            {"new_email": "nuevo@gmail.com", "otp": "54321"},
            format="json",
        )
        self.assertEqual(confirm_blocked.status_code, status.HTTP_400_BAD_REQUEST, confirm_blocked.data)
        self.assertEqual(confirm_blocked.data.get("code"), "EMAIL_DOMAIN_NOT_ALLOWED")

        with self.assertRaises(ImportServiceError) as import_exc:
            execute_aprendices_import(
                rows=[
                    {
                        "first_name": "Import",
                        "last_name": "Blocked",
                        "documento": "6262626262",
                        "telefono": "3001234567",
                        "email": "blocked@gmail.com",
                        "jornada": "TARDE",
                        "programa_formacion": "Analisis",
                        "sede_principal": "sede-1",
                    }
                ],
                imported_by=self.superadmin,
                errors=[],
            )
        self.assertEqual(import_exc.exception.code, "EMAIL_DOMAIN_NOT_ALLOWED")

    def test_precedence_role_over_global(self):
        self._create_global_rule("empresax.com")
        role_aprendiz = Role.objects.get(code=Usuario.Rol.APRENDIZ)
        AllowedEmailDomain.objects.create(
            role=role_aprendiz,
            sede=None,
            domain="campus.edu",
            is_active=True,
            created_by=self.superadmin,
        )

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        aprendiz_allowed = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="aprendiz_campus_ok",
                email="ok@campus.edu",
                documento="6363636363",
                rol="aprendiz",
            ),
            format="json",
        )
        self.assertEqual(aprendiz_allowed.status_code, status.HTTP_201_CREATED, aprendiz_allowed.data)

        guarda_rejected = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="guarda_campus_blocked",
                email="blocked@campus.edu",
                documento="6464646464",
                rol="guarda",
            ),
            format="json",
        )
        self.assertEqual(guarda_rejected.status_code, status.HTTP_400_BAD_REQUEST, guarda_rejected.data)
        self.assertEqual(guarda_rejected.data.get("code"), "EMAIL_DOMAIN_NOT_ALLOWED")

    def test_inactive_rule_is_ignored(self):
        AllowedEmailDomain.objects.create(
            role=None,
            sede=None,
            domain="empresax.com",
            is_active=False,
            created_by=self.superadmin,
        )
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="inactive_rule_user",
                email="any@gmail.com",
                documento="6565656565",
            ),
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_empty_policy_allows_any_domain(self):
        AllowedEmailDomain.objects.all().delete()
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            self._user_payload(
                username="empty_policy_user",
                email="anywhere@randomdomain.test",
                documento="6666666661",
            ),
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_duplicate_domain_rule_rejected_with_400(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()
        first = self.client.post(
            "/api/dominios-email/",
            {"domain": "empresax.com", "is_active": True},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Crear dominio permitido"),
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        duplicate = self.client.post(
            "/api/dominios-email/",
            {"domain": "@EMPRESAX.com", "is_active": True},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Intento duplicado"),
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST, duplicate.data)

    def test_non_superadmin_cannot_crud_domain_rules(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        create_denied = self.client.post(
            "/api/dominios-email/",
            {"domain": "empresa.com", "is_active": True},
            format="json",
        )
        self.assertEqual(create_denied.status_code, status.HTTP_403_FORBIDDEN, create_denied.data)

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()
        created = self.client.post(
            "/api/dominios-email/",
            {"domain": "empresa.com", "is_active": True},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Crear dominio cliente"),
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        rule_id = created.data.get("id")

        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        patch_denied = self.client.patch(
            f"/api/dominios-email/{rule_id}/",
            {"is_active": False},
            format="json",
            **self.control_panel_headers(reason="Cambio ilegal"),
        )
        delete_denied = self.client.delete(
            f"/api/dominios-email/{rule_id}/",
            **self.control_panel_headers(reason="Cambio ilegal"),
        )
        self.assertEqual(patch_denied.status_code, status.HTTP_403_FORBIDDEN, patch_denied.data)
        self.assertEqual(delete_denied.status_code, status.HTTP_403_FORBIDDEN, delete_denied.data)
