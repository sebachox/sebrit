from django.db import models

class Mantenimiento(models.Model):
    class Estado(models.TextChoices):
        PROGRAMADO = "programado"
        EN_CURSO = "en_curso"
        COMPLETADO = "completado"

    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.CASCADE)
    titulo = models.CharField(max_length=200)
    fecha_programada = models.DateTimeField()
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PROGRAMADO)