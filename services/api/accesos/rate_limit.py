from __future__ import annotations

import time

from django.core.cache import cache


def _cache_key(prefix: str, parts: list[str]) -> str:
    return f"sadi:{prefix}:{':'.join(parts)}"


def get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _now_ts() -> int:
    return int(time.time())


def _set_lock(lock_key: str, lock_sec: int) -> int:
    until_ts = _now_ts() + int(lock_sec)
    # `add` avoids clobbering a lock set by a concurrent request.
    if not cache.add(lock_key, until_ts, timeout=lock_sec):
        cache.set(lock_key, until_ts, timeout=lock_sec)
    return until_ts


def _lock_remaining(lock_key: str) -> int:
    until_ts = cache.get(lock_key)
    if not until_ts:
        return 0
    remaining = int(until_ts) - _now_ts()
    if remaining <= 0:
        cache.delete(lock_key)
        return 0
    return remaining


def bump_with_lock(prefix: str, key_parts: list[str], max_attempts: int, window_sec: int, lock_sec: int):
    key = _cache_key(prefix, key_parts)
    lock_key = f"{key}:lock"

    remaining = _lock_remaining(lock_key)
    if remaining > 0:
        return {"locked": True, "attempts": max_attempts, "remaining_sec": remaining, "just_locked": False}

    # Atomic bump for distributed caches (Redis): add first, then incr.
    if cache.add(key, 1, timeout=window_sec):
        attempts = 1
    else:
        try:
            attempts = int(cache.incr(key))
        except Exception:
            # Fallback for backends without atomic `incr`.
            attempts = int(cache.get(key, 0) or 0) + 1
            cache.set(key, attempts, timeout=window_sec)

    if attempts >= max_attempts:
        until_ts = _set_lock(lock_key, lock_sec)
        cache.delete(key)
        return {
            "locked": True,
            "attempts": attempts,
            "remaining_sec": max(0, until_ts - _now_ts()),
            "just_locked": True,
        }

    return {"locked": False, "attempts": attempts, "remaining_sec": 0, "just_locked": False}


def is_locked(prefix: str, key_parts: list[str]) -> bool:
    key = _cache_key(prefix, key_parts)
    return _lock_remaining(f"{key}:lock") > 0


def get_lock_remaining(prefix: str, key_parts: list[str]) -> int:
    key = _cache_key(prefix, key_parts)
    return _lock_remaining(f"{key}:lock")


def reset_counter(prefix: str, key_parts: list[str]):
    key = _cache_key(prefix, key_parts)
    cache.delete(key)
