from django.db.models import Count
from rest_framework import mixins, viewsets
from rest_framework.response import Response

from apps.assets.permissions import EsAdminOTecnico
from apps.organizations.pagination import PaginacionEstandar

from .models import Incidente
from .serializers import IncidenteDetalleSerializer, IncidenteListaSerializer


class IncidenteViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Interrupciones del servicio. No se borran; estado y severidad tienen acciones propias."""

    permission_classes = [EsAdminOTecnico]
    pagination_class = PaginacionEstandar
    # "delete" es solo para quitar tickets: el incidente no define destroy y da 405.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return IncidenteListaSerializer
        return IncidenteDetalleSerializer

    def get_queryset(self):
        qs = Incidente.objects.select_related("organizacion", "tecnico", "reportado_por")
        if self.action != "list":
            return qs
        return qs.annotate(
            total_activos=Count("activos", distinct=True),
            total_tickets=Count("tickets", distinct=True),
        ).order_by("id")

    def _detalle(self, incidente):
        return Response(IncidenteDetalleSerializer(incidente, context=self.get_serializer_context()).data)
