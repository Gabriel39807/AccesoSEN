from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Turno


class GuardTurnoResumeTests(APITestCase):
    def setUp(self):
        self.User = get_user_model()
        self.guarda = self.User.objects.create_user(
            username="guarda1",
            password="1234",
            rol="guarda",
            estado="activo",
        )

    def _auth(self):
        r = self.client.post(reverse("token_obtain_pair"), {"username": "guarda1", "password": "1234"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def test_guardia_estado_actual_sin_turno(self):
        self._auth()
        r = self.client.get("/api/guardia/estado-actual/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data["turno_activo"])

    def test_turno_reanudar_idempotente(self):
        self._auth()
        Turno.objects.create(guarda=self.guarda, sede="CEGAFE", jornada="MANANA", activo=True)
        r1 = self.client.post("/api/turnos/reanudar/")
        r2 = self.client.post("/api/turnos/reanudar/")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data["turno"]["id"], r2.data["turno"]["id"])


class ErrorShapeTests(APITestCase):
    def test_not_authenticated_uses_new_shape(self):
        r = self.client.get("/api/me/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("code", r.data)
        self.assertIn("message", r.data)
        self.assertIn("detail", r.data)
        self.assertIn("field", r.data)


class AprendizSecurityTests(APITestCase):
    def setUp(self):
        self.User = get_user_model()
        self.aprendiz = self.User.objects.create_user(
            username="apr1",
            password="123456",
            rol="aprendiz",
            documento="1053444048",
            must_change_password=True,
        )

    def _auth(self):
        r = self.client.post(reverse("token_obtain_pair"), {"username": "apr1", "password": "123456"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def test_mi_qr_endpoint(self):
        self._auth()
        r = self.client.get("/api/aprendiz/mi-qr/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("qr_value", r.data)
        self.assertTrue(str(r.data["qr_value"]).startswith("SADI1:"))

    def test_change_initial_password(self):
        self._auth()
        r = self.client.post(
            "/api/auth/change-initial-password/",
            {"current_password": "123456", "new_password": "MyPassw0rd"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.aprendiz.refresh_from_db()
        self.assertFalse(self.aprendiz.must_change_password)
