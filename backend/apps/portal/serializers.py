"""Lo que un cliente puede ver y enviar. Cada campo está listado a propósito: lo que no esté aquí no sale."""

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from apps.assets.models import Activo, Backup
from apps.assets.serializers import referencia
from apps.incidents.serializers import errores
from apps.organizations.models import Organizacion
from apps.organizations.serializers import VacioComoNullMixin
from apps.tickets.models import EventoTicket, Ticket
from apps.tickets.prioridad import calcular_prioridad
from apps.tickets.servicios import autor_es_cliente, nombre_usuario, registrar_evento

MSG_ACTIVO = "Elige un activo de tu empresa."
EVENTOS_VISIBLES = Q(tipo__in=[EventoTicket.Tipo.CREACION, EventoTicket.Tipo.ESTADO]) | Q(
    tipo=EventoTicket.Tipo.COMENTARIO, visible_cliente=True
)


def nombre_o_null(usuario):
    return nombre_usuario(usuario) or None


class EventoPortalSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["texto", "valor_anterior", "valor_nuevo"]

    autor = serializers.SerializerMethodField()
    autor_es_cliente = serializers.SerializerMethodField()

    class Meta:
        model = EventoTicket
        fields = ["id", "tipo", "autor", "autor_es_cliente", "texto", "valor_anterior", "valor_nuevo", "fecha"]

    def to_representation(self, evento):
        data = super().to_representation(evento)
        # El texto de un cambio de estado es interno (puede citar el incidente);
        # la solución ya llega al cliente en el campo `solucion` del ticket.
        if evento.tipo == EventoTicket.Tipo.ESTADO:
            data["texto"] = None
        return data

    def get_autor(self, evento):
        return nombre_o_null(evento.autor)

    def get_autor_es_cliente(self, evento):
        return autor_es_cliente(evento)


class TicketPortalListaSerializer(serializers.ModelSerializer):
    activo = serializers.SerializerMethodField()
    tecnico = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = ["id", "codigo", "titulo", "categoria", "estado", "activo", "tecnico", "creado_en", "actualizado_en"]

    def get_activo(self, ticket):
        return referencia(ticket.activo)

    def get_tecnico(self, ticket):
        return nombre_o_null(ticket.tecnico)


class TicketPortalDetalleSerializer(VacioComoNullMixin, TicketPortalListaSerializer):
    texto_opcional = ["descripcion", "solucion"]

    reportado_por = serializers.SerializerMethodField()
    eventos = serializers.SerializerMethodField()

    class Meta(TicketPortalListaSerializer.Meta):
        fields = TicketPortalListaSerializer.Meta.fields + [
            "descripcion", "alcance", "solucion", "reportado_por", "resuelto_en", "cerrado_en", "eventos",
        ]

    def get_reportado_por(self, ticket):
        return nombre_o_null(ticket.reportado_por)

    def get_eventos(self, ticket):
        eventos = ticket.eventos.filter(EVENTOS_VISIBLES).select_related("autor").order_by("fecha", "id")
        return EventoPortalSerializer(eventos, many=True).data


class ActivoPortalField(serializers.PrimaryKeyRelatedField):
    def to_internal_value(self, data):
        # Un decimal no es un id; 1e400 llega como infinito y haría fallar la consulta.
        if isinstance(data, float):
            self.fail("incorrect_type", data_type="float")
        return super().to_internal_value(data)


class TicketPortalCrearSerializer(serializers.Serializer):
    titulo = serializers.CharField(
        max_length=200,
        error_messages={**errores("Escribe el título."), "max_length": "Usa máximo 200 caracteres."},
    )
    descripcion = serializers.CharField(error_messages=errores("Describe lo que ocurre."))
    categoria = serializers.ChoiceField(choices=Ticket.Categoria.choices, error_messages=errores("Elige una categoría."))
    alcance = serializers.ChoiceField(choices=Ticket.Alcance.choices, error_messages=errores("Indica a quién afecta."))
    activo = ActivoPortalField(
        queryset=Activo.objects.filter(de_baja=False),
        required=False,
        allow_null=True,
        error_messages=errores(MSG_ACTIVO),
    )

    def validate_activo(self, activo):
        if activo is not None and activo.organizacion_id != self.context["usuario"].organizacion_id:
            raise serializers.ValidationError(MSG_ACTIVO)
        return activo

    @transaction.atomic
    def save(self):
        usuario = self.context["usuario"]
        datos = self.validated_data
        ticket = Ticket.objects.create(
            organizacion=usuario.organizacion,
            reportado_por=usuario,
            prioridad=calcular_prioridad(datos["alcance"], datos["categoria"], datos.get("activo")),
            **datos,
        )
        registrar_evento(ticket, EventoTicket.Tipo.CREACION, usuario)
        return ticket


class EmpresaPortalSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = [
        "nit", "sector", "telefono", "correo", "direccion", "ciudad",
        "contacto_nombre", "contacto_cargo", "contacto_correo", "contacto_telefono", "plan",
    ]

    class Meta:
        model = Organizacion
        fields = [
            "id", "nombre", "nit", "sector", "telefono", "correo", "direccion", "ciudad",
            "contacto_nombre", "contacto_cargo", "contacto_correo", "contacto_telefono",
            "plan", "fecha_inicio_contrato", "fecha_fin_contrato",
        ]


def ultimo_backup_portal(activo):
    """Usa las anotaciones ub_* de con_ultimo_backup; sin id ni datos internos."""
    if activo.ub_fecha is None:
        return None
    return {"fecha": serializers.DateTimeField().to_representation(activo.ub_fecha), "estado": activo.ub_estado}


class ActivoPortalListaSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["ubicacion"]

    ultimo_backup = serializers.SerializerMethodField()

    class Meta:
        model = Activo
        fields = ["id", "nombre", "tipo", "estado", "ubicacion", "ultimo_backup"]

    def get_ultimo_backup(self, activo):
        return ultimo_backup_portal(activo)


class ActivoPortalDetalleSerializer(ActivoPortalListaSerializer):
    texto_opcional = ["ubicacion", "fabricante", "modelo", "sistema_operativo", "numero_serie"]

    class Meta(ActivoPortalListaSerializer.Meta):
        fields = ActivoPortalListaSerializer.Meta.fields + [
            "fabricante", "modelo", "sistema_operativo", "numero_serie", "de_baja", "fecha_baja",
        ]


class BackupPortalSerializer(VacioComoNullMixin, serializers.ModelSerializer):
    texto_opcional = ["tipo"]

    activo = serializers.SerializerMethodField()

    class Meta:
        model = Backup
        fields = ["id", "activo", "tipo", "estado", "fecha", "tamano_gb"]

    def get_activo(self, backup):
        return referencia(backup.activo)
