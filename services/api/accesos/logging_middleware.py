from __future__ import annotations

import json
import logging
import time
import uuid


logger = logging.getLogger("accesos.request")


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id

        response = self.get_response(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

        user = getattr(request, "user", None)
        user_id = getattr(user, "id", None) if getattr(user, "is_authenticated", False) else None
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
        if client_ip and "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        event = {
            "request_id": request_id,
            "method": request.method,
            "path": request.path,
            "status_code": response.status_code,
            "duration_ms": elapsed_ms,
            "user_id": user_id,
            "client_ip": client_ip,
        }
        logger.info(json.dumps(event, ensure_ascii=True))
        response["X-Request-ID"] = request_id
        return response
