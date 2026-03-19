from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Sede


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
        r = self.client.post("/api/token/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return r

    def start_control_panel_session(self) -> str:
        with patch("accesos.views.send_control_panel_otp_email") as send_mock:
            requested = self.client.post("/api/control-panel/session/request-otp/", {}, format="json")
            self.assertEqual(requested.status_code, status.HTTP_200_OK, requested.data)
            self.assertTrue(send_mock.called)
            otp_code = send_mock.call_args.args[1]

        verified = self.client.post(
            "/api/control-panel/session/verify-otp/",
            {"request_id": requested.data["request_id"], "otp": otp_code},
            format="json",
        )
        self.assertEqual(verified.status_code, status.HTTP_200_OK, verified.data)
        session_id = verified.data["session"]["id"]
        self.assertTrue(session_id)
        return session_id

    def control_panel_headers(self, *, session_id: str | None = None, reason: str = "Cambio de prueba") -> dict:
        headers = {"HTTP_X_CONTROL_PANEL_REASON": reason}
        if session_id:
            headers["HTTP_X_CONTROL_PANEL_SESSION"] = session_id
        return headers
