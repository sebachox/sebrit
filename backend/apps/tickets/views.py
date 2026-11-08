from rest_framework import viewsets

from apps.assets.permissions import EsAdminOTecnico
from apps.organizations.pagination import PaginacionEstandar

from .models import Ticket
from .serializers import TicketDetalleSerializer, TicketListaSerializer


class TicketViewSet(viewsets.ModelViewSet):
    """Tickets de soporte. No se borran; estado y prioridad tienen acciones propias."""

    permission_classes = [EsAdminOTecnico]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return TicketListaSerializer
        return TicketDetalleSerializer

    def get_queryset(self):
        return Ticket.objects.select_related("organizacion", "activo", "tecnico", "reportado_por").order_by(
            "-creado_en", "-id"
        )
