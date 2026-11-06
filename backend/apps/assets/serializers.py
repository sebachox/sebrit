import ipaddress

from rest_framework import serializers

from apps.organizations.models import Organizacion
from apps.organizations.serializers import VacioComoNullMixin

from .models import Activo

MSG_DE_BAJA = "El activo está dado de baja."

TEXTO_OPCIONAL_ACTIVO = [
    "hostname", "sistema_operativo", "fabricante", "modelo", "numero_serie", "ubicacion", "notas",
]


def referencia(obj):
    return {"id": obj.id, "nombre": obj.nombre} if obj else None


class ConOrganizacionMixin:
    """`organizacion` se recibe como id y se devuelve como {id, nombre}."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["organizacion"] = referencia(instance.organizacion)
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
