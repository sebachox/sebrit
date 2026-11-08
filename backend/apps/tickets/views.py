from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.assets.permissions import EsAdminOTecnico
from apps.organizations.pagination import PaginacionEstandar

from . import servicios
from .models import Ticket
from .serializers import EventoSerializer, TicketDetalleSerializer, TicketListaSerializer


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

    def _detalle(self, ticket):
        return Response(TicketDetalleSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        ticket = servicios.cambiar_estado(
            self.get_object(), request.data.get("estado"), request.data.get("solucion"), request.user
        )
        return self._detalle(ticket)

    @action(detail=True, methods=["post"])
    def prioridad(self, request, pk=None):
        ticket = servicios.corregir_prioridad(
            self.get_object(), request.data.get("prioridad"), request.data.get("motivo"), request.user
        )
        return self._detalle(ticket)

    @action(detail=True, methods=["post"])
    def comentarios(self, request, pk=None):
        evento = servicios.comentar(self.get_object(), request.data.get("texto"), request.user)
        return Response(EventoSerializer(evento).data, status=status.HTTP_201_CREATED)
