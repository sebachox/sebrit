from rest_framework import viewsets

from .models import Organizacion
from .pagination import PaginacionEstandar
from .permissions import EsAdminOTecnicoLectura
from .serializers import OrganizacionDetalleSerializer, OrganizacionListaSerializer


class OrganizacionViewSet(viewsets.ModelViewSet):
    """Clientes: lista, detalle, creación y edición parcial. Sin borrado (se desactiva)."""

    queryset = Organizacion.objects.all()
    permission_classes = [EsAdminOTecnicoLectura]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return OrganizacionListaSerializer
        return OrganizacionDetalleSerializer
