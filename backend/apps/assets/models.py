from django.conf import settings
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

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.PROTECT)
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    nombre = models.CharField(max_length=100)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.OPERATIVO)

    hostname = models.CharField(max_length=150, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    sistema_operativo = models.CharField(max_length=100, blank=True)
    fabricante = models.CharField(max_length=100, blank=True)
    modelo = models.CharField(max_length=100, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    ubicacion = models.CharField(max_length=150, blank=True)
    notas = models.TextField(blank=True)

    de_baja = models.BooleanField(default=False)
    fecha_baja = models.DateTimeField(null=True, blank=True)

    creado_en = models.DateTimeField(default=timezone.now, editable=False)
    actualizado_en = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.de_baja and self.fecha_baja is None:
            self.fecha_baja = timezone.now()
        elif not self.de_baja:
            self.fecha_baja = None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre


class Backup(models.Model):
    class Estado(models.TextChoices):
        EXITOSO = "exitoso"
        FALLIDO = "fallido"
        PENDIENTE = "pendiente"

    class Tipo(models.TextChoices):
        COMPLETO = "completo"
        INCREMENTAL = "incremental"
        DIFERENCIAL = "diferencial"

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.PROTECT)
    # Nulo solo en backups anteriores al módulo 03; la API lo exige.
    activo = models.ForeignKey(Activo, null=True, blank=True, on_delete=models.PROTECT)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    tipo = models.CharField(max_length=12, choices=Tipo.choices, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
    tamano_gb = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notas = models.TextField(blank=True)
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    creado_en = models.DateTimeField(default=timezone.now, editable=False)
