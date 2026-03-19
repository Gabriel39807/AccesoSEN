from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SMOKE_DB = ROOT / "smoke_integration.sqlite3"

os.chdir(ROOT)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "accesosen_api.settings")
os.environ.setdefault("DJANGO_ENV", "development")
os.environ.setdefault("DJANGO_SECRET_KEY", "smoke-only-secret-key-not-for-production-123456789")
os.environ.setdefault("DATABASE_ENGINE", "django.db.backends.sqlite3")
os.environ.setdefault("DATABASE_SQLITE_NAME", str(SMOKE_DB))
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:3100,http://localhost:3100")
os.environ.setdefault("CSRF_TRUSTED_ORIGINS", "http://127.0.0.1:3100,http://localhost:3100")
os.environ.setdefault("DEFAULT_SUPERADMIN_AUTO_CREATE", "false")
os.environ.setdefault("WEBAUTHN_MOCK", "false")

import django

django.setup()

from django.contrib.auth import get_user_model
from django.core.management import call_command

from accesos.models import Sede, Usuario


def bootstrap_smoke_data():
    User = get_user_model()

    call_command("migrate", interactive=False, verbosity=0)
    call_command("seed_institution", profile="generic", verbosity=0)

    if not User.objects.filter(username="smoke_admin").exists():
        User.objects.create_superuser(
            username="smoke_admin",
            email="smoke.admin@sadi.test",
            password="SmokePassw0rd!",
            rol=Usuario.Rol.SUPERADMIN,
        )

    if not User.objects.filter(username="smoke_aprendiz").exists():
        sede_1 = Sede.objects.get(code="sede-1")
        User.objects.create_user(
            username="smoke_aprendiz",
            email="smoke.aprendiz@sadi.test",
            password="SmokePassw0rd!",
            rol=Usuario.Rol.APRENDIZ,
            documento="1234567890",
            sede_principal=sede_1,
            estado=Usuario.Estado.ACTIVO,
        )


if __name__ == "__main__":
    bootstrap_smoke_data()
    call_command("runserver", "127.0.0.1:8000", "--noreload")
