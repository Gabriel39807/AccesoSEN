from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.views import exception_handler

from .error_codes import ErrorCode


def _error_payload(code: str, message: str, detail=None, field=None):
    return {
        "code": code,
        "message": message,
        "detail": detail,
        "field": field,
        "permitido": False,
        "motivo": message,
    }


def ui_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return response

    if isinstance(exc, NotAuthenticated):
        response.data = _error_payload(
            code=ErrorCode.NOT_AUTHENTICATED,
            message="Debes iniciar sesión para continuar.",
            detail=response.data,
        )
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return response

    if isinstance(exc, AuthenticationFailed):
        detail = exc.detail if isinstance(exc.detail, dict) else response.data
        code = detail.get("code", ErrorCode.INVALID_CREDENTIALS) if isinstance(detail, dict) else ErrorCode.INVALID_CREDENTIALS
        message = detail.get("message", "Tu sesión no es válida o expiró.") if isinstance(detail, dict) else "Tu sesión no es válida o expiró."
        response.data = _error_payload(code=code, message=message, detail=detail)
        if code == ErrorCode.ACCOUNT_LOCKED_15MIN:
            response.status_code = status.HTTP_423_LOCKED
        else:
            response.status_code = status.HTTP_401_UNAUTHORIZED
        return response

    if isinstance(exc, PermissionDenied):
        response.data = _error_payload(
            code=ErrorCode.PERMISSION_DENIED,
            message="No tienes permisos para realizar esta acción.",
            detail=response.data,
        )
        response.status_code = status.HTTP_403_FORBIDDEN
        return response

    if isinstance(exc, ValidationError):
        response.data = _error_payload(
            code=ErrorCode.VALIDATION_ERROR,
            message="Datos inválidos.",
            detail=response.data,
        )
        response.status_code = status.HTTP_400_BAD_REQUEST
        return response

    detail = response.data
    message = "Ocurrió un error."
    if isinstance(detail, dict) and isinstance(detail.get("detail"), str):
        message = detail["detail"]
    response.data = _error_payload(
        code=ErrorCode.SERVER_ERROR if response.status_code >= 500 else ErrorCode.VALIDATION_ERROR,
        message=message,
        detail=detail,
    )
    return response
