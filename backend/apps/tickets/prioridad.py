"""Regla de prioridad automática de los tickets (puntos por lo afectado)."""

PUNTOS_ALCANCE = {"un_usuario": 1, "varios_usuarios": 2, "toda_empresa": 3}
CATEGORIAS_SENSIBLES = {"red", "seguridad"}


def calcular_prioridad(alcance, categoria, activo):
    puntos = PUNTOS_ALCANCE[alcance]
    if categoria in CATEGORIAS_SENSIBLES:
        puntos += 1
    if activo is not None:
        if activo.tipo == "servidor":
            puntos += 1
        if activo.estado == "critico":
            puntos += 1

    if puntos <= 1:
        return "baja"
    if puntos == 2:
        return "media"
    if puntos <= 4:
        return "alta"
    return "critica"
