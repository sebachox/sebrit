from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.incidents.models import AccionIncidente, Incidente
from apps.maintenance.models import Mantenimiento
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket


class Command(BaseCommand):
    help = "Carga datos de demostración para el dashboard administrativo"

    def handle(self, *args, **options):
        if Organizacion.objects.exists():
            self.stdout.write("Ya hay datos; no se carga nada.")
            return

        org1 = Organizacion.objects.create(nombre="Empresa Ejemplo S.A.S.")
        org2 = Organizacion.objects.create(nombre="Comercial del Sur")
        Organizacion.objects.create(nombre="Inactiva Ltda.", activa=False)

        carlos = Usuario.objects.create_user("carlos", first_name="Carlos", last_name="Pérez", rol="tecnico")
        laura = Usuario.objects.create_user("laura", first_name="Laura", last_name="Gómez", rol="tecnico")

        # Infraestructura: mismas proporciones del JSON de ejemplo
        estados_srv = ["operativo"] * 22 + ["advertencia"] * 2 + ["critico"]
        for n, estado in enumerate(estados_srv, 1):
            Activo.objects.create(
                organizacion=org1 if n % 2 else org2,
                tipo="servidor", nombre=f"SRV-{n:02d}", estado=estado,
            )
        estados_red = ["operativo"] * 13 + ["advertencia"] + ["critico"]
        for n, estado in enumerate(estados_red, 1):
            Activo.objects.create(
                organizacion=org1 if n % 2 else org2,
                tipo="red", nombre=f"NET-{n:02d}", estado=estado,
            )
        for estado in ["exitoso"] * 18 + ["fallido", "pendiente"]:
            Backup.objects.create(organizacion=org1, estado=estado)

        # Tickets
        for n in range(28):
            Ticket.objects.create(organizacion=org1 if n % 2 else org2, titulo=f"Solicitud {n + 1}")
        for n in range(5):
            Ticket.objects.create(organizacion=org1, titulo=f"Solicitud cerrada {n + 1}", estado="cerrado")

        # Mantenimientos: 4 hoy y 1 mañana
        hoy = timezone.localtime().replace(minute=0, second=0, microsecond=0)
        for h in (8, 10, 14, 16):
            Mantenimiento.objects.create(
                organizacion=org1, titulo=f"Mantenimiento {h}:00", fecha_programada=hoy.replace(hour=h),
            )
        Mantenimiento.objects.create(
            organizacion=org2, titulo="Mantenimiento de mañana",
            fecha_programada=hoy + timezone.timedelta(days=1),
        )

        # Incidentes: 3 críticos activos (1 abierto sin técnico, 2 en progreso)
        i1 = Incidente.objects.create(
            codigo="INC-0001", titulo="Servidor de base de datos sin respuesta",
            organizacion=org1, severidad="critica", estado="en_progreso", tecnico=carlos,
        )
        AccionIncidente.objects.create(incidente=i1, descripcion="Se inició el diagnóstico del servidor")
        Incidente.objects.create(
            codigo="INC-0002", titulo="Caída intermitente del enlace principal",
            organizacion=org2, severidad="critica", estado="abierto",
        )
        i3 = Incidente.objects.create(
            codigo="INC-0003", titulo="Fallo en el firewall perimetral",
            organizacion=org1, severidad="critica", estado="en_progreso", tecnico=laura,
        )
        AccionIncidente.objects.create(incidente=i3, descripcion="Se aisló el equipo afectado")
        Incidente.objects.create(
            codigo="INC-0004", titulo="Lentitud en el correo",
            organizacion=org2, severidad="alta", estado="abierto", tecnico=laura,
        )
        Incidente.objects.create(
            codigo="INC-0005", titulo="Certificado vencido",
            organizacion=org1, severidad="media", estado="resuelto", tecnico=carlos,
        )

        self.stdout.write(self.style.SUCCESS("Datos de demostración cargados."))