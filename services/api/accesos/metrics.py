from __future__ import annotations

from django.core.cache import cache


METRICS_PREFIX = "sadi:metrics"


def incr(metric: str, *, amount: int = 1):
    if not metric:
        return
    key = f"{METRICS_PREFIX}:{metric}"
    try:
        if cache.add(key, amount, timeout=None):
            return
        cache.incr(key, amount)
    except Exception:
        # Metrics are best-effort and must not break request flow.
        return
