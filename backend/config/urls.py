from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import LoginView, UsuarioActualView
from apps.dashboard.views import AdminDashboardView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/refresh/", TokenRefreshView.as_view()),
    path("api/auth/me/", UsuarioActualView.as_view()),
    path("api/dashboard/admin/", AdminDashboardView.as_view()),
]
