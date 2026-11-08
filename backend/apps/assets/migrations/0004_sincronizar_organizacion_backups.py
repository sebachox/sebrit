from django.db import migrations
from django.db.models import F, OuterRef, Subquery


def sincronizar(apps, schema_editor):
    """Desde el módulo 03 la organización de un backup es la de su activo.

    Corrige los backups creados antes (por ejemplo desde el admin de Django)
    cuya organización no coincide con la de su activo.
    """
    Backup = apps.get_model("assets", "Backup")
    Activo = apps.get_model("assets", "Activo")
    org_del_activo = Activo.objects.filter(pk=OuterRef("activo_id")).values("organizacion_id")[:1]
    (
        Backup.objects.filter(activo__isnull=False)
        .exclude(organizacion=F("activo__organizacion"))
        .update(organizacion_id=Subquery(org_del_activo))
    )


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0003_activo_actualizado_en_activo_creado_en_and_more"),
    ]

    operations = [
        migrations.RunPython(sincronizar, migrations.RunPython.noop),
    ]
