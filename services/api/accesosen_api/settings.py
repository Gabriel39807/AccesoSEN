"""Entry-point settings selector for Django environments.

Responsibility:
- Select the active settings module (development/base/production)
  from the DJANGO_ENV variable.
"""

from __future__ import annotations

import os


DJANGO_ENV = os.getenv("DJANGO_ENV", "development").strip().lower()

if DJANGO_ENV == "production":
    from .production import *  # noqa: F401,F403
elif DJANGO_ENV == "base":
    from .base import *  # noqa: F401,F403
else:
    from .development import *  # noqa: F401,F403
