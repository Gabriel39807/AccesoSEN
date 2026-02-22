"""HTTP health probes for S.A.D.I runtime checks.

Responsibility:
- Expose liveness and readiness endpoints for orchestrators/monitors.
- Validate dependencies (database/cache) without exposing internals.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse


def health(request):
    """Liveness probe.

    Returns:
        JsonResponse: Minimal payload indicating process is alive.
    """
    return JsonResponse({"status": "ok", "service": "sadi-api"})


def ready(request):
    """Readiness probe for database/cache dependencies.

    Returns:
        JsonResponse: `ok` when dependencies are reachable; `degraded` otherwise.
    """
    checks: dict[str, str] = {}
    status_code = 200

    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        status_code = 503

    try:
        cache.set("sadi:ready", "ok", timeout=5)
        checks["cache"] = "ok" if cache.get("sadi:ready") == "ok" else "error"
        if checks["cache"] != "ok":
            status_code = 503
    except Exception:
        checks["cache"] = "error"
        status_code = 503

    payload = {"status": "ok" if status_code == 200 else "degraded", "checks": checks}
    return JsonResponse(payload, status=status_code)
