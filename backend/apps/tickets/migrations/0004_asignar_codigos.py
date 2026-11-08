from django.db import migrations


def asignar_codigos(apps, schema_editor):
    Ticket = apps.get_model("tickets", "Ticket")
    for ticket in Ticket.objects.filter(codigo__isnull=True).only("pk"):
        Ticket.objects.filter(pk=ticket.pk).update(codigo=f"TCK-{ticket.pk:04d}")


class Migration(migrations.Migration):
    dependencies = [
        ("tickets", "0003_campos_modulo_04"),
    ]

    operations = [
        migrations.RunPython(asignar_codigos, migrations.RunPython.noop),
    ]
