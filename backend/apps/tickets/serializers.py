from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.assets.serializers import referencia, referencia_usuario
from apps.organizations.models import Organizacion
from apps.organizations.serializers import VacioComoNullMixin

from .models import EventoTicket, Ticket
from .prioridad import calcular_prioridad
from .servicios import MSG_CERRADO, nombre_usuario, recalcular_prioridad, registrar_evento


class EventoSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["texto", "valor_anterior", "valor_nuevo"]

    class Meta:
        model = EventoTicket
        fields = ["id", "tipo", "autor", "texto", "valor_anterior", "valor_nuevo", "fecha"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["autor"] = referencia_usuario(instance.autor)
        return data


class ConReferenciasMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["organizacion"] = referencia(instance.organizacion)
        data["activo"] = referencia(instance.activo)
        data["tecnico"] = referencia_usuario(instance.tecnico)
        i = instance.incidente
        data["incidente"] = {"id": i.id, "codigo": i.codigo} if i else None
        return data


class TicketListaSerializer(ConReferenciasMixin, serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = [
            "id", "codigo", "titulo", "organizacion", "categoria", "prioridad",
            "prioridad_manual", "estado", "tecnico", "activo", "incidente", "creado_en",
        ]


class TicketDetalleSerializer(ConReferenciasMixin, VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["solucion"]

    organizacion = serializers.PrimaryKeyRelatedField(queryset=Organizacion.objects.all())
    activo = serializers.PrimaryKeyRelatedField(
        queryset=Activo.objects.all(), required=False, allow_null=True
    )
    tecnico = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.all(), required=False, allow_null=True
    )
    descripcion = serializers.CharField()
    categoria = serializers.ChoiceField(choices=Ticket.Categoria.choices)
    alcance = serializers.ChoiceField(choices=Ticket.Alcance.choices)

    class Meta:
        model = Ticket
        fields = [
            "id", "codigo", "organizacion", "titulo", "descripcion", "categoria", "alcance",
            "activo", "prioridad", "prioridad_manual", "estado", "tecnico", "reportado_por", "incidente",
            "solucion", "creado_en", "actualizado_en", "resuelto_en", "cerrado_en",
        ]
        read_only_fields = [
            "codigo", "prioridad", "prioridad_manual", "estado", "reportado_por", "incidente", "solucion",
            "creado_en", "actualizado_en", "resuelto_en", "cerrado_en",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["reportado_por"] = referencia_usuario(instance.reportado_por)
        eventos = instance.eventos.select_related("autor").order_by("fecha", "id")
        data["eventos"] = EventoSerializer(eventos, many=True).data
        return data

    def validate_organizacion(self, valor):
        if self.instance and valor != self.instance.organizacion:
            raise serializers.ValidationError("No se puede cambiar el cliente de un ticket.")
        return valor

    def validate_tecnico(self, valor):
        cambia = not self.instance or valor != self.instance.tecnico
        if valor is not None and cambia and (valor.rol not in ("admin", "tecnico") or not valor.is_active):
            raise serializers.ValidationError("El usuario debe ser un técnico o administrador activo.")
        return valor

    def validate(self, attrs):
        ticket = self.instance
        if ticket and ticket.estado == Ticket.Estado.CERRADO:
            raise serializers.ValidationError(MSG_CERRADO)

        if ticket and ticket.estado == Ticket.Estado.EN_PROGRESO:
            if "tecnico" in attrs and attrs["tecnico"] is None:
                raise serializers.ValidationError(
                    {"tecnico": "Un ticket en progreso debe tener un técnico asignado."}
                )

        activo = attrs.get("activo")
        # Solo se valida al elegir un activo: uno ya vinculado puede haberse dado de baja después.
        if activo is not None and (not ticket or activo != ticket.activo):
            organizacion = attrs.get("organizacion", getattr(ticket, "organizacion", None))
            if activo.organizacion != organizacion:
                raise serializers.ValidationError({"activo": "El activo no pertenece a este cliente."})
            if activo.de_baja:
                raise serializers.ValidationError({"activo": "El activo está dado de baja."})
        return attrs

    def _autor(self):
        return self.context["request"].user

    @transaction.atomic
    def create(self, datos):
        datos["reportado_por"] = self._autor()
        datos["prioridad"] = calcular_prioridad(datos["alcance"], datos["categoria"], datos.get("activo"))
        ticket = super().create(datos)
        registrar_evento(ticket, EventoTicket.Tipo.CREACION, self._autor())
        return ticket

    @transaction.atomic
    def update(self, ticket, datos):
        tecnico_anterior = ticket.tecnico
        factores = (ticket.alcance, ticket.categoria, ticket.activo_id)
        ticket = super().update(ticket, datos)
        if ticket.tecnico != tecnico_anterior:
            registrar_evento(
                ticket,
                EventoTicket.Tipo.TECNICO,
                self._autor(),
                anterior=nombre_usuario(tecnico_anterior),
                nuevo=nombre_usuario(ticket.tecnico),
            )
        if (ticket.alcance, ticket.categoria, ticket.activo_id) != factores:
            recalcular_prioridad(ticket, self._autor())
        return ticket
