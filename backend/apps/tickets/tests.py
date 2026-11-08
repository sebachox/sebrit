from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.organizations.models import Organizacion
from apps.tickets.models import EventoTicket, Ticket
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


URL = "/api/tickets/"
URL_TECNICOS = "/api/tecnicos/"


def url_ticket(t):
    return f"{URL}{t.pk}/"


class BaseTickets(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin1", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec1", rol="tecnico", first_name="Laura", last_name="Gómez")
        self.otro_tecnico = Usuario.objects.create_user("tec2", rol="tecnico", first_name="Carlos", last_name="Pérez")
        self.cliente = Usuario.objects.create_user("cli1", rol="cliente")
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.otra = Organizacion.objects.create(nombre="Otra", nit="900000002")
        self.servidor = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        self.ticket = Ticket.objects.create(
            organizacion=self.org, titulo="Base", descripcion="d", categoria="software", alcance="un_usuario"
        )

    def datos(self, **extra):
        d = {
            "organizacion": self.org.pk, "titulo": "Nuevo", "descripcion": "Algo pasó",
            "categoria": "software", "alcance": "un_usuario",
        }
        d.update(extra)
        return d

    def crear(self, **extra):
        return self.client.post(URL, self.datos(**extra), format="json")

    def patch(self, t=None, **datos):
        return self.client.patch(url_ticket(t or self.ticket), datos, format="json")

    def eventos(self, tipo, t=None):
        return EventoTicket.objects.filter(ticket=t or self.ticket, tipo=tipo)


class PermisosTicketsTests(BaseTickets):
    def test_sin_token_da_401(self):
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.assertEqual(self.crear().status_code, 401)
        self.assertEqual(self.client.get(URL_TECNICOS).status_code, 401)

    def test_cliente_da_403(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.crear().status_code, 403)
        self.assertEqual(self.patch(titulo="x").status_code, 403)
        self.assertEqual(self.client.get(URL_TECNICOS).status_code, 403)

    def test_tecnico_y_admin_crean_y_editan(self):
        for u in (self.admin, self.tecnico):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(URL).status_code, 200)
            self.assertEqual(self.crear().status_code, 201)
            self.assertEqual(self.patch(titulo=f"T {u.pk}").status_code, 200)

    def test_put_y_delete_dan_405(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.client.put(url_ticket(self.ticket), {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url_ticket(self.ticket)).status_code, 405)

    def test_inexistente_da_404(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.client.get(f"{URL}99999/").status_code, 404)

    def test_tecnicos_excluye_clientes_e_inactivos(self):
        Usuario.objects.create_user("baja", rol="tecnico", is_active=False)
        self.client.force_authenticate(self.tecnico)
        r = self.client.get(URL_TECNICOS)
        self.assertEqual(r.status_code, 200)
        ids = {u["id"] for u in r.data}
        self.assertEqual(ids, {self.admin.pk, self.tecnico.pk, self.otro_tecnico.pk})
        nombre = next(u["nombre"] for u in r.data if u["id"] == self.tecnico.pk)
        self.assertEqual(nombre, "Laura Gómez")


class CrearEditarTicketTests(BaseTickets):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.tecnico)

    def test_crear_calcula_prioridad_y_deja_evento(self):
        r = self.crear(alcance="toda_empresa", categoria="red")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["prioridad"], "alta")
        self.assertEqual(r.data["reportado_por"], {"id": self.tecnico.pk, "nombre": "Laura Gómez"})
        self.assertTrue(r.data["codigo"].startswith("TCK-"))
        t = Ticket.objects.get(pk=r.data["id"])
        self.assertEqual(self.eventos("creacion", t).count(), 1)

    def test_campos_obligatorios_al_crear(self):
        r = self.client.post(URL, {"organizacion": self.org.pk, "titulo": "X"}, format="json")
        self.assertEqual(r.status_code, 400)
        for campo in ("descripcion", "categoria", "alcance"):
            self.assertIn(campo, r.data)

    def test_no_se_envian_prioridad_ni_estado(self):
        r = self.crear(prioridad="critica", estado="cerrado")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["prioridad"], "baja")
        self.assertEqual(r.data["estado"], "abierto")

    def test_editar_alcance_recalcula_y_deja_evento(self):
        r = self.patch(alcance="toda_empresa")
        self.assertEqual(r.data["prioridad"], "alta")
        ev = self.eventos("prioridad").get()
        self.assertEqual((ev.valor_anterior, ev.valor_nuevo), ("baja", "alta"))

    def test_prioridad_manual_no_se_recalcula(self):
        self.ticket.prioridad = "critica"
        self.ticket.prioridad_manual = True
        self.ticket.save()
        r = self.patch(alcance="varios_usuarios")
        self.assertEqual(r.data["prioridad"], "critica")
        self.assertFalse(self.eventos("prioridad").exists())

    def test_quitar_activo_recalcula(self):
        self.ticket.activo = self.servidor
        self.ticket.prioridad = "media"
        self.ticket.save()
        r = self.patch(activo=None)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["activo"])
        self.assertEqual(r.data["prioridad"], "baja")
        self.assertEqual(self.eventos("prioridad").count(), 1)

    def test_cambiar_tecnico_deja_evento(self):
        self.ticket.tecnico = self.tecnico
        self.ticket.save()
        r = self.patch(tecnico=self.otro_tecnico.pk)
        self.assertEqual(r.status_code, 200)
        ev = self.eventos("tecnico").get()
        self.assertEqual((ev.valor_anterior, ev.valor_nuevo), ("Laura Gómez", "Carlos Pérez"))
        self.assertEqual(ev.autor, self.tecnico)

    def test_patch_sin_cambios_no_crea_eventos(self):
        self.patch(titulo="Base", alcance="un_usuario", categoria="software")
        self.assertEqual(EventoTicket.objects.filter(ticket=self.ticket).count(), 0)

    def test_desasignar_en_progreso_da_400(self):
        self.ticket.tecnico = self.tecnico
        self.ticket.estado = "en_progreso"
        self.ticket.save()
        r = self.patch(tecnico=None)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["tecnico"], ["Un ticket en progreso debe tener un técnico asignado."])

    def test_activo_de_otro_cliente(self):
        ajeno = Activo.objects.create(organizacion=self.otra, tipo="red", nombre="R9")
        r = self.crear(activo=ajeno.pk)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["activo"], ["El activo no pertenece a este cliente."])

    def test_activo_de_baja_al_asignar(self):
        baja = Activo.objects.create(organizacion=self.org, tipo="red", nombre="R8", de_baja=True)
        r = self.patch(activo=baja.pk)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["activo"], ["El activo está dado de baja."])

    def test_editar_con_activo_ya_de_baja_es_valido(self):
        self.ticket.activo = self.servidor
        self.ticket.save()
        self.servidor.de_baja = True
        self.servidor.save()
        r = self.client.patch(
            url_ticket(self.ticket), {"titulo": "Otro", "activo": self.servidor.pk}, format="json"
        )
        self.assertEqual(r.status_code, 200)

    def test_tecnico_invalido(self):
        inactivo = Usuario.objects.create_user("baja", rol="tecnico", is_active=False)
        for usuario in (self.cliente, inactivo):
            r = self.patch(tecnico=usuario.pk)
            self.assertEqual(r.status_code, 400)
            self.assertEqual(r.data["tecnico"], ["El usuario debe ser un técnico o administrador activo."])

    def test_no_se_cambia_organizacion(self):
        r = self.patch(organizacion=self.otra.pk)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["organizacion"], ["No se puede cambiar el cliente de un ticket."])

    def test_ticket_cerrado_no_se_edita(self):
        self.ticket.estado = "cerrado"
        self.ticket.save()
        r = self.patch(titulo="Nuevo")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["non_field_errors"], ["El ticket está cerrado. Reábrelo para modificarlo."])

    def test_detalle_trae_eventos_cronologicos(self):
        t = Ticket.objects.get(pk=self.crear().data["id"])
        self.patch(t=t, tecnico=self.otro_tecnico.pk)
        d = self.client.get(url_ticket(t)).data
        self.assertEqual([e["tipo"] for e in d["eventos"]], ["creacion", "tecnico"])
        self.assertEqual(d["eventos"][0]["autor"], {"id": self.tecnico.pk, "nombre": "Laura Gómez"})
        self.assertIsNone(d["eventos"][0]["valor_nuevo"])

    def test_opcionales_vacios_como_null(self):
        d = self.client.get(url_ticket(self.ticket)).data
        for campo in ("solucion", "tecnico", "activo", "reportado_por", "resuelto_en", "cerrado_en"):
            self.assertIsNone(d[campo], campo)
