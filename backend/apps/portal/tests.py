from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.incidents.models import Incidente
from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket

RESUMEN = "/api/portal/resumen/"
ACTIVOS = "/api/portal/activos/"


class BasePortal(APITestCase):
    def setUp(self):
        self.org_a = Organizacion.objects.create(nombre="Empresa A", nit="900000001")
        self.org_b = Organizacion.objects.create(nombre="Empresa B", nit="900000002")
        self.cliente_a = Usuario.objects.create_user(
            "cli_a", rol="cliente", organizacion=self.org_a, first_name="Ana", last_name="Ríos"
        )
        self.cliente_b = Usuario.objects.create_user("cli_b", rol="cliente", organizacion=self.org_b)
        self.tecnico = Usuario.objects.create_user("tec", rol="tecnico", first_name="Laura", last_name="Gómez")
        self.admin = Usuario.objects.create_user("adm", rol="admin")

    def entrar(self, usuario):
        self.client.force_authenticate(usuario)

    def entrar_con_token(self, usuario):
        """Token real: cada petición vuelve a cargar al usuario desde la base."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(usuario)}")


class PermisoPortalTests(BasePortal):
    URLS = (RESUMEN, ACTIVOS)

    def estados(self):
        return [self.client.get(u).status_code for u in self.URLS]

    def test_sin_token_da_401(self):
        self.assertEqual(self.estados(), [401, 401])

    def test_personal_interno_da_403(self):
        for usuario in (self.admin, self.tecnico):
            self.entrar(usuario)
            self.assertEqual(self.estados(), [403, 403])

    def test_cliente_sin_organizacion_da_403(self):
        self.entrar(Usuario.objects.create_user("solo", rol="cliente"))
        self.assertEqual(self.estados(), [403, 403])

    def test_cliente_de_empresa_inactiva_da_403(self):
        self.org_a.activa = False
        self.org_a.save()
        self.entrar(self.cliente_a)
        self.assertEqual(self.estados(), [403, 403])

    def test_cliente_da_200(self):
        self.entrar(self.cliente_a)
        self.assertEqual(self.estados(), [200, 200])

    def test_desactivar_empresa_tiene_efecto_inmediato(self):
        self.entrar_con_token(self.cliente_a)
        self.assertEqual(self.client.get(RESUMEN).status_code, 200)
        Organizacion.objects.filter(pk=self.org_a.pk).update(activa=False)
        self.assertEqual(self.client.get(RESUMEN).status_code, 403)

    def test_mover_de_empresa_tiene_efecto_inmediato(self):
        self.entrar_con_token(self.cliente_a)
        self.assertEqual(self.client.get(RESUMEN).data["empresa"]["nombre"], "Empresa A")
        Usuario.objects.filter(pk=self.cliente_a.pk).update(organizacion=self.org_b)
        self.assertEqual(self.client.get(RESUMEN).data["empresa"]["nombre"], "Empresa B")

    def test_post_da_405(self):
        self.entrar(self.cliente_a)
        self.assertEqual(self.client.post(RESUMEN, {}, format="json").status_code, 405)
        self.assertEqual(self.client.post(ACTIVOS, {}, format="json").status_code, 405)


class ResumenTests(BasePortal):
    def setUp(self):
        super().setUp()
        self.entrar(self.cliente_a)

    def test_claves_del_contrato(self):
        d = self.client.get(RESUMEN).data
        self.assertEqual(set(d), {"generado_en", "empresa", "tickets", "incidentes_activos", "infraestructura"})
        self.assertEqual(d["empresa"], {"id": self.org_a.id, "nombre": "Empresa A"})
        self.assertEqual(set(d["tickets"]), {"abiertos", "en_progreso", "resueltos"})
        self.assertEqual(set(d["infraestructura"]), {"servidores", "redes", "backups"})

    def test_tickets_por_estado_sin_cerrados_ni_otra_empresa(self):
        for estado in ("abierto", "abierto", "en_progreso", "resuelto", "cerrado"):
            Ticket.objects.create(titulo="t", organizacion=self.org_a, estado=estado)
        Ticket.objects.create(titulo="t", organizacion=self.org_b, estado="abierto")
        self.assertEqual(
            self.client.get(RESUMEN).data["tickets"], {"abiertos": 2, "en_progreso": 1, "resueltos": 1}
        )

    def test_incidentes_activos_solo_de_la_empresa(self):
        for estado in ("abierto", "en_progreso", "resuelto", "cerrado"):
            Incidente.objects.create(titulo="i", organizacion=self.org_a, severidad="alta", estado=estado)
        Incidente.objects.create(titulo="i", organizacion=self.org_b, severidad="alta")
        self.assertEqual(self.client.get(RESUMEN).data["incidentes_activos"], 2)

    def test_infraestructura_sin_dados_de_baja_ni_otra_empresa(self):
        s1 = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1", estado="critico")
        Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S2", estado="operativo", de_baja=True)
        Activo.objects.create(organizacion=self.org_a, tipo="red", nombre="R1", estado="advertencia")
        otro = Activo.objects.create(organizacion=self.org_b, tipo="servidor", nombre="S9", estado="critico")
        Backup.objects.create(organizacion=self.org_a, activo=s1, estado="fallido")
        Backup.objects.create(organizacion=self.org_b, activo=otro, estado="exitoso")
        i = self.client.get(RESUMEN).data["infraestructura"]
        self.assertEqual(i["servidores"], {"total": 1, "operativos": 0, "advertencia": 0, "criticos": 1})
        self.assertEqual(i["redes"], {"total": 1, "operativos": 0, "advertencia": 1, "criticos": 0})
        self.assertEqual(i["backups"], {"total": 1, "exitosos": 0, "fallidos": 1, "pendientes": 0})

    def test_empresa_sin_datos_da_ceros(self):
        d = self.client.get(RESUMEN).data
        self.assertEqual(d["tickets"], {"abiertos": 0, "en_progreso": 0, "resueltos": 0})
        self.assertEqual(d["infraestructura"]["servidores"]["total"], 0)
        self.assertEqual(d["infraestructura"]["backups"]["fallidos"], 0)


class ActivosPortalTests(BasePortal):
    def test_solo_id_nombre_y_tipo_de_la_empresa_ordenados(self):
        b = Activo.objects.create(organizacion=self.org_a, tipo="red", nombre="beta", ip="10.0.0.1", notas="secreto")
        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="Alfa")
        Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="Baja", de_baja=True)
        Activo.objects.create(organizacion=self.org_b, tipo="servidor", nombre="Ajeno")
        self.entrar(self.cliente_a)
        self.assertEqual(
            self.client.get(ACTIVOS).data,
            [
                {"id": a.id, "nombre": "Alfa", "tipo": "servidor"},
                {"id": b.id, "nombre": "beta", "tipo": "red"},
            ],
        )

    def test_sin_activos_da_lista_vacia(self):
        self.entrar(self.cliente_a)
        self.assertEqual(self.client.get(ACTIVOS).data, [])
