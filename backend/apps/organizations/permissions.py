from rest_framework.permissions import SAFE_METHODS, BasePermission


class EsAdminOTecnicoLectura(BasePermission):
    """Admin: todo. Técnico: solo lectura. Cliente: sin acceso."""

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.rol == "admin":
            return True
        return u.rol == "tecnico" and request.method in SAFE_METHODS
