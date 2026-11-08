from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket
from apps.tickets.prioridad import calcular_prioridad


class CalcularPrioridadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        org = Organizacion.objects.create(nombre="Org", nit="900000001")
        cls.servidor_critico = Activo.objects.create(
            organizacion=org, tipo="servidor", nombre="S1", estado="critico"
        )
        cls.red_operativa = Activo.objects.create(
            organizacion=org, tipo="red", nombre="R1", estado="operativo"
        )

    def test_solo_alcance(self):
        self.assertEqual(calcular_prioridad("un_usuario", "otro", None), "baja")
        self.assertEqual(calcular_prioridad("varios_usuarios", "software", None), "media")
        self.assertEqual(calcular_prioridad("toda_empresa", "software", None), "alta")

    def test_categoria_red_o_seguridad_suma(self):
        self.assertEqual(calcular_prioridad("varios_usuarios", "red", None), "alta")
        self.assertEqual(calcular_prioridad("toda_empresa", "red", None), "alta")
        self.assertEqual(calcular_prioridad("un_usuario", "seguridad", None), "media")

    def test_servidor_critico_suma_dos(self):
        self.assertEqual(calcular_prioridad("toda_empresa", "software", self.servidor_critico), "critica")
        self.assertEqual(calcular_prioridad("toda_empresa", "seguridad", self.servidor_critico), "critica")

    def test_activo_de_red_operativo_no_suma(self):
        self.assertEqual(calcular_prioridad("un_usuario", "otro", self.red_operativa), "baja")


class ModeloTicketTests(APITestCase):
    def test_codigo_automatico(self):
        org = Organizacion.objects.create(nombre="Org", nit="900000001")
        t = Ticket.objects.create(organizacion=org, titulo="A")
        t.refresh_from_db()
        self.assertEqual(t.codigo, f"TCK-{t.pk:04d}")
        codigo = t.codigo
        t.titulo = "B"
        t.save()
        t.refresh_from_db()
        self.assertEqual(t.codigo, codigo)

    def test_seed_crea_tickets_con_datos(self):
        call_command("seed_demo", stdout=StringIO())
        self.assertFalse(Ticket.objects.filter(codigo__isnull=True).exists())
        self.assertFalse(Ticket.objects.filter(descripcion="").exists())
        self.assertGreater(Ticket.objects.values("prioridad").distinct().count(), 1)

    def test_dashboard_tickets_abiertos_no_cambia(self):
        self.client.force_authenticate(Usuario.objects.create_user("admin1", rol="admin"))
        org = Organizacion.objects.create(nombre="Org", nit="900000001")
        for estado in ["abierto", "en_progreso", "cerrado"]:
            Ticket.objects.create(organizacion=org, titulo=estado, estado=estado)
        d = self.client.get("/api/dashboard/admin/").data
        self.assertEqual(d["resumen_operativo"]["tickets_abiertos"], 2)


class MigracionCodigosTests(TransactionTestCase):
    antes = [("tickets", "0002_alter_ticket_organizacion")]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_migracion_asigna_codigo(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.antes)
        apps_viejas = executor.loader.project_state(self.antes).apps
        Org = apps_viejas.get_model("organizations", "Organizacion")
        TicketViejo = apps_viejas.get_model("tickets", "Ticket")
        org = Org.objects.create(nombre="Vieja")
        viejo = TicketViejo.objects.create(organizacion=org, titulo="Antiguo")

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

        t = Ticket.objects.get(pk=viejo.pk)
        self.assertEqual(t.codigo, f"TCK-{t.pk:04d}")
        self.assertEqual((t.alcance, t.categoria, t.prioridad), ("un_usuario", "otro", "baja"))
