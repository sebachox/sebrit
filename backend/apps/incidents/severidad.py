"""Regla automática de severidad de un incidente."""

PUNTOS_IMPACTO = {"degradado": 1, "parcial": 2, "total": 3}


def calcular_severidad(impacto, activos):
    activos = list(activos)
    puntos = PUNTOS_IMPACTO[impacto]
    if any(a.tipo == "servidor" for a in activos):
        puntos += 1
    if any(a.estado == "critico" for a in activos):
        puntos += 1

    if puntos <= 1:
        return "baja"
    if puntos == 2:
        return "media"
    if puntos == 3:
        return "alta"
    return "critica"
