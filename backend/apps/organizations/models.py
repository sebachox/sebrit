from django.db import models
from django.utils import timezone


class Organizacion(models.Model):
    class Plan(models.TextChoices):
        BASICO = "basico"
        ESTANDAR = "estandar"
        PREMIUM = "premium"

    nombre = models.CharField(max_length=150, unique=True)
    # Nulo solo para las organizaciones creadas antes del módulo 02; la API lo exige.
    nit = models.CharField(max_length=20, unique=True, null=True, blank=True)
    sector = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    correo = models.EmailField(blank=True)
    direccion = models.CharField(max_length=200, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)

    contacto_nombre = models.CharField(max_length=150, blank=True)
    contacto_cargo = models.CharField(max_length=100, blank=True)
    contacto_correo = models.EmailField(blank=True)
    contacto_telefono = models.CharField(max_length=30, blank=True)

    plan = models.CharField(max_length=10, choices=Plan.choices, blank=True)
    fecha_inicio_contrato = models.DateField(null=True, blank=True)
    fecha_fin_contrato = models.DateField(null=True, blank=True)

    activa = models.BooleanField(default=True)
    creado_en = models.DateTimeField(default=timezone.now, editable=False)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre
