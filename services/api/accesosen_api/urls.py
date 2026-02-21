from django.contrib import admin
from django.urls import path, include
from accesos.jwt_views import SadiTokenObtainPairView, SadiTokenRefreshView
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework.permissions import AllowAny
from .health import health, ready

schema_view = get_schema_view(
    openapi.Info(
        title="SADI API",
        default_version="v1",
        description="API de control de accesos, usuarios, turnos, equipos y recuperacion de contrasena.",
    ),
    public=True,
    permission_classes=(AllowAny,),
)

urlpatterns = [
    path("health/", health, name="health"),
    path("ready/", ready, name="ready"),
    path("admin/", admin.site.urls),

    path("api/token/", SadiTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", SadiTokenRefreshView.as_view(), name="token_refresh"),

    path("api/", include("accesos.urls")),
    path("api/openapi.json", schema_view.without_ui(cache_timeout=0), name="openapi-json"),
    path("api/docs/", schema_view.with_ui("swagger", cache_timeout=0), name="swagger-ui"),
    path("api/redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="redoc-ui"),
]
