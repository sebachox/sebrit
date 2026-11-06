from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import LoginView, UsuarioActualView
from apps.assets.views import ActivoViewSet
from apps.dashboard.views import AdminDashboardView
from apps.organizations.views import OrganizacionViewSet

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("organizaciones", OrganizacionViewSet, basename="organizacion")
router.register("activos", ActivoViewSet, basename="activo")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/me/", UsuarioActualView.as_view()),
    path("api/dashboard/admin/", AdminDashboardView.as_view()),
    path("api/", include(router.urls)),
]
