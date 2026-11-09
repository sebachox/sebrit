"""Operaciones sobre incidentes que dejan rastro en la bitácora."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404

from apps.tickets.models import EventoTicket, Ticket
from apps.tickets.servicios import registrar_evento

from .models import AccionIncidente, Incidente
from .severidad import calcular_severidad

MSG_CERRADO = "El incidente está cerrado. Reábrelo para modificarlo."

TRANSICIONES = {
    Incidente.Estado.ABIERTO: {Incidente.Estado.EN_PROGRESO},
    Incidente.Estado.EN_PROGRESO: {Incidente.Estado.ABIERTO, Incidente.Estado.RESUELTO},
    Incidente.Estado.RESUELTO: {Incidente.Estado.CERRADO, Incidente.Estado.ABIERTO},
    Incidente.Estado.CERRADO: {Incidente.Estado.ABIERTO},
}

NOMBRE_ESTADO = {
    Incidente.Estado.ABIERTO: "Abierto",
    Incidente.Estado.EN_PROGRESO: "En progreso",
    Incidente.Estado.RESUELTO: "Resuelto",
    Incidente.Estado.CERRADO: "Cerrado",
}


def registrar_accion(incidente, tipo, autor, descripcion="", anterior=None, nuevo=None):
    return AccionIncidente.objects.create(
        incidente=incidente,
        tipo=tipo,
        autor=autor,
        descripcion=descripcion,
        valor_anterior=anterior,
        valor_nuevo=nuevo,
    )


def recalcular_severidad(incidente, autor):
    """Aplica la regla automática, salvo corrección manual. Deja acción solo si cambia."""
    if incidente.severidad_manual:
        return
    nueva = calcular_severidad(incidente.impacto, incidente.activos.all())
    if nueva == incidente.severidad:
        return
    anterior = incidente.severidad
    incidente.severidad = nueva
    incidente.save(update_fields=["severidad", "actualizado_en"])
    registrar_accion(incidente, AccionIncidente.Tipo.SEVERIDAD, autor, anterior=anterior, nuevo=nueva)


def validar_fecha_origen(valor, deteccion=None):
    if valor > timezone.now():
        raise ValidationError("La fecha de origen no puede ser futura.")
    if deteccion is not None and valor > deteccion:
        raise ValidationError("La fecha de origen no puede ser posterior a la detección.")
    return valor


def _texto(valor):
    # PostgreSQL no admite el carácter NUL: se trata como un texto no válido.
    return valor.strip() if isinstance(valor, str) and "\x00" not in valor else ""


def _exigir_no_cerrado(incidente):
    if incidente.estado == Incidente.Estado.CERRADO:
        raise ValidationError({"non_field_errors": [MSG_CERRADO]})


def _resolver_tickets(incidente, solucion, autor, ahora):
    """Ruta propia: los tickets del incidente se resuelven sin pasar por su flujo normal."""
    activos = incidente.tickets.filter(estado__in=[Ticket.Estado.ABIERTO, Ticket.Estado.EN_PROGRESO])
    for ticket in activos:
        anterior = ticket.estado
        ticket.estado = Ticket.Estado.RESUELTO
        ticket.solucion = solucion
        ticket.resuelto_en = ahora
        ticket.save()
        registrar_evento(
            ticket,
            EventoTicket.Tipo.ESTADO,
            autor,
            texto=f"Resuelto por el incidente {incidente.codigo}.",
            anterior=anterior,
            nuevo=ticket.estado,
        )


@transaction.atomic
def cambiar_estado(incidente, nuevo, solucion, causa_raiz, autor):
    if not isinstance(nuevo, str) or nuevo not in Incidente.Estado.values:
        raise ValidationError({"estado": ["Elige un estado válido."]})
    nuevo = Incidente.Estado(nuevo)
    actual = Incidente.Estado(incidente.estado)
    if nuevo not in TRANSICIONES[actual]:
        raise ValidationError(
            {"estado": [f"No se puede pasar de «{NOMBRE_ESTADO[actual]}» a «{NOMBRE_ESTADO[nuevo]}»."]}
        )
    if nuevo == Incidente.Estado.EN_PROGRESO and incidente.tecnico is None:
        raise ValidationError({"tecnico": ["Asigna un técnico antes de pasar a En progreso."]})

    texto = ""
    ahora = timezone.now()
    if nuevo == Incidente.Estado.RESUELTO:
        texto = _texto(solucion)
        if not texto:
            raise ValidationError({"solucion": ["Describe cómo se restableció el servicio."]})
        incidente.solucion = texto
        incidente.fecha_fin = ahora
    elif nuevo == Incidente.Estado.CERRADO:
        texto = _texto(causa_raiz)
        if not texto:
            raise ValidationError({"causa_raiz": ["Indica la causa raíz para cerrar el incidente."]})
        incidente.causa_raiz = texto
        incidente.cerrado_en = ahora
    elif actual in (Incidente.Estado.RESUELTO, Incidente.Estado.CERRADO):
        # Reabrir: la solución y la causa raíz quedan en la bitácora.
        incidente.solucion = ""
        incidente.causa_raiz = ""
        incidente.fecha_fin = None
        incidente.cerrado_en = None

    incidente.estado = nuevo
    incidente.save()
    registrar_accion(
        incidente, AccionIncidente.Tipo.ESTADO, autor, descripcion=texto, anterior=actual.value, nuevo=nuevo.value
    )
    if nuevo == Incidente.Estado.RESUELTO:
        _resolver_tickets(incidente, texto, autor, ahora)
    return incidente


@transaction.atomic
def corregir_severidad(incidente, severidad, motivo, autor):
    _exigir_no_cerrado(incidente)
    if not isinstance(severidad, str) or severidad not in Incidente.Severidad.values:
        raise ValidationError({"severidad": ["Elige una severidad válida."]})
    if severidad == incidente.severidad:
        raise ValidationError({"severidad": ["La severidad ya tiene ese valor. Elige otra para corregirla."]})
    motivo = _texto(motivo)
    if not motivo:
        raise ValidationError({"motivo": ["Explica por qué cambias la severidad."]})

    anterior = incidente.severidad
    incidente.severidad = severidad
    incidente.severidad_manual = True
    incidente.save()
    registrar_accion(
        incidente, AccionIncidente.Tipo.SEVERIDAD, autor, descripcion=motivo, anterior=anterior, nuevo=severidad
    )
    return incidente


def _vincular(incidente, ticket, autor):
    ticket.incidente = incidente
    ticket.save(update_fields=["incidente", "actualizado_en"])
    registrar_accion(incidente, AccionIncidente.Tipo.TICKET, autor, nuevo=ticket.codigo)
    registrar_evento(ticket, EventoTicket.Tipo.INCIDENTE, autor, nuevo=incidente.codigo)


def _exigir_ticket_disponible(ticket):
    if ticket.estado == Ticket.Estado.CERRADO:
        raise ValidationError({"ticket": ["El ticket está cerrado."]})
    if ticket.incidente_id:
        raise ValidationError({"ticket": ["El ticket ya está asociado a un incidente."]})


def _buscar_ticket(ticket_id):
    valido = not isinstance(ticket_id, bool) and isinstance(ticket_id, (int, str)) and str(ticket_id).isdecimal()
    ticket = Ticket.objects.filter(pk=int(ticket_id)).first() if valido else None
    if ticket is None:
        raise ValidationError({"ticket": ["Elige un ticket válido."]})
    return ticket


@transaction.atomic
def asociar_ticket(incidente, ticket_id, autor):
    _exigir_no_cerrado(incidente)
    ticket = _buscar_ticket(ticket_id)
    if ticket.organizacion_id != incidente.organizacion_id:
        raise ValidationError({"ticket": ["El ticket no pertenece a este cliente."]})
    _exigir_ticket_disponible(ticket)
    _vincular(incidente, ticket, autor)
    return incidente


@transaction.atomic
def quitar_ticket(incidente, ticket_id, autor):
    _exigir_no_cerrado(incidente)
    ticket = get_object_or_404(incidente.tickets.all(), pk=ticket_id)
    ticket.incidente = None
    ticket.save(update_fields=["incidente", "actualizado_en"])
    registrar_accion(incidente, AccionIncidente.Tipo.TICKET, autor, anterior=ticket.codigo)
    registrar_evento(ticket, EventoTicket.Tipo.INCIDENTE, autor, anterior=incidente.codigo)
    return incidente


@transaction.atomic
def escalar_ticket(ticket, impacto, fecha_origen, autor):
    _exigir_ticket_disponible(ticket)
    activos = [ticket.activo] if ticket.activo and not ticket.activo.de_baja else []
    tecnico = ticket.tecnico
    if tecnico and (not tecnico.is_active or tecnico.rol not in ("admin", "tecnico")):
        tecnico = None

    incidente = Incidente.objects.create(
        organizacion=ticket.organizacion,
        titulo=ticket.titulo,
        descripcion=ticket.descripcion or ticket.titulo,
        impacto=impacto,
        fecha_origen=fecha_origen,
        severidad=calcular_severidad(impacto, activos),
        tecnico=tecnico,
        reportado_por=autor,
    )
    incidente.activos.set(activos)
    registrar_accion(incidente, AccionIncidente.Tipo.CREACION, autor)
    _vincular(incidente, ticket, autor)
    return incidente


def agregar_accion(incidente, descripcion, autor):
    _exigir_no_cerrado(incidente)
    descripcion = _texto(descripcion)
    if not descripcion:
        raise ValidationError({"descripcion": ["Describe la acción realizada."]})
    return registrar_accion(incidente, AccionIncidente.Tipo.ACCION, autor, descripcion=descripcion)
