from datetime import date

from django.db.models import Case, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Lower
from rest_framework import viewsets

from apps.organizations.pagination import PaginacionEstandar

from .models import Activo, Backup
from .permissions import EsAdminOTecnico
from .serializers import ActivoDetalleSerializer, ActivoListaSerializer, BackupSerializer

GRAVEDAD = Case(
    When(estado="critico", then=Value(0)),
    When(estado="advertencia", then=Value(1)),
    default=Value(2),
    output_field=IntegerField(),
)

ORDENES_ACTIVOS = {
    "nombre": [Lower("nombre").asc()],
    "-nombre": [Lower("nombre").desc()],
    "estado": [GRAVEDAD.asc(), Lower("nombre").asc()],
    "creado_en": ["creado_en"],
    "-creado_en": ["-creado_en"],
}


def con_ultimo_backup(qs):
    """Anota ub_id, ub_fecha y ub_estado con el backup más reciente (sin N+1)."""
    ultimo = Backup.objects.filter(activo=OuterRef("pk")).order_by("-fecha", "-id")
    return qs.annotate(
        ub_id=Subquery(ultimo.values("id")[:1]),
        ub_fecha=Subquery(ultimo.values("fecha")[:1]),
        ub_estado=Subquery(ultimo.values("estado")[:1]),
    )


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
        qs = con_ultimo_backup(Activo.objects.select_related("organizacion"))
        if self.action != "list":
            return qs

        p = self.request.query_params
        qs = qs.filter(de_baja=p.get("de_baja") == "true")

        q = p.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(nombre__icontains=q)
                | Q(hostname__icontains=q)
                | Q(ip__icontains=q)
                | Q(numero_serie__icontains=q)
                | Q(fabricante__icontains=q)
                | Q(modelo__icontains=q)
            )

        organizacion = p.get("organizacion", "")
        if organizacion.isdigit():
            qs = qs.filter(organizacion_id=int(organizacion))
        if p.get("tipo") in Activo.Tipo.values:
            qs = qs.filter(tipo=p["tipo"])
        if p.get("estado") in Activo.Estado.values:
            qs = qs.filter(estado=p["estado"])

        orden = ORDENES_ACTIVOS.get(p.get("ordering", ""), ORDENES_ACTIVOS["nombre"])
        return qs.order_by(*orden, "id")


def fecha_param(valor):
    try:
        return date.fromisoformat(valor) if valor else None
    except ValueError:
        return None


class BackupViewSet(viewsets.ModelViewSet):
    """Registro manual de backups. Admin y técnico registran, editan y borran."""

    serializer_class = BackupSerializer
    permission_classes = [EsAdminOTecnico]
    pagination_class = PaginacionEstandar
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)

    def get_queryset(self):
        qs = Backup.objects.select_related("activo", "organizacion", "registrado_por")
        if self.action != "list":
            return qs

        p = self.request.query_params
        for campo in ("organizacion", "activo"):
            valor = p.get(campo, "")
            if valor.isdigit():
                qs = qs.filter(**{f"{campo}_id": int(valor)})
        if p.get("estado") in Backup.Estado.values:
            qs = qs.filter(estado=p["estado"])
        if p.get("tipo") in Backup.Tipo.values:
            qs = qs.filter(tipo=p["tipo"])

        # __date usa TIME_ZONE (America/Bogota): el día "hasta" es inclusivo en hora local.
        desde, hasta = fecha_param(p.get("desde")), fecha_param(p.get("hasta"))
        if desde:
            qs = qs.filter(fecha__date__gte=desde)
        if hasta:
            qs = qs.filter(fecha__date__lte=hasta)
        return qs.order_by("-fecha", "-id")
