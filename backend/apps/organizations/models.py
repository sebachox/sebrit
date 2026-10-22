from django.db import models

class Organizacion(models.Model):
    nombre = models.CharField(max_length=150, unique=True)
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre