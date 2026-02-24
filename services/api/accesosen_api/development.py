from __future__ import annotations

import socket

from .base import *  # noqa: F401,F403

DEBUG = True


def _detect_local_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()

    try:
        host_name = socket.gethostname()
        for addr_info in socket.getaddrinfo(host_name, None, socket.AF_INET):
            ip = addr_info[4][0]
            if ip:
                addresses.add(ip)
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip:
                addresses.add(ip)
    except OSError:
        pass

    addresses.discard("127.0.0.1")
    return sorted(addresses)


DEFAULT_DEV_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2"]
ALLOWED_HOSTS = sorted(set(env_list("DJANGO_ALLOWED_HOSTS", default=DEFAULT_DEV_ALLOWED_HOSTS) + _detect_local_ipv4_addresses()))

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
)

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)

WEBAUTHN_MOCK = True
