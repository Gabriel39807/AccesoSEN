"""Entry-point settings selector for Django environments.

Responsibility:
- Select the active settings module (development/base/production)
  from the DJANGO_ENV variable.
"""

from __future__ import annotations

import os

raw_django_env = os.getenv("DJANGO_ENV")
if raw_django_env is None:
    # Pytest should default to test settings even when caller forgets DJANGO_ENV.
    argv = " ".join(os.sys.argv).lower()
    if "pytest" in argv:
        raw_django_env = "test"

DJANGO_ENV = (raw_django_env or "development").strip().lower()
if DJANGO_ENV == "test" and not os.getenv("TEST_DATABASE_NAME"):
    os.environ["TEST_DATABASE_NAME"] = f"sadi_backend_test_{os.getpid()}"

if DJANGO_ENV == "production":
    from .production import *  # noqa: F401,F403
elif DJANGO_ENV == "test":
    from .test import *  # noqa: F401,F403
elif DJANGO_ENV == "base":
    from .base import *  # noqa: F401,F403
else:
    from .development import *  # noqa: F401,F403
