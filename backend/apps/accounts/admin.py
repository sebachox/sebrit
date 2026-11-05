from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("SEBRIT", {"fields": ("rol", "organizacion")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("SEBRIT", {"fields": ("first_name", "last_name", "email", "rol", "organizacion")}),
    )
    list_display = ("username", "first_name", "last_name", "rol", "organizacion", "is_superuser", "is_active")
    list_filter = ("rol", "organizacion", "is_superuser", "is_staff", "is_active")
    search_fields = ("username", "first_name", "last_name", "email")
