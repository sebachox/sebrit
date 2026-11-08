from django.contrib import admin

from .models import EventoTicket, Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("codigo", "titulo", "organizacion", "prioridad", "estado", "tecnico")
    list_filter = ("estado", "prioridad", "categoria", "organizacion")
    search_fields = ("codigo", "titulo")


admin.site.register(EventoTicket)
