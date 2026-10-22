from django.db import models
from django.utils import timezone

class Activo(models.Model):
    class Tipo(models.TextChoices):
        SERVIDOR = "servidor"
        RED = "red"

    class Estado(models.TextChoices):
        OPERATIVO = "operativo"
        ADVERTENCIA = "advertencia"
        CRITICO = "critico"

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    nombre = models.CharField(max_length=100)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.OPERATIVO)

    def __str__(self):
        return self.nombre


class Backup(models.Model):
    class Estado(models.TextChoices):
        EXITOSO = "exitoso"
        FALLIDO = "fallido"
        PENDIENTE = "pendiente"

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.CASCADE)
    activo = models.ForeignKey(Activo, null=True, blank=True, on_delete=models.SET_NULL)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    fecha = models.DateTimeField(default=timezone.now)