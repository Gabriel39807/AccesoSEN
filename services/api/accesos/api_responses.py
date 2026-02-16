from __future__ import annotations

from rest_framework.response import Response


def ok_response(data: dict | None = None, status_code: int = 200) -> Response:
    payload = {"permitido": True, "motivo": None}
    if data:
        payload.update(data)
    return Response(payload, status=status_code)


def error_response(
    code: str,
    message: str,
    status_code: int,
    detail=None,
    field: str | None = None,
    legacy_motivo: str | None = None,
    extra: dict | None = None,
) -> Response:
    payload = {
        "code": code,
        "message": message,
        "detail": detail,
        "field": field,
        "permitido": False,
        "motivo": legacy_motivo or message,
    }
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)
