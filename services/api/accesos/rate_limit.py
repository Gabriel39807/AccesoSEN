from __future__ import annotations

from django.core.cache import cache


def _cache_key(prefix: str, parts: list[str]) -> str:
    return f"sadi:{prefix}:{':'.join(parts)}"


def get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def bump_with_lock(prefix: str, key_parts: list[str], max_attempts: int, window_sec: int, lock_sec: int):
    key = _cache_key(prefix, key_parts)
    lock_key = f"{key}:lock"

    if cache.get(lock_key):
        return {"locked": True, "attempts": max_attempts}

    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, timeout=window_sec)

    if attempts >= max_attempts:
        cache.set(lock_key, 1, timeout=lock_sec)
        cache.delete(key)
        return {"locked": True, "attempts": attempts}

    return {"locked": False, "attempts": attempts}


def is_locked(prefix: str, key_parts: list[str]) -> bool:
    key = _cache_key(prefix, key_parts)
    return bool(cache.get(f"{key}:lock"))


def reset_counter(prefix: str, key_parts: list[str]):
    key = _cache_key(prefix, key_parts)
    cache.delete(key)
