from pathlib import Path

from .tests_support import BaseApiTest


class FrontendContractSmokeTests(BaseApiTest):
    def test_mobile_password_recovery_is_email_only(self):
        root = Path(__file__).resolve().parents[3]
        recovery = (root / "apps" / "mobile-rn" / "app" / "auth" / "password-recovery.tsx").read_text(encoding="utf-8")
        auth_api = (root / "apps" / "mobile-rn" / "src" / "api" / "auth.ts").read_text(encoding="utf-8")
        self.assertNotIn("WhatsApp", recovery)
        self.assertNotIn("passwordResetVerifyWithChannel", auth_api)
        self.assertNotIn("passwordResetConfirmWithChannel", auth_api)
        self.assertIn("/api/auth/password-reset/request/", auth_api)
        self.assertIn("/api/auth/password-reset/verify/", auth_api)
        self.assertIn("/api/auth/password-reset/confirm/", auth_api)

    def test_web_login_uses_expected_role_and_passkey_endpoints(self):
        root = Path(__file__).resolve().parents[3]
        login = (root / "apps" / "web" / "src" / "app" / "(auth)" / "login" / "page.tsx").read_text(encoding="utf-8")
        self.assertIn("expected_role", login)
        self.assertIn("/api/auth/passkeys/auth/options/", login)
        self.assertIn("/api/auth/passkeys/auth/verify/", login)

    def test_web_auth_tokens_are_not_persisted_in_local_storage(self):
        root = Path(__file__).resolve().parents[3]
        auth_lib = (root / "apps" / "web" / "src" / "lib" / "auth.ts").read_text(encoding="utf-8")
        self.assertIn("accessTokenMemory", auth_lib)
        self.assertNotIn(".setItem(", auth_lib)

    def test_admin_pages_use_dynamic_sedes_api_not_hardcoded_constants(self):
        root = Path(__file__).resolve().parents[3]
        files = [
            root / "apps" / "web" / "src" / "app" / "(app)" / "admin" / "usuarios" / "page.tsx",
            root / "apps" / "web" / "src" / "app" / "(app)" / "admin" / "accesos" / "page.tsx",
            root / "apps" / "web" / "src" / "app" / "(app)" / "admin" / "turnos" / "page.tsx",
        ]
        for file_path in files:
            content = file_path.read_text(encoding="utf-8")
            self.assertNotIn("CEGAFE", content)
            self.assertNotIn("SANTA_CLARA", content)
            self.assertNotIn("ITEDRIS", content)
            self.assertNotIn("GASTRONOMIA", content)
            self.assertIn("useSedes", content)
