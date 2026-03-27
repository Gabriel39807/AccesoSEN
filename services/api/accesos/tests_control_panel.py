from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status

from .control_panel_support import control_panel_otp_cache_key
from .models import ControlPanelAuditEvent, ControlPanelQuotaCounter, ProgramaFormacion, TenantBrandingConfig, Usuario
from .tests_support import BaseApiTest


class ControlPanelSessionStepUpTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="cp_super",
            password="Passw0rd!",
            rol="superadmin",
            email="cp.super@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.admin_sede = self.create_user(
            username="cp_admin",
            password="Passw0rd!",
            rol="admin_sede",
            email="cp.admin@sadi.test",
            sede_principal="sede-1",
        )

    def test_superadmin_can_open_status_and_close_control_panel_session(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        status_ok = self.client.get("/api/control-panel/session/status/", HTTP_X_CONTROL_PANEL_SESSION=session_id)
        self.assertEqual(status_ok.status_code, status.HTTP_200_OK, status_ok.data)
        self.assertTrue(status_ok.data.get("active"))
        self.assertEqual(status_ok.data["session"]["id"], session_id)

        quotas = self.client.get("/api/control-panel/quotas/", **self.control_panel_headers(session_id=session_id))
        self.assertEqual(quotas.status_code, status.HTTP_200_OK, quotas.data)
        self.assertEqual(quotas.data.get("count"), 6)

        closed = self.client.post(
            "/api/control-panel/session/close/", {}, format="json", HTTP_X_CONTROL_PANEL_SESSION=session_id
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK, closed.data)
        self.assertFalse(closed.data.get("active"))

        denied_after_close = self.client.get("/api/auditoria/eventos/", HTTP_X_CONTROL_PANEL_SESSION=session_id)
        self.assertEqual(denied_after_close.status_code, status.HTTP_403_FORBIDDEN, denied_after_close.data)

    def test_admin_sede_cannot_open_control_panel_session(self):
        self.auth(self.admin_sede.username, "Passw0rd!", expected_role="admin")
        denied = self.client.post("/api/control-panel/session/request-otp/", {}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

    def test_control_panel_session_cannot_be_reused_by_other_user(self):
        other_superadmin = self.create_user(
            username="cp_super_other",
            password="Passw0rd!",
            rol="superadmin",
            email="cp.super.other@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        self.auth(other_superadmin.username, "Passw0rd!", expected_role="admin")
        denied = self.client.get("/api/auditoria/eventos/", HTTP_X_CONTROL_PANEL_SESSION=session_id)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

    def test_control_panel_otp_cache_key_is_obfuscated(self):
        key = control_panel_otp_cache_key(self.superadmin.id, "request-raw-visible")
        self.assertTrue(key.startswith("sadi:control-panel:otp:"))
        self.assertNotIn(f":{self.superadmin.id}:", key)
        self.assertNotIn("request-raw-visible", key)

    def test_control_panel_verify_otp_is_one_time_and_clears_cache_payload(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        with patch("accesos.views.send_control_panel_otp_email") as send_mock:
            requested = self.client.post("/api/control-panel/session/request-otp/", {}, format="json")
            self.assertEqual(requested.status_code, status.HTTP_200_OK, requested.data)
            otp_code = send_mock.call_args.args[1]

        cache_key = control_panel_otp_cache_key(self.superadmin.id, requested.data["request_id"])
        self.assertIsNotNone(cache.get(cache_key))

        verified = self.client.post(
            "/api/control-panel/session/verify-otp/",
            {"request_id": requested.data["request_id"], "otp": otp_code},
            format="json",
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)
        self.assertIsNone(cache.get(cache_key))

        replay = self.client.post(
            "/api/control-panel/session/verify-otp/",
            {"request_id": requested.data["request_id"], "otp": otp_code},
            format="json",
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST, replay.data)
        self.assertEqual(replay.data.get("code"), "OTP_EXPIRED")

    def test_control_panel_verify_otp_blocks_after_max_attempts(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        with patch("accesos.views.send_control_panel_otp_email") as send_mock:
            requested = self.client.post("/api/control-panel/session/request-otp/", {}, format="json")
            self.assertEqual(requested.status_code, status.HTTP_200_OK, requested.data)
            self.assertTrue(send_mock.called)

        for _ in range(5):
            wrong = self.client.post(
                "/api/control-panel/session/verify-otp/",
                {"request_id": requested.data["request_id"], "otp": "99999"},
                format="json",
            )
            self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST, wrong.data)
            self.assertEqual(wrong.data.get("code"), "OTP_INVALID")

        blocked = self.client.post(
            "/api/control-panel/session/verify-otp/",
            {"request_id": requested.data["request_id"], "otp": "99999"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS, blocked.data)
        self.assertEqual(blocked.data.get("code"), "OTP_TOO_MANY_ATTEMPTS")

    @override_settings(WEBAUTHN_MOCK=False)
    def test_control_panel_passkey_step_up_is_disabled_without_real_webauthn(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")

        request_passkey = self.client.post("/api/control-panel/session/request-passkey/", {}, format="json")
        self.assertEqual(request_passkey.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, request_passkey.data)
        self.assertIn("deshabilitada", request_passkey.data.get("message", "").lower())

        verify_passkey = self.client.post(
            "/api/control-panel/session/verify-passkey/",
            {
                "request_id": "disabled-request",
                "challenge": "disabled-challenge",
                "credential_id": "cred-001",
            },
            format="json",
        )
        self.assertEqual(verify_passkey.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, verify_passkey.data)
        self.assertIn("deshabilitada", verify_passkey.data.get("message", "").lower())


@override_settings(CONTROL_PANEL_BRANDING_DAILY_LIMIT=1)
class ControlPanelGovernanceTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="cp_gov_super",
            password="Passw0rd!",
            rol="superadmin",
            email="cp.gov.super@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )

    def test_branding_mutation_creates_audit_event(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        updated = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "SADI Cliente"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Ajuste inicial de cliente"),
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)

        audit_event = ControlPanelAuditEvent.objects.filter(category="branding").latest("created_at")
        self.assertEqual(audit_event.action, "update")
        self.assertEqual(audit_event.reason, "Ajuste inicial de cliente")
        self.assertEqual(audit_event.target_type, "configuracion_sistema")
        self.assertEqual(audit_event.after_json["nombre_institucion"], "SADI Cliente")

        audit_list = self.client.get(
            "/api/control-panel/audit-events/",
            **self.control_panel_headers(session_id=session_id),
        )
        self.assertEqual(audit_list.status_code, status.HTTP_200_OK, audit_list.data)
        types = {item.get("type") for item in audit_list.data.get("results", [])}
        self.assertIn("control_panel.branding.update", types)

    def test_branding_quota_blocks_second_change_in_same_window(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        first = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "Cliente Uno"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Primer ajuste de branding"),
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)

        second = self.client.put(
            "/api/configuracion/",
            {"nombre_institucion": "Cliente Dos"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Segundo ajuste de branding"),
        )
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS, second.data)
        self.assertEqual(second.data.get("field"), "quota")

        counter = ControlPanelQuotaCounter.objects.get(user=self.superadmin, category="branding")
        self.assertEqual(counter.count, 1)

    def test_branding_presets_and_config_endpoint_apply_selected_preset(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        presets = self.client.get(
            "/api/control-panel/branding/presets/",
            **self.control_panel_headers(session_id=session_id),
        )
        self.assertEqual(presets.status_code, status.HTTP_200_OK, presets.data)
        preset_slugs = {item["slug"] for item in presets.data["results"]}
        self.assertIn("sadi-classic", preset_slugs)
        self.assertIn("forest-campus", preset_slugs)

        changed = self.client.patch(
            "/api/control-panel/branding/config/",
            {"branding_preset": "forest-campus"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Ajustar tema del cliente"),
        )
        self.assertEqual(changed.status_code, status.HTTP_200_OK, changed.data)
        self.assertEqual(changed.data["configuracion"]["branding_preset"], "forest-campus")

        tenant_config = TenantBrandingConfig.get_solo()
        self.assertEqual(tenant_config.branding_preset.slug, "forest-campus")

        public_config = self.client.get("/api/configuracion/")
        self.assertEqual(public_config.status_code, status.HTTP_200_OK, public_config.data)
        self.assertEqual(public_config.data["configuracion"]["branding_preset"], "forest-campus")
        self.assertEqual(public_config.data["configuracion"]["color_aprendiz_light"], "#22C55E")


class ControlPanelProgramsTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.superadmin = self.create_user(
            username="cp_programs_super",
            password="Passw0rd!",
            rol="superadmin",
            email="cp.programs.super@sadi.test",
            is_staff=True,
            is_superuser=True,
            sede_principal=None,
        )

    def test_programs_can_be_created_updated_and_deleted_from_control_panel(self):
        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        created = self.client.post(
            "/api/programas-formacion/",
            {"name": "Analisis de Datos", "is_active": True},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Crear catalogo inicial de programas"),
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        program_id = created.data["id"]

        updated = self.client.patch(
            f"/api/programas-formacion/{program_id}/",
            {"name": "Analitica de Datos", "is_active": False},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Renombrar programa legado"),
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
        self.assertEqual(updated.data["name"], "Analitica de Datos")
        self.assertFalse(updated.data["is_active"])

        listed = self.client.get(
            "/api/programas-formacion/?include_inactive=true",
            **self.control_panel_headers(session_id=session_id),
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK, listed.data)
        self.assertEqual(len(listed.data.get("results", [])), 1)

        deleted = self.client.delete(
            f"/api/programas-formacion/{program_id}/",
            **self.control_panel_headers(session_id=session_id, reason="Eliminar programa no usado"),
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT, deleted.data)
        self.assertFalse(ProgramaFormacion.objects.filter(id=program_id).exists())

    def test_program_delete_is_blocked_when_users_still_reference_program(self):
        program = ProgramaFormacion.objects.create(name="ADSO")
        Usuario.objects.create_user(
            username="aprendiz_programa",
            password="Passw0rd!",
            rol="aprendiz",
            email="aprendiz.programa@sadi.test",
            documento="4455667788",
            programa_formacion="ADSO",
            sede_principal=self.sede("sede-1"),
        )

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        denied = self.client.delete(
            f"/api/programas-formacion/{program.id}/",
            **self.control_panel_headers(session_id=session_id, reason="Intento eliminar programa en uso"),
        )
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST, denied.data)
        self.assertIn("Desactivalo", denied.data.get("message", ""))

    def test_program_rename_updates_existing_users(self):
        program = ProgramaFormacion.objects.create(name="ADSO")
        learner = Usuario.objects.create_user(
            username="aprendiz_programa_rename",
            password="Passw0rd!",
            rol="aprendiz",
            email="aprendiz.programa.rename@sadi.test",
            documento="1122334455",
            programa_formacion="ADSO",
            sede_principal=self.sede("sede-1"),
        )

        self.auth(self.superadmin.username, "Passw0rd!", expected_role="admin")
        session_id = self.start_control_panel_session()

        updated = self.client.patch(
            f"/api/programas-formacion/{program.id}/",
            {"name": "Analisis y Desarrollo de Software"},
            format="json",
            **self.control_panel_headers(session_id=session_id, reason="Renombrar programa homologado"),
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)

        learner.refresh_from_db()
        self.assertEqual(learner.programa_formacion, "Analisis y Desarrollo de Software")
