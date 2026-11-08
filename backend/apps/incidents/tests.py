from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.incidents.models import AccionIncidente, Incidente
from apps.incidents.severidad import calcular_severidad
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket


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


URL = "/api/incidentes/"


def url_incidente(i, sufijo=""):
    return f"{URL}{i.pk}/{sufijo}"


class BaseIncidentes(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin1", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec1", rol="tecnico", first_name="Laura", last_name="Gómez")
        self.otro_tecnico = Usuario.objects.create_user("tec2", rol="tecnico", first_name="Carlos", last_name="Pérez")
        self.cliente = Usuario.objects.create_user("cli1", rol="cliente")
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.otra = Organizacion.objects.create(nombre="Otra", nit="900000002")
        self.servidor = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        self.red = Activo.objects.create(organizacion=self.org, tipo="red", nombre="R1")
        self.ajeno = Activo.objects.create(organizacion=self.otra, tipo="red", nombre="R9")
        self.hace_una_hora = timezone.now() - timedelta(hours=1)

    def entrar(self, usuario=None):
        self.client.force_authenticate(usuario or self.tecnico)

    def incidente(self, **extra):
        datos = {
            "organizacion": self.org,
            "titulo": "Caída",
            "descripcion": "Se cayó",
            "impacto": "parcial",
            "severidad": "media",
            "fecha_origen": self.hace_una_hora,
        }
        datos.update(extra)
        return Incidente.objects.create(**datos)

    def datos(self, **extra):
        base = {
            "organizacion": self.org.pk,
            "titulo": "Caída del ERP",
            "descripcion": "No responde",
            "impacto": "total",
            "fecha_origen": self.hace_una_hora.isoformat(),
        }
        base.update(extra)
        return base

    def post(self, url, datos=None):
        return self.client.post(url, datos if datos is not None else {}, format="json")

    def patch(self, i, datos):
        return self.client.patch(url_incidente(i), datos, format="json")

    def assertError(self, r, campo, mensaje):
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual([str(m) for m in r.data[campo]], [mensaje])


class PermisosIncidentesTests(BaseIncidentes):
    def test_sin_token_da_401(self):
        i = self.incidente()
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.assertEqual(self.post(URL, self.datos()).status_code, 401)
        self.assertEqual(self.client.get(url_incidente(i)).status_code, 401)
        self.assertEqual(self.patch(i, {"titulo": "x"}).status_code, 401)

    def test_cliente_da_403(self):
        i = self.incidente()
        self.entrar(self.cliente)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.post(URL, self.datos()).status_code, 403)
        self.assertEqual(self.client.get(url_incidente(i)).status_code, 403)
        self.assertEqual(self.patch(i, {"titulo": "x"}).status_code, 403)

    def test_tecnico_y_admin_pueden_todo(self):
        for usuario in (self.tecnico, self.admin):
            self.entrar(usuario)
            r = self.post(URL, self.datos())
            self.assertEqual(r.status_code, 201, r.data)
            i = Incidente.objects.get(pk=r.data["id"])
            self.assertEqual(self.client.get(URL).status_code, 200)
            self.assertEqual(self.client.get(url_incidente(i)).status_code, 200)
            self.assertEqual(self.patch(i, {"titulo": "x"}).status_code, 200)

    def test_put_y_delete_no_permitidos(self):
        i = self.incidente()
        self.entrar()
        self.assertEqual(self.client.put(url_incidente(i), self.datos(), format="json").status_code, 405)
        self.assertEqual(self.client.delete(url_incidente(i)).status_code, 405)
        self.assertTrue(Incidente.objects.filter(pk=i.pk).exists())

    def test_inexistente_da_404(self):
        self.entrar()
        self.assertEqual(self.client.get(f"{URL}999999/").status_code, 404)


class CrearEditarIncidenteTests(BaseIncidentes):
    def setUp(self):
        super().setUp()
        self.entrar()

    def test_crear_calcula_severidad_y_deja_accion(self):
        r = self.post(URL, self.datos(activos=[self.servidor.pk]))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["severidad"], "critica")
        self.assertFalse(r.data["severidad_manual"])
        self.assertEqual(r.data["reportado_por"]["id"], self.tecnico.pk)
        self.assertEqual(r.data["codigo"], f"INC-{r.data['id']:04d}")
        self.assertIsNotNone(r.data["fecha_deteccion"])
        self.assertEqual([a["tipo"] for a in r.data["acciones"]], ["creacion"])

    def test_campos_obligatorios_al_crear(self):
        casos = {
            "organizacion": "Elige el cliente.",
            "titulo": "Escribe un título corto.",
            "descripcion": "Describe qué está pasando.",
            "impacto": "Indica el impacto.",
            "fecha_origen": "Indica cuándo empezó el incidente.",
        }
        for campo, mensaje in casos.items():
            datos = self.datos()
            del datos[campo]
            self.assertError(self.post(URL, datos), campo, mensaje)

    def test_titulo_y_descripcion_solo_espacios(self):
        self.assertError(self.post(URL, self.datos(titulo="   ")), "titulo", "Escribe un título corto.")
        self.assertError(
            self.post(URL, self.datos(descripcion="  \n ")), "descripcion", "Describe qué está pasando."
        )

    def test_impacto_y_fecha_invalidos(self):
        self.assertError(self.post(URL, self.datos(impacto="x")), "impacto", "Indica el impacto.")
        self.assertError(
            self.post(URL, self.datos(fecha_origen="ayer")),
            "fecha_origen",
            "Indica cuándo empezó el incidente.",
        )

    def test_no_se_envian_severidad_ni_estado(self):
        fin = timezone.now().isoformat()
        r = self.post(URL, self.datos(severidad="baja", estado="cerrado", fecha_fin=fin))
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["severidad"], "alta")
        self.assertEqual(r.data["estado"], "abierto")
        self.assertIsNone(r.data["fecha_fin"])

    def test_fecha_origen_futura(self):
        futura = (timezone.now() + timedelta(hours=1)).isoformat()
        self.assertError(
            self.post(URL, self.datos(fecha_origen=futura)),
            "fecha_origen",
            "La fecha de origen no puede ser futura.",
        )

    def test_fecha_origen_posterior_a_deteccion(self):
        i = self.incidente(creado_en=timezone.now() - timedelta(hours=2))
        self.assertError(
            self.patch(i, {"fecha_origen": self.hace_una_hora.isoformat()}),
            "fecha_origen",
            "La fecha de origen no puede ser posterior a la detección.",
        )

    def test_editar_impacto_recalcula_y_deja_accion(self):
        i = self.incidente()
        r = self.patch(i, {"impacto": "total"})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["severidad"], "alta")
        accion = i.acciones.get(tipo="severidad")
        self.assertEqual((accion.valor_anterior, accion.valor_nuevo), ("media", "alta"))
        self.assertEqual(accion.autor, self.tecnico)

    def test_severidad_manual_no_se_recalcula(self):
        i = self.incidente(severidad="baja", severidad_manual=True)
        r = self.patch(i, {"impacto": "total"})
        self.assertEqual(r.data["severidad"], "baja")
        self.assertFalse(i.acciones.filter(tipo="severidad").exists())

    def test_cambiar_activos_recalcula(self):
        i = self.incidente()
        r = self.patch(i, {"activos": [self.servidor.pk]})
        self.assertEqual(r.data["severidad"], "alta")
        self.assertEqual([a["id"] for a in r.data["activos"]], [self.servidor.pk])

    def test_mismos_activos_no_recalcula(self):
        # La severidad guardada no coincide con la regla: un recálculo la cambiaría.
        i = self.incidente(severidad="baja")
        i.activos.set([self.servidor, self.red])
        for lista in ([self.red.pk, self.servidor.pk], [self.servidor.pk, self.red.pk, self.red.pk]):
            r = self.patch(i, {"activos": lista})
            self.assertEqual(r.status_code, 200, r.data)
            self.assertEqual(r.data["severidad"], "baja")
            self.assertEqual(r.data["total_activos"], 2)
        self.assertFalse(i.acciones.exists())

    def test_quitar_todos_los_activos_recalcula(self):
        i = self.incidente(severidad="alta")
        i.activos.set([self.servidor])
        r = self.patch(i, {"activos": []})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["activos"], [])
        self.assertEqual(r.data["severidad"], "media")

    def test_activo_de_otro_cliente(self):
        self.assertError(
            self.post(URL, self.datos(activos=[self.ajeno.pk])),
            "activos",
            "Todos los activos deben ser de este cliente.",
        )

    def test_activo_de_baja_al_agregar(self):
        self.red.de_baja = True
        self.red.save()
        self.assertError(
            self.post(URL, self.datos(activos=[self.red.pk])), "activos", "Hay activos dados de baja."
        )

    def test_activo_inexistente(self):
        self.assertError(
            self.post(URL, self.datos(activos=[999999])),
            "activos",
            "Todos los activos deben ser de este cliente.",
        )

    def test_editar_con_activo_ya_de_baja_es_valido(self):
        i = self.incidente()
        i.activos.set([self.red])
        self.red.de_baja = True
        self.red.save()
        r = self.patch(i, {"activos": [self.red.pk], "titulo": "Nuevo"})
        self.assertEqual(r.status_code, 200, r.data)

    def test_cambiar_tecnico_deja_accion(self):
        i = self.incidente(tecnico=self.tecnico)
        self.patch(i, {"tecnico": self.otro_tecnico.pk})
        accion = i.acciones.get(tipo="tecnico")
        self.assertEqual((accion.valor_anterior, accion.valor_nuevo), ("Laura Gómez", "Carlos Pérez"))

    def test_patch_sin_cambios_no_crea_acciones(self):
        i = self.incidente(tecnico=self.tecnico)
        self.patch(i, {"titulo": i.titulo, "tecnico": self.tecnico.pk, "impacto": i.impacto})
        self.assertFalse(i.acciones.exists())

    def test_desasignar_en_progreso_da_400(self):
        i = self.incidente(tecnico=self.tecnico, estado="en_progreso")
        self.assertError(
            self.patch(i, {"tecnico": None}),
            "tecnico",
            "Un incidente en progreso debe tener un técnico asignado.",
        )

    def test_tecnico_invalido(self):
        inactivo = Usuario.objects.create_user("ina", rol="tecnico", is_active=False)
        mensaje = "El usuario debe ser un técnico o administrador activo."
        for usuario in (self.cliente.pk, inactivo.pk, 999999):
            self.assertError(self.post(URL, self.datos(tecnico=usuario)), "tecnico", mensaje)

    def test_tecnico_actual_inactivo_no_bloquea_editar(self):
        inactivo = Usuario.objects.create_user("ina", rol="tecnico", is_active=False)
        i = self.incidente(tecnico=inactivo)
        self.assertEqual(self.patch(i, {"tecnico": inactivo.pk, "titulo": "x"}).status_code, 200)

    def test_no_se_cambia_organizacion(self):
        i = self.incidente()
        self.assertError(
            self.patch(i, {"organizacion": self.otra.pk}),
            "organizacion",
            "No se puede cambiar el cliente de un incidente.",
        )

    def test_incidente_cerrado_no_se_edita(self):
        i = self.incidente(estado="cerrado")
        self.assertError(
            self.patch(i, {"titulo": "x"}),
            "non_field_errors",
            "El incidente está cerrado. Reábrelo para modificarlo.",
        )

    def test_detalle_trae_activos_tickets_y_acciones(self):
        i = self.incidente(tecnico=self.tecnico)
        i.activos.set([self.servidor])
        ticket = Ticket.objects.create(organizacion=self.org, titulo="T", incidente=i)
        ahora = timezone.now()
        AccionIncidente.objects.create(incidente=i, descripcion="Segunda", fecha=ahora, autor=self.admin)
        AccionIncidente.objects.create(incidente=i, descripcion="Primera", fecha=ahora - timedelta(minutes=5))
        d = self.client.get(url_incidente(i)).data
        self.assertEqual(
            d["activos"],
            [{"id": self.servidor.pk, "nombre": "S1", "tipo": "servidor", "estado": "operativo"}],
        )
        ticket.refresh_from_db()
        self.assertEqual(
            d["tickets"],
            [{"id": ticket.pk, "codigo": ticket.codigo, "titulo": "T", "estado": "abierto"}],
        )
        self.assertEqual([a["descripcion"] for a in d["acciones"]], ["Primera", "Segunda"])
        self.assertEqual(d["acciones"][1]["autor"]["id"], self.admin.pk)
        self.assertIsNone(d["acciones"][0]["autor"])
        self.assertEqual(
            set(d["acciones"][0]),
            {"id", "tipo", "autor", "descripcion", "valor_anterior", "valor_nuevo", "fecha"},
        )
        self.assertEqual(d["organizacion"], {"id": self.org.pk, "nombre": "Org"})
        self.assertEqual(d["tecnico"], {"id": self.tecnico.pk, "nombre": "Laura Gómez"})
        self.assertEqual((d["total_activos"], d["total_tickets"]), (1, 1))

    def test_textos_vacios_como_null(self):
        d = self.client.get(url_incidente(self.incidente())).data
        self.assertIsNone(d["solucion"])
        self.assertIsNone(d["causa_raiz"])
        self.assertIsNone(d["duracion_minutos"])


MSG_CERRADO = "El incidente está cerrado. Reábrelo para modificarlo."


class FlujoIncidenteTests(BaseIncidentes):
    def setUp(self):
        super().setUp()
        self.entrar()

    def estado(self, i, **datos):
        return self.post(url_incidente(i, "estado/"), datos)

    def test_permisos(self):
        i = self.incidente(tecnico=self.tecnico)
        for sufijo, datos, esperado in (
            ("estado/", {"estado": "en_progreso"}, 200),
            ("severidad/", {"severidad": "alta", "motivo": "m"}, 200),
            ("acciones/", {"descripcion": "d"}, 201),
        ):
            self.client.force_authenticate(None)
            self.assertEqual(self.post(url_incidente(i, sufijo), datos).status_code, 401)
            self.entrar(self.cliente)
            self.assertEqual(self.post(url_incidente(i, sufijo), datos).status_code, 403)
            self.entrar(self.admin)
            self.assertEqual(self.post(url_incidente(i, sufijo), datos).status_code, esperado)

    def test_transiciones_validas(self):
        casos = [
            ("abierto", "en_progreso", {}),
            ("en_progreso", "abierto", {}),
            ("en_progreso", "resuelto", {"solucion": "s"}),
            ("resuelto", "cerrado", {"causa_raiz": "c"}),
            ("resuelto", "abierto", {}),
            ("cerrado", "abierto", {}),
        ]
        for actual, nuevo, extra in casos:
            i = self.incidente(estado=actual, tecnico=self.tecnico)
            r = self.estado(i, estado=nuevo, **extra)
            self.assertEqual(r.status_code, 200, (actual, nuevo, r.data))
            self.assertEqual(r.data["estado"], nuevo)

    def test_transiciones_invalidas(self):
        casos = [
            ("abierto", "resuelto", "Abierto", "Resuelto"),
            ("abierto", "cerrado", "Abierto", "Cerrado"),
            ("en_progreso", "cerrado", "En progreso", "Cerrado"),
            ("cerrado", "resuelto", "Cerrado", "Resuelto"),
        ]
        for actual, nuevo, de, a in casos:
            i = self.incidente(estado=actual, tecnico=self.tecnico)
            r = self.estado(i, estado=nuevo, solucion="s", causa_raiz="c")
            self.assertError(r, "estado", f"No se puede pasar de «{de}» a «{a}».")

    def test_estado_invalido(self):
        i = self.incidente()
        for valor in ("x", None, ["abierto"]):
            self.assertError(self.estado(i, estado=valor), "estado", "Elige un estado válido.")

    def test_en_progreso_exige_tecnico(self):
        i = self.incidente()
        self.assertError(
            self.estado(i, estado="en_progreso"), "tecnico", "Asigna un técnico antes de pasar a En progreso."
        )

    def test_resolver_exige_solucion(self):
        i = self.incidente(estado="en_progreso", tecnico=self.tecnico)
        for datos in ({}, {"solucion": "   "}, {"solucion": ["x"]}):
            self.assertError(
                self.estado(i, estado="resuelto", **datos),
                "solucion",
                "Describe cómo se restableció el servicio.",
            )

    def test_cerrar_exige_causa_raiz(self):
        i = self.incidente(estado="resuelto", tecnico=self.tecnico)
        for datos in ({}, {"causa_raiz": "  "}):
            self.assertError(
                self.estado(i, estado="cerrado", **datos),
                "causa_raiz",
                "Indica la causa raíz para cerrar el incidente.",
            )

    def test_resolver_guarda_fecha_fin_y_duracion(self):
        i = self.incidente(estado="en_progreso", tecnico=self.tecnico)
        r = self.estado(i, estado="resuelto", solucion="  Se reinició  ")
        self.assertEqual(r.data["solucion"], "Se reinició")
        self.assertIsNotNone(r.data["fecha_fin"])
        self.assertEqual(r.data["duracion_minutos"], 60)

    def test_cerrar_guarda_cerrado_en(self):
        i = self.incidente(estado="resuelto", tecnico=self.tecnico)
        r = self.estado(i, estado="cerrado", causa_raiz="Disco lleno")
        self.assertEqual(r.data["causa_raiz"], "Disco lleno")
        self.assertIsNotNone(r.data["cerrado_en"])

    def test_reabrir_vacia_campos(self):
        i = self.incidente(estado="en_progreso", tecnico=self.tecnico)
        self.estado(i, estado="resuelto", solucion="Se reinició")
        self.estado(i, estado="cerrado", causa_raiz="Disco lleno")
        r = self.estado(i, estado="abierto")
        for campo in ("solucion", "causa_raiz", "fecha_fin", "cerrado_en", "duracion_minutos"):
            self.assertIsNone(r.data[campo], campo)
        textos = [a["descripcion"] for a in r.data["acciones"]]
        self.assertIn("Se reinició", textos)
        self.assertIn("Disco lleno", textos)

    def test_cada_cambio_deja_accion(self):
        i = self.incidente(tecnico=self.tecnico)
        self.estado(i, estado="en_progreso")
        a = i.acciones.get(tipo="estado")
        self.assertEqual((a.valor_anterior, a.valor_nuevo, a.autor), ("abierto", "en_progreso", self.tecnico))

    def test_cuerpo_no_objeto_da_400(self):
        i = self.incidente()
        for sufijo in ("estado/", "severidad/", "acciones/"):
            self.assertError(
                self.post(url_incidente(i, sufijo), [1, 2]),
                "non_field_errors",
                "El cuerpo de la petición no es válido.",
            )


class CorreccionSeveridadTests(BaseIncidentes):
    def setUp(self):
        super().setUp()
        self.entrar()

    def corregir(self, i, **datos):
        return self.post(url_incidente(i, "severidad/"), datos)

    def test_corregir_severidad(self):
        i = self.incidente()
        r = self.corregir(i, severidad="critica", motivo="  Afecta facturación  ")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["severidad"], "critica")
        self.assertTrue(r.data["severidad_manual"])
        a = i.acciones.get(tipo="severidad")
        self.assertEqual((a.descripcion, a.valor_anterior, a.valor_nuevo), ("Afecta facturación", "media", "critica"))

    def test_motivo_obligatorio(self):
        i = self.incidente()
        for datos in ({}, {"motivo": "   "}):
            self.assertError(
                self.corregir(i, severidad="alta", **datos), "motivo", "Explica por qué cambias la severidad."
            )

    def test_severidad_invalida(self):
        i = self.incidente()
        self.assertError(self.corregir(i, severidad="x", motivo="m"), "severidad", "Elige una severidad válida.")

    def test_cerrado_no_admite_correccion(self):
        i = self.incidente(estado="cerrado")
        self.assertError(self.corregir(i, severidad="alta", motivo="m"), "non_field_errors", MSG_CERRADO)


class BitacoraTests(BaseIncidentes):
    def setUp(self):
        super().setUp()
        self.entrar()

    def test_agregar_accion(self):
        i = self.incidente()
        r = self.post(url_incidente(i, "acciones/"), {"descripcion": "  Se revisó el disco  "})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["tipo"], "accion")
        self.assertEqual(r.data["descripcion"], "Se revisó el disco")
        self.assertEqual(r.data["autor"]["id"], self.tecnico.pk)

    def test_descripcion_obligatoria(self):
        i = self.incidente()
        for datos in ({}, {"descripcion": "   "}):
            self.assertError(
                self.post(url_incidente(i, "acciones/"), datos), "descripcion", "Describe la acción realizada."
            )

    def test_cerrado_no_admite_acciones(self):
        i = self.incidente(estado="cerrado")
        self.assertError(
            self.post(url_incidente(i, "acciones/"), {"descripcion": "x"}), "non_field_errors", MSG_CERRADO
        )


class CascadaTicketsTests(BaseIncidentes):
    def setUp(self):
        super().setUp()
        self.entrar()
        self.i = self.incidente(estado="en_progreso", tecnico=self.tecnico)

    def ticket(self, **extra):
        return Ticket.objects.create(organizacion=self.org, titulo="T", incidente=self.i, **extra)

    def resolver(self):
        return self.post(url_incidente(self.i, "estado/"), {"estado": "resuelto", "solucion": "Se reinició"})

    def test_resolver_resuelve_tickets_activos(self):
        t = self.ticket(estado="en_progreso", tecnico=self.tecnico)
        self.assertEqual(self.resolver().status_code, 200)
        t.refresh_from_db()
        self.i.refresh_from_db()
        self.assertEqual(t.estado, "resuelto")
        self.assertEqual(t.solucion, "Se reinició")
        self.assertIsNotNone(t.resuelto_en)
        e = t.eventos.get(tipo="estado")
        self.assertEqual(e.texto, f"Resuelto por el incidente {self.i.codigo}.")
        self.assertEqual((e.valor_anterior, e.valor_nuevo, e.autor), ("en_progreso", "resuelto", self.tecnico))

    def test_resolver_ticket_sin_tecnico(self):
        t = self.ticket()
        self.assertEqual(self.resolver().status_code, 200)
        t.refresh_from_db()
        self.assertEqual(t.estado, "resuelto")

    def test_resolver_no_toca_tickets_cerrados_ni_resueltos(self):
        cerrado = self.ticket(estado="cerrado", solucion="Antes")
        resuelto = self.ticket(estado="resuelto", solucion="Antes")
        self.resolver()
        for t in (cerrado, resuelto):
            estado = t.estado
            t.refresh_from_db()
            self.assertEqual((t.estado, t.solucion), (estado, "Antes"))
            self.assertFalse(t.eventos.exists())

    def test_reabrir_no_reabre_tickets(self):
        t = self.ticket()
        self.resolver()
        self.post(url_incidente(self.i, "estado/"), {"estado": "abierto"})
        t.refresh_from_db()
        self.assertEqual(t.estado, "resuelto")

    def test_cascada_atomica(self):
        t = self.ticket()
        with mock.patch("apps.incidents.servicios.registrar_evento", side_effect=RuntimeError):
            with self.assertRaises(RuntimeError):
                self.resolver()
        self.i.refresh_from_db()
        t.refresh_from_db()
        self.assertEqual(self.i.estado, "en_progreso")
        self.assertEqual(t.estado, "abierto")
        self.assertFalse(self.i.acciones.exists())
