from django.db.models import Q
from django.db.models.functions import Lower
from rest_framework import viewsets

from .models import Organizacion
from .pagination import PaginacionEstandar
from .permissions import EsAdminOTecnicoLectura
from .serializers import OrganizacionDetalleSerializer, OrganizacionListaSerializer

# Orden sin distinguir mayúsculas; valores no reconocidos usan el orden por defecto.
ORDENES = {
    "nombre": [Lower("nombre").asc()],
    "-nombre": [Lower("nombre").desc()],
    "creado_en": ["creado_en"],
    "-creado_en": ["-creado_en"],
}


class OrganizacionViewSet(viewsets.ModelViewSet):
    """Clientes: lista, detalle, creación y edición parcial. Sin borrado (se desactiva)."""

    permission_classes = [EsAdminOTecnicoLectura]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return OrganizacionListaSerializer
        return OrganizacionDetalleSerializer

    def get_queryset(self):
        qs = Organizacion.objects.all()
        if self.action != "list":
            return qs

        params = self.request.query_params
        q = params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(nombre__icontains=q)
                | Q(nit__icontains=q)
                | Q(ciudad__icontains=q)
                | Q(contacto_nombre__icontains=q)
            )

        activa = params.get("activa")
        if activa in ("true", "false"):
            qs = qs.filter(activa=activa == "true")

        plan = params.get("plan")
        if plan in Organizacion.Plan.values:
            qs = qs.filter(plan=plan)

        orden = ORDENES.get(params.get("ordering", ""), ORDENES["nombre"])
        return qs.order_by(*orden, "id")
