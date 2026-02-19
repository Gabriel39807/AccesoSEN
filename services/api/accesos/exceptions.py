from __future__ import annotations

import logging
from typing import Any

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .error_codes import ErrorCode

logger = logging.getLogger(__name__)


def _error_payload(code: str, message: str, detail=None, field=None):
    return {
        "code": code,
        "message": message,
        "detail": detail,
        "field": field,
        "permitido": False,
        "motivo": message,
    }


FIELD_LABELS = {
    "username": "nombre de usuario",
    "password": "contrasena",
    "email": "correo",
    "new_email": "nuevo correo",
    "documento": "documento",
    "telefono": "telefono",
    "rol": "rol",
    "estado": "estado",
    "sede_principal": "sede principal",
    "programa_formacion": "programa de formacion",
    "jornada": "jornada",
    "new_password": "nueva contrasena",
    "current_password": "contrasena actual",
    "otp": "codigo OTP",
    "serial": "serial",
    "marca": "marca",
    "modelo": "modelo",
    "equipos": "equipos",
    "propietario": "propietario",
    "usuario": "usuario",
}


def _first_message(value: Any) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        if text == "This field is required.":
            text = "Este campo es obligatorio."
        elif text == "This field may not be blank.":
            text = "Este campo no puede estar vacio."
        elif text == "A valid email address is required.":
            text = "El correo no tiene un formato valido."
        return text or None
    if isinstance(value, list):
        for item in value:
            message = _first_message(item)
            if message:
                return message
        return None
    if isinstance(value, dict):
        for _, item in value.items():
            message = _first_message(item)
            if message:
                return message
        return None
    return None


def _human_field(field: str) -> str:
    return FIELD_LABELS.get(field, field.replace("_", " "))


def _extract_validation_summary(detail: Any) -> tuple[str | None, str | None]:
    if isinstance(detail, dict):
        field_messages: list[tuple[str, str]] = []
        global_message: str | None = None
        for field, value in detail.items():
            if field in {"non_field_errors", "detail", "message"}:
                message = _first_message(value)
                if message:
                    global_message = message
                continue

            message = _first_message(value)
            if message:
                field_messages.append((str(field), message))

        if field_messages:
            first_field, first_message = field_messages[0]
            if len(field_messages) == 1:
                return first_field, first_message

            max_items = 3
            joined = "; ".join(f"{_human_field(field)}: {msg}" for field, msg in field_messages[:max_items])
            suffix = " ..." if len(field_messages) > max_items else ""
            return first_field, f"Corrige estos campos: {joined}{suffix}"

        if global_message:
            return None, global_message

        message = _first_message(detail)
        return None, message

    message = _first_message(detail)
    return None, message


def _build_validation_message(field: str | None, message: str | None) -> str:
    if message and message.lower().startswith("corrige estos campos:"):
        return message
    if field and message:
        label = _human_field(field)
        return f"Revisa el campo {label}: {message}"
    if message:
        return message
    return "Revisa los datos enviados e intenta nuevamente."


def ui_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        request = context.get("request")
        path = getattr(request, "path", "")
        if str(path).startswith("/api/"):
            logger.exception("Unhandled API exception in %s", path, exc_info=exc)
            return Response(
                _error_payload(
                    code=ErrorCode.SERVER_ERROR,
                    message="Ocurrio un error interno. Intenta nuevamente.",
                    detail=None,
                ),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return response

    if isinstance(exc, NotAuthenticated):
        response.data = _error_payload(
            code=ErrorCode.NOT_AUTHENTICATED,
            message="Debes iniciar sesion para continuar.",
            detail=response.data,
        )
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return response

    if isinstance(exc, AuthenticationFailed):
        detail = exc.detail if isinstance(exc.detail, dict) else response.data
        code = detail.get("code", ErrorCode.INVALID_CREDENTIALS) if isinstance(detail, dict) else ErrorCode.INVALID_CREDENTIALS
        message = (
            detail.get("message", "Tu sesion no es valida o expiro.")
            if isinstance(detail, dict)
            else "Tu sesion no es valida o expiro."
        )
        response.data = _error_payload(code=code, message=message, detail=detail)
        if code == ErrorCode.ACCOUNT_LOCKED_15MIN:
            response.status_code = status.HTTP_423_LOCKED
        else:
            response.status_code = status.HTTP_401_UNAUTHORIZED
        return response

    if isinstance(exc, PermissionDenied):
        response.data = _error_payload(
            code=ErrorCode.PERMISSION_DENIED,
            message="No tienes permisos para realizar esta accion.",
            detail=response.data,
        )
        response.status_code = status.HTTP_403_FORBIDDEN
        return response

    if isinstance(exc, ValidationError):
        field, first_message = _extract_validation_summary(response.data)
        response.data = _error_payload(
            code=ErrorCode.VALIDATION_ERROR,
            message=_build_validation_message(field, first_message),
            detail=response.data,
            field=field,
        )
        response.status_code = status.HTTP_400_BAD_REQUEST
        return response

    detail = response.data
    message = "Ocurrio un error inesperado. Intenta nuevamente."
    if isinstance(detail, dict) and isinstance(detail.get("detail"), str):
        message = detail["detail"]
    response.data = _error_payload(
        code=ErrorCode.SERVER_ERROR if response.status_code >= 500 else ErrorCode.VALIDATION_ERROR,
        message=message,
        detail=detail,
    )
    return response
