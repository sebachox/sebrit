from rest_framework.permissions import BasePermission


class EsAdminOTecnico(BasePermission):
    """Admin y técnico: acceso completo (los técnicos levantan el inventario). Cliente: sin acceso."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.rol in ("admin", "tecnico"))
