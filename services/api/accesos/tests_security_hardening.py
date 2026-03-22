from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, connection
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from accesos.api.permissions import RequiresPermission
from accesos.domain.services.qr_service import QRParseError, QRService

from .models import Acceso, Equipo, PasswordResetOTP, Permission as RbacPermission, RefreshSession, Role, RolePermission, SedePolicy, Turno, Usuario
from .otp_services import hash_code
from .tests_support import BaseApiTest


class SecurityHardeningTests(BaseApiTest):
    @staticmethod
    def _has_sqlite_trigger(table_name: str) -> bool:
        if connection.vendor != "sqlite":
            return False
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = %s AND tbl_name = %s",
                ["trigger", table_name],
            )
            row = cursor.fetchone()
        return bool(row and row[0])

    def setUp(self):
        super().setUp()
        self.sede_1 = self.sede("sede-1")
        self.guarda = self.create_user(
            username="hardening_guarda",
            password="Passw0rd!",
            rol="guarda",
            documento="7777777777",
            email="hardening.guarda@sadi.test",
            sede_principal="sede-1",
        )
        self.aprendiz = self.create_user(
            username="hardening_aprendiz",
            password="Passw0rd!",
            rol="aprendiz",
            documento="8888888888",
            email="hardening.aprendiz@sadi.test",
            sede_principal="sede-1",
        )
        self.admin_sede = self.create_user(
            username="hardening_admin",
            password="Passw0rd!",
            rol="admin_sede",
            documento="9999999999",
            email="hardening.admin@sadi.test",
            sede_principal="sede-1",
        )

    def _drf_request(self, method: str, path: str, *, user, data=None):
        factory = APIRequestFactory()
        raw_request = getattr(factory, method.lower())(path, data=data or {}, format="json")
        force_authenticate(raw_request, user=user)
        return APIView().initialize_request(raw_request)

    def _ensure_role_permission(self, role_code: str, permission_code: str, scope: str):
        role = Role.objects.get(code=role_code)
        permission = RbacPermission.objects.get(code=permission_code)
        RolePermission.objects.update_or_create(
            role=role,
            permission=permission,
            defaults={"scope": scope},
        )

    def test_requires_permission_denies_when_permission_map_missing(self):
        factory = APIRequestFactory()
        request = factory.get("/api/secure/")
        request.user = self.guarda

        class DummyView:
            action = "list"

        permission = RequiresPermission()
        self.assertFalse(permission.has_permission(request, DummyView()))

    def test_requires_permission_keeps_read_queries_backend_scoped_without_forced_denial(self):
        self._ensure_role_permission("admin_sede", "user.read", RolePermission.Scope.SEDE)
        request = self._drf_request(
            "get",
            "/api/usuarios/?sede_id=sede-2",
            user=self.admin_sede,
        )

        class DummyView:
            action = "list"
            permission_map = {"list": "user.read"}

        permission = RequiresPermission()
        self.assertTrue(permission.has_permission(request, DummyView()))

    def test_requires_permission_allows_same_sede_query_scope_hint(self):
        self._ensure_role_permission("admin_sede", "user.read", RolePermission.Scope.SEDE)
        request = self._drf_request(
            "get",
            "/api/usuarios/?sede_id=sede-1",
            user=self.admin_sede,
        )

        class DummyView:
            action = "list"
            permission_map = {"list": "user.read"}

        permission = RequiresPermission()
        self.assertTrue(permission.has_permission(request, DummyView()))

    def test_requires_permission_blocks_admin_role_escalation_payload(self):
        self._ensure_role_permission("admin_sede", "user.create", RolePermission.Scope.SEDE)
        request = self._drf_request(
            "post",
            "/api/usuarios/",
            user=self.admin_sede,
            data={"rol": "admin_sede", "sede_principal": "sede-1"},
        )

        class DummyView:
            action = "create"
            permission_map = {"create": "user.create"}

        permission = RequiresPermission()
        self.assertFalse(permission.has_permission(request, DummyView()))

    def test_requires_permission_blocks_cross_sede_user_mutation_payload(self):
        self._ensure_role_permission("admin_sede", "user.create", RolePermission.Scope.SEDE)
        request = self._drf_request(
            "post",
            "/api/usuarios/",
            user=self.admin_sede,
            data={"rol": "aprendiz", "sede_principal": "sede-2"},
        )

        class DummyView:
            action = "create"
            permission_map = {"create": "user.create"}

        permission = RequiresPermission()
        self.assertFalse(permission.has_permission(request, DummyView()))

    def test_prevent_multiple_active_turnos_for_same_guard(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        with self.assertRaises(IntegrityError):
            Turno.objects.create(
                guarda=self.guarda,
                sede=self.sede_1,
                jornada=Turno.Jornada.TARDE,
                activo=True,
                fin=None,
            )

    def test_model_blocks_fifth_equipo_outside_view_logic(self):
        for idx in range(1, 5):
            Equipo.objects.create(
                propietario=self.aprendiz,
                serial=f"HARD-{idx}",
                marca="Dell",
                modelo=f"M{idx}",
            )

        with self.assertRaises(DjangoValidationError):
            Equipo.objects.create(
                propietario=self.aprendiz,
                serial="HARD-5",
                marca="Dell",
                modelo="M5",
            )

    def test_model_blocks_acceso_with_inactive_turno(self):
        inicio = timezone.now() - timedelta(minutes=5)
        turno = Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            inicio=inicio,
            activo=False,
            fin=timezone.now(),
        )

        with self.assertRaises(DjangoValidationError):
            Acceso.objects.create(
                usuario=self.aprendiz,
                tipo=Acceso.Tipo.INGRESO,
                registrado_por=self.guarda,
                turno=turno,
                sede=self.sede_1,
            )

    def test_model_blocks_acceso_sede_turno_mismatch(self):
        turno = Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )

        with self.assertRaises(DjangoValidationError):
            Acceso.objects.create(
                usuario=self.aprendiz,
                tipo=Acceso.Tipo.INGRESO,
                registrado_por=self.guarda,
                turno=turno,
                sede=self.sede("sede-2"),
            )

    def test_db_trigger_blocks_fifth_equipo_even_with_raw_insert(self):
        if connection.vendor == "sqlite" and not self._has_sqlite_trigger("accesos_equipo"):
            self.skipTest(
                "DB-level hard-cap raw insert check unavailable in this environment: SQLite test database has no trigger installed on accesos_equipo."
            )

        for idx in range(1, 5):
            Equipo.objects.create(
                propietario=self.aprendiz,
                serial=f"PG-HARD-{idx}",
                marca="HP",
                modelo=f"P{idx}",
            )

        with connection.cursor() as cursor:
            with self.assertRaises(IntegrityError):
                cursor.execute(
                    """
                    INSERT INTO accesos_equipo (propietario_id, serial, marca, modelo, estado, creado_en)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    [
                        self.aprendiz.id,
                        "PG-HARD-5",
                        "HP",
                        "P5",
                        Equipo.Estado.PENDIENTE,
                        timezone.now(),
                    ],
                )

    def test_db_trigger_blocks_acceso_turno_sede_mismatch_with_raw_insert(self):
        if connection.vendor == "sqlite" and not self._has_sqlite_trigger("accesos_acceso"):
            self.skipTest(
                "DB-level acceso/turno/sede raw insert check unavailable in this environment: SQLite test database has no trigger installed on accesos_acceso."
            )

        turno = Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )

        with connection.cursor() as cursor:
            with self.assertRaises(IntegrityError):
                cursor.execute(
                    """
                    INSERT INTO accesos_acceso (usuario_id, fecha, tipo, registrado_por_id, turno_id, sede_id, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        self.aprendiz.id,
                        timezone.now(),
                        Acceso.Tipo.INGRESO,
                        self.guarda.id,
                        turno.id,
                        self.sede("sede-2").id,
                        False,
                    ],
                )

    def test_qr_signed_replay_attempt_is_blocked(self):
        session = RefreshSession.objects.create(
            user=self.aprendiz,
            device_id="qr-replay-device",
            refresh_token_hash=uuid4().hex,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        qr_value, _ = QRService.build_aprendiz_qr_value(
            self.aprendiz.documento,
            sede=self.sede_1,
            session_id=str(session.id),
        )

        first = QRService.parse_document(qr_value, sede=self.sede_1)
        self.assertEqual(first.documento, self.aprendiz.documento)

        with self.assertRaises(QRParseError) as replay_exc:
            QRService.parse_document(qr_value, sede=self.sede_1)
        self.assertEqual(getattr(replay_exc.exception, "code", ""), "replay")

    @override_settings(CURRENT_DJANGO_ENV="production")
    def test_production_environment_forces_signed_qr_even_if_policy_is_plain(self):
        policy, _ = SedePolicy.objects.get_or_create(sede=self.sede_1)
        policy.qr_mode = SedePolicy.QrMode.PLAIN
        policy.save(update_fields=["qr_mode"])
        session = RefreshSession.objects.create(
            user=self.aprendiz,
            device_id="qr-production-device",
            refresh_token_hash=uuid4().hex,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        qr_value, qr_mode = QRService.build_aprendiz_qr_value(
            self.aprendiz.documento,
            sede=self.sede_1,
            session_id=str(session.id),
            user_id=self.aprendiz.id,
        )

        self.assertEqual(qr_mode, SedePolicy.QrMode.SIGNED)
        parsed = QRService.parse_document(qr_value, sede=self.sede_1)
        self.assertEqual(parsed.mode_used, SedePolicy.QrMode.SIGNED)

        with self.assertRaises(QRParseError) as plain_exc:
            QRService.parse_document(self.aprendiz.documento, sede=self.sede_1)
        self.assertEqual(getattr(plain_exc.exception, "code", ""), "mode_violation")

    def test_register_access_without_active_turno_is_rejected_for_guarda(self):
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.post(
            "/api/accesos/",
            {"usuario": self.aprendiz.id, "tipo": Acceso.Tipo.INGRESO},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(response.data.get("code"), "TURNO_REQUIRED")

    def test_register_salida_without_ingreso_previo_is_rejected(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.post(
            "/api/accesos/",
            {"usuario": self.aprendiz.id, "tipo": Acceso.Tipo.SALIDA},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn(response.data.get("code"), {"ACCESO_INCONSISTENTE_EQUIPO", "VALIDATION_ERROR"})

    def test_create_access_is_idempotent_with_header(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        payload = {"usuario": self.aprendiz.id, "tipo": Acceso.Tipo.INGRESO}

        first = self.client.post(
            "/api/accesos/",
            payload,
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="idem-create-001",
        )
        second = self.client.post(
            "/api/accesos/",
            payload,
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="idem-create-001",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(first.data["acceso"]["id"], second.data["acceso"]["id"])
        self.assertEqual(Acceso.objects.filter(usuario=self.aprendiz, tipo=Acceso.Tipo.INGRESO).count(), 1)

    def test_scan_access_is_idempotent_with_header(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        payload = {"documento": self.aprendiz.documento, "tipo": Acceso.Tipo.INGRESO}

        first = self.client.post(
            "/api/accesos/registrar_por_documento/",
            payload,
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="idem-scan-001",
        )
        second = self.client.post(
            "/api/accesos/registrar_por_documento/",
            payload,
            format="json",
            HTTP_X_IDEMPOTENCY_KEY="idem-scan-001",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(first.data["acceso"]["id"], second.data["acceso"]["id"])
        self.assertEqual(Acceso.objects.filter(usuario=self.aprendiz, tipo=Acceso.Tipo.INGRESO).count(), 1)

    def test_validar_documento_accepts_signed_aprendiz_qr(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        session = RefreshSession.objects.create(
            user=self.aprendiz,
            device_id="guard-validate-signed",
            refresh_token_hash=uuid4().hex,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        qr_value, _ = QRService.build_aprendiz_qr_value(
            self.aprendiz.documento,
            sede=self.sede_1,
            session_id=str(session.id),
            user_id=self.aprendiz.id,
        )

        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.post(
            "/api/accesos/validar_documento/",
            {"documento": qr_value},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["aprendiz"]["documento"], self.aprendiz.documento)
        self.assertEqual(response.data["turno"]["sede"], self.sede_1.code)

    def test_registrar_por_documento_accepts_signed_aprendiz_qr(self):
        Turno.objects.create(
            guarda=self.guarda,
            sede=self.sede_1,
            jornada=Turno.Jornada.TARDE,
            activo=True,
            fin=None,
        )
        session = RefreshSession.objects.create(
            user=self.aprendiz,
            device_id="guard-register-signed",
            refresh_token_hash=uuid4().hex,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        qr_value, _ = QRService.build_aprendiz_qr_value(
            self.aprendiz.documento,
            sede=self.sede_1,
            session_id=str(session.id),
            user_id=self.aprendiz.id,
        )

        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.post(
            "/api/accesos/registrar_por_documento/",
            {"documento": qr_value, "tipo": Acceso.Tipo.INGRESO},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["acceso"]["usuario"], self.aprendiz.id)
        self.assertEqual(response.data["acceso"]["tipo"], Acceso.Tipo.INGRESO)

    def test_access_token_with_invalid_sid_is_rejected(self):
        login = self.client.post(
            "/api/token/",
            {"username": self.guarda.documento, "password": "Passw0rd!", "expected_role": "guarda"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.guarda.refresh_from_db()
        self.assertIsNotNone(self.guarda.active_session_id)

        forged = AccessToken.for_user(self.guarda)
        forged["rol"] = Usuario.Rol.GUARDA
        forged["sid"] = str(uuid4())

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(forged)}")
        denied = self.client.get("/api/guardia/estado-actual/")
        self.assertEqual(denied.status_code, status.HTTP_401_UNAUTHORIZED, denied.data)

    def test_turno_fin_before_inicio_fails_db_constraint(self):
        inicio = timezone.now()
        with self.assertRaises(IntegrityError):
            Turno.objects.create(
                guarda=self.guarda,
                sede=self.sede_1,
                jornada=Turno.Jornada.TARDE,
                inicio=inicio,
                fin=inicio - timedelta(minutes=1),
                activo=False,
            )

    def test_password_reset_verify_blocks_bruteforce_after_max_attempts(self):
        salt = "hardening-otp-salt"
        PasswordResetOTP.objects.create(
            user=self.aprendiz,
            salt=salt,
            code_hash=hash_code(salt, "12345"),
            expires_at=timezone.now() + timedelta(minutes=5),
            channel=PasswordResetOTP.Channel.EMAIL,
        )

        for _ in range(5):
            wrong = self.client.post(
                "/api/auth/password-reset/verify/",
                {"email": self.aprendiz.email, "otp": "99999"},
                format="json",
            )
            self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST, wrong.data)

        blocked = self.client.post(
            "/api/auth/password-reset/verify/",
            {"email": self.aprendiz.email, "otp": "99999"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS, blocked.data)
        self.assertEqual(blocked.data.get("code"), "OTP_TOO_MANY_ATTEMPTS")

    def test_guarda_cannot_delete_acceso_log(self):
        acceso = Acceso.objects.create(
            usuario=self.aprendiz,
            tipo=Acceso.Tipo.INGRESO,
            sede=self.sede_1,
            registrado_por=self.guarda,
        )
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.delete(f"/api/accesos/{acceso.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        acceso.refresh_from_db()
        self.assertFalse(acceso.is_deleted)

    def test_access_log_cannot_be_updated(self):
        acceso = Acceso.objects.create(
            usuario=self.aprendiz,
            tipo=Acceso.Tipo.INGRESO,
            sede=self.sede_1,
            registrado_por=self.guarda,
        )
        self.auth(self.guarda.documento, "Passw0rd!", expected_role="guarda")
        response = self.client.patch(
            f"/api/accesos/{acceso.id}/",
            {"tipo": Acceso.Tipo.SALIDA},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED, response.data)
        acceso.refresh_from_db()
        self.assertEqual(acceso.tipo, Acceso.Tipo.INGRESO)

    def test_sensitive_tables_enable_rls_and_remove_anon_grants(self):
        if connection.vendor != "postgresql":
            self.skipTest(
                "RLS verification is PostgreSQL-only: SQLite in this environment has no pg_class catalogs or row-level security feature to assert."
            )

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.relrowsecurity
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'accesos_usuario';
                """
            )
            row = cursor.fetchone()
            self.assertIsNotNone(row)
            self.assertTrue(bool(row[0]))

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.role_table_grants
                WHERE table_schema = 'public'
                  AND table_name = 'accesos_usuario'
                  AND grantee IN ('anon', 'authenticated');
                """
            )
            grant_count = int(cursor.fetchone()[0] or 0)
            self.assertEqual(grant_count, 0)
