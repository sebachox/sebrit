from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.incidents.models import AccionIncidente, Incidente
from apps.incidents.severidad import calcular_severidad
from apps.organizations.models import Organizacion
from apps.tickets.models import EventoTicket, Ticket
from apps.tickets.prioridad import calcular_prioridad

CLAVE = "Clave-Demo-2026!"
CLAVE_ADMIN = "Admin-Demo-2026!"


def cargar(**opciones):
    salida = StringIO()
    call_command("seed_completo", stdout=salida, **opciones)
    return salida.getvalue()


def huella():
    """Lo que debe salir idéntico en cualquier equipo (sin fechas, que dependen del día)."""
    return {
        "empresas": list(Organizacion.objects.order_by("id").values_list("id", "nombre", "nit", "activa")),
        "activos": list(Activo.objects.order_by("id").values_list("id", "organizacion_id", "nombre", "estado", "de_baja")),
        "backups": list(Backup.objects.order_by("id").values_list("id", "activo_id", "estado", "tipo")),
        "tickets": list(Ticket.objects.order_by("id").values_list("codigo", "organizacion_id", "titulo", "estado", "prioridad")),
        "eventos": list(EventoTicket.objects.order_by("id").values_list("ticket__codigo", "tipo", "texto")),
        "incidentes": list(Incidente.objects.order_by("id").values_list("codigo", "titulo", "estado", "severidad")),
        "acciones": list(AccionIncidente.objects.order_by("id").values_list("incidente__codigo", "tipo", "descripcion")),
        "usuarios": sorted(Usuario.objects.filter(rol__in=["tecnico", "cliente"]).values_list("username", "rol")),
    }


class SeedCompletoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cargar(reiniciar=True, clave=CLAVE, clave_admin=CLAVE_ADMIN)

    def test_volumen_parecido_a_una_base_real(self):
        self.assertEqual(Organizacion.objects.count(), 8)
        self.assertEqual(Organizacion.objects.filter(activa=False).count(), 1)
        self.assertGreaterEqual(Activo.objects.count(), 120)
        self.assertTrue(Activo.objects.filter(de_baja=True).exists())
        self.assertGreaterEqual(Backup.objects.count(), 800)
        self.assertGreaterEqual(Ticket.objects.count(), 180)
        self.assertGreaterEqual(Incidente.objects.count(), 20)
        self.assertEqual(Usuario.objects.filter(rol="tecnico").count(), 5)
        self.assertEqual(Usuario.objects.filter(rol="cliente").count(), 16)
        for estado in Ticket.Estado.values:
            self.assertTrue(Ticket.objects.filter(estado=estado).exists(), estado)
        for estado in Incidente.Estado.values:
            self.assertTrue(Incidente.objects.filter(estado=estado).exists(), estado)

    def test_codigos_consecutivos_en_orden_de_creacion(self):
        tickets = list(Ticket.objects.order_by("id").values_list("codigo", "creado_en"))
        self.assertEqual(tickets[0][0], "TCK-0001")
        self.assertEqual([c for c, _ in tickets], [f"TCK-{n:04d}" for n in range(1, len(tickets) + 1)])
        self.assertEqual([f for _, f in tickets], sorted(f for _, f in tickets))
        self.assertEqual(Incidente.objects.order_by("id").first().codigo, "INC-0001")

    def test_prioridad_y_severidad_siguen_las_reglas(self):
        for t in Ticket.objects.filter(prioridad_manual=False).select_related("activo"):
            self.assertEqual(t.prioridad, calcular_prioridad(t.alcance, t.categoria, t.activo), t.codigo)
        for i in Incidente.objects.filter(severidad_manual=False).prefetch_related("activos"):
            self.assertEqual(i.severidad, calcular_severidad(i.impacto, list(i.activos.all())), i.codigo)

    def test_estados_coherentes_con_el_flujo(self):
        ahora = timezone.now()
        for t in Ticket.objects.all():
            self.assertLessEqual(t.creado_en, ahora)
            if t.estado == "en_progreso":
                self.assertIsNotNone(t.tecnico, t.codigo)
            if t.estado in ("resuelto", "cerrado"):
                self.assertTrue(t.solucion, t.codigo)
                self.assertIsNotNone(t.resuelto_en, t.codigo)
                self.assertGreaterEqual(t.resuelto_en, t.creado_en)
            if t.estado == "cerrado":
                self.assertIsNotNone(t.cerrado_en, t.codigo)
            self.assertEqual(t.eventos.filter(tipo="creacion").count(), 1, t.codigo)
            if t.activo_id:
                self.assertEqual(t.activo.organizacion_id, t.organizacion_id, t.codigo)
        for i in Incidente.objects.all():
            self.assertLessEqual(i.fecha_origen, i.creado_en)
            if i.estado in ("en_progreso", "resuelto", "cerrado"):
                self.assertIsNotNone(i.tecnico, i.codigo)
            if i.estado in ("resuelto", "cerrado"):
                self.assertTrue(i.solucion, i.codigo)
                self.assertIsNotNone(i.fecha_fin, i.codigo)
            if i.estado == "cerrado":
                self.assertTrue(i.causa_raiz, i.codigo)
            self.assertTrue(i.acciones.filter(tipo="accion").exists(), i.codigo)
            self.assertFalse(i.activos.exclude(organizacion_id=i.organizacion_id).exists(), i.codigo)
            self.assertFalse(i.tickets.exclude(organizacion_id=i.organizacion_id).exists(), i.codigo)

    def test_backups_coherentes(self):
        for b in Backup.objects.select_related("activo"):
            self.assertEqual(b.organizacion_id, b.activo.organizacion_id)
            self.assertEqual(b.activo.tipo, "servidor")
            self.assertLessEqual(b.fecha, timezone.now())
            if b.activo.fecha_baja:
                self.assertLess(b.fecha, b.activo.fecha_baja)

    def test_usuarios_con_la_clave_dada_y_su_empresa(self):
        for u in Usuario.objects.filter(rol="cliente"):
            self.assertIsNotNone(u.organizacion_id, u.username)
            self.assertTrue(u.check_password(CLAVE), u.username)
        for u in Usuario.objects.filter(rol="tecnico"):
            self.assertTrue(u.check_password(CLAVE), u.username)

    def test_crea_el_superusuario_admin(self):
        admin = Usuario.objects.get(username="admin")
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)
        self.assertEqual(admin.rol, "admin")
        self.assertTrue(admin.check_password(CLAVE_ADMIN))
        self.assertTrue(self.client.login(username="admin", password=CLAVE_ADMIN))
        self.assertEqual(self.client.get("/admin/").status_code, 200)

    def test_datos_ficticios_sin_dominios_reales(self):
        correos = list(Organizacion.objects.values_list("correo", flat=True))
        correos += list(Usuario.objects.exclude(email="").values_list("email", flat=True))
        self.assertTrue(correos)
        for correo in correos:
            self.assertTrue(correo.endswith(".example"), correo)


class SeedCompletoReinicioTests(TestCase):
    def test_es_identico_en_cada_corrida(self):
        cargar(reiniciar=True, clave=CLAVE)
        primera = huella()
        cargar(reiniciar=True, clave=CLAVE)
        self.assertEqual(huella(), primera)

    def test_conserva_administradores_y_borra_lo_demas(self):
        Usuario.objects.create_superuser("sebri", password="x-clave-larga-1")
        Usuario.objects.create_user("jefa", password="x-clave-larga-2", rol="admin")
        Usuario.objects.create_user("viejo", rol="tecnico")
        Organizacion.objects.create(nombre="Empresa vieja", nit="900999999")
        cargar(reiniciar=True, clave=CLAVE)
        self.assertTrue(Usuario.objects.filter(username="sebri", is_superuser=True).exists())
        self.assertTrue(Usuario.objects.filter(username="jefa", rol="admin").exists())
        self.assertFalse(Usuario.objects.filter(username="viejo").exists())
        self.assertFalse(Organizacion.objects.filter(nombre="Empresa vieja").exists())

    def test_sin_reiniciar_no_toca_una_base_con_datos(self):
        Organizacion.objects.create(nombre="Empresa vieja", nit="900999999")
        salida = cargar(clave=CLAVE)
        self.assertIn("--reiniciar", salida)
        self.assertEqual(Organizacion.objects.count(), 1)

    def test_sin_clave_los_usuarios_no_pueden_entrar(self):
        cargar(reiniciar=True)
        self.assertFalse(Usuario.objects.filter(rol__in=["tecnico", "cliente"]).first().has_usable_password())
        self.assertFalse(Usuario.objects.filter(username="admin").exists())

    def test_clave_debil_se_rechaza_sin_borrar_nada(self):
        Organizacion.objects.create(nombre="Empresa vieja", nit="900999999")
        with self.assertRaises(CommandError):
            cargar(reiniciar=True, clave="123")
        with self.assertRaises(CommandError):
            cargar(reiniciar=True, clave=CLAVE, clave_admin="admin")
        self.assertTrue(Organizacion.objects.filter(nombre="Empresa vieja").exists())

    def test_admin_existente_actualiza_su_clave(self):
        Usuario.objects.create_superuser("admin", password="otra-clave-larga-3")
        cargar(reiniciar=True, clave=CLAVE, clave_admin=CLAVE_ADMIN)
        self.assertTrue(Usuario.objects.get(username="admin").check_password(CLAVE_ADMIN))
