"""Operaciones sobre incidentes que dejan rastro en la bitácora."""

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import AccionIncidente
from .severidad import calcular_severidad

MSG_CERRADO = "El incidente está cerrado. Reábrelo para modificarlo."


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
