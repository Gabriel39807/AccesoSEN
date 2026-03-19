from django.test import override_settings
from rest_framework import status

from .models import WebAuthnCredential
from .tests_support import BaseApiTest


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

    @override_settings(WEBAUTHN_MOCK=True)
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

    @override_settings(
        WEBAUTHN_MOCK=True,
        WEBAUTHN_RP_ID="",
        WEBAUTHN_ORIGIN="",
        ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1", "api.sadi.test"],
    )
    def test_passkey_options_fallback_to_request_host_when_settings_are_empty(self):
        self.auth(self.aprendiz.username, "Passw0rd!", expected_role="aprendiz")

        options = self.client.post(
            "/api/auth/passkeys/register/options/",
            {"nickname": "Fallback passkey"},
            format="json",
            HTTP_HOST="api.sadi.test",
            HTTP_X_FORWARDED_PROTO="https",
        )
        self.assertEqual(options.status_code, status.HTTP_200_OK, options.data)
        self.assertEqual(options.data["rp"]["id"], "api.sadi.test")
        self.assertEqual(options.data["origin"], "https://api.sadi.test")

        self.client.credentials()
        auth_options = self.client.post(
            "/api/auth/passkeys/auth/options/",
            {"username": self.aprendiz.username, "expected_role": "aprendiz"},
            format="json",
            HTTP_HOST="api.sadi.test",
            HTTP_X_FORWARDED_PROTO="https",
        )
        self.assertEqual(auth_options.status_code, status.HTTP_200_OK, auth_options.data)
        self.assertEqual(auth_options.data["rp_id"], "api.sadi.test")

    @override_settings(WEBAUTHN_MOCK=False)
    def test_passkey_auth_endpoints_are_disabled_when_mock_mode_is_off(self):
        auth_options = self.client.post(
            "/api/auth/passkeys/auth/options/",
            {"username": self.aprendiz.username, "expected_role": "aprendiz"},
            format="json",
        )
        self.assertEqual(auth_options.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, auth_options.data)
        self.assertIn("deshabilitada", auth_options.data.get("message", "").lower())

        auth_verify = self.client.post(
            "/api/auth/passkeys/auth/verify/",
            {
                "request_id": "mock-disabled",
                "challenge": "mock-disabled",
                "credential_id": "cred-001",
                "expected_role": "aprendiz",
            },
            format="json",
        )
        self.assertEqual(auth_verify.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, auth_verify.data)
        self.assertIn("deshabilitada", auth_verify.data.get("message", "").lower())
