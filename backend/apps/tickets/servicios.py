"""Operaciones sobre tickets que dejan rastro en la línea de tiempo."""

from .models import EventoTicket
from .prioridad import calcular_prioridad


def nombre_usuario(usuario):
    return (usuario.get_full_name() or usuario.username) if usuario else ""


def registrar_evento(ticket, tipo, autor, texto="", anterior="", nuevo=""):
    return EventoTicket.objects.create(
        ticket=ticket, tipo=tipo, autor=autor, texto=texto, valor_anterior=anterior, valor_nuevo=nuevo
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
