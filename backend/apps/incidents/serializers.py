from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.assets.serializers import referencia, referencia_usuario
from apps.organizations.models import Organizacion
from apps.organizations.serializers import VacioComoNullMixin
from apps.tickets.servicios import nombre_usuario

from .models import AccionIncidente, Incidente
from .servicios import MSG_CERRADO, recalcular_severidad, registrar_accion, validar_fecha_origen
from .severidad import calcular_severidad

MSG_TECNICO = "El usuario debe ser un técnico o administrador activo."
MSG_ACTIVO_AJENO = "Todos los activos deben ser de este cliente."
MSG_FECHA_ORIGEN = "Indica cuándo empezó el incidente."
MSG_IMPACTO = "Indica el impacto."


def errores(mensaje):
    """El mismo mensaje en español para cualquier valor faltante o inválido."""
    claves = [
        "required", "blank", "null", "invalid", "invalid_choice", "does_not_exist",
        "incorrect_type", "not_a_list", "date", "make_aware", "overflow",
    ]
    return dict.fromkeys(claves, mensaje)


class EscalarSerializer(serializers.Serializer):
    impacto = serializers.ChoiceField(choices=Incidente.Impacto.choices, error_messages=errores(MSG_IMPACTO))
    fecha_origen = serializers.DateTimeField(error_messages=errores(MSG_FECHA_ORIGEN))

    def validate_fecha_origen(self, valor):
        return validar_fecha_origen(valor)


class AccionSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["descripcion"]

    class Meta:
        model = AccionIncidente
        fields = ["id", "tipo", "autor", "descripcion", "valor_anterior", "valor_nuevo", "fecha"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["autor"] = referencia_usuario(instance.autor)
        return data


class ConReferenciasMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["organizacion"] = referencia(instance.organizacion)
        data["tecnico"] = referencia_usuario(instance.tecnico)
        return data


CAMPOS_FILA = [
    "id", "codigo", "titulo", "organizacion", "severidad", "severidad_manual", "impacto", "estado",
    "tecnico", "fecha_origen", "fecha_deteccion", "fecha_fin", "duracion_minutos",
    "total_activos", "total_tickets",
]


class IncidenteListaSerializer(ConReferenciasMixin, serializers.ModelSerializer):
    fecha_deteccion = serializers.DateTimeField(source="creado_en", read_only=True)
    duracion_minutos = serializers.IntegerField(read_only=True)
    total_activos = serializers.IntegerField(read_only=True)
    total_tickets = serializers.IntegerField(read_only=True)

    class Meta:
        model = Incidente
        fields = CAMPOS_FILA


class IncidenteDetalleSerializer(ConReferenciasMixin, VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["solucion", "causa_raiz"]

    organizacion = serializers.PrimaryKeyRelatedField(
        queryset=Organizacion.objects.all(), error_messages=errores("Elige el cliente.")
    )
    titulo = serializers.CharField(
        max_length=200,
        error_messages={**errores("Escribe un título corto."), "max_length": "Máximo 200 caracteres."},
    )
    descripcion = serializers.CharField(error_messages=errores("Describe qué está pasando."))
    impacto = serializers.ChoiceField(choices=Incidente.Impacto.choices, error_messages=errores(MSG_IMPACTO))
    activos = serializers.PrimaryKeyRelatedField(
        queryset=Activo.objects.all(), many=True, required=False, error_messages=errores(MSG_ACTIVO_AJENO)
    )
    tecnico = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.all(), required=False, allow_null=True, error_messages=errores(MSG_TECNICO)
    )
    fecha_origen = serializers.DateTimeField(error_messages=errores(MSG_FECHA_ORIGEN))
    fecha_deteccion = serializers.DateTimeField(source="creado_en", read_only=True)
    duracion_minutos = serializers.IntegerField(read_only=True)

    class Meta:
        model = Incidente
        fields = [
            "id", "codigo", "organizacion", "titulo", "descripcion", "impacto", "activos", "severidad",
            "severidad_manual", "estado", "tecnico", "reportado_por", "fecha_origen", "fecha_deteccion",
            "fecha_fin", "duracion_minutos", "solucion", "causa_raiz", "cerrado_en", "actualizado_en",
        ]
        read_only_fields = [
            "codigo", "severidad", "severidad_manual", "estado", "reportado_por", "fecha_fin",
            "solucion", "causa_raiz", "cerrado_en", "actualizado_en",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["reportado_por"] = referencia_usuario(instance.reportado_por)
        data["activos"] = [
            {"id": a.id, "nombre": a.nombre, "tipo": a.tipo, "estado": a.estado}
            for a in instance.activos.order_by("nombre", "id")
        ]
        data["tickets"] = [
            {"id": t.id, "codigo": t.codigo, "titulo": t.titulo, "estado": t.estado}
            for t in instance.tickets.order_by("id")
        ]
        data["total_activos"] = len(data["activos"])
        data["total_tickets"] = len(data["tickets"])
        acciones = instance.acciones.select_related("autor").order_by("fecha", "id")
        data["acciones"] = AccionSerializer(acciones, many=True).data
        return data

    def validate_organizacion(self, valor):
        if self.instance and valor != self.instance.organizacion:
            raise serializers.ValidationError("No se puede cambiar el cliente de un incidente.")
        return valor

    def validate_tecnico(self, valor):
        cambia = not self.instance or valor != self.instance.tecnico
        if valor is not None and cambia and (valor.rol not in ("admin", "tecnico") or not valor.is_active):
            raise serializers.ValidationError(MSG_TECNICO)
        return valor

    def validate_fecha_origen(self, valor):
        return validar_fecha_origen(valor, self.instance.creado_en if self.instance else None)

    def validate(self, attrs):
        incidente = self.instance
        if incidente and incidente.estado == Incidente.Estado.CERRADO:
            raise serializers.ValidationError(MSG_CERRADO)

        if incidente and incidente.estado == Incidente.Estado.EN_PROGRESO:
            if "tecnico" in attrs and attrs["tecnico"] is None:
                raise serializers.ValidationError(
                    {"tecnico": "Un incidente en progreso debe tener un técnico asignado."}
                )

        if "activos" in attrs:
            attrs["activos"] = list(set(attrs["activos"]))
            # Solo se validan los que se agregan: uno ya vinculado puede haberse dado de baja después.
            actuales = set(incidente.activos.all()) if incidente else set()
            organizacion = attrs.get("organizacion", getattr(incidente, "organizacion", None))
            nuevos = set(attrs["activos"]) - actuales
            if any(a.organizacion != organizacion for a in nuevos):
                raise serializers.ValidationError({"activos": MSG_ACTIVO_AJENO})
            if any(a.de_baja for a in nuevos):
                raise serializers.ValidationError({"activos": "Hay activos dados de baja."})
        return attrs

    def _autor(self):
        return self.context["request"].user

    @transaction.atomic
    def create(self, datos):
        datos["reportado_por"] = self._autor()
        datos["severidad"] = calcular_severidad(datos["impacto"], datos.get("activos", []))
        incidente = super().create(datos)
        registrar_accion(incidente, AccionIncidente.Tipo.CREACION, self._autor())
        return incidente

    @transaction.atomic
    def update(self, incidente, datos):
        tecnico_anterior = incidente.tecnico
        factores = self._factores(incidente)
        incidente = super().update(incidente, datos)
        if incidente.tecnico != tecnico_anterior:
            registrar_accion(
                incidente,
                AccionIncidente.Tipo.TECNICO,
                self._autor(),
                anterior=nombre_usuario(tecnico_anterior) or None,
                nuevo=nombre_usuario(incidente.tecnico) or None,
            )
        if self._factores(incidente) != factores:
            recalcular_severidad(incidente, self._autor())
        return incidente

    @staticmethod
    def _factores(incidente):
        return incidente.impacto, set(incidente.activos.values_list("pk", flat=True))
