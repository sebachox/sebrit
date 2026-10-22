from django.contrib.auth.models import AbstractUser
from django.db import models

class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        ADMIN = "admin"
        TECNICO = "tecnico"
        CLIENTE = "cliente"

    rol = models.CharField(max_length=10, choices=Rol.choices, default=Rol.CLIENTE)
    organizacion = models.ForeignKey(
        "organizations.Organizacion", null=True, blank=True, on_delete=models.SET_NULL
    )

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.rol = self.Rol.ADMIN
        super().save(*args, **kwargs)