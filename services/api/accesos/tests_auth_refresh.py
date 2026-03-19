from datetime import timedelta

from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from .models import RefreshSession
from .tests_support import BaseApiTest


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

    def _clear_login_rate_limit(self):
        login_key = (self.aprendiz.username or "").strip().lower()
        ip_key = "127.0.0.1"
        keys = [
            f"sadi:login-user:{login_key}",
            f"sadi:login-user:{login_key}:lock",
            f"sadi:login-ip:{ip_key}",
            f"sadi:login-ip:{ip_key}:lock",
        ]
        for key in keys:
            cache.delete(key)

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
        seconds = int(r.data.get("detail", {}).get("seconds_remaining", 0))
        self.assertGreater(seconds, 0)
        self.assertLessEqual(seconds, 60)

    def test_fifth_temporal_lock_forces_password_recovery(self):
        self.aprendiz.failed_lockouts_count = 4
        self.aprendiz.first_lockout_at = timezone.now()
        self.aprendiz.force_password_reset = False
        self.aprendiz.save(update_fields=["failed_lockouts_count", "first_lockout_at", "force_password_reset"])
        self._clear_login_rate_limit()

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
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN, r.data)
        self.assertEqual(r.data["code"], "PASSWORD_RESET_REQUIRED")

        self.aprendiz.refresh_from_db()
        self.assertTrue(self.aprendiz.force_password_reset)

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

    def test_cookie_transport_sets_cookie_and_refresh_works_without_body_token(self):
        login = self.client.post(
            "/api/auth/login/",
            {
                "username": self.aprendiz.username,
                "password": "Passw0rd!",
                "expected_role": "aprendiz",
                "device_id": "device-cookie-001",
                "auth_transport": "cookie",
            },
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        self.assertIn("sadi_refresh", login.cookies)
        self.assertIn("access", login.data)

        refresh = self.client.post(
            "/api/auth/refresh/",
            {"device_id": "device-cookie-001", "auth_transport": "cookie"},
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(refresh.status_code, status.HTTP_200_OK, refresh.data)
        self.assertIn("access", refresh.data)
        self.assertIn("sadi_refresh", refresh.cookies)

    def test_cookie_transport_refresh_without_cookie_fails(self):
        refresh = self.client.post(
            "/api/auth/refresh/",
            {"device_id": "device-cookie-missing", "auth_transport": "cookie"},
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(refresh.status_code, status.HTTP_400_BAD_REQUEST, refresh.data)
        self.assertEqual(refresh.data.get("field"), "refresh")

    def test_cookie_transport_rotated_cookie_cannot_be_reused(self):
        login = self.client.post(
            "/api/auth/login/",
            {
                "username": self.aprendiz.username,
                "password": "Passw0rd!",
                "expected_role": "aprendiz",
                "device_id": "device-cookie-rotate",
                "auth_transport": "cookie",
            },
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        first_cookie = login.cookies["sadi_refresh"].value

        refresh = self.client.post(
            "/api/auth/refresh/",
            {"device_id": "device-cookie-rotate", "auth_transport": "cookie"},
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(refresh.status_code, status.HTTP_200_OK, refresh.data)
        next_cookie = refresh.cookies["sadi_refresh"].value
        self.assertNotEqual(first_cookie, next_cookie)

        replay = self.client.post(
            "/api/auth/refresh/",
            {"refresh": first_cookie, "device_id": "device-cookie-rotate"},
            format="json",
        )
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED, replay.data)

    def test_cookie_transport_logout_all_clears_refresh_cookie(self):
        login = self.client.post(
            "/api/auth/login/",
            {
                "username": self.aprendiz.username,
                "password": "Passw0rd!",
                "expected_role": "aprendiz",
                "device_id": "device-cookie-logout",
                "auth_transport": "cookie",
            },
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout_all = self.client.post(
            "/api/auth/logout-all/",
            {"auth_transport": "cookie"},
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(logout_all.status_code, status.HTTP_200_OK, logout_all.data)
        self.assertIn("sadi_refresh", logout_all.cookies)

    def test_cookie_transport_revoked_cookie_fails_after_logout_all(self):
        login = self.client.post(
            "/api/auth/login/",
            {
                "username": self.aprendiz.username,
                "password": "Passw0rd!",
                "expected_role": "aprendiz",
                "device_id": "device-cookie-revoked",
                "auth_transport": "cookie",
            },
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        revoked_cookie = login.cookies["sadi_refresh"].value

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout_all = self.client.post(
            "/api/auth/logout-all/",
            {"auth_transport": "cookie"},
            format="json",
            HTTP_X_AUTH_TRANSPORT="cookie",
        )
        self.assertEqual(logout_all.status_code, status.HTTP_200_OK, logout_all.data)

        replay = self.client.post(
            "/api/auth/refresh/",
            {"refresh": revoked_cookie, "device_id": "device-cookie-revoked"},
            format="json",
        )
        self.assertEqual(replay.status_code, status.HTTP_401_UNAUTHORIZED, replay.data)

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
