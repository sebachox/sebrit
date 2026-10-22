from django.conf import settings
from django.db import models
from django.utils import timezone

class Incidente(models.Model):
    class Severidad(models.TextChoices):
        BAJA = "baja"
        MEDIA = "media"
        ALTA = "alta"
        CRITICA = "critica"

    class Estado(models.TextChoices):
        ABIERTO = "abierto"
        EN_PROGRESO = "en_progreso"
        RESUELTO = "resuelto"
        CERRADO = "cerrado"

    codigo = models.CharField(max_length=20, unique=True)
    titulo = models.CharField(max_length=200)
    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.CASCADE)
    severidad = models.CharField(max_length=10, choices=Severidad.choices)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.ABIERTO)
    tecnico = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    creado_en = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.codigo


class AccionIncidente(models.Model):
    incidente = models.ForeignKey(Incidente, on_delete=models.CASCADE)
    descripcion = models.CharField(max_length=255)
    fecha = models.DateTimeField(default=timezone.now)