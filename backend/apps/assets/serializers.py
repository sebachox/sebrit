import ipaddress
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers

from apps.organizations.models import Organizacion
from apps.organizations.serializers import VacioComoNullMixin

from .models import Activo, Backup

MSG_DE_BAJA = "El activo está dado de baja."

TEXTO_OPCIONAL_ACTIVO = [
    "hostname", "sistema_operativo", "fabricante", "modelo", "numero_serie", "ubicacion", "notas",
]


def referencia(obj):
    return {"id": obj.id, "nombre": obj.nombre} if obj else None


def ultimo_backup(activo):
    """Usa las anotaciones de la vista (ub_*) si existen; si no, consulta."""
    if hasattr(activo, "ub_id"):
        if activo.ub_id is None:
            return None
        return {"id": activo.ub_id, "fecha": activo.ub_fecha, "estado": activo.ub_estado}
    b = activo.backup_set.order_by("-fecha", "-id").first()
    return {"id": b.id, "fecha": b.fecha, "estado": b.estado} if b else None


class ConOrganizacionMixin:
    """`organizacion` se recibe como id y se devuelve como {id, nombre}; agrega `ultimo_backup`."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["organizacion"] = referencia(instance.organizacion)
        ub = ultimo_backup(instance)
        if ub:
            ub["fecha"] = serializers.DateTimeField().to_representation(ub["fecha"])
        data["ultimo_backup"] = ub
        return data


class ActivoListaSerializer(ConOrganizacionMixin, VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = TEXTO_OPCIONAL_ACTIVO

    class Meta:
        model = Activo
        fields = [
            "id", "nombre", "tipo", "estado", "organizacion",
            "ip", "hostname", "ubicacion", "de_baja",
        ]


class ActivoDetalleSerializer(ConOrganizacionMixin, VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = TEXTO_OPCIONAL_ACTIVO

    organizacion = serializers.PrimaryKeyRelatedField(queryset=Organizacion.objects.all())
    # CharField + validación propia: IPAddressField de DRF reemplaza el mensaje de error.
    ip = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=45)

    class Meta:
        model = Activo
        fields = [
            "id", "organizacion", "tipo", "nombre", "estado",
            "hostname", "ip", "sistema_operativo", "fabricante", "modelo", "numero_serie",
            "ubicacion", "notas", "de_baja", "fecha_baja", "creado_en", "actualizado_en",
        ]
        read_only_fields = ["fecha_baja", "creado_en", "actualizado_en"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["resumen_backups"] = instance.backup_set.aggregate(
            total=Count("id"),
            exitosos=Count("id", filter=Q(estado="exitoso")),
            fallidos=Count("id", filter=Q(estado="fallido")),
            pendientes=Count("id", filter=Q(estado="pendiente")),
        )
        return data

    def validate_ip(self, valor):
        valor = (valor or "").strip()
        if not valor:
            return None
        try:
            return str(ipaddress.ip_address(valor))
        except ValueError:
            raise serializers.ValidationError(
                "Escribe una dirección IP válida, por ejemplo 192.168.1.10."
            )

    def validate_organizacion(self, valor):
        if self.instance and valor != self.instance.organizacion:
            raise serializers.ValidationError("No se puede cambiar el cliente de un activo.")
        return valor

    def validate(self, attrs):
        instancia = self.instance

        # Un activo dado de baja solo admite reactivarse (opcionalmente junto con otros cambios).
        if instancia and instancia.de_baja and attrs.get("de_baja", True) is not False:
            cambios = {k for k in attrs if k not in ("de_baja", "organizacion")}
            if "estado" in cambios:
                raise serializers.ValidationError({"estado": MSG_DE_BAJA})
            if cambios:
                raise serializers.ValidationError(MSG_DE_BAJA)

        if "nombre" in attrs or "organizacion" in attrs:
            nombre = attrs.get("nombre", getattr(instancia, "nombre", "")).strip()
            organizacion = attrs.get("organizacion", getattr(instancia, "organizacion", None))
            repetidos = Activo.objects.filter(organizacion=organizacion, nombre__iexact=nombre)
            if instancia:
                repetidos = repetidos.exclude(pk=instancia.pk)
            if repetidos.exists():
                raise serializers.ValidationError(
                    {"nombre": "Ya existe un activo con este nombre en este cliente."}
                )
            if "nombre" in attrs:
                attrs["nombre"] = nombre
        return attrs


TOLERANCIA_FUTURO = timedelta(minutes=5)


def referencia_usuario(u):
    return {"id": u.id, "nombre": u.get_full_name() or u.username} if u else None


class BackupSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["notas", "tipo"]

    activo = serializers.PrimaryKeyRelatedField(queryset=Activo.objects.all())
    tipo = serializers.ChoiceField(choices=Backup.Tipo.choices)
    tamano_gb = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True, coerce_to_string=False
    )

    class Meta:
        model = Backup
        fields = [
            "id", "activo", "organizacion", "fecha", "estado", "tipo",
            "tamano_gb", "notas", "registrado_por", "creado_en",
        ]
        read_only_fields = ["organizacion", "registrado_por", "creado_en"]

    def validate_activo(self, activo):
        if activo.de_baja:
            raise serializers.ValidationError(MSG_DE_BAJA)
        return activo

    def validate_fecha(self, fecha):
        # Tolerancia para diferencias de reloj entre el navegador y el servidor.
        if fecha > timezone.now() + TOLERANCIA_FUTURO:
            raise serializers.ValidationError("La fecha del backup no puede ser futura.")
        return fecha

    def validate_tamano_gb(self, valor):
        if valor is not None and valor < 0:
            raise serializers.ValidationError("El tamaño no puede ser negativo.")
        return valor

    def create(self, datos):
        datos["organizacion"] = datos["activo"].organizacion
        return super().create(datos)

    def update(self, instancia, datos):
        if "activo" in datos:
            datos["organizacion"] = datos["activo"].organizacion
        return super().update(instancia, datos)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["activo"] = referencia(instance.activo)
        data["organizacion"] = referencia(instance.organizacion)
        data["registrado_por"] = referencia_usuario(instance.registrado_por)
        return data
