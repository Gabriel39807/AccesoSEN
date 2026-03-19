from django.test import override_settings
from rest_framework import status

from .models import ControlPanelAuditEvent, ControlPanelQuotaCounter, TenantBrandingConfig
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
        self.assertEqual(quotas.data.get("count"), 5)

        closed = self.client.post("/api/control-panel/session/close/", {}, format="json", HTTP_X_CONTROL_PANEL_SESSION=session_id)
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
