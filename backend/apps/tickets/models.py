from django.db import models
from django.utils import timezone

class Ticket(models.Model):
    class Estado(models.TextChoices):
        ABIERTO = "abierto"
        EN_PROGRESO = "en_progreso"
        RESUELTO = "resuelto"
        CERRADO = "cerrado"

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.CASCADE)
    titulo = models.CharField(max_length=200)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.ABIERTO)
    creado_en = models.DateTimeField(default=timezone.now)