import re

from rest_framework import serializers

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.incidents.models import Incidente
from apps.tickets.models import Ticket

from .models import Organizacion

ESTADOS_ACTIVOS = ["abierto", "en_progreso"]
NIT_VALIDO = re.compile(r"^\d{6,10}(-\d)?$")

# Campos de texto opcionales: en la API "vacío" es null; en la base es "".
TEXTO_OPCIONAL = [
    "sector", "telefono", "correo", "direccion", "ciudad",
    "contacto_nombre", "contacto_cargo", "contacto_correo", "contacto_telefono", "plan",
]

MSG_NIT_OBLIGATORIO = "El NIT es obligatorio."


class VacioComoNullMixin:
    """Textos opcionales: "" en la base, null en la API (y null de entrada se guarda "")."""

    texto_opcional = TEXTO_OPCIONAL

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for campo in self.texto_opcional:
            if data.get(campo) == "":
                data[campo] = None
        return data

    def to_internal_value(self, data):
        if hasattr(data, "dict"):
            data = data.dict()
        if isinstance(data, dict):
            data = {
                k: ("" if k in self.texto_opcional and v is None else v) for k, v in data.items()
            }
        return super().to_internal_value(data)


class OrganizacionListaSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    class Meta:
        model = Organizacion
        fields = [
            "id", "nombre", "nit", "ciudad", "plan",
            "contacto_nombre", "fecha_fin_contrato", "activa",
        ]


class OrganizacionDetalleSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    # Se declaran para reemplazar el validador de unicidad del modelo por uno
    # sin distinción de mayúsculas y con mensajes propios.
    nombre = serializers.CharField(max_length=150)
    nit = serializers.CharField(
        max_length=20,
        error_messages={
            "required": MSG_NIT_OBLIGATORIO,
            "blank": MSG_NIT_OBLIGATORIO,
            "null": MSG_NIT_OBLIGATORIO,
        },
    )
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Organizacion
        fields = [
            "id", "nombre", "nit", "sector", "telefono", "correo", "direccion", "ciudad",
            "contacto_nombre", "contacto_cargo", "contacto_correo", "contacto_telefono",
            "plan", "fecha_inicio_contrato", "fecha_fin_contrato", "activa",
            "creado_en", "actualizado_en", "resumen",
        ]
        read_only_fields = ["creado_en", "actualizado_en"]

    def _otras(self):
        qs = Organizacion.objects.all()
        return qs.exclude(pk=self.instance.pk) if self.instance else qs

    def validate_nombre(self, valor):
        valor = valor.strip()
        if self._otras().filter(nombre__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe una organización con este nombre.")
        return valor

    def validate_nit(self, valor):
        valor = valor.strip()
        if not NIT_VALIDO.match(valor):
            raise serializers.ValidationError(
                "Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7."
            )
        if self._otras().filter(nit__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe una organización con este NIT.")
        return valor

    def validate(self, attrs):
        def valor(campo):
            if campo in attrs:
                return attrs[campo]
            return getattr(self.instance, campo, None)

        inicio, fin = valor("fecha_inicio_contrato"), valor("fecha_fin_contrato")
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                {"fecha_fin_contrato": "La fecha de fin no puede ser anterior a la de inicio."}
            )
        return attrs

    def get_resumen(self, obj):
        return {
            "activos": Activo.objects.filter(organizacion=obj, de_baja=False).count(),
            "tickets_abiertos": Ticket.objects.filter(
                organizacion=obj, estado__in=ESTADOS_ACTIVOS
            ).count(),
            "incidentes_activos": Incidente.objects.filter(
                organizacion=obj, estado__in=ESTADOS_ACTIVOS
            ).count(),
            "usuarios": Usuario.objects.filter(organizacion=obj).count(),
        }
