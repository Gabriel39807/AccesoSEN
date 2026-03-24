from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.utils import timezone
from django.test import override_settings
from rest_framework import status

from .models import EmailChangeOTP, PasswordResetOTP
from .otp_services import OTP_TTL_MINUTES, create_otp_for_user, hash_code, send_password_reset_email
from .rate_limit import build_rate_limit_key
from .tests_support import BaseApiTest


class OtpServiceHardeningTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="otp_hardening_user",
            password="Passw0rd!",
            rol="aprendiz",
            documento="8181818181",
            email="otp.hardening@sadi.test",
        )

    def test_rate_limit_cache_keys_do_not_expose_raw_identifiers(self):
        key = build_rate_limit_key("otp-request-user", [self.user.email, "127.0.0.1"])
        self.assertTrue(key.startswith("sadi:otp-request-user:"))
        self.assertNotIn(self.user.email.lower(), key)
        self.assertNotIn("127.0.0.1", key)

    def test_create_otp_for_user_invalidates_previous_active_tokens(self):
        old_otp = PasswordResetOTP.objects.create(
            user=self.user,
            salt="legacy-salt",
            code_hash=hash_code("legacy-salt", "12345"),
            expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
            channel=PasswordResetOTP.Channel.EMAIL,
        )

        new_otp, code = create_otp_for_user(self.user)

        self.assertEqual(len(code), 5)
        old_otp.refresh_from_db()
        self.assertIsNotNone(old_otp.used_at)
        self.assertIsNone(new_otp.used_at)
        self.assertGreater(new_otp.expires_at, timezone.now())


class PasswordResetOtpHardeningFlowTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="reset_hardening_user",
            password="Passw0rd!",
            rol="aprendiz",
            documento="8282828282",
            email="reset.hardening@sadi.test",
        )

    def _request_password_reset_code(self):
        with patch("accesos.views.send_password_reset_email") as send_mock:
            response = self.client.post(
                "/api/auth/password-reset/request/",
                {"email": self.user.email},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.assertTrue(send_mock.called)
            return send_mock.call_args.args[1]

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="no-reply@sadi.test",
    )
    def test_password_reset_request_delivers_email_and_persists_hashed_otp(self):
        mail.outbox = []

        response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        otp_obj = PasswordResetOTP.objects.get(user=self.user, used_at__isnull=True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn("Codigo de recuperacion", mail.outbox[0].subject)
        self.assertIn(str(OTP_TTL_MINUTES), mail.outbox[0].body)
        self.assertTrue(otp_obj.code_hash)
        self.assertNotIn(otp_obj.code_hash, mail.outbox[0].body)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.gmail.com",
        EMAIL_PORT=587,
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        EMAIL_HOST_USER="otp@sadi.test",
        EMAIL_HOST_PASSWORD="abcd efgh ijkl mnop",
        DEFAULT_FROM_EMAIL="otp@sadi.test",
    )
    def test_password_reset_email_normalizes_gmail_app_password_spacing(self):
        with patch("accesos.otp_services.get_connection") as get_connection_mock:
            fake_connection = get_connection_mock.return_value
            fake_connection.send_messages.return_value = 1

            send_password_reset_email(self.user.email, "12345")

        self.assertEqual(get_connection_mock.call_args.kwargs["password"], "abcdefghijklmnop")

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.gmail.com",
        EMAIL_PORT=587,
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        EMAIL_HOST_USER="",
        EMAIL_HOST_PASSWORD="",
        DEFAULT_FROM_EMAIL="",
    )
    def test_password_reset_request_fails_clearly_when_email_backend_is_not_configured(self):
        response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, response.data)
        self.assertEqual(response.data.get("code"), "NETWORK_ERROR")
        self.assertEqual(response.data.get("message"), "El servicio de correo OTP no esta disponible.")
        self.assertFalse(PasswordResetOTP.objects.filter(user=self.user, used_at__isnull=True).exists())

    def test_password_reset_request_keeps_only_latest_otp_active(self):
        first_code = self._request_password_reset_code()
        second_code = self._request_password_reset_code()

        verify_old = self.client.post(
            "/api/auth/password-reset/verify/",
            {"email": self.user.email, "otp": first_code},
            format="json",
        )
        self.assertEqual(verify_old.status_code, status.HTTP_400_BAD_REQUEST, verify_old.data)
        self.assertEqual(verify_old.data.get("code"), "OTP_INVALID")

        verify_new = self.client.post(
            "/api/auth/password-reset/verify/",
            {"email": self.user.email, "otp": second_code},
            format="json",
        )
        self.assertEqual(verify_new.status_code, status.HTTP_200_OK, verify_new.data)

    def test_password_reset_confirm_rejects_reused_otp(self):
        otp_obj, code = create_otp_for_user(self.user)
        self.assertIsNone(otp_obj.used_at)

        confirmed = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"email": self.user.email, "otp": code, "new_password": "NewPassw0rd!"},
            format="json",
        )
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK, confirmed.data)

        replay = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"email": self.user.email, "otp": code, "new_password": "AnotherPassw0rd!"},
            format="json",
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST, replay.data)
        self.assertEqual(replay.data.get("code"), "OTP_INVALID")


class EmailChangeOtpHardeningTests(BaseApiTest):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="email_hardening_user",
            password="Passw0rd!",
            rol="aprendiz",
            documento="8383838383",
            email="email.hardening@sadi.test",
        )
        self.auth(self.user.documento, "Passw0rd!", expected_role="aprendiz")

    def test_email_change_confirm_blocks_after_max_attempts(self):
        salt = "email-hardening-salt"
        EmailChangeOTP.objects.create(
            user=self.user,
            new_email="new.email.hardening@sadi.test",
            salt=salt,
            code_hash=hash_code(salt, "12345"),
            expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
        )

        for _ in range(5):
            wrong = self.client.post(
                "/api/aprendiz/perfil/email-change/confirm/",
                {"new_email": "new.email.hardening@sadi.test", "otp": "99999"},
                format="json",
            )
            self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST, wrong.data)
            self.assertEqual(wrong.data.get("code"), "OTP_INVALID")

        blocked = self.client.post(
            "/api/aprendiz/perfil/email-change/confirm/",
            {"new_email": "new.email.hardening@sadi.test", "otp": "99999"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS, blocked.data)
        self.assertEqual(blocked.data.get("code"), "OTP_TOO_MANY_ATTEMPTS")
