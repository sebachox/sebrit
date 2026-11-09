from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.assets.permissions import EsAdminOTecnico
from apps.incidents.serializers import EscalarSerializer, IncidenteDetalleSerializer
from apps.incidents.servicios import escalar_ticket
from apps.incidents.views import cuerpo
from apps.organizations.pagination import PaginacionEstandar

from . import servicios
from .models import Ticket
from .serializers import EventoSerializer, TicketDetalleSerializer, TicketListaSerializer


ESTADOS_ACTIVOS = [Ticket.Estado.ABIERTO, Ticket.Estado.EN_PROGRESO]

URGENCIA = Case(
    When(prioridad="critica", then=Value(0)),
    When(prioridad="alta", then=Value(1)),
    When(prioridad="media", then=Value(2)),
    default=Value(3),
    output_field=IntegerField(),
)

ORDENES_TICKETS = {
    "prioridad": [URGENCIA.asc(), "creado_en"],
    "creado_en": ["creado_en"],
    "-creado_en": ["-creado_en"],
}


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
        qs = Ticket.objects.select_related("organizacion", "activo", "tecnico", "reportado_por", "incidente")
        if self.action != "list":
            return qs

        p = self.request.query_params
        q = p.get("q", "").replace("\x00", "").strip()
        if q:
            qs = qs.filter(Q(codigo__icontains=q) | Q(titulo__icontains=q))

        for campo in ("organizacion", "activo"):
            valor = p.get(campo, "")
            if valor.isdecimal():
                qs = qs.filter(**{f"{campo}_id": int(valor)})

        if p.get("estado") in Ticket.Estado.values:
            qs = qs.filter(estado=p["estado"])
        if p.get("abiertos") == "true":
            qs = qs.filter(estado__in=ESTADOS_ACTIVOS)
        if p.get("prioridad") in Ticket.Prioridad.values:
            qs = qs.filter(prioridad=p["prioridad"])
        if p.get("categoria") in Ticket.Categoria.values:
            qs = qs.filter(categoria=p["categoria"])

        tecnico = p.get("tecnico", "")
        if tecnico == "sin_asignar":
            qs = qs.filter(tecnico__isnull=True)
        elif tecnico.isdecimal():
            qs = qs.filter(tecnico_id=int(tecnico))

        orden = ORDENES_TICKETS.get(p.get("ordering", ""), ORDENES_TICKETS["prioridad"])
        return qs.order_by(*orden, "id")

    def _detalle(self, ticket):
        return Response(TicketDetalleSerializer(ticket, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        datos = cuerpo(request)
        ticket = servicios.cambiar_estado(
            self.get_object(), datos.get("estado"), datos.get("solucion"), request.user
        )
        return self._detalle(ticket)

    @action(detail=True, methods=["post"])
    def prioridad(self, request, pk=None):
        datos = cuerpo(request)
        ticket = servicios.corregir_prioridad(
            self.get_object(), datos.get("prioridad"), datos.get("motivo"), request.user
        )
        return self._detalle(ticket)

    @action(detail=True, methods=["post"])
    def comentarios(self, request, pk=None):
        datos = cuerpo(request)
        evento = servicios.comentar(
            self.get_object(), datos.get("texto"), request.user, datos.get("visible_cliente", False)
        )
        return Response(EventoSerializer(evento).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def escalar(self, request, pk=None):
        ticket = self.get_object()
        entrada = EscalarSerializer(data=cuerpo(request))
        entrada.is_valid(raise_exception=True)
        incidente = escalar_ticket(
            ticket, entrada.validated_data["impacto"], entrada.validated_data["fecha_origen"], request.user
        )
        datos = IncidenteDetalleSerializer(incidente, context=self.get_serializer_context()).data
        return Response(datos, status=status.HTTP_201_CREATED)
