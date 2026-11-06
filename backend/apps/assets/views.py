from rest_framework import viewsets

from apps.organizations.pagination import PaginacionEstandar

from .models import Activo
from .permissions import EsAdminOTecnico
from .serializers import ActivoDetalleSerializer, ActivoListaSerializer


class ActivoViewSet(viewsets.ModelViewSet):
    """Inventario de activos. Sin borrado: se dan de baja con PATCH {"de_baja": true}."""

    permission_classes = [EsAdminOTecnico]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return ActivoListaSerializer
        return ActivoDetalleSerializer

    def get_queryset(self):
        return Activo.objects.select_related("organizacion").order_by("nombre", "id")
