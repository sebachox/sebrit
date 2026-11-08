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

    class Impacto(models.TextChoices):
        DEGRADADO = "degradado"
        PARCIAL = "parcial"
        TOTAL = "total"

    # Nulo solo durante el primer insert: el código se deriva del id.
    codigo = models.CharField(max_length=20, unique=True, null=True, editable=False)
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    organizacion = models.ForeignKey("organizations.Organizacion", on_delete=models.PROTECT)
    impacto = models.CharField(max_length=10, choices=Impacto.choices, default=Impacto.PARCIAL)
    activos = models.ManyToManyField("assets.Activo", blank=True, related_name="incidentes")
    severidad = models.CharField(max_length=10, choices=Severidad.choices)
    severidad_manual = models.BooleanField(default=False)
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.ABIERTO)
    tecnico = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    reportado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="incidentes_reportados",
    )
    solucion = models.TextField(blank=True)
    causa_raiz = models.TextField(blank=True)
    # La API exige fecha_origen; el valor por defecto es para datos creados fuera de ella.
    fecha_origen = models.DateTimeField(default=timezone.now)
    creado_en = models.DateTimeField(default=timezone.now)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    cerrado_en = models.DateTimeField(null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    @property
    def duracion_minutos(self):
        if self.fecha_fin is None:
            return None
        return int((self.fecha_fin - self.fecha_origen).total_seconds() // 60)

    def _codigo_libre(self):
        modelo = type(self)
        numero = self.pk
        while modelo.objects.filter(codigo=f"INC-{numero:04d}").exists():
            numero += 1
        return f"INC-{numero:04d}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = self._codigo_libre()
            type(self).objects.filter(pk=self.pk).update(codigo=self.codigo)

    def __str__(self):
        return self.codigo or self.titulo


class AccionIncidente(models.Model):
    class Tipo(models.TextChoices):
        CREACION = "creacion"
        ACCION = "accion"
        ESTADO = "estado"
        TECNICO = "tecnico"
        SEVERIDAD = "severidad"
        TICKET = "ticket"

    incidente = models.ForeignKey(Incidente, on_delete=models.CASCADE, related_name="acciones")
    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.ACCION)
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    descripcion = models.TextField()
    valor_anterior = models.TextField(null=True, blank=True)
    valor_nuevo = models.TextField(null=True, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
