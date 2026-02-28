from __future__ import annotations

import os


# Force deterministic test settings module unless caller explicitly overrides it.
os.environ.setdefault("DJANGO_ENV", "test")
# Avoid collisions with stale local test databases from other sessions.
os.environ.setdefault("TEST_DATABASE_NAME", f"sadi_backend_test_{os.getpid()}")
