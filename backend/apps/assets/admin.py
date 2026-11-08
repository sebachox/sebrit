from django.contrib import admin

from .models import Activo, Backup


@admin.register(Activo)
class ActivoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "organizacion", "tipo", "estado", "ip", "de_baja")
    list_filter = ("tipo", "estado", "de_baja", "organizacion")
    search_fields = ("nombre", "hostname", "ip", "numero_serie")


@admin.register(Backup)
class BackupAdmin(admin.ModelAdmin):
    list_display = ("fecha", "activo", "organizacion", "tipo", "estado", "tamano_gb")
    list_filter = ("estado", "tipo", "organizacion")
