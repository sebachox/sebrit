from django.conf import settings
from django.db import models
from django.utils import timezone


class Ticket(models.Model):
    class Estado(models.TextChoices):
        ABIERTO = "abierto"
        EN_PROGRESO = "en_progreso"
        RESUELTO = "resuelto"
        CERRADO = "cerrado"

    class Categoria(models.TextChoices):
        HARDWARE = "hardware"
        SOFTWARE = "software"
        RED = "red"
        SEGURIDAD = "seguridad"
        ACCESOS = "accesos"
        OTRO = "otro"

    class Alcance(models.TextChoices):
        UN_USUARIO = "un_usuario"
        VARIOS_USUARIOS = "varios_usuarios"
        TODA_EMPRESA = "toda_empresa"

    class Prioridad(models.TextChoices):
        BAJA = "baja"
        MEDIA = "media"
        ALTA = "alta"
        CRITICA = "critica"

    # Nulo solo durante el primer insert: el código se deriva del id.
    codigo = models.CharField(max_length=20, unique=True, null=True, editable=False)
    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.PROTECT)
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=10, choices=Categoria.choices, default=Categoria.OTRO)
    alcance = models.CharField(max_length=16, choices=Alcance.choices, default=Alcance.UN_USUARIO)
    activo = models.ForeignKey("assets.Activo", null=True, blank=True, on_delete=models.PROTECT)
    prioridad = models.CharField(max_length=8, choices=Prioridad.choices, default=Prioridad.BAJA)
    prioridad_manual = models.BooleanField(default=False)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.ABIERTO)
    tecnico = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tickets_asignados",
    )
    reportado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tickets_reportados",
    )
    incidente = models.ForeignKey(
        "incidents.Incidente",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tickets",
    )
    solucion = models.TextField(blank=True)
    creado_en = models.DateTimeField(default=timezone.now)
    actualizado_en = models.DateTimeField(auto_now=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)
    cerrado_en = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = f"TCK-{self.pk:04d}"
            type(self).objects.filter(pk=self.pk).update(codigo=self.codigo)

    def __str__(self):
        return self.codigo or self.titulo


class EventoTicket(models.Model):
    class Tipo(models.TextChoices):
        CREACION = "creacion"
        COMENTARIO = "comentario"
        ESTADO = "estado"
        TECNICO = "tecnico"
        PRIORIDAD = "prioridad"
        INCIDENTE = "incidente"

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    texto = models.TextField(blank=True)
    valor_anterior = models.CharField(max_length=100, blank=True)
    valor_nuevo = models.CharField(max_length=100, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
