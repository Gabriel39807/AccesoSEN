from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.test import APITestCase

from accesos.domain.services.qr_service import QRParseError, QRService
from .exceptions import ui_exception_handler
from .import_services import ImportServiceError, execute_aprendices_import
from .models import (
    Acceso,
    AprendizImportAudit,
    AllowedEmailDomain,
    ConfiguracionSistema,
    EmailChangeOTP,
    Equipo,
    PasswordResetOTP,
    RefreshSession,
    Role,
    Sede,
    SedePolicy,
    Turno,
    UserMembership,
    WebAuthnCredential,
)
from .otp_services import hash_code


class BaseApiTest(APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.User = get_user_model()
        self.seed_sedes()

    def seed_sedes(self):
        rows = [
            ("sede-1", "Sede 1"),
            ("sede-2", "Sede 2"),
            ("sede-3", "Sede 3"),
            ("sede-4", "Sede 4"),
        ]
        for code, name in rows:
            Sede.objects.get_or_create(code=code, defaults={"name": name, "is_active": True})

    def sede(self, code: str) -> Sede:
        sede, _ = Sede.objects.get_or_create(code=code, defaults={"name": code.upper(), "is_active": True})
        return sede

    def create_user(self, **kwargs):
        sede_value = kwargs.pop("sede_principal", "sede-1")
        if isinstance(sede_value, Sede):
            sede = sede_value
        elif sede_value:
            sede = self.sede(str(sede_value))
        else:
            sede = None
        defaults = {
            "username": kwargs.pop("username", f"user_{timezone.now().timestamp()}"),
            "password": kwargs.pop("password", "Passw0rd!"),
            "rol": kwargs.pop("rol", "aprendiz"),
            "estado": kwargs.pop("estado", "activo"),
            "email": kwargs.pop("email", None),
            "documento": kwargs.pop("documento", None),
            "sede_principal": sede,
        }
        user = self.User.objects.create_user(**defaults, **kwargs)
        return user

    def auth(self, username: str, password: str, expected_role: str | None = None):
        payload = {"username": username, "password": password}
        if expected_role:
            payload["expected_role"] = expected_role
        r = self.client.post(reverse("token_obtain_pair"), payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return r


class HealthEndpointsTests(BaseApiTest):
    def test_health_endpoint_is_available(self):
        r = self.client.get("/health/")
        body = r.json()
        self.assertEqual(r.status_code, status.HTTP_200_OK, body)
        self.assertEqual(body.get("status"), "ok")

    def test_ready_endpoint_is_available(self):
        r = self.client.get("/ready/")
        body = r.json()
        self.assertIn(r.status_code, [status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE], body)
        self.assertIn("checks", body)


class ConfiguracionSistemaEndpointTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superuser = self.create_user(
            username="cfg_super",
            password="Passw0rd!",
            rol="superadmin",
            email="cfg.super@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.admin_sede = self.create_user(
            username="cfg_admin",
            password="Passw0rd!",
            rol="admin_sede",
            email="cfg.admin@sadi.test",
            is_staff=True,
            is_superuser=False,
            sede_principal="sede-1",
        )

    def test_public_get_returns_singleton_payload(self):
        r = self.client.get("/api/configuracion/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data.get("permitido"))
        payload = r.data.get("configuracion", {})
        self.assertEqual(payload.get("nombre_institucion"), "Institución")
        self.assertIn("color_aprendiz_light", payload)

    def test_put_requires_superuser(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        denied = self.client.put("/api/configuracion/", {"nombre_institucion": "Institucion X"}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

        self.auth(self.superuser.username, "Passw0rd!", expected_role="admin")
        ok = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "Institucion X", "color_admin_light": "#123ABC"},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.assertEqual(ok.data["configuracion"]["nombre_institucion"], "Institucion X")
        self.assertEqual(ok.data["configuracion"]["color_admin_light"], "#123ABC")
        self.assertEqual(ConfiguracionSistema.objects.count(), 1)


class LoginAndLockTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="1010101010",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1010101010",
            email="aprendiz.lock@sadi.test",
        )

    def test_lock_response_contains_countdown(self):
        for _ in range(4):
            r = self.client.post(
                reverse("token_obtain_pair"),
                {"username": self.aprendiz.username, "password": "bad-pass", "expected_role": "aprendiz"},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

        r = self.client.post(
            reverse("token_obtain_pair"),
            {"username": self.aprendiz.username, "password": "bad-pass", "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_423_LOCKED, r.data)
        self.assertEqual(r.data["code"], "ACCOUNT_LOCKED_15MIN")
        self.assertGreater(int(r.data.get("detail", {}).get("seconds_remaining", 0)), 0)

    def test_force_password_reset_blocks_login(self):
        self.aprendiz.force_password_reset = True
        self.aprendiz.save(update_fields=["force_password_reset"])

        r = self.client.post(
            reverse("token_obtain_pair"),
            {"username": self.aprendiz.username, "password": "Passw0rd!", "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data["code"], "PASSWORD_RESET_REQUIRED")

    def test_expected_role_mismatch_rejected(self):
        r = self.client.post(
            reverse("token_obtain_pair"),
            {"username": self.aprendiz.username, "password": "Passw0rd!", "expected_role": "admin"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED, r.data)
        self.assertEqual(r.data["code"], "INVALID_CREDENTIALS")

    def test_aprendiz_login_rejects_document_shorter_than_six_digits(self):
        short_doc_user = self.create_user(
            username="short_doc_user",
            password="Passw0rd!",
            rol="aprendiz",
            documento="12345",
            email="short.doc@sadi.test",
        )
        r = self.client.post(
            reverse("token_obtain_pair"),
            {"username": short_doc_user.documento, "password": "Passw0rd!", "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED, r.data)
        self.assertEqual(r.data["code"], "INVALID_CREDENTIALS")

    def test_aprendiz_can_login_with_documento_when_username_is_text(self):
        mixed_user = self.create_user(
            username="aprendiz_test_1",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1112223334",
            email="aprendiz.documento@sadi.test",
        )
        r = self.client.post(
            reverse("token_obtain_pair"),
            {"username": mixed_user.documento, "password": "Passw0rd!", "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIn("access", r.data)


class RefreshSessionFlowTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="7171717171",
            password="Passw0rd!",
            rol="aprendiz",
            documento="7171717171",
            email="refresh.session@sadi.test",
        )
        self.guarda = self.create_user(
            username="7272727272",
            password="Passw0rd!",
            rol="guarda",
            documento="7272727272",
            email="refresh.guarda@sadi.test",
            sede_principal="sede-1",
        )

    def _auth_login(self, *, user: str, password: str, role: str, device_id: str):
        return self.client.post(
            "/api/auth/login/",
            {
                "username": user,
                "password": password,
                "expected_role": role,
                "device_id": device_id,
            },
            format="json",
        )

    def test_login_creates_refresh_session(self):
        r = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-001",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)

        session = RefreshSession.objects.filter(
            user=self.aprendiz,
            device_id="device-aprendiz-001",
            revoked_at__isnull=True,
        ).first()
        self.assertIsNotNone(session)
        self.assertNotEqual(session.refresh_token_hash, r.data["refresh"])

    def test_refresh_rotates_token_and_old_token_fails(self):
        login = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-002",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        first_refresh = login.data["refresh"]

        rotate = self.client.post(
            "/api/auth/refresh/",
            {"refresh": first_refresh, "device_id": "device-aprendiz-002"},
            format="json",
        )
        self.assertEqual(rotate.status_code, status.HTTP_200_OK, rotate.data)
        self.assertIn("access", rotate.data)
        self.assertIn("refresh", rotate.data)
        self.assertNotEqual(first_refresh, rotate.data["refresh"])

        old_again = self.client.post(
            "/api/auth/refresh/",
            {"refresh": first_refresh, "device_id": "device-aprendiz-002"},
            format="json",
        )
        self.assertEqual(old_again.status_code, status.HTTP_401_UNAUTHORIZED, old_again.data)

    def test_legacy_token_refresh_route_still_works(self):
        login = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-legacy",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        legacy_refresh = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"], "device_id": "device-aprendiz-legacy"},
            format="json",
        )
        self.assertEqual(legacy_refresh.status_code, status.HTTP_200_OK, legacy_refresh.data)
        self.assertIn("access", legacy_refresh.data)
        self.assertIn("refresh", legacy_refresh.data)

    def test_refresh_without_device_id_keeps_legacy_compatibility(self):
        login = self.client.post(
            "/api/token/",
            {
                "username": self.aprendiz.username,
                "password": "Passw0rd!",
                "expected_role": "aprendiz",
            },
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        refresh = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh.status_code, status.HTTP_200_OK, refresh.data)
        self.assertIn("access", refresh.data)

    def test_refresh_expired_or_revoked_fails(self):
        login = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-003",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        refresh = login.data["refresh"]
        session = RefreshSession.objects.filter(user=self.aprendiz, device_id="device-aprendiz-003").first()
        self.assertIsNotNone(session)

        session.expires_at = timezone.now() - timedelta(minutes=1)
        session.save(update_fields=["expires_at"])

        r = self.client.post(
            "/api/auth/refresh/",
            {"refresh": refresh, "device_id": "device-aprendiz-003"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED, r.data)

    def test_logout_revokes_session_and_refresh_fails(self):
        login = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-004",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        access = login.data["access"]
        refresh = login.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout = self.client.post("/api/auth/logout/", {"device_id": "device-aprendiz-004"}, format="json")
        self.assertEqual(logout.status_code, status.HTTP_200_OK, logout.data)
        self.assertGreaterEqual(int(logout.data.get("revoked_sessions", 0)), 1)

        self.client.credentials()
        r = self.client.post(
            "/api/auth/refresh/",
            {"refresh": refresh, "device_id": "device-aprendiz-004"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED, r.data)

    def test_logout_all_revokes_all_active_sessions(self):
        first = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-a",
        )
        second = self._auth_login(
            user=self.aprendiz.username,
            password="Passw0rd!",
            role="aprendiz",
            device_id="device-aprendiz-b",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {second.data['access']}")
        logout_all = self.client.post("/api/auth/logout-all/", format="json")
        self.assertEqual(logout_all.status_code, status.HTTP_200_OK, logout_all.data)
        self.assertGreaterEqual(int(logout_all.data.get("revoked_sessions", 0)), 2)

        self.client.credentials()
        old_1 = self.client.post(
            "/api/auth/refresh/",
            {"refresh": first.data["refresh"], "device_id": "device-aprendiz-a"},
            format="json",
        )
        old_2 = self.client.post(
            "/api/auth/refresh/",
            {"refresh": second.data["refresh"], "device_id": "device-aprendiz-b"},
            format="json",
        )
        self.assertEqual(old_1.status_code, status.HTTP_401_UNAUTHORIZED, old_1.data)
        self.assertEqual(old_2.status_code, status.HTTP_401_UNAUTHORIZED, old_2.data)

    def test_guarda_new_device_revokes_previous_session(self):
        first = self._auth_login(
            user=self.guarda.username,
            password="Passw0rd!",
            role="guarda",
            device_id="device-guarda-001",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)

        second = self._auth_login(
            user=self.guarda.username,
            password="Passw0rd!",
            role="guarda",
            device_id="device-guarda-002",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)

        old_refresh = self.client.post(
            "/api/auth/refresh/",
            {"refresh": first.data["refresh"], "device_id": "device-guarda-001"},
            format="json",
        )
        self.assertEqual(old_refresh.status_code, status.HTTP_401_UNAUTHORIZED, old_refresh.data)

        active = RefreshSession.objects.filter(user=self.guarda, revoked_at__isnull=True).count()
        self.assertEqual(active, 1)


class PasswordResetOtpTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="2020202020",
            password="Passw0rd!",
            rol="aprendiz",
            documento="2020202020",
            email="recover@sadi.test",
        )

    def _seed_otp(self, code: str = "12345"):
        salt = "abc123salt"
        return PasswordResetOTP.objects.create(
            user=self.user,
            salt=salt,
            code_hash=hash_code(salt, code),
            expires_at=timezone.now() + timedelta(minutes=5),
            channel=PasswordResetOTP.Channel.EMAIL,
        )

    def test_request_does_not_reveal_user_existence(self):
        r1 = self.client.post("/api/auth/password-reset/request/", {"email": "recover@sadi.test"}, format="json")
        r2 = self.client.post("/api/auth/password-reset/request/", {"email": "unknown@sadi.test"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_200_OK, r2.data)
        self.assertEqual(r1.data.get("mensaje"), r2.data.get("mensaje"))

    def test_verify_and_confirm_password_reset(self):
        self._seed_otp(code="12345")

        vr = self.client.post(
            "/api/auth/password-reset/verify/",
            {"email": "recover@sadi.test", "otp": "12345"},
            format="json",
        )
        self.assertEqual(vr.status_code, status.HTTP_200_OK, vr.data)

        self.user.force_password_reset = True
        self.user.save(update_fields=["force_password_reset"])

        cr = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"email": "recover@sadi.test", "otp": "12345", "new_password": "NewPassw0rd!"},
            format="json",
        )
        self.assertEqual(cr.status_code, status.HTTP_200_OK, cr.data)
        self.user.refresh_from_db()
        self.assertFalse(self.user.force_password_reset)
        self.assertTrue(self.user.check_password("NewPassw0rd!"))


class EquipoRulesTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="3030303030",
            password="Passw0rd!",
            rol="aprendiz",
            documento="3030303030",
            email="equipos@sadi.test",
        )
        self.superadmin = self.create_user(
            username="superadmin_test",
            password="Passw0rd!",
            rol="superadmin",
            email="superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )

    def _auth_aprendiz(self):
        self.auth(self.aprendiz.documento, "Passw0rd!", expected_role="aprendiz")

    def _auth_superadmin(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

    def test_aprendiz_cannot_register_more_than_four_equipment(self):
        self._auth_aprendiz()
        for i in range(4):
            r = self.client.post(
                "/api/equipos/",
                {"serial": f"SER-{i}", "marca": "Dell", "modelo": "XPS"},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        r5 = self.client.post(
            "/api/equipos/",
            {"serial": "SER-5", "marca": "Dell", "modelo": "XPS"},
            format="json",
        )
        self.assertEqual(r5.status_code, status.HTTP_400_BAD_REQUEST, r5.data)
        self.assertEqual(r5.data["code"], "EQUIPO_LIMIT_REACHED")

    def test_aprendiz_only_deletes_pending(self):
        pending = Equipo.objects.create(propietario=self.aprendiz, serial="PEND-1", marca="HP", modelo="1", estado=Equipo.Estado.PENDIENTE)
        approved = Equipo.objects.create(propietario=self.aprendiz, serial="APP-1", marca="HP", modelo="2", estado=Equipo.Estado.APROBADO)

        self._auth_aprendiz()
        r1 = self.client.delete(f"/api/equipos/{pending.id}/")
        self.assertEqual(r1.status_code, status.HTTP_204_NO_CONTENT)

        r2 = self.client.delete(f"/api/equipos/{approved.id}/")
        self.assertEqual(r2.status_code, status.HTTP_403_FORBIDDEN, r2.data)
        self.assertEqual(r2.data["code"], "PERMISSION_DENIED")

    def test_admin_can_delete_approved(self):
        approved = Equipo.objects.create(propietario=self.aprendiz, serial="APP-2", marca="HP", modelo="3", estado=Equipo.Estado.APROBADO)
        self._auth_superadmin()
        r = self.client.delete(f"/api/equipos/{approved.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_aprendiz_can_update_own_pending_equipment(self):
        pending = Equipo.objects.create(propietario=self.aprendiz, serial="P-UPD-1", marca="HP", modelo="14", estado=Equipo.Estado.PENDIENTE)
        self._auth_aprendiz()

        r = self.client.patch(
            f"/api/equipos/{pending.id}/",
            {"serial": "P-UPD-2", "marca": "Lenovo", "modelo": "ThinkPad"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        pending.refresh_from_db()
        self.assertEqual(pending.serial, "P-UPD-2")
        self.assertEqual(pending.marca, "Lenovo")
        self.assertEqual(pending.modelo, "ThinkPad")

    def test_aprendiz_cannot_update_non_pending_equipment(self):
        approved = Equipo.objects.create(propietario=self.aprendiz, serial="APP-UPD-1", marca="HP", modelo="15", estado=Equipo.Estado.APROBADO)
        self._auth_aprendiz()

        r = self.client.patch(
            f"/api/equipos/{approved.id}/",
            {"marca": "Dell"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data["code"], "PERMISSION_DENIED")


class AdminSedeRulesTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="super_admin",
            password="Passw0rd!",
            rol="superadmin",
            email="super@sadi.test",
            is_staff=True,
            is_superuser=True,
        )

    def _auth_superadmin(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

    def test_max_four_admins_per_sede(self):
        self._auth_superadmin()
        base_payload = {
            "estado": "activo",
            "first_name": "Admin",
            "last_name": "Sede",
            "rol": "admin_sede",
            "sede_principal": "sede-1",
            "password": "Passw0rd!",
        }

        for i in range(4):
            payload = {
                **base_payload,
                "username": f"adminsede{i}",
                "email": f"adminsede{i}@sadi.test",
            }
            r = self.client.post("/api/usuarios/", payload, format="json")
            self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        r5 = self.client.post(
            "/api/usuarios/",
            {
                **base_payload,
                "username": "adminsede4",
                "email": "adminsede4@sadi.test",
            },
            format="json",
        )
        self.assertEqual(r5.status_code, status.HTTP_400_BAD_REQUEST, r5.data)
        self.assertEqual(r5.data["code"], "MAX_ADMINS_PER_SEDE")


class RolePermissionScopeTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="root_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="root.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )
        self.admin_sede = self.create_user(
            username="admin_sede_scope",
            password="Passw0rd!",
            rol="admin_sede",
            email="admin.sede.scope@sadi.test",
            sede_principal="sede-1",
        )

    def _auth_superadmin(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

    def _auth_admin_sede(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")

    def test_superadmin_can_create_admin_sede_account(self):
        self._auth_superadmin()
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "new_admin_role",
                "password": "Passw0rd!",
                "first_name": "New",
                "last_name": "Admin",
                "email": "new.admin@sadi.test",
                "rol": "admin_sede",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_superadmin_cannot_create_legacy_admin_role(self):
        self._auth_superadmin()
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "legacy_admin_role",
                "password": "Passw0rd!",
                "first_name": "Legacy",
                "last_name": "Admin",
                "email": "legacy.admin@sadi.test",
                "rol": "admin",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("rol", r.data.get("detail", {}))

    def test_admin_sede_cannot_create_administrative_account(self):
        self._auth_admin_sede()
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "blocked_admin_create",
                "password": "Passw0rd!",
                "first_name": "Blocked",
                "last_name": "Admin",
                "email": "blocked.admin@sadi.test",
                "rol": "admin_sede",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data["code"], "PERMISSION_DENIED")

    def test_admin_sede_can_create_aprendiz_and_guarda_in_own_sede(self):
        self._auth_admin_sede()
        aprendiz = self.client.post(
            "/api/usuarios/",
            {
                "username": "7070707070",
                "password": "Passw0rd!",
                "first_name": "Aprendiz",
                "last_name": "Admin",
                "email": "aprendiz.admin@sadi.test",
                "documento": "7070707070",
                "rol": "aprendiz",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        guarda = self.client.post(
            "/api/usuarios/",
            {
                "username": "8080808080",
                "password": "Passw0rd!",
                "first_name": "Guarda",
                "last_name": "Admin",
                "email": "guarda.admin@sadi.test",
                "documento": "8080808080",
                "rol": "guarda",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(aprendiz.status_code, status.HTTP_201_CREATED, aprendiz.data)
        self.assertEqual(guarda.status_code, status.HTTP_201_CREATED, guarda.data)

    def test_admin_sede_cannot_create_user_for_other_sede(self):
        self._auth_admin_sede()
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "9090909090",
                "password": "Passw0rd!",
                "first_name": "Otro",
                "last_name": "Centro",
                "email": "otro.centro@sadi.test",
                "documento": "9090909090",
                "rol": "aprendiz",
                "estado": "activo",
                "sede_principal": "sede-2",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data["code"], "PERMISSION_DENIED")

    def test_admin_sede_can_create_aprendiz_in_own_sede(self):
        self._auth_admin_sede()
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "9191919191",
                "password": "Passw0rd!",
                "first_name": "Misma",
                "last_name": "Sede",
                "email": "misma.sede@sadi.test",
                "documento": "9191919191",
                "rol": "aprendiz",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data.get("sede_principal"), "sede-1")

    def test_admin_sede_cannot_edit_or_delete_administrative_account(self):
        self._auth_admin_sede()
        patch = self.client.patch(
            f"/api/usuarios/{self.admin_sede.id}/",
            {"estado": "bloqueado"},
            format="json",
        )
        delete = self.client.delete(f"/api/usuarios/{self.admin_sede.id}/")
        self.assertEqual(patch.status_code, status.HTTP_403_FORBIDDEN, patch.data)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN, delete.data)
        self.assertEqual(patch.data["code"], "PERMISSION_DENIED")
        self.assertEqual(delete.data["code"], "PERMISSION_DENIED")

    def test_superadmin_can_delete_any_user_role(self):
        victim = self.create_user(
            username="del_target",
            password="Passw0rd!",
            rol="admin_sede",
            sede_principal="sede-2",
            email="del.target@sadi.test",
        )
        self._auth_superadmin()
        r = self.client.delete(f"/api/usuarios/{victim.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT, getattr(r, "data", None))

    def test_admin_sede_can_delete_guarda_and_aprendiz_in_own_sede(self):
        guarda = self.create_user(
            username="9393939393",
            password="Passw0rd!",
            rol="guarda",
            documento="9393939393",
            sede_principal="sede-1",
            email="guarda.own.sede@sadi.test",
        )
        aprendiz = self.create_user(
            username="9494949494",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9494949494",
            sede_principal="sede-1",
            email="aprendiz.own.sede@sadi.test",
        )
        self._auth_admin_sede()
        r1 = self.client.delete(f"/api/usuarios/{guarda.id}/")
        r2 = self.client.delete(f"/api/usuarios/{aprendiz.id}/")
        self.assertEqual(r1.status_code, status.HTTP_204_NO_CONTENT, getattr(r1, "data", None))
        self.assertEqual(r2.status_code, status.HTTP_204_NO_CONTENT, getattr(r2, "data", None))

    def test_admin_sede_cannot_delete_users_from_other_sede(self):
        guarda_other = self.create_user(
            username="9595959595",
            password="Passw0rd!",
            rol="guarda",
            documento="9595959595",
            sede_principal="sede-2",
            email="guarda.other.sede@sadi.test",
        )
        aprendiz_other = self.create_user(
            username="9696969696",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9696969696",
            sede_principal="sede-2",
            email="aprendiz.other.sede@sadi.test",
        )
        self._auth_admin_sede()
        r1 = self.client.delete(f"/api/usuarios/{guarda_other.id}/")
        r2 = self.client.delete(f"/api/usuarios/{aprendiz_other.id}/")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_404_NOT_FOUND, r2.data)


class FilterAndScopeEnforcementTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="filters_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="filters.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )
        self.admin_sede = self.create_user(
            username="filters_admin_sede",
            password="Passw0rd!",
            rol="admin_sede",
            email="filters.admin.sede@sadi.test",
            sede_principal="sede-1",
        )
        self.aprendiz_sede1 = self.create_user(
            username="1111111111",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1111111111",
            email="aprendiz.sede1@sadi.test",
            sede_principal="sede-1",
        )
        self.aprendiz_santa = self.create_user(
            username="2222222222",
            password="Passw0rd!",
            rol="aprendiz",
            documento="2222222222",
            email="aprendiz.santa@sadi.test",
            sede_principal="sede-2",
        )
        self.guarda_sede1 = self.create_user(
            username="3333333333",
            password="Passw0rd!",
            rol="guarda",
            documento="3333333333",
            email="guarda.sede1@sadi.test",
            sede_principal="sede-1",
        )

    def _auth_superadmin(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

    def _auth_admin_sede(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")

    def test_superadmin_can_filter_usuarios_by_machine_sede_id(self):
        self._auth_superadmin()
        r = self.client.get("/api/usuarios/?sede_id=sede-2")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertGreaterEqual(len(rows), 1)
        self.assertTrue(all(item.get("sede_principal") == "sede-2" for item in rows))

    def test_admin_sede_queryset_forces_own_sede_even_with_cross_sede_param(self):
        self._auth_admin_sede()
        r = self.client.get("/api/usuarios/?sede_id=sede-2")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertGreaterEqual(len(rows), 1)
        self.assertTrue(all(item.get("sede_principal") == "sede-1" for item in rows))
        self.assertFalse(any(item.get("id") == self.aprendiz_santa.id for item in rows))

    def test_filter_rejects_human_label_for_usuario_estado(self):
        self._auth_superadmin()
        r = self.client.get("/api/usuarios/?estado=Activo")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertEqual(r.data.get("code"), "VALIDATION_ERROR")
        self.assertIn("estado", r.data.get("detail", {}))

    def test_filter_rejects_human_label_for_turno_jornada(self):
        Turno.objects.create(
            guarda=self.guarda_sede1,
            sede=self.sede("sede-1"),
            jornada=Turno.Jornada.TARDE,
            activo=True,
        )
        self._auth_superadmin()
        r = self.client.get("/api/turnos/?jornada=Tarde")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertEqual(r.data.get("code"), "VALIDATION_ERROR")
        self.assertIn("jornada", r.data.get("detail", {}))

    def test_admin_sede_acceso_list_forces_own_sede_even_if_querying_other(self):
        Acceso.objects.create(
            usuario=self.aprendiz_sede1,
            tipo=Acceso.Tipo.INGRESO,
            sede=self.sede("sede-1"),
            registrado_por=self.admin_sede,
        )
        Acceso.objects.create(
            usuario=self.aprendiz_santa,
            tipo=Acceso.Tipo.INGRESO,
            sede=self.sede("sede-2"),
            registrado_por=self.superadmin,
        )
        self._auth_admin_sede()
        r = self.client.get("/api/accesos/?sede_id=sede-2")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertGreaterEqual(len(rows), 1)
        self.assertTrue(all(item.get("sede") == "sede-1" for item in rows))

    def test_admin_sede_cannot_create_acceso_for_aprendiz_other_sede(self):
        self._auth_admin_sede()
        r = self.client.post(
            "/api/accesos/",
            {"usuario": self.aprendiz_santa.id, "tipo": "ingreso"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data.get("code"), "PERMISSION_DENIED")

    def test_guarda_cannot_start_turno_in_other_sede(self):
        self.auth(self.guarda_sede1.username, "Passw0rd!", expected_role="guarda")
        r = self.client.post(
            "/api/turnos/iniciar/",
            {"sede": "sede-2", "jornada": Turno.Jornada.TARDE},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data.get("code"), "PERMISSION_DENIED")


class DataDrivenRBACAndPolicyTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="rbac_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="rbac.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )
        self.admin_sede = self.create_user(
            username="rbac_admin_sede",
            password="Passw0rd!",
            rol="admin_sede",
            email="rbac.admin@sadi.test",
            sede_principal="sede-1",
        )
        self.aprendiz = self.create_user(
            username="rbac_aprendiz",
            password="Passw0rd!",
            rol="aprendiz",
            documento="5544332211",
            email="rbac.aprendiz@sadi.test",
            sede_principal="sede-1",
        )

    def test_admin_scope_uses_membership_as_source_of_truth(self):
        role_admin = Role.objects.get(code="admin_sede")
        UserMembership.objects.filter(user=self.admin_sede).update(is_primary=False, is_active=False)
        UserMembership.objects.create(
            user=self.admin_sede,
            role=role_admin,
            sede=self.sede("sede-2"),
            is_primary=True,
            is_active=True,
        )

        self.create_user(
            username="scope_aprendiz_sede1",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1234567890",
            email="scope.sede1@sadi.test",
            sede_principal="sede-1",
        )
        self.create_user(
            username="scope_aprendiz_sede2",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1234567891",
            email="scope.sede2@sadi.test",
            sede_principal="sede-2",
        )

        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        r = self.client.get("/api/usuarios/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertTrue(rows)
        self.assertTrue(all(item.get("sede_principal") == "sede-2" for item in rows))

    def test_policy_max_equipos_is_dynamic_per_sede(self):
        policy, _ = SedePolicy.objects.get_or_create(sede=self.sede("sede-1"))
        policy.max_equipos_aprendiz = 2
        policy.save(update_fields=["max_equipos_aprendiz"])

        self.auth(self.aprendiz.documento, "Passw0rd!", expected_role="aprendiz")
        r1 = self.client.post("/api/equipos/", {"serial": "POL-1", "marca": "Dell", "modelo": "A"}, format="json")
        r2 = self.client.post("/api/equipos/", {"serial": "POL-2", "marca": "Dell", "modelo": "B"}, format="json")
        r3 = self.client.post("/api/equipos/", {"serial": "POL-3", "marca": "Dell", "modelo": "C"}, format="json")

        self.assertEqual(r1.status_code, status.HTTP_201_CREATED, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED, r2.data)
        self.assertEqual(r3.status_code, status.HTTP_400_BAD_REQUEST, r3.data)
        self.assertEqual(r3.data.get("code"), "EQUIPO_LIMIT_REACHED")
        self.assertIn("2", str(r3.data.get("message", "")))

    def test_allowed_email_domain_rejects_invalid_domain_for_role_and_sede(self):
        role_aprendiz = Role.objects.get(code="aprendiz")
        sede_1 = self.sede("sede-1")
        AllowedEmailDomain.objects.filter(role=role_aprendiz).delete()
        AllowedEmailDomain.objects.create(role=role_aprendiz, sede=sede_1, domain="institucion.edu.co", is_active=True)

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "domain_user_1",
                "password": "Passw0rd!",
                "first_name": "Domain",
                "last_name": "Blocked",
                "email": "no.permitido@gmail.com",
                "documento": "1234567892",
                "rol": "aprendiz",
                "estado": "activo",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("email", r.data.get("detail", {}))

    def test_qr_mode_signed_rejects_plain_payload(self):
        sede_1 = self.sede("sede-1")
        policy, _ = SedePolicy.objects.get_or_create(sede=sede_1)
        policy.qr_mode = "SIGNED"
        policy.save(update_fields=["qr_mode"])

        signed_value, mode = QRService.build_aprendiz_qr_value("1234567893", sede=sede_1)
        self.assertEqual(mode, "SIGNED")

        parsed = QRService.parse_document(signed_value, sede=sede_1)
        self.assertEqual(parsed.documento, "1234567893")
        self.assertEqual(parsed.mode_used, "SIGNED")

        with self.assertRaises(QRParseError):
            QRService.parse_document("1234567893", sede=sede_1)


class EmailChangeOtpTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="4040404040",
            password="Passw0rd!",
            rol="aprendiz",
            documento="4040404040",
            email="oldmail@sadi.test",
        )

    def test_change_email_requires_otp(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        salt = "email-otp-salt"
        EmailChangeOTP.objects.create(
            user=self.aprendiz,
            new_email="newmail@sadi.test",
            salt=salt,
            code_hash=hash_code(salt, "12345"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        wrong = self.client.post(
            "/api/aprendiz/perfil/email-change/confirm/",
            {"new_email": "newmail@sadi.test", "otp": "99999"},
            format="json",
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST, wrong.data)
        self.assertEqual(wrong.data["code"], "OTP_INVALID")

        ok = self.client.post(
            "/api/aprendiz/perfil/email-change/confirm/",
            {"new_email": "newmail@sadi.test", "otp": "12345"},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.aprendiz.refresh_from_db()
        self.assertEqual(self.aprendiz.email, "newmail@sadi.test")


class NumericFieldValidationTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="numeric_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="numeric.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )
        self.aprendiz = self.create_user(
            username="4040404041",
            password="Passw0rd!",
            rol="aprendiz",
            documento="4040404041",
            email="numeric.aprendiz@sadi.test",
        )

    def test_usuario_create_rejects_non_numeric_document(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "doc_invalid",
                "password": "Passw0rd!",
                "rol": "aprendiz",
                "estado": "activo",
                "documento": "ABC123",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("documento", r.data.get("detail", {}))
        self.assertEqual(r.data.get("field"), "documento")
        self.assertIn("entre 6 y 10 digitos", str(r.data.get("detail", {}).get("documento", "")).lower())

    def test_usuario_create_rejects_document_shorter_than_six_digits(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "doc_short",
                "password": "Passw0rd!",
                "rol": "aprendiz",
                "estado": "activo",
                "documento": "12345",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("documento", r.data.get("detail", {}))

    def test_usuario_create_rejects_document_longer_than_ten_digits(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "doc_long",
                "password": "Passw0rd!",
                "rol": "aprendiz",
                "estado": "activo",
                "documento": "12345678901",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("documento", r.data.get("detail", {}))

    def test_usuario_create_accepts_non_numeric_username(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        payload = {
            "username": "gabriel_pico_8",
            "password": "Passw0rd!",
            "rol": "aprendiz",
            "estado": "activo",
            "documento": "1234567890",
            "sede_principal": "sede-1",
        }
        r = self.client.post("/api/usuarios/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data["username"], payload["username"])

    def test_usuario_create_rejects_username_with_spaces(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.post(
            "/api/usuarios/",
            {
                "username": "nombre invalido",
                "password": "Passw0rd!",
                "rol": "aprendiz",
                "estado": "activo",
                "documento": "1234567891",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertEqual(r.data.get("field"), "username")
        self.assertIn("nombre de usuario", (r.data.get("message") or "").lower())

    def test_aprendiz_profile_phone_rejects_non_ten_digits(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        r = self.client.patch("/api/aprendiz/perfil/", {"telefono": "+57 (300) 123-4567"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("telefono", r.data.get("detail", {}))

    def test_aprendiz_profile_phone_accepts_exact_ten_digits(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        r = self.client.patch("/api/aprendiz/perfil/", {"telefono": "3001234567"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["perfil"]["telefono"], "3001234567")


class PasskeyEndpointTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="5050505050",
            password="Passw0rd!",
            rol="aprendiz",
            documento="5050505050",
            email="passkey@sadi.test",
        )

    def test_register_and_authenticate_with_passkey_mock_flow(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")

        options = self.client.post("/api/auth/passkeys/register/options/", {"nickname": "Mi passkey"}, format="json")
        self.assertEqual(options.status_code, status.HTTP_200_OK, options.data)

        verify = self.client.post(
            "/api/auth/passkeys/register/verify/",
            {
                "request_id": options.data["request_id"],
                "challenge": options.data["challenge"],
                "credential_id": "cred-001",
                "public_key": "pk-test",
                "sign_count": 1,
            },
            format="json",
        )
        self.assertEqual(verify.status_code, status.HTTP_200_OK, verify.data)
        self.assertTrue(WebAuthnCredential.objects.filter(user=self.aprendiz, credential_id="cred-001").exists())

        self.client.credentials()
        auth_options = self.client.post(
            "/api/auth/passkeys/auth/options/",
            {"username": self.aprendiz.username, "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(auth_options.status_code, status.HTTP_200_OK, auth_options.data)

        auth_verify = self.client.post(
            "/api/auth/passkeys/auth/verify/",
            {
                "request_id": auth_options.data["request_id"],
                "challenge": auth_options.data["challenge"],
                "credential_id": "cred-001",
                "expected_role": "aprendiz",
            },
            format="json",
        )
        self.assertEqual(auth_verify.status_code, status.HTTP_200_OK, auth_verify.data)
        self.assertIn("access", auth_verify.data)
        self.assertIn("refresh", auth_verify.data)


class AprendizEstadoEndpointTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="6060606060",
            password="Passw0rd!",
            rol="aprendiz",
            documento="6060606060",
            email="estado@sadi.test",
        )

    def test_estado_endpoint_returns_canonical_values(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")

        empty = self.client.get("/api/accesos/estado/")
        self.assertEqual(empty.status_code, status.HTTP_200_OK, empty.data)
        self.assertEqual(empty.data.get("estado"), "SIN_REGISTROS")
        self.assertIsNone(empty.data.get("ultima_fecha"))

        Acceso.objects.create(usuario=self.aprendiz, tipo=Acceso.Tipo.INGRESO)
        ingreso = self.client.get("/api/accesos/estado/")
        self.assertEqual(ingreso.status_code, status.HTTP_200_OK, ingreso.data)
        self.assertEqual(ingreso.data.get("estado"), "DENTRO")

        Acceso.objects.create(usuario=self.aprendiz, tipo=Acceso.Tipo.SALIDA)
        salida = self.client.get("/api/accesos/estado/")
        self.assertEqual(salida.status_code, status.HTTP_200_OK, salida.data)
        self.assertEqual(salida.data.get("estado"), "FUERA")


class FrontendContractSmokeTests(BaseApiTest):
    def test_mobile_password_recovery_is_email_only(self):
        root = Path(__file__).resolve().parents[3]
        recovery = (root / "apps" / "mobile-rn" / "app" / "auth" / "password-recovery.tsx").read_text(encoding="utf-8")
        auth_api = (root / "apps" / "mobile-rn" / "src" / "api" / "auth.ts").read_text(encoding="utf-8")
        self.assertNotIn("WhatsApp", recovery)
        self.assertNotIn("passwordResetVerifyWithChannel", auth_api)
        self.assertNotIn("passwordResetConfirmWithChannel", auth_api)
        self.assertIn('/api/auth/password-reset/request/', auth_api)
        self.assertIn('/api/auth/password-reset/verify/', auth_api)
        self.assertIn('/api/auth/password-reset/confirm/', auth_api)

    def test_web_login_uses_expected_role_and_passkey_endpoints(self):
        root = Path(__file__).resolve().parents[3]
        login = (root / "apps" / "web" / "src" / "app" / "(auth)" / "login" / "page.tsx").read_text(encoding="utf-8")
        self.assertIn("expected_role", login)
        self.assertIn("/api/auth/passkeys/auth/options/", login)
        self.assertIn("/api/auth/passkeys/auth/verify/", login)


class ExceptionHandlerSafetyTests(BaseApiTest):
    def test_unhandled_api_exception_returns_safe_json_payload(self):
        request = APIRequestFactory().post("/api/usuarios/", {}, format="json")
        response = ui_exception_handler(RuntimeError("boom PATH=C:\\Windows"), {"request": request})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data.get("code"), "SERVER_ERROR")
        self.assertIn("error interno", str(response.data.get("message", "")).lower())
        self.assertIsNone(response.data.get("detail"))

    def test_validation_message_is_human_friendly(self):
        request = APIRequestFactory().post("/api/usuarios/", {}, format="json")
        response = ui_exception_handler(ValidationError({"username": ["This field is required."]}), {"request": request})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nombre de usuario", str(response.data.get("message", "")).lower())
        self.assertIn("obligatorio", str(response.data.get("message", "")).lower())


class InstitutionalDecouplingTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.dynamic_sede = self.sede("north-campus")
        self.dynamic_sede.name = "North Campus"
        self.dynamic_sede.save(update_fields=["name"])

        self.superadmin = self.create_user(
            username="superadmin_dynamic",
            password="Passw0rd!",
            rol="superadmin",
            email="superadmin.dynamic@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.admin_sede = self.create_user(
            username="admin_dynamic",
            password="Passw0rd!",
            rol="admin_sede",
            email="admin.dynamic@sadi.test",
            sede_principal=self.dynamic_sede,
        )
        self.aprendiz_same = self.create_user(
            username="apr_dynamic_1",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9191919191",
            email="apr.dynamic.1@sadi.test",
            sede_principal=self.dynamic_sede,
        )
        self.aprendiz_other = self.create_user(
            username="apr_dynamic_2",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9292929292",
            email="apr.dynamic.2@sadi.test",
            sede_principal=self.sede("south-campus"),
        )

    def test_sedes_endpoint_lists_dynamic_sedes(self):
        r = self.client.get("/api/sedes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        codes = {item.get("code") for item in rows}
        self.assertIn("north-campus", codes)

    def test_admin_sede_queryset_is_scoped_with_dynamic_sede(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        r = self.client.get("/api/usuarios/?sede_id=south-campus")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertGreaterEqual(len(rows), 1)
        self.assertTrue(all(item.get("sede_principal") == "north-campus" for item in rows))

    def test_admin_sede_cannot_create_turno_for_other_sede(self):
        guarda = self.create_user(
            username="9393939393",
            password="Passw0rd!",
            rol="guarda",
            documento="9393939393",
            email="guarda.dynamic@sadi.test",
            sede_principal=self.dynamic_sede,
        )
        self.auth(guarda.username, "Passw0rd!", expected_role="guarda")
        r = self.client.post(
            "/api/turnos/iniciar/",
            {"sede": "south-campus", "jornada": Turno.Jornada.TARDE},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)


class SedeBootstrapTests(BaseApiTest):
    def test_sedes_endpoint_bootstraps_defaults_when_table_is_empty(self):
        Sede.objects.all().delete()
        r = self.client.get("/api/sedes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertGreaterEqual(len(rows), 4)
        codes = {item.get("code") for item in rows}
        self.assertTrue({"sede-1", "sede-2", "sede-3", "sede-4"}.issubset(codes))


class ImportAtomicityTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.admin = self.create_user(
            username="import_admin",
            password="Passw0rd!",
            rol="superadmin",
            email="import.admin@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )

    def test_execute_aprendices_import_rolls_back_on_single_row_error(self):
        rows = [
            {
                "first_name": "Ana",
                "last_name": "Import",
                "documento": "6666666666",
                "telefono": "3001234567",
                "email": "ana.import@sadi.test",
                "jornada": "TARDE",
                "programa_formacion": "Analisis",
                "sede_principal": "sede-1",
            },
            {
                "first_name": "Luis",
                "last_name": "Fallido",
                "documento": "7777777777",
                "telefono": "3011234567",
                "email": "luis.fallido@sadi.test",
                "jornada": "NOCHE",
                "programa_formacion": "Desarrollo",
                "sede_principal": "sede-invalida",
            },
        ]

        with self.assertRaises(ImportServiceError):
            execute_aprendices_import(rows=rows, imported_by=self.admin, errors=[])

        self.assertFalse(self.User.objects.filter(documento="6666666666").exists())
        self.assertFalse(self.User.objects.filter(documento="7777777777").exists())
        self.assertEqual(AprendizImportAudit.objects.count(), 0)


class TurnoExpirationRulesTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.guarda = self.create_user(
            username="5151515151",
            password="Passw0rd!",
            rol="guarda",
            documento="5151515151",
            email="turno.expira@sadi.test",
            sede_principal="sede-1",
        )

    def test_iniciar_turno_cierra_turno_expirado_automaticamente(self):
        expired_turno = Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede("sede-1"),
            jornada=Turno.Jornada.TARDE,
            inicio=timezone.now() - timedelta(hours=13),
            activo=True,
            fin=None,
        )
        self.assertTrue(expired_turno.is_expired)

        self.auth(self.guarda.username, "Passw0rd!", expected_role="guarda")
        r = self.client.post(
            "/api/turnos/iniciar/",
            {"sede": "sede-1", "jornada": Turno.Jornada.TARDE},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        expired_turno.refresh_from_db()
        self.assertFalse(expired_turno.activo)
        self.assertIsNotNone(expired_turno.fin)
        self.assertEqual(expired_turno.cierre_observacion, "Cierre por tiempo limite alcanzado")
