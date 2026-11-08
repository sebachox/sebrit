from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.assets.permissions import EsAdminOTecnico
from apps.organizations.pagination import PaginacionEstandar

from . import servicios
from .models import Incidente
from .serializers import AccionSerializer, IncidenteDetalleSerializer, IncidenteListaSerializer


def cuerpo(request):
    if not isinstance(request.data, dict):
        raise ValidationError({"non_field_errors": ["El cuerpo de la petición no es válido."]})
    return request.data


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

    @action(detail=True, methods=["post"])
    def estado(self, request, pk=None):
        datos = cuerpo(request)
        incidente = servicios.cambiar_estado(
            self.get_object(), datos.get("estado"), datos.get("solucion"), datos.get("causa_raiz"), request.user
        )
        return self._detalle(incidente)

    @action(detail=True, methods=["post"])
    def severidad(self, request, pk=None):
        datos = cuerpo(request)
        incidente = servicios.corregir_severidad(
            self.get_object(), datos.get("severidad"), datos.get("motivo"), request.user
        )
        return self._detalle(incidente)

    @action(detail=True, methods=["post"])
    def acciones(self, request, pk=None):
        accion = servicios.agregar_accion(self.get_object(), cuerpo(request).get("descripcion"), request.user)
        return Response(AccionSerializer(accion).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def tickets(self, request, pk=None):
        incidente = servicios.asociar_ticket(self.get_object(), cuerpo(request).get("ticket"), request.user)
        return self._detalle(incidente)

    @action(detail=True, methods=["delete"], url_path=r"tickets/(?P<ticket_id>[^/.]+)")
    def quitar_ticket(self, request, pk=None, ticket_id=None):
        return self._detalle(servicios.quitar_ticket(self.get_object(), ticket_id, request.user))
