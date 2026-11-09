"""Operaciones sobre tickets que dejan rastro en la línea de tiempo."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import EventoTicket, Ticket
from .prioridad import calcular_prioridad

MSG_CERRADO = "El ticket está cerrado. Reábrelo para modificarlo."

TRANSICIONES = {
    Ticket.Estado.ABIERTO: {Ticket.Estado.EN_PROGRESO},
    Ticket.Estado.EN_PROGRESO: {Ticket.Estado.ABIERTO, Ticket.Estado.RESUELTO},
    Ticket.Estado.RESUELTO: {Ticket.Estado.CERRADO, Ticket.Estado.ABIERTO},
    Ticket.Estado.CERRADO: {Ticket.Estado.ABIERTO},
}

NOMBRE_ESTADO = {
    Ticket.Estado.ABIERTO: "Abierto",
    Ticket.Estado.EN_PROGRESO: "En progreso",
    Ticket.Estado.RESUELTO: "Resuelto",
    Ticket.Estado.CERRADO: "Cerrado",
}


def nombre_usuario(usuario):
    return (usuario.get_full_name() or usuario.username) if usuario else ""


def autor_es_cliente(evento):
    return evento.autor is not None and evento.autor.rol == "cliente"


def registrar_evento(ticket, tipo, autor, texto="", anterior="", nuevo="", visible_cliente=False):
    return EventoTicket.objects.create(
        ticket=ticket,
        tipo=tipo,
        autor=autor,
        texto=texto,
        valor_anterior=anterior,
        valor_nuevo=nuevo,
        visible_cliente=visible_cliente,
    )


def recalcular_prioridad(ticket, autor):
    """Aplica la regla automática, salvo corrección manual. Deja evento solo si cambia."""
    if ticket.prioridad_manual:
        return
    nueva = calcular_prioridad(ticket.alcance, ticket.categoria, ticket.activo)
    if nueva == ticket.prioridad:
        return
    anterior = ticket.prioridad
    ticket.prioridad = nueva
    ticket.save(update_fields=["prioridad", "actualizado_en"])
    registrar_evento(ticket, EventoTicket.Tipo.PRIORIDAD, autor, anterior=anterior, nuevo=nueva)


def _texto(valor):
    texto = str(valor or "")
    # PostgreSQL no admite NUL ni texto que no se pueda codificar en UTF-8: es un texto no válido.
    try:
        texto.encode("utf-8")
    except UnicodeEncodeError:
        return ""
    return "" if "\x00" in texto else texto.strip()


def _exigir_no_cerrado(ticket):
    if ticket.estado == Ticket.Estado.CERRADO:
        raise ValidationError({"non_field_errors": [MSG_CERRADO]})


@transaction.atomic
def cambiar_estado(ticket, nuevo, solucion, autor):
    if nuevo not in Ticket.Estado.values:
        raise ValidationError({"estado": ["Elige un estado válido."]})
    nuevo = Ticket.Estado(nuevo)
    actual = Ticket.Estado(ticket.estado)
    if nuevo not in TRANSICIONES[actual]:
        raise ValidationError(
            {"estado": [f"No se puede pasar de «{NOMBRE_ESTADO[actual]}» a «{NOMBRE_ESTADO[nuevo]}»."]}
        )
    if nuevo == Ticket.Estado.EN_PROGRESO and ticket.tecnico is None:
        raise ValidationError({"tecnico": ["Asigna un técnico antes de pasar a En progreso."]})

    texto = ""
    ahora = timezone.now()
    if nuevo == Ticket.Estado.RESUELTO:
        texto = _texto(solucion)
        if not texto:
            raise ValidationError({"solucion": ["Describe la solución para resolver el ticket."]})
        ticket.solucion = texto
        ticket.resuelto_en = ahora
    elif nuevo == Ticket.Estado.CERRADO:
        ticket.cerrado_en = ahora
    elif actual in (Ticket.Estado.RESUELTO, Ticket.Estado.CERRADO):
        # Reabrir: la solución anterior queda en el evento de resolución.
        ticket.solucion = ""
        ticket.resuelto_en = None
        ticket.cerrado_en = None

    ticket.estado = nuevo
    ticket.save()
    registrar_evento(ticket, EventoTicket.Tipo.ESTADO, autor, texto=texto, anterior=actual, nuevo=nuevo)
    return ticket


@transaction.atomic
def corregir_prioridad(ticket, prioridad, motivo, autor):
    _exigir_no_cerrado(ticket)
    if prioridad not in Ticket.Prioridad.values:
        raise ValidationError({"prioridad": ["Elige una prioridad válida."]})
    if prioridad == ticket.prioridad:
        raise ValidationError({"prioridad": ["La prioridad ya tiene ese valor. Elige otra para corregirla."]})
    motivo = _texto(motivo)
    if not motivo:
        raise ValidationError({"motivo": ["Explica por qué cambias la prioridad."]})

    anterior = ticket.prioridad
    ticket.prioridad = prioridad
    ticket.prioridad_manual = True
    ticket.save()
    registrar_evento(ticket, EventoTicket.Tipo.PRIORIDAD, autor, texto=motivo, anterior=anterior, nuevo=prioridad)
    return ticket


def comentar(ticket, texto, autor, visible_cliente=False):
    _exigir_no_cerrado(ticket)
    if not isinstance(visible_cliente, bool):
        raise ValidationError({"visible_cliente": ["Indica si el comentario es visible para el cliente."]})
    texto = _texto(texto)
    if not texto:
        raise ValidationError({"texto": ["Escribe el comentario."]})
    return registrar_evento(
        ticket, EventoTicket.Tipo.COMENTARIO, autor, texto=texto, visible_cliente=visible_cliente
    )
