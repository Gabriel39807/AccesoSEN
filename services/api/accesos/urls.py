from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    UsuarioViewSet,
    AccesoViewSet,
    EquipoViewSet,
    TurnoViewSet,
    NotificacionViewSet,
    MeView,
    GuardiaEstadoActualView,
    ChangeInitialPasswordView,
    AprendizMiQRView,
    AprendizMiQRDownloadView,
    PasswordResetRequestView,
    PasswordResetVerifyView,
    PasswordResetConfirmView,
)

router = DefaultRouter()
router.register(r"usuarios", UsuarioViewSet, basename="usuarios")
router.register(r"accesos", AccesoViewSet, basename="accesos")
router.register(r"equipos", EquipoViewSet, basename="equipos")
router.register(r"turnos", TurnoViewSet, basename="turnos")
router.register(r"notificaciones", NotificacionViewSet, basename="notificaciones")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("auth/change-initial-password/", ChangeInitialPasswordView.as_view(), name="change-initial-password"),
    path("aprendiz/mi-qr/", AprendizMiQRView.as_view(), name="aprendiz-mi-qr"),
    path("aprendiz/mi-qr/descargar/", AprendizMiQRDownloadView.as_view(), name="aprendiz-mi-qr-descargar"),
    path("guardia/estado-actual/", GuardiaEstadoActualView.as_view(), name="guardia-estado-actual"),

    # Password reset OTP
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password-reset/verify/", PasswordResetVerifyView.as_view(), name="password-reset-verify"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]

urlpatterns += router.urls
