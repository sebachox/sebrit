from rest_framework.permissions import BasePermission


class EsClienteDelPortal(BasePermission):
    """Solo usuarios `cliente` de una organización activa."""

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.rol == "cliente"):
            return False
        return bool(u.organizacion_id and u.organizacion.activa)
