from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assets.models import Activo, Backup
from apps.incidents.models import Incidente
from apps.maintenance.models import Mantenimiento
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket

ACTIVOS = ["abierto", "en_progreso"]


class EsAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return u.is_authenticated and u.rol == "admin"


def conteo_activos(tipo):
    return Activo.objects.filter(tipo=tipo).aggregate(
        total=Count("id"),
        operativos=Count("id", filter=Q(estado="operativo")),
        advertencia=Count("id", filter=Q(estado="advertencia")),
        criticos=Count("id", filter=Q(estado="critico")),
    )


class AdminDashboardView(APIView):
    permission_classes = [EsAdmin]

    def get(self, request):
        hoy = timezone.localdate()
        criticos = Incidente.objects.filter(severidad="critica", estado__in=ACTIVOS)

        incidentes = (
            Incidente.objects.filter(estado__in=ACTIVOS)
            .select_related("organizacion", "tecnico")
            .order_by("-creado_en")[:10]
        )

        def serializar(i):
            accion = i.accionincidente_set.order_by("-fecha").first()
            return {
                "id": i.id,
                "codigo": i.codigo,
                "titulo": i.titulo,
                "empresa": {"id": i.organizacion_id, "nombre": i.organizacion.nombre},
                "severidad": i.severidad,
                "estado": i.estado,
                "tecnico_asignado": (
                    {"id": i.tecnico_id, "nombre": i.tecnico.get_full_name() or i.tecnico.username}
                    if i.tecnico else None
                ),
                "ultima_accion": (
                    {"descripcion": accion.descripcion, "fecha": timezone.localtime(accion.fecha).isoformat()}
                    if accion else None
                ),
            }

        return Response({
            "generado_en": timezone.localtime().isoformat(),
            "resumen_operativo": {
                "clientes_activos": Organizacion.objects.filter(activa=True).count(),
                "tickets_abiertos": Ticket.objects.filter(estado__in=ACTIVOS).count(),
                "mantenimientos_hoy": Mantenimiento.objects.filter(fecha_programada__date=hoy).count(),
                "incidentes_criticos": criticos.count(),
            },
            "incidentes": [serializar(i) for i in incidentes],
            "infraestructura": {
                "servidores": conteo_activos("servidor"),
                "redes": conteo_activos("red"),
                "backups": Backup.objects.aggregate(
                    total=Count("id"),
                    exitosos=Count("id", filter=Q(estado="exitoso")),
                    fallidos=Count("id", filter=Q(estado="fallido")),
                    pendientes=Count("id", filter=Q(estado="pendiente")),
                ),
                "incidentes_criticos": {
                    "total": criticos.count(),
                    "abiertos": criticos.filter(estado="abierto").count(),
                    "en_progreso": criticos.filter(estado="en_progreso").count(),
                    "sin_tecnico": criticos.filter(tecnico__isnull=True).count(),
                },
            },
        })