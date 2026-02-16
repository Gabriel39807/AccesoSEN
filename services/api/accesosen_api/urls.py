from django.contrib import admin
from django.urls import path, include
from accesos.jwt_views import SadiTokenObtainPairView, SadiTokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/token/", SadiTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", SadiTokenRefreshView.as_view(), name="token_refresh"),

    path("api/", include("accesos.urls")),
]
