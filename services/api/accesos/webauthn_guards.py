from rest_framework import status

from .api_responses import error_response
from .error_codes import ErrorCode


def passkey_auth_disabled_response():
    return error_response(
        code=ErrorCode.PASSKEY_DISABLED,
        message="La autenticacion con passkey esta deshabilitada en produccion hasta completar la verificacion WebAuthn real.",
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def control_panel_passkey_disabled_response():
    return error_response(
        code=ErrorCode.PASSKEY_DISABLED,
        message="La autenticacion con passkey del panel esta deshabilitada en produccion hasta completar la verificacion WebAuthn real.",
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
