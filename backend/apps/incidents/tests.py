from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.assets.models import Activo
from apps.incidents.models import Incidente
from apps.incidents.severidad import calcular_severidad
from apps.organizations.models import Organizacion


class CalcularSeveridadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        org = Organizacion.objects.create(nombre="Org", nit="900000001")
        crear = lambda nombre, tipo, estado: Activo.objects.create(  # noqa: E731
            organizacion=org, nombre=nombre, tipo=tipo, estado=estado
        )
        cls.servidor_operativo = crear("S1", "servidor", "operativo")
        cls.otro_servidor = crear("S2", "servidor", "operativo")
        cls.servidor_critico = crear("S3", "servidor", "critico")
        cls.red_critico = crear("R1", "red", "critico")

    def test_solo_impacto(self):
        self.assertEqual(calcular_severidad("degradado", []), "baja")
        self.assertEqual(calcular_severidad("parcial", []), "media")
        self.assertEqual(calcular_severidad("total", []), "alta")

    def test_servidor_suma_uno(self):
        self.assertEqual(calcular_severidad("total", [self.servidor_operativo]), "critica")

    def test_servidor_critico_suma_dos(self):
        self.assertEqual(calcular_severidad("parcial", [self.servidor_critico]), "critica")
        self.assertEqual(calcular_severidad("total", [self.servidor_critico]), "critica")

    def test_red_critico_suma_uno(self):
        self.assertEqual(calcular_severidad("degradado", [self.red_critico]), "media")

    def test_dos_servidores_suman_una_vez(self):
        self.assertEqual(
            calcular_severidad("degradado", [self.servidor_operativo, self.otro_servidor]), "media"
        )


class ModeloIncidenteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organizacion.objects.create(nombre="Org", nit="900000001")

    def crear(self, **extra):
        return Incidente.objects.create(organizacion=self.org, titulo="A", severidad="baja", **extra)

    def test_codigo_automatico(self):
        i = self.crear()
        i.refresh_from_db()
        self.assertEqual(i.codigo, f"INC-{i.pk:04d}")
        codigo = i.codigo
        i.titulo = "B"
        i.save()
        i.refresh_from_db()
        self.assertEqual(i.codigo, codigo)

    def test_codigo_toma_siguiente_libre(self):
        primero = self.crear()
        # El siguiente id que entregará la base ya tiene dueño.
        Incidente.objects.filter(pk=primero.pk).update(codigo=f"INC-{primero.pk + 1:04d}")
        nuevo = self.crear()
        nuevo.refresh_from_db()
        self.assertEqual(nuevo.pk, primero.pk + 1)
        self.assertEqual(nuevo.codigo, f"INC-{nuevo.pk + 1:04d}")

    def test_codigo_explicito_se_conserva(self):
        i = self.crear(codigo="INC-9")
        i.refresh_from_db()
        self.assertEqual(i.codigo, "INC-9")

    def test_duracion_minutos(self):
        origen = timezone.now() - timedelta(hours=2)
        i = self.crear(fecha_origen=origen, fecha_fin=origen + timedelta(minutes=90))
        self.assertEqual(i.duracion_minutos, 90)

    def test_duracion_sin_fin_es_nula(self):
        self.assertIsNone(self.crear().duracion_minutos)


class MigracionIncidentesTests(TransactionTestCase):
    antes = [("incidents", "0002_alter_incidente_organizacion")]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_migracion_datos(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.antes)
        apps_viejas = executor.loader.project_state(self.antes).apps
        Org = apps_viejas.get_model("organizations", "Organizacion")
        IncidenteViejo = apps_viejas.get_model("incidents", "Incidente")
        AccionVieja = apps_viejas.get_model("incidents", "AccionIncidente")
        org = Org.objects.create(nombre="Vieja")
        abierto = IncidenteViejo.objects.create(
            codigo="INC-0007", titulo="Abierto", organizacion=org, severidad="alta"
        )
        cerrado = IncidenteViejo.objects.create(
            codigo="INC-0008", titulo="Cerrado", organizacion=org, severidad="baja", estado="cerrado"
        )
        fecha = cerrado.creado_en + timedelta(hours=3)
        accion = AccionVieja.objects.create(incidente=cerrado, descripcion="Se atendió", fecha=fecha)

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

        a = Incidente.objects.get(pk=abierto.pk)
        self.assertTrue(a.severidad_manual)
        self.assertEqual(a.severidad, "alta")
        self.assertEqual(a.impacto, "parcial")
        self.assertEqual(a.fecha_origen, a.creado_en)
        self.assertEqual(a.descripcion, "Abierto")
        self.assertIsNone(a.fecha_fin)
        self.assertEqual(a.codigo, "INC-0007")

        c = Incidente.objects.get(pk=cerrado.pk)
        self.assertEqual(c.fecha_fin, fecha)
        self.assertEqual(c.cerrado_en, fecha)
        self.assertEqual(c.acciones.get(pk=accion.pk).tipo, "accion")
        self.assertIsNone(c.acciones.get(pk=accion.pk).autor)


class SeedIncidentesTests(TestCase):
    def test_seed(self):
        call_command("seed_demo", stdout=StringIO())
        todos = Incidente.objects.all()
        self.assertEqual(todos.count(), 5)
        criticos = todos.filter(severidad="critica", estado__in=["abierto", "en_progreso"])
        self.assertEqual(criticos.count(), 3)
        self.assertEqual(criticos.filter(tecnico__isnull=True).count(), 1)

        resuelto = todos.get(estado="resuelto")
        self.assertIsNotNone(resuelto.duracion_minutos)
        self.assertTrue(resuelto.solucion)
        self.assertTrue(todos.get(estado="cerrado").causa_raiz)

        for i in todos:
            self.assertTrue(i.descripcion)
            self.assertFalse(i.severidad_manual)
            self.assertEqual(i.severidad, calcular_severidad(i.impacto, i.activos.all()))
