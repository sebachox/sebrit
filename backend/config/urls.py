from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import LoginView, TecnicosView, UsuarioActualView
from apps.assets.views import ActivoViewSet, BackupViewSet
from apps.dashboard.views import AdminDashboardView
from apps.incidents.views import IncidenteViewSet
from apps.organizations.views import OrganizacionViewSet
from apps.tickets.views import TicketViewSet

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("organizaciones", OrganizacionViewSet, basename="organizacion")
router.register("activos", ActivoViewSet, basename="activo")
router.register("backups", BackupViewSet, basename="backup")
router.register("tickets", TicketViewSet, basename="ticket")
router.register("incidentes", IncidenteViewSet, basename="incidente")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/me/", UsuarioActualView.as_view()),
    path("api/dashboard/admin/", AdminDashboardView.as_view()),
    path("api/tecnicos/", TecnicosView.as_view()),
    path("api/", include(router.urls)),
]
