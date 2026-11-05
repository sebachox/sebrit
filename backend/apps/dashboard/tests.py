from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.assets.models import Activo
from apps.incidents.models import Incidente
from apps.organizations.models import Organizacion

URL = "/api/dashboard/admin/"


class DashboardAdminTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin1", password="x", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec1", password="x", rol="tecnico")

    def test_sin_token_da_401(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_tecnico_da_403(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_admin_da_200_y_respeta_el_contrato(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            set(r.data),
            {"generado_en", "resumen_operativo", "incidentes", "infraestructura"},
        )
        self.assertEqual(
            set(r.data["resumen_operativo"]),
            {"clientes_activos", "tickets_abiertos", "mantenimientos_hoy", "incidentes_criticos"},
        )

    def test_conteos_y_incidente_sin_tecnico(self):
        org = Organizacion.objects.create(nombre="Org")
        Activo.objects.create(organizacion=org, tipo="servidor", nombre="S1", estado="operativo")
        Activo.objects.create(organizacion=org, tipo="servidor", nombre="S2", estado="critico")
        Incidente.objects.create(
            codigo="INC-1", titulo="Prueba", organizacion=org, severidad="critica"
        )

        self.client.force_authenticate(self.admin)
        d = self.client.get(URL).data

        self.assertEqual(
            d["infraestructura"]["servidores"],
            {"total": 2, "operativos": 1, "advertencia": 0, "criticos": 1},
        )
        self.assertEqual(d["resumen_operativo"]["incidentes_criticos"], 1)
        self.assertEqual(
            d["infraestructura"]["incidentes_criticos"],
            {"total": 1, "abiertos": 1, "en_progreso": 0, "sin_tecnico": 1},
        )
        self.assertIsNone(d["incidentes"][0]["tecnico_asignado"])
        self.assertIsNone(d["incidentes"][0]["ultima_accion"])