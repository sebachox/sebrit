from django.db import migrations


def completar_incidentes(apps, schema_editor):
    """Los incidentes anteriores al módulo conservan su severidad, marcada como manual."""
    Incidente = apps.get_model("incidents", "Incidente")
    Accion = apps.get_model("incidents", "AccionIncidente")
    for incidente in Incidente.objects.all():
        incidente.severidad_manual = True
        incidente.impacto = "parcial"
        incidente.fecha_origen = incidente.creado_en
        incidente.descripcion = incidente.titulo
        if incidente.estado in ("resuelto", "cerrado"):
            ultima = Accion.objects.filter(incidente=incidente).order_by("-fecha").first()
            incidente.fecha_fin = ultima.fecha if ultima else incidente.creado_en
            if incidente.estado == "cerrado":
                incidente.cerrado_en = incidente.fecha_fin
        incidente.save()


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0003_campos_modulo_05"),
    ]

    operations = [
        migrations.RunPython(completar_incidentes, migrations.RunPython.noop),
    ]
