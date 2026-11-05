from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario

from apps.organizations.models import Organizacion
from apps.tickets.models import Ticket


class ModeloOrganizacionTests(TestCase):
    def test_borrar_con_datos_relacionados_esta_protegido(self):
        org = Organizacion.objects.create(nombre="Org")
        ticket = Ticket.objects.create(organizacion=org, titulo="Soporte")

        with self.assertRaises(ProtectedError):
            org.delete()
        self.assertTrue(Ticket.objects.filter(pk=ticket.pk).exists())

    def test_varias_organizaciones_sin_nit(self):
        Organizacion.objects.create(nombre="Uno", nit=None)
        Organizacion.objects.create(nombre="Dos", nit=None)
        self.assertEqual(Organizacion.objects.filter(nit__isnull=True).count(), 2)

    def test_plan_acepta_solo_la_enumeracion(self):
        with self.assertRaises(ValidationError):
            Organizacion(nombre="X", nit="900000001", plan="oro").full_clean()


class SeedDemoTests(TestCase):
    def test_seed_demo_asigna_nit_y_plan(self):
        call_command("seed_demo", stdout=StringIO())
        self.assertEqual(Organizacion.objects.count(), 3)
        self.assertFalse(Organizacion.objects.filter(nit__isnull=True).exists())
        self.assertEqual(
            Organizacion.objects.get(nit="900123456-7").plan, Organizacion.Plan.PREMIUM
        )


URL = "/api/organizaciones/"


def url_detalle(org):
    return f"{URL}{org.pk}/"


class PermisosOrganizacionesTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin1", password="x", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec1", password="x", rol="tecnico")
        self.cliente = Usuario.objects.create_user("cli1", password="x", rol="cliente")
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")

    def test_sin_token_da_401(self):
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.assertEqual(self.client.post(URL, {"nombre": "A", "nit": "900000002"}).status_code, 401)

    def test_cliente_da_403(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.client.get(url_detalle(self.org)).status_code, 403)
        self.assertEqual(self.client.post(URL, {"nombre": "A", "nit": "900000002"}).status_code, 403)
        self.assertEqual(self.client.patch(url_detalle(self.org), {"activa": False}).status_code, 403)

    def test_tecnico_puede_leer(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.client.get(URL).status_code, 200)
        self.assertEqual(self.client.get(url_detalle(self.org)).status_code, 200)

    def test_tecnico_no_puede_escribir(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.client.post(URL, {"nombre": "A", "nit": "900000002"}).status_code, 403)
        self.assertEqual(self.client.patch(url_detalle(self.org), {"activa": False}).status_code, 403)
        self.assertEqual(self.client.put(url_detalle(self.org), {"nombre": "B"}).status_code, 403)
        self.assertEqual(self.client.delete(url_detalle(self.org)).status_code, 403)

    def test_admin_crea_201_y_edita_200(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(URL, {"nombre": "Nueva", "nit": "900111222"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn("resumen", r.data)

        r = self.client.patch(f"{URL}{r.data['id']}/", {"activa": False}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIs(r.data["activa"], False)

    def test_admin_put_y_delete_dan_405(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.put(url_detalle(self.org), {"nombre": "B"}).status_code, 405)
        self.assertEqual(self.client.delete(url_detalle(self.org)).status_code, 405)
        self.assertTrue(Organizacion.objects.filter(pk=self.org.pk).exists())

    def test_detalle_inexistente_da_404(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f"{URL}99999/").status_code, 404)
