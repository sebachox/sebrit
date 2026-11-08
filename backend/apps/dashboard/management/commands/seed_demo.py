from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.incidents.models import AccionIncidente, Incidente
from apps.incidents.severidad import calcular_severidad
from apps.maintenance.models import Mantenimiento
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket
from apps.tickets.prioridad import calcular_prioridad


class Command(BaseCommand):
    help = "Carga datos de demostración para el dashboard administrativo"

    def handle(self, *args, **options):
        if Organizacion.objects.exists():
            self.stdout.write("Ya hay datos; no se carga nada.")
            return

        org1 = Organizacion.objects.create(
            nombre="Empresa Ejemplo S.A.S.", nit="900123456-7", ciudad="Bogotá", plan="premium",
        )
        org2 = Organizacion.objects.create(
            nombre="Comercial del Sur", nit="800987654-3", ciudad="Cali", plan="estandar",
        )
        Organizacion.objects.create(
            nombre="Inactiva Ltda.", nit="901555222-1", ciudad="Medellín", plan="basico", activa=False,
        )

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
        servidores_org1 = list(Activo.objects.filter(organizacion=org1, tipo="servidor"))
        for n, estado in enumerate(["exitoso"] * 18 + ["fallido", "pendiente"]):
            Backup.objects.create(
                organizacion=org1,
                activo=servidores_org1[n % len(servidores_org1)],
                estado=estado,
                tipo="completo" if n == 0 else "incremental",
            )

        # Tickets
        categorias = ["hardware", "software", "red", "seguridad", "accesos", "otro"]
        alcances = ["un_usuario", "varios_usuarios", "toda_empresa"]
        for n in range(28):
            categoria, alcance = categorias[n % 6], alcances[n % 3]
            Ticket.objects.create(
                organizacion=org1 if n % 2 else org2,
                titulo=f"Solicitud {n + 1}",
                descripcion=f"Detalle de la solicitud {n + 1} reportada por el cliente.",
                categoria=categoria,
                alcance=alcance,
                prioridad=calcular_prioridad(alcance, categoria, None),
                tecnico=carlos if n % 4 == 0 else None,
            )
        for n in range(5):
            Ticket.objects.create(
                organizacion=org1,
                titulo=f"Solicitud cerrada {n + 1}",
                descripcion="Solicitud atendida y cerrada.",
                estado="cerrado",
                categoria="software",
                solucion="Se aplicó la corrección y el cliente confirmó.",
                tecnico=laura,
                cerrado_en=timezone.now(),
            )

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

        # Incidentes: 3 críticos activos (1 abierto sin técnico, 2 en progreso), 1 cerrado y 1 resuelto
        ahora = timezone.now()
        servidores_org2 = list(Activo.objects.filter(organizacion=org2, tipo="servidor"))

        def incidente(impacto, activos, horas_atras, **datos):
            detectado = ahora - timedelta(hours=horas_atras)
            i = Incidente.objects.create(
                impacto=impacto,
                severidad=calcular_severidad(impacto, activos),
                fecha_origen=detectado - timedelta(minutes=20),
                creado_en=detectado,
                **datos,
            )
            i.activos.set(activos)
            AccionIncidente.objects.create(
                incidente=i, tipo="creacion", descripcion="Incidente registrado.", fecha=detectado
            )
            return i

        i1 = incidente(
            "total", [servidores_org1[0]], 3,
            titulo="Servidor de base de datos sin respuesta",
            descripcion="El servidor principal de base de datos dejó de responder a las aplicaciones.",
            organizacion=org1, estado="en_progreso", tecnico=carlos,
        )
        AccionIncidente.objects.create(incidente=i1, descripcion="Se inició el diagnóstico del servidor")
        Ticket.objects.filter(pk__in=Ticket.objects.filter(organizacion=org1).order_by("id")[:2]).update(
            incidente=i1
        )
        incidente(
            "total", [servidores_org2[0]], 2,
            titulo="Caída intermitente del enlace principal",
            descripcion="El enlace principal se cae por periodos cortos y afecta a toda la sede.",
            organizacion=org2, estado="abierto",
        )
        i3 = incidente(
            "total", [servidores_org1[1]], 1,
            titulo="Fallo en el firewall perimetral",
            descripcion="El firewall perimetral reinicia sus servicios y corta las conexiones externas.",
            organizacion=org1, estado="en_progreso", tecnico=laura,
        )
        AccionIncidente.objects.create(incidente=i3, descripcion="Se aisló el equipo afectado")
        incidente(
            "total", [], 48,
            titulo="Lentitud en el correo",
            descripcion="El correo tardaba varios minutos en entregar los mensajes.",
            organizacion=org2, estado="cerrado", tecnico=laura,
            solucion="Se depuró la cola de mensajes del servidor de correo.",
            causa_raiz="La cola de mensajes se llenó por una cuenta comprometida.",
            fecha_fin=ahora - timedelta(hours=45),
            cerrado_en=ahora - timedelta(hours=44),
        )
        incidente(
            "parcial", [], 26,
            titulo="Certificado vencido",
            descripcion="El certificado del portal interno venció y los navegadores bloqueaban el acceso.",
            organizacion=org1, estado="resuelto", tecnico=carlos,
            solucion="Se renovó e instaló el certificado.",
            fecha_fin=ahora - timedelta(hours=25),
        )

        self.stdout.write(self.style.SUCCESS("Datos de demostración cargados."))