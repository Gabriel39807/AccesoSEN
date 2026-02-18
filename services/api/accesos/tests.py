from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Acceso, EmailChangeOTP, Equipo, PasswordResetOTP, WebAuthnCredential
from .otp_services import hash_code


class BaseApiTest(APITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.User = get_user_model()

    def create_user(self, **kwargs):
        defaults = {
            "username": kwargs.pop("username", f"user_{timezone.now().timestamp()}"),
            "password": kwargs.pop("password", "Passw0rd!"),
            "rol": kwargs.pop("rol", "aprendiz"),
            "estado": kwargs.pop("estado", "activo"),
            "email": kwargs.pop("email", None),
            "documento": kwargs.pop("documento", None),
            "sede_principal": kwargs.pop("sede_principal", "CEGAFE"),
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
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")

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
            "sede_principal": "CEGAFE",
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
            sede_principal="CEGAFE",
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
                "sede_principal": "CEGAFE",
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
                "sede_principal": "CEGAFE",
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
                "sede_principal": "CEGAFE",
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
                "sede_principal": "CEGAFE",
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
                "sede_principal": "CEGAFE",
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
                "sede_principal": "SANTA_CLARA",
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
                "sede_principal": "CEGAFE",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data.get("sede_principal"), "CEGAFE")

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
            sede_principal="SANTA_CLARA",
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
            sede_principal="CEGAFE",
            email="guarda.own.sede@sadi.test",
        )
        aprendiz = self.create_user(
            username="9494949494",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9494949494",
            sede_principal="CEGAFE",
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
            sede_principal="SANTA_CLARA",
            email="guarda.other.sede@sadi.test",
        )
        aprendiz_other = self.create_user(
            username="9696969696",
            password="Passw0rd!",
            rol="aprendiz",
            documento="9696969696",
            sede_principal="SANTA_CLARA",
            email="aprendiz.other.sede@sadi.test",
        )
        self._auth_admin_sede()
        r1 = self.client.delete(f"/api/usuarios/{guarda_other.id}/")
        r2 = self.client.delete(f"/api/usuarios/{aprendiz_other.id}/")
        self.assertEqual(r1.status_code, status.HTTP_404_NOT_FOUND, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_404_NOT_FOUND, r2.data)


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
                "sede_principal": "CEGAFE",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("documento", r.data.get("detail", {}))

    def test_aprendiz_profile_phone_normalizes_to_digits(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        r = self.client.patch("/api/aprendiz/perfil/", {"telefono": "+57 (300) 123-4567"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["perfil"]["telefono"], "573001234567")


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
