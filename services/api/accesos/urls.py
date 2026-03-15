"""API routing for the `accesos` app.

Responsibility:
- Wire auth and business resource endpoints.
- Expose DRF routers and utility routes like healthcheck.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from accesos.api.viewsets import (
    AccesoViewSet,
    AllowedEmailDomainViewSet,
    EquipoViewSet,
    NotificacionViewSet,
    PermissionViewSet,
    RolePermissionViewSet,
    RoleViewSet,
    SedePolicyViewSet,
    SedeViewSet,
    TurnoViewSet,
    UsuarioViewSet,
)
from accesos.api.viewsets.auth import (
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
from accesos.views import AuditEventsView, ControlPanelQuotaStatusView, GeminiStubView
from .jwt_views import SadiLogoutAllView, SadiLogoutView, SadiTokenObtainPairView, SadiTokenRefreshView

router = DefaultRouter()
router.register(r"sedes", SedeViewSet, basename="sedes")
router.register(r"usuarios", UsuarioViewSet, basename="usuarios")
router.register(r"roles", RoleViewSet, basename="roles")
router.register(r"permisos", PermissionViewSet, basename="permisos")
router.register(r"asignaciones", RolePermissionViewSet, basename="asignaciones")
router.register(r"politicas-sede", SedePolicyViewSet, basename="politicas-sede")
router.register(r"dominios-email", AllowedEmailDomainViewSet, basename="dominios-email")
router.register(r"accesos", AccesoViewSet, basename="accesos")
router.register(r"equipos", EquipoViewSet, basename="equipos")
router.register(r"turnos", TurnoViewSet, basename="turnos")
router.register(r"notificaciones", NotificacionViewSet, basename="notificaciones")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="api-health"),
    path("configuracion/", ConfiguracionSistemaView.as_view(), name="configuracion-sistema"),
    path("control-panel/branding/presets/", ControlPanelBrandingPresetListView.as_view(), name="control-panel-branding-presets"),
    path("control-panel/branding/config/", ControlPanelBrandingConfigView.as_view(), name="control-panel-branding-config"),
    path("auth/login/", SadiTokenObtainPairView.as_view(), name="auth-login"),
    path("auth/refresh/", SadiTokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", SadiLogoutView.as_view(), name="auth-logout"),
    path("auth/logout-all/", SadiLogoutAllView.as_view(), name="auth-logout-all"),
    path("me/", MeView.as_view(), name="me"),
    path("auth/change-initial-password/", ChangeInitialPasswordView.as_view(), name="change-initial-password"),
    path("aprendiz/perfil/", AprendizPerfilView.as_view(), name="aprendiz-perfil"),
    path(
        "aprendiz/perfil/email-change/request/",
        AprendizEmailChangeRequestView.as_view(),
        name="aprendiz-email-change-request",
    ),
    path(
        "aprendiz/perfil/email-change/confirm/",
        AprendizEmailChangeConfirmView.as_view(),
        name="aprendiz-email-change-confirm",
    ),
    path("aprendiz/mi-qr/", AprendizMiQRView.as_view(), name="aprendiz-mi-qr"),
    path("aprendiz/mi-qr/descargar/", AprendizMiQRDownloadView.as_view(), name="aprendiz-mi-qr-descargar"),
    path("guardia/estado-actual/", GuardiaEstadoActualView.as_view(), name="guardia-estado-actual"),
    path("control-panel/session/status/", ControlPanelSessionStatusView.as_view(), name="control-panel-session-status"),
    path(
        "control-panel/session/request-otp/",
        ControlPanelSessionRequestOtpView.as_view(),
        name="control-panel-session-request-otp",
    ),
    path(
        "control-panel/session/verify-otp/",
        ControlPanelSessionVerifyOtpView.as_view(),
        name="control-panel-session-verify-otp",
    ),
    path(
        "control-panel/session/request-passkey/",
        ControlPanelSessionRequestPasskeyView.as_view(),
        name="control-panel-session-request-passkey",
    ),
    path(
        "control-panel/session/verify-passkey/",
        ControlPanelSessionVerifyPasskeyView.as_view(),
        name="control-panel-session-verify-passkey",
    ),
    path("control-panel/session/close/", ControlPanelSessionCloseView.as_view(), name="control-panel-session-close"),
    path("control-panel/quotas/", ControlPanelQuotaStatusView.as_view(), name="control-panel-quotas"),
    path("control-panel/audit-events/", AuditEventsView.as_view(), name="control-panel-audit-events"),
    path("auth/passkeys/register/options/", PasskeyRegisterOptionsView.as_view(), name="passkey-register-options"),
    path("auth/passkeys/register/verify/", PasskeyRegisterVerifyView.as_view(), name="passkey-register-verify"),
    path("auth/passkeys/auth/options/", PasskeyAuthOptionsView.as_view(), name="passkey-auth-options"),
    path("auth/passkeys/auth/verify/", PasskeyAuthVerifyView.as_view(), name="passkey-auth-verify"),
    path("ai/gemini/stub/", GeminiStubView.as_view(), name="ai-gemini-stub"),
    path("auditoria/eventos/", AuditEventsView.as_view(), name="auditoria-eventos"),
    # Password reset OTP
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password-reset/verify/", PasswordResetVerifyView.as_view(), name="password-reset-verify"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]

urlpatterns += router.urls
