from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import io
from unittest.mock import patch
from uuid import uuid4

from django.db import connection
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.test import APIRequestFactory
from rest_framework.test import force_authenticate
from rest_framework_simplejwt.tokens import AccessToken

from accesos.domain.services.qr_service import QRParseError, QRService
from accesos.api.viewsets import TurnoViewSet
from .exceptions import ui_exception_handler
from .import_services import ImportServiceError, count_distinct_error_rows, execute_aprendices_import, validate_excel
from .models import (
    Acceso,
    AprendizImportAudit,
    AllowedEmailDomain,
    ConfiguracionSistema,
    EmailChangeOTP,
    Equipo,
    Notificacion,
    PasswordResetOTP,
    Permission as RbacPermission,
    RefreshSession,
    Role,
    Sede,
    SedePolicy,
    Turno,
    UserMembership,
    Usuario,
)
from .otp_services import hash_code
from .tests_support import BaseApiTest


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

    def test_put_requires_superuser_and_control_panel_session(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        denied = self.client.put("/api/configuracion/", {"nombre_institucion": "Institucion X"}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

        self.auth(self.superuser.username, "Passw0rd!", expected_role="admin")
        denied_without_step_up = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "Institucion X"},
            format="json",
        )
        self.assertEqual(denied_without_step_up.status_code, status.HTTP_403_FORBIDDEN, denied_without_step_up.data)

        session_id = self.start_control_panel_session()
        ok = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "Institucion X", "color_admin_light": "#123ABC"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Actualizar branding base"),
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.assertEqual(ok.data["configuracion"]["nombre_institucion"], "Institucion X")
        self.assertEqual(ok.data["configuracion"]["color_admin_light"], "#123ABC")
        self.assertEqual(ConfiguracionSistema.objects.count(), 1)


class AuthEndpointPermissionTests(BaseApiTest):
    def test_me_requires_authentication(self):
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, response.data)


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

    def test_verify_rejects_expired_otp(self):
        otp = self._seed_otp(code="12345")
        otp.expires_at = timezone.now() - timedelta(seconds=1)
        otp.save(update_fields=["expires_at"])

        vr = self.client.post(
            "/api/auth/password-reset/verify/",
            {"email": "recover@sadi.test", "otp": "12345"},
            format="json",
        )
        self.assertEqual(vr.status_code, status.HTTP_400_BAD_REQUEST, vr.data)
        self.assertEqual(vr.data.get("code"), "OTP_EXPIRED")


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
        pending = Equipo.objects.create(
            propietario=self.aprendiz, serial="PEND-1", marca="HP", modelo="1", estado=Equipo.Estado.PENDIENTE
        )
        approved = Equipo.objects.create(
            propietario=self.aprendiz, serial="APP-1", marca="HP", modelo="2", estado=Equipo.Estado.APROBADO
        )

        self._auth_aprendiz()
        r1 = self.client.delete(f"/api/equipos/{pending.id}/")
        self.assertEqual(r1.status_code, status.HTTP_204_NO_CONTENT)

        r2 = self.client.delete(f"/api/equipos/{approved.id}/")
        self.assertEqual(r2.status_code, status.HTTP_403_FORBIDDEN, r2.data)
        self.assertEqual(r2.data["code"], "PERMISSION_DENIED")

    def test_admin_can_delete_approved(self):
        approved = Equipo.objects.create(
            propietario=self.aprendiz, serial="APP-2", marca="HP", modelo="3", estado=Equipo.Estado.APROBADO
        )
        self._auth_superadmin()
        r = self.client.delete(f"/api/equipos/{approved.id}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_aprendiz_can_update_own_pending_equipment(self):
        pending = Equipo.objects.create(
            propietario=self.aprendiz, serial="P-UPD-1", marca="HP", modelo="14", estado=Equipo.Estado.PENDIENTE
        )
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
        approved = Equipo.objects.create(
            propietario=self.aprendiz, serial="APP-UPD-1", marca="HP", modelo="15", estado=Equipo.Estado.APROBADO
        )
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

    def test_max_two_admins_per_sede(self):
        self._auth_superadmin()
        base_payload = {
            "estado": "activo",
            "first_name": "Admin",
            "last_name": "Sede",
            "rol": "admin_sede",
            "sede_principal": "sede-1",
            "password": "Passw0rd!",
        }

        for i in range(2):
            payload = {
                **base_payload,
                "username": f"adminsede{i}",
                "email": f"adminsede{i}@sadi.test",
            }
            r = self.client.post("/api/usuarios/", payload, format="json")
            self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        denied = self.client.post(
            "/api/usuarios/",
            {
                **base_payload,
                "username": "adminsede2",
                "email": "adminsede2@sadi.test",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST, denied.data)
        self.assertEqual(denied.data["code"], "MAX_ADMINS_PER_SEDE")
        self.assertEqual(denied.data["detail"]["limit"], 2)


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

    def test_admin_operational_access_without_turno_is_rejected_even_when_membership_matches(self):
        role_admin = Role.objects.get(code="admin_sede")
        UserMembership.objects.filter(user=self.admin_sede).update(is_primary=False, is_active=False)
        UserMembership.objects.create(
            user=self.admin_sede,
            role=role_admin,
            sede=self.sede("sede-2"),
            is_primary=True,
            is_active=True,
        )
        aprendiz_sede_2 = self.create_user(
            username="scope_access_sede2",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1234567893",
            email="scope.access.sede2@sadi.test",
            sede_principal="sede-2",
        )

        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        response = self.client.post(
            "/api/accesos/",
            {"usuario": aprendiz_sede_2.id, "tipo": Acceso.Tipo.INGRESO},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertEqual(response.data["code"], "PERMISSION_DENIED")
        self.assertIn("contingencia", response.data["message"].lower())

    def test_admin_contingency_access_uses_membership_sede_as_source_of_truth(self):
        role_admin = Role.objects.get(code="admin_sede")
        UserMembership.objects.filter(user=self.admin_sede).update(is_primary=False, is_active=False)
        UserMembership.objects.create(
            user=self.admin_sede,
            role=role_admin,
            sede=self.sede("sede-2"),
            is_primary=True,
            is_active=True,
        )
        aprendiz_sede_2 = self.create_user(
            username="scope_contingency_sede2",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1234567894",
            email="scope.contingency.sede2@sadi.test",
            sede_principal="sede-2",
        )

        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        response = self.client.post(
            "/api/accesos/registrar_contingencia/",
            {
                "documento": aprendiz_sede_2.documento,
                "tipo": Acceso.Tipo.INGRESO,
                "motivo": "Caida controlada del lector QR",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["acceso"]["sede"], "sede-2")
        self.assertEqual(response.data["acceso"]["usuario"], aprendiz_sede_2.id)

    def test_policy_max_equipos_is_canonical_global_four(self):
        policy, _ = SedePolicy.objects.get_or_create(sede=self.sede("sede-1"))
        policy.max_equipos_aprendiz = 2
        policy.save(update_fields=["max_equipos_aprendiz"])

        self.auth(self.aprendiz.documento, "Passw0rd!", expected_role="aprendiz")
        r1 = self.client.post("/api/equipos/", {"serial": "POL-1", "marca": "Dell", "modelo": "A"}, format="json")
        r2 = self.client.post("/api/equipos/", {"serial": "POL-2", "marca": "Dell", "modelo": "B"}, format="json")
        r3 = self.client.post("/api/equipos/", {"serial": "POL-3", "marca": "Dell", "modelo": "C"}, format="json")
        r4 = self.client.post("/api/equipos/", {"serial": "POL-4", "marca": "Dell", "modelo": "D"}, format="json")
        r5 = self.client.post("/api/equipos/", {"serial": "POL-5", "marca": "Dell", "modelo": "E"}, format="json")

        self.assertEqual(r1.status_code, status.HTTP_201_CREATED, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED, r2.data)
        self.assertEqual(r3.status_code, status.HTTP_201_CREATED, r3.data)
        self.assertEqual(r4.status_code, status.HTTP_201_CREATED, r4.data)
        self.assertEqual(r5.status_code, status.HTTP_400_BAD_REQUEST, r5.data)
        self.assertEqual(r5.data.get("code"), "EQUIPO_LIMIT_REACHED")
        self.assertIn("4", str(r5.data.get("message", "")))

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

        aprendiz = self.create_user(
            username="qr_signed_user",
            password="Passw0rd!",
            rol="aprendiz",
            documento="1234567893",
            email="qr.signed@sadi.test",
            sede_principal="sede-1",
        )
        session = RefreshSession.objects.create(
            user=aprendiz,
            device_id="qr-test-device",
            refresh_token_hash=uuid4().hex,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        signed_value, mode = QRService.build_aprendiz_qr_value("1234567893", sede=sede_1, session_id=str(session.id))
        self.assertEqual(mode, "SIGNED")

        parsed = QRService.parse_document(signed_value, sede=sede_1)
        self.assertEqual(parsed.documento, "1234567893")
        self.assertEqual(parsed.mode_used, "SIGNED")

        with self.assertRaises(QRParseError):
            QRService.parse_document("1234567893", sede=sede_1)


class GeminiStubEndpointTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.aprendiz = self.create_user(
            username="7878787878",
            password="Passw0rd!",
            rol="aprendiz",
            documento="7878787878",
            email="gemini.aprendiz@sadi.test",
        )

    @override_settings(GEMINI_ENABLED=False)
    def test_stub_rejects_when_feature_is_disabled(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        r = self.client.post("/api/ai/gemini/stub/", {"prompt": "hola"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, r.data)
        self.assertEqual(r.data.get("code"), "AI_FEATURE_DISABLED")

    @override_settings(GEMINI_ENABLED=True)
    def test_stub_returns_simulated_payload(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        r = self.client.post("/api/ai/gemini/stub/", {"prompt": "resume este texto"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertTrue(r.data.get("stub"))
        self.assertIn("output", r.data)

    @override_settings(
        GEMINI_ENABLED=True,
        GEMINI_RATE_LIMIT_ATTEMPTS=2,
        GEMINI_RATE_LIMIT_WINDOW_SEC=60,
        GEMINI_RATE_LIMIT_LOCK_SEC=60,
    )
    def test_stub_rate_limit_blocks_after_threshold(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        first = self.client.post("/api/ai/gemini/stub/", {"prompt": "uno"}, format="json")
        second = self.client.post("/api/ai/gemini/stub/", {"prompt": "dos"}, format="json")
        third = self.client.post("/api/ai/gemini/stub/", {"prompt": "tres"}, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS, second.data)
        self.assertEqual(third.status_code, status.HTTP_429_TOO_MANY_REQUESTS, third.data)
        self.assertEqual(second.data.get("code"), "AI_RATE_LIMITED")

    @override_settings(GEMINI_ENABLED=True)
    def test_stub_timeout_returns_gateway_timeout(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")
        with patch("accesos.views._gemini_stub_with_retry", side_effect=TimeoutError("simulated-timeout")):
            r = self.client.post("/api/ai/gemini/stub/", {"prompt": "hola"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_504_GATEWAY_TIMEOUT, r.data)
        self.assertEqual(r.data.get("code"), "UPSTREAM_TIMEOUT")


class TurnoConcurrencySafetyTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.guarda = self.create_user(
            username="6161616161",
            password="Passw0rd!",
            rol="guarda",
            documento="6161616161",
            email="turno.concurrente@sadi.test",
            sede_principal="sede-1",
        )

    def test_parallel_turno_start_returns_one_success_and_one_controlled_conflict(self):
        payload = {"sede": "sede-1", "jornada": Turno.Jornada.TARDE}
        if connection.vendor == "sqlite" or connection.in_atomic_block:
            # SQLite test DB serializes writes aggressively and does not model
            # real concurrent row-level locks. Also, Django TestCase wraps each
            # test in an outer transaction, so worker threads cannot observe
            # setup data on independent connections in PostgreSQL. Run a
            # deterministic two-step assertion in those constrained environments.
            self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
            first = self.client.post("/api/turnos/iniciar/", payload, format="json")
            second = self.client.post("/api/turnos/iniciar/", payload, format="json")
            self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
            self.assertIn(second.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT}, second.data)
            self.assertEqual(second.data.get("code"), "TURNO_ALREADY_ACTIVE")
            self.assertEqual(Turno.objects.filter(guarda=self.guarda, activo=True, fin__isnull=True).count(), 1)
            return

        factory = APIRequestFactory()
        view = TurnoViewSet.as_view({"post": "iniciar"})

        def call_start():
            request = factory.post("/api/turnos/iniciar/", payload, format="json")
            force_authenticate(request, user=self.guarda)
            result = view(request)
            return result.status_code, getattr(result, "data", {})

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: call_start(), [1, 2]))

        status_codes = sorted(code for code, _ in outcomes)
        self.assertIn(status.HTTP_201_CREATED, status_codes)
        self.assertTrue(
            status.HTTP_400_BAD_REQUEST in status_codes or status.HTTP_409_CONFLICT in status_codes,
            outcomes,
        )
        conflict_payload = next((body for code, body in outcomes if code in {400, 409}), {})
        self.assertEqual(conflict_payload.get("code"), "TURNO_ALREADY_ACTIVE")
        self.assertEqual(Turno.objects.filter(guarda=self.guarda, activo=True, fin__isnull=True).count(), 1)


class LegacyRolePrecedenceTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="7373737373",
            password="Passw0rd!",
            rol="superadmin",
            documento="7373737373",
            email="legacy.role@sadi.test",
            is_superuser=False,
            is_staff=False,
            sede_principal="sede-1",
        )
        role_guard = Role.objects.get(code="guarda")
        UserMembership.objects.filter(user=self.user).update(is_active=False, is_primary=False)
        UserMembership.objects.create(
            user=self.user,
            role=role_guard,
            sede=self.sede("sede-1"),
            is_active=True,
            is_primary=True,
        )
        # Legacy field kept as superadmin, but runtime role must come from membership.
        Usuario.objects.filter(id=self.user.id).update(rol=Usuario.Rol.SUPERADMIN)
        self.user.refresh_from_db()

    def test_membership_role_overrides_legacy_role_field_at_login(self):
        guard_login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "guarda"},
            format="json",
        )
        self.assertEqual(guard_login.status_code, status.HTTP_200_OK, guard_login.data)

        admin_login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "admin"},
            format="json",
        )
        self.assertEqual(admin_login.status_code, status.HTTP_401_UNAUTHORIZED, admin_login.data)
        self.assertEqual(admin_login.data.get("code"), "INVALID_CREDENTIALS")


class MultiRoleSessionRoleTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="8383838383",
            password="Passw0rd!",
            rol="admin_sede",
            documento="8383838383",
            email="multi.role@sadi.test",
            sede_principal="sede-1",
        )
        role_guard = Role.objects.get(code="guarda")
        UserMembership.objects.create(
            user=self.user,
            role=role_guard,
            sede=self.sede("sede-1"),
            is_active=True,
            is_primary=False,
        )

    def test_multi_role_login_issues_guard_token_and_blocks_admin_actions(self):
        login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "guarda"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        access = AccessToken(login.data["access"])
        self.assertEqual(access["rol"], Usuario.Rol.GUARDA)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        guard_status = self.client.get("/api/guardia/estado-actual/")
        self.assertEqual(guard_status.status_code, status.HTTP_200_OK, guard_status.data)

        denied = self.client.post(
            "/api/usuarios/",
            {
                "username": "blocked_from_guard_module",
                "password": "Passw0rd!",
                "rol": "aprendiz",
                "estado": "activo",
                "documento": "1231231231",
                "sede_principal": "sede-1",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

    def test_multi_role_refresh_preserves_requested_guard_role(self):
        login = self.client.post(
            "/api/token/",
            {
                "username": self.user.documento,
                "password": "Passw0rd!",
                "expected_role": "guarda",
                "device_id": "multi-role-guard-device",
            },
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        refreshed = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"], "device_id": "multi-role-guard-device"},
            format="json",
        )
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK, refreshed.data)
        self.assertEqual(AccessToken(refreshed.data["access"])["rol"], Usuario.Rol.GUARDA)

    def test_multi_role_refresh_rejects_stale_admin_session_after_admin_membership_loss(self):
        login = self.client.post(
            "/api/token/",
            {
                "username": self.user.documento,
                "password": "Passw0rd!",
                "expected_role": "admin",
                "device_id": "multi-role-admin-device",
            },
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        UserMembership.objects.filter(
            user=self.user,
            role__code=Usuario.Rol.ADMIN_SEDE,
        ).update(is_active=False, is_primary=False)

        refreshed = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"], "device_id": "multi-role-admin-device"},
            format="json",
        )
        self.assertEqual(refreshed.status_code, status.HTTP_401_UNAUTHORIZED, refreshed.data)
        self.assertEqual(refreshed.data.get("code"), "NOT_AUTHENTICATED")

        latest_session = RefreshSession.objects.order_by("-last_used_at").first()
        self.assertIsNotNone(latest_session)
        self.assertIsNotNone(latest_session.revoked_at)

    def test_multi_role_admin_token_blocks_guard_only_endpoint(self):
        login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "admin"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.assertEqual(AccessToken(login.data["access"])["rol"], Usuario.Rol.ADMIN_SEDE)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        denied = self.client.get("/api/guardia/estado-actual/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

    def test_multi_role_notifications_follow_active_runtime_role(self):
        Notificacion.objects.create(
            rol_objetivo=Usuario.Rol.ADMIN_SEDE,
            titulo="Solo admin",
            mensaje="visible solo en sesion admin",
        )
        guard_notification = Notificacion.objects.create(
            rol_objetivo=Usuario.Rol.GUARDA,
            titulo="Solo guarda",
            mensaje="visible solo en sesion guarda",
        )
        Notificacion.objects.create(
            titulo="Global",
            mensaje="visible para todos",
        )

        guard_login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "guarda"},
            format="json",
        )
        self.assertEqual(guard_login.status_code, status.HTTP_200_OK, guard_login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {guard_login.data['access']}")

        guard_list = self.client.get("/api/notificaciones/")
        self.assertEqual(guard_list.status_code, status.HTTP_200_OK, guard_list.data)
        guard_titles = {item["titulo"] for item in guard_list.data.get("results", [])}
        self.assertIn("Solo guarda", guard_titles)
        self.assertIn("Global", guard_titles)
        self.assertNotIn("Solo admin", guard_titles)

        guard_read = self.client.patch(f"/api/notificaciones/{guard_notification.id}/leer/", {}, format="json")
        self.assertEqual(guard_read.status_code, status.HTTP_200_OK, guard_read.data)

        admin_login = self.client.post(
            "/api/token/",
            {"username": self.user.documento, "password": "Passw0rd!", "expected_role": "admin"},
            format="json",
        )
        self.assertEqual(admin_login.status_code, status.HTTP_200_OK, admin_login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}")

        admin_list = self.client.get("/api/notificaciones/")
        self.assertEqual(admin_list.status_code, status.HTTP_200_OK, admin_list.data)
        admin_titles = {item["titulo"] for item in admin_list.data.get("results", [])}
        self.assertIn("Solo admin", admin_titles)
        self.assertIn("Global", admin_titles)
        self.assertNotIn("Solo guarda", admin_titles)


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

    def test_usuario_create_without_password_generates_non_document_secret(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        payload = {
            "username": "auto_password_user",
            "rol": "aprendiz",
            "estado": "activo",
            "documento": "1234567890",
            "sede_principal": "sede-1",
            "email": "auto.password@sadi.test",
        }
        r = self.client.post("/api/usuarios/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

        created = Usuario.objects.get(username="auto_password_user")
        self.assertTrue(created.must_change_password)
        self.assertFalse(created.check_password("567890"))
        self.assertFalse(created.check_password("7890"))

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
        response = ui_exception_handler(
            ValidationError({"username": ["This field is required."]}), {"request": request}
        )
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nombre de usuario", str(response.data.get("message", "")).lower())
        self.assertIn("obligatorio", str(response.data.get("message", "")).lower())

    def test_throttled_exception_returns_spanish_payload_with_wait_hint(self):
        request = APIRequestFactory().post("/api/usuarios/", {}, format="json")
        response = ui_exception_handler(Throttled(wait=12), {"request": request})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get("code"), "VALIDATION_ERROR")
        self.assertIn("12", str(response.data.get("message", "")))
        self.assertEqual(response.data.get("detail", {}).get("seconds_remaining"), 12)


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

    def test_sedes_endpoint_requires_authentication(self):
        r = self.client.get("/api/sedes/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED, r.data)

    def test_public_sedes_endpoint_is_available_prelogin_and_only_returns_active_rows(self):
        Sede.objects.all().delete()
        Sede.objects.create(code="north-campus", name="North Campus", is_active=True)
        Sede.objects.create(code="old-campus", name="Old Campus", is_active=False)

        r = self.client.get("/api/public/sedes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["code"], "north-campus")
        self.assertTrue(rows[0]["is_active"])

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


class SedeEndpointIntegrityTests(BaseApiTest):
    def test_superadmin_sedes_endpoint_returns_exact_db_rows_without_bootstrap(self):
        Sede.objects.all().delete()
        Sede.objects.create(code="campus-a", name="Campus A", is_active=True)
        Sede.objects.create(code="campus-b", name="Campus B", is_active=True)

        superadmin = self.create_user(
            username="sedes_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="sedes.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.auth(superadmin.username, "Passw0rd!", expected_role="admin")
        r = self.client.get("/api/sedes/?active=true")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        codes = {item.get("code") for item in rows}
        self.assertSetEqual(codes, {"campus-a", "campus-b"})

    def test_admin_sede_only_gets_its_membership_sedes(self):
        Sede.objects.get_or_create(code="north", defaults={"name": "North", "is_active": True})
        Sede.objects.get_or_create(code="south", defaults={"name": "South", "is_active": True})

        admin = self.create_user(
            username="admin_sedes_scope",
            password="Passw0rd!",
            rol="admin_sede",
            email="admin.scope@sadi.test",
            sede_principal="north",
        )
        self.auth(admin.username, "Passw0rd!", expected_role="admin")

        r = self.client.get("/api/sedes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        rows = r.data.get("results", r.data)
        codes = {item.get("code") for item in rows}
        self.assertSetEqual(codes, {"north"})

    def test_admin_sede_cannot_request_inactive_sedes_filters(self):
        Sede.objects.get_or_create(code="north", defaults={"name": "North", "is_active": True})
        admin = self.create_user(
            username="admin_sedes_inactive_scope",
            password="Passw0rd!",
            rol="admin_sede",
            email="admin.inactive.scope@sadi.test",
            sede_principal="north",
        )
        self.auth(admin.username, "Passw0rd!", expected_role="admin")

        by_flag = self.client.get("/api/sedes/?include_inactive=true")
        self.assertEqual(by_flag.status_code, status.HTTP_400_BAD_REQUEST, by_flag.data)
        self.assertEqual(by_flag.data.get("field"), "active")
        self.assertIn("active", by_flag.data.get("detail", {}))

        by_active_false = self.client.get("/api/sedes/?active=false")
        self.assertEqual(by_active_false.status_code, status.HTTP_400_BAD_REQUEST, by_active_false.data)
        self.assertEqual(by_active_false.data.get("field"), "active")
        self.assertIn("active", by_active_false.data.get("detail", {}))


class SuperadminControlCenterPermissionTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="center_super",
            password="Passw0rd!",
            rol="superadmin",
            email="center.super@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.admin_sede = self.create_user(
            username="center_admin",
            password="Passw0rd!",
            rol="admin_sede",
            email="center.admin@sadi.test",
            sede_principal="sede-1",
        )

    def test_non_superadmin_cannot_manage_control_center_resources(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")

        endpoints = [
            ("/api/sedes/", {"code": "campus-x", "name": "Campus X"}),
            ("/api/roles/", {"code": "auditor", "name": "Auditor"}),
            ("/api/permisos/", {"code": "audit.read", "name": "Ver auditoria"}),
            ("/api/asignaciones/", {"role": "admin_sede", "permission": "user.read", "scope": "SEDE"}),
        ]
        for url, payload in endpoints:
            r = self.client.post(url, payload, format="json")
            self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)

        sede = Sede.objects.filter(code="sede-1").first()
        role = Role.objects.filter(code="admin_sede").first()
        permission = RbacPermission.objects.filter(code="user.read").first()
        self.assertIsNotNone(sede)
        self.assertIsNotNone(role)
        self.assertIsNotNone(permission)

        patch_sede = self.client.patch(f"/api/sedes/{sede.id}/", {"name": "Cambio ilegal"}, format="json")
        self.assertEqual(patch_sede.status_code, status.HTTP_403_FORBIDDEN, patch_sede.data)
        delete_sede = self.client.delete(f"/api/sedes/{sede.id}/")
        self.assertEqual(delete_sede.status_code, status.HTTP_403_FORBIDDEN, delete_sede.data)

        patch_role = self.client.patch(f"/api/roles/{role.id}/", {"name": "Cambio ilegal"}, format="json")
        self.assertEqual(patch_role.status_code, status.HTTP_403_FORBIDDEN, patch_role.data)
        delete_role = self.client.delete(f"/api/roles/{role.id}/")
        self.assertEqual(delete_role.status_code, status.HTTP_403_FORBIDDEN, delete_role.data)

        patch_permission = self.client.patch(
            f"/api/permisos/{permission.id}/",
            {"name": "Cambio ilegal"},
            format="json",
        )
        self.assertEqual(patch_permission.status_code, status.HTTP_403_FORBIDDEN, patch_permission.data)
        delete_permission = self.client.delete(f"/api/permisos/{permission.id}/")
        self.assertEqual(delete_permission.status_code, status.HTTP_403_FORBIDDEN, delete_permission.data)

        denied_audit = self.client.get("/api/auditoria/eventos/")
        self.assertEqual(denied_audit.status_code, status.HTTP_403_FORBIDDEN, denied_audit.data)

    def test_superadmin_can_create_and_deactivate_sede(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        created = self.client.post(
            "/api/sedes/",
            {"code": "campus-z", "name": "Campus Z"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Crear sede cliente"),
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        sede_id = created.data.get("id")
        self.assertIsNotNone(sede_id)

        deleted = self.client.delete(
            f"/api/sedes/{sede_id}/",
            **self.control_panel_headers(session_id=session_id, reason="Desactivar sede cliente"),
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK, deleted.data)
        self.assertFalse(Sede.objects.get(id=sede_id).is_active)


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


class ImportValidationServiceTests(BaseApiTest):
    def make_csv(self, content: str):
        file_obj = io.BytesIO(content.encode("utf-8"))
        file_obj.name = "aprendices.csv"
        return file_obj

    def test_validate_excel_skips_blank_rows_and_counts_error_rows_once(self):
        csv_file = self.make_csv(
            "Nombres,Apellidos,Documento,Telefono,Correo,Jornada,Programa,Sede\n"
            "Ana,Importa,1234567890,3001234567,,TARDE,ADSO,sede-1\n"
            ",,,,,,,\n"
            ",,abc,300,correo-invalido,INVALIDA,,sede-1\n"
        )

        result = validate_excel(csv_file, require_sede=True)

        self.assertEqual(result.total_rows, 2)
        self.assertEqual(len(result.rows), 1)
        self.assertEqual(count_distinct_error_rows(result.errors), 1)
        self.assertEqual({err["row"] for err in result.errors}, {4})

    def test_validate_excel_for_admin_sede_does_not_require_sede_column(self):
        csv_file = self.make_csv(
            "Nombres,Apellidos,Documento,Telefono,Correo,Jornada,Programa\n"
            "Ana,Importa,1234567890,3001234567,,TARDE,ADSO\n"
        )

        result = validate_excel(csv_file, require_sede=False, default_sede_code="sede-1")

        self.assertEqual(result.total_rows, 1)
        self.assertEqual(result.errors, [])
        self.assertEqual(result.rows[0]["sede_principal"], "sede-1")


class ImportValidationApiTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="import_api_superadmin",
            password="Passw0rd!",
            rol="superadmin",
            email="import.api.superadmin@sadi.test",
            is_staff=True,
            is_superuser=True,
        )

    def _auth_superadmin(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

    def test_validate_import_rejects_unsupported_extension(self):
        self._auth_superadmin()
        upload = io.BytesIO(b"hola")
        upload.name = "aprendices.txt"

        response = self.client.post(
            "/api/usuarios/importar-aprendices/validar/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(response.data.get("code"), "VALIDATION_ERROR")
        self.assertIn("Formato no soportado", str(response.data.get("detail", {}).get("file", [""])[0]))

    def test_validate_import_rejects_oversized_file(self):
        self._auth_superadmin()
        upload = io.BytesIO(b"0" * (5 * 1024 * 1024 + 1))
        upload.name = "aprendices.csv"

        response = self.client.post(
            "/api/usuarios/importar-aprendices/validar/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(response.data.get("code"), "VALIDATION_ERROR")
        self.assertIn("5 MB", str(response.data.get("detail", {}).get("file", [""])[0]))


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
