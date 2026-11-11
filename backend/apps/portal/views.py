from django.db.models import Count, Q
from django.db.models.functions import Lower
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.models import Activo
from apps.assets.views import ORDENES_ACTIVOS, con_ultimo_backup
from apps.dashboard.views import ACTIVOS, conteo_activos, conteo_backups
from apps.incidents.models import Incidente
from apps.incidents.views import cuerpo
from apps.organizations.pagination import PaginacionEstandar
from apps.tickets.models import Ticket
from apps.tickets.servicios import comentar

from .permissions import EsClienteDelPortal
from .serializers import (
    ActivoPortalDetalleSerializer,
    ActivoPortalListaSerializer,
    EmpresaPortalSerializer,
    EventoPortalSerializer,
    TicketPortalCrearSerializer,
    TicketPortalDetalleSerializer,
    TicketPortalListaSerializer,
)

MSG_CERRADO = "Este ticket está cerrado. Si el problema volvió, abre uno nuevo."


class ResumenView(APIView):
    permission_classes = [EsClienteDelPortal]

    def get(self, request):
        org = request.user.organizacion
        return Response(
            {
                "generado_en": timezone.localtime().isoformat(),
                "empresa": {"id": org.id, "nombre": org.nombre},
                "tickets": Ticket.objects.filter(organizacion=org).aggregate(
                    abiertos=Count("id", filter=Q(estado="abierto")),
                    en_progreso=Count("id", filter=Q(estado="en_progreso")),
                    resueltos=Count("id", filter=Q(estado="resuelto")),
                ),
                "incidentes_activos": Incidente.objects.filter(organizacion=org, estado__in=ACTIVOS).count(),
                "infraestructura": {
                    "servidores": conteo_activos("servidor", org),
                    "redes": conteo_activos("red", org),
                    "backups": conteo_backups(org),
                },
            }
        )


class EmpresaView(APIView):
    permission_classes = [EsClienteDelPortal]

    def get(self, request):
        return Response(EmpresaPortalSerializer(request.user.organizacion).data)


class TicketPortalViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Tickets de la empresa del usuario. La empresa nunca sale de la petición."""

    permission_classes = [EsClienteDelPortal]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "head", "options"]
    lookup_value_regex = r"\d{1,18}"

    def get_serializer_class(self):
        if self.action == "list":
            return TicketPortalListaSerializer
        return TicketPortalDetalleSerializer

    def get_queryset(self):
        qs = Ticket.objects.filter(organizacion=self.request.user.organizacion).select_related(
            "activo", "tecnico", "reportado_por"
        )
        if self.action != "list":
            return qs

        p = self.request.query_params
        q = p.get("q", "").replace("\x00", "").strip()
        if q:
            qs = qs.filter(Q(codigo__icontains=q) | Q(titulo__icontains=q))
        if p.get("estado") in Ticket.Estado.values:
            qs = qs.filter(estado=p["estado"])
        if p.get("abiertos") == "true":
            qs = qs.filter(estado__in=ACTIVOS)
        return qs.order_by("-creado_en", "-id")

    def create(self, request, *args, **kwargs):
        entrada = TicketPortalCrearSerializer(data=cuerpo(request), context={"usuario": request.user})
        entrada.is_valid(raise_exception=True)
        ticket = entrada.save()
        return Response(TicketPortalDetalleSerializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def comentarios(self, request, pk=None):
        ticket = self.get_object()
        if ticket.estado == Ticket.Estado.CERRADO:
            raise ValidationError({"non_field_errors": [MSG_CERRADO]})
        evento = comentar(ticket, cuerpo(request).get("texto"), request.user, visible_cliente=True)
        return Response(EventoPortalSerializer(evento).data, status=status.HTTP_201_CREATED)


class ActivoPortalViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Inventario de la empresa, solo lectura. La ficha abre también los dados de baja."""

    permission_classes = [EsClienteDelPortal]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "head", "options"]
    lookup_value_regex = r"\d{1,18}"

    def get_serializer_class(self):
        return ActivoPortalListaSerializer if self.action == "list" else ActivoPortalDetalleSerializer

    def get_queryset(self):
        qs = con_ultimo_backup(Activo.objects.filter(organizacion=self.request.user.organizacion))
        if self.action != "list":
            return qs

        p = self.request.query_params
        qs = qs.filter(de_baja=False)
        q = p.get("q", "").replace("\x00", "").strip()
        if q:
            qs = qs.filter(
                Q(nombre__icontains=q) | Q(ubicacion__icontains=q) | Q(fabricante__icontains=q) | Q(modelo__icontains=q)
            )
        if p.get("tipo") in Activo.Tipo.values:
            qs = qs.filter(tipo=p["tipo"])
        if p.get("estado") in Activo.Estado.values:
            qs = qs.filter(estado=p["estado"])
        orden = "estado" if p.get("ordering") == "estado" else "nombre"
        return qs.order_by(*ORDENES_ACTIVOS[orden], "id")
