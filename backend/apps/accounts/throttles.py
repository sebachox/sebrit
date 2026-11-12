"""Límites de intentos para frenar el adivinado de contraseñas.

La IP sale de REMOTE_ADDR (`NUM_PROXIES = 0` en settings): la cabecera X-Forwarded-For
la puede escribir cualquiera. Con un proxy delante en producción hay que subir ese valor.
"""

import hashlib

from rest_framework.exceptions import Throttled
from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


def usuario_normalizado(request):
    datos = request.data if isinstance(request.data, dict) else {}
    valor = datos.get("username")
    return valor.strip().lower() if isinstance(valor, str) else ""


class LoginPorUsuarioThrottle(SimpleRateThrottle):
    """Mismo usuario desde la misma IP: los compañeros que salen por esa IP no se bloquean entre sí."""

    scope = "login_usuario"

    def get_cache_key(self, request, view):
        usuario = hashlib.sha256(usuario_normalizado(request).encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": f"{self.get_ident(request)}:{usuario}"}


class LoginPorIPThrottle(SimpleRateThrottle):
    """Tope más alto por IP, para quien prueba muchos usuarios distintos."""

    scope = "login_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class CambioClaveThrottle(UserRateThrottle):
    scope = "cambio_clave"


def limite_superado(wait):
    """Throttled en español: DRF agrega su propio texto en inglés si recibe `wait` en el constructor."""
    segundos = max(1, round(wait or 60))
    error = Throttled(detail=f"Demasiados intentos. Espera {segundos} segundos e intenta de nuevo.")
    error.wait = wait
    return error
