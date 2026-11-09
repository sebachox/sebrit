from django.db.models import Count, Q
from django.db.models.functions import Lower
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.models import Activo
from apps.dashboard.views import ACTIVOS, conteo_activos, conteo_backups
from apps.incidents.models import Incidente
from apps.tickets.models import Ticket

from .permissions import EsClienteDelPortal


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


class ActivosView(APIView):
    """Solo lo necesario para elegir un activo al abrir un ticket."""

    permission_classes = [EsClienteDelPortal]

    def get(self, request):
        activos = (
            Activo.objects.filter(organizacion=request.user.organizacion, de_baja=False)
            .order_by(Lower("nombre"), "id")
            .values("id", "nombre", "tipo")
        )
        return Response(list(activos))
