"""Compatibility layer for auth-related views.

Responsibility:
- Re-export view classes from `accesos.views`.
- Keep stable imports for routing modules.
"""

from accesos.views import (
    AprendizEmailChangeConfirmView,
    AprendizEmailChangeRequestView,
    AprendizMiQRDownloadView,
    AprendizMiQRView,
    AprendizPerfilView,
    ChangeInitialPasswordView,
    ConfiguracionSistemaView,
    ControlPanelBrandingConfigView,
    ControlPanelBrandingPresetListView,
    ControlPanelSessionCloseView,
    ControlPanelSessionRequestOtpView,
    ControlPanelSessionRequestPasskeyView,
    ControlPanelSessionStatusView,
    ControlPanelSessionVerifyOtpView,
    ControlPanelSessionVerifyPasskeyView,
    GuardiaEstadoActualView,
    HealthCheckView,
    MeView,
    PasskeyAuthOptionsView,
    PasskeyAuthVerifyView,
    PasskeyRegisterOptionsView,
    PasskeyRegisterVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PasswordResetVerifyView,
)

__all__ = [
    "AprendizEmailChangeConfirmView",
    "AprendizEmailChangeRequestView",
    "AprendizMiQRDownloadView",
    "AprendizMiQRView",
    "AprendizPerfilView",
    "ChangeInitialPasswordView",
    "ConfiguracionSistemaView",
    "ControlPanelBrandingConfigView",
    "ControlPanelBrandingPresetListView",
    "ControlPanelSessionCloseView",
    "ControlPanelSessionRequestOtpView",
    "ControlPanelSessionRequestPasskeyView",
    "ControlPanelSessionStatusView",
    "ControlPanelSessionVerifyOtpView",
    "ControlPanelSessionVerifyPasskeyView",
    "GuardiaEstadoActualView",
    "HealthCheckView",
    "MeView",
    "PasskeyAuthOptionsView",
    "PasskeyAuthVerifyView",
    "PasskeyRegisterOptionsView",
    "PasskeyRegisterVerifyView",
    "PasswordResetConfirmView",
    "PasswordResetRequestView",
    "PasswordResetVerifyView",
]
