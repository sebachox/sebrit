from datetime import date
from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario

from apps.organizations.models import Organizacion
from apps.assets.models import Activo
from apps.incidents.models import Incidente
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


class ValidacionOrganizacionTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(Usuario.objects.create_user("admin1", rol="admin"))

    def crear(self, **datos):
        return self.client.post(URL, datos, format="json")

    def test_nit_obligatorio_al_crear(self):
        r = self.crear(nombre="Sin NIT")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nit"], ["El NIT es obligatorio."])

    def test_nit_formato_invalido(self):
        r = self.crear(nombre="Puntos", nit="900.123.456-7")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(
            r.data["nit"], ["Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7."]
        )

    def test_nit_con_espacios_se_recorta(self):
        r = self.crear(nombre="Espacios", nit=" 900123456-7 ")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["nit"], "900123456-7")

    def test_nit_duplicado(self):
        self.crear(nombre="Uno", nit="900123456-7")
        r = self.crear(nombre="Dos", nit="900123456-7")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nit"], ["Ya existe una organización con este NIT."])

    def test_nombre_duplicado_sin_importar_mayusculas(self):
        self.crear(nombre="Empresa Ejemplo", nit="900000001")
        r = self.crear(nombre="empresa ejemplo", nit="900000002")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nombre"], ["Ya existe una organización con este nombre."])

    def test_editar_con_su_propio_nombre_es_valido(self):
        org = Organizacion.objects.create(nombre="Propia", nit="900000001")
        r = self.client.patch(
            url_detalle(org), {"nombre": "Propia", "nit": "900000001"}, format="json"
        )
        self.assertEqual(r.status_code, 200)

    def test_plan_invalido_da_400(self):
        r = self.crear(nombre="Plan", nit="900000001", plan="oro")
        self.assertEqual(r.status_code, 400)
        self.assertIn("plan", r.data)

    def test_fecha_fin_anterior_a_inicio_da_400(self):
        r = self.crear(
            nombre="Fechas", nit="900000001",
            fecha_inicio_contrato="2026-06-01", fecha_fin_contrato="2026-01-01",
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(
            r.data["fecha_fin_contrato"], ["La fecha de fin no puede ser anterior a la de inicio."]
        )

    def test_patch_solo_fecha_fin_valida_contra_la_guardada(self):
        org = Organizacion.objects.create(
            nombre="Contrato", nit="900000001", fecha_inicio_contrato=date(2026, 6, 1)
        )
        r = self.client.patch(url_detalle(org), {"fecha_fin_contrato": "2026-01-01"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fecha_fin_contrato", r.data)

    def test_vaciar_nit_al_editar_da_400(self):
        org = Organizacion.objects.create(nombre="Con NIT", nit="900000001")
        r = self.client.patch(url_detalle(org), {"nit": ""}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nit"], ["El NIT es obligatorio."])


class DetalleOrganizacionTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(Usuario.objects.create_user("admin1", rol="admin"))
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")

    def test_resumen_cuenta_solo_lo_activo(self):
        Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        Activo.objects.create(organizacion=self.org, tipo="red", nombre="R1")
        Ticket.objects.create(organizacion=self.org, titulo="A", estado="abierto")
        Ticket.objects.create(organizacion=self.org, titulo="B", estado="cerrado")
        Incidente.objects.create(
            codigo="INC-1", titulo="X", organizacion=self.org, severidad="alta", estado="en_progreso"
        )
        Incidente.objects.create(
            codigo="INC-2", titulo="Y", organizacion=self.org, severidad="baja", estado="resuelto"
        )
        Usuario.objects.create_user("cli1", rol="cliente", organizacion=self.org)

        r = self.client.get(url_detalle(self.org))
        self.assertEqual(
            r.data["resumen"],
            {"activos": 2, "tickets_abiertos": 1, "incidentes_activos": 1, "usuarios": 1},
        )

    def test_opcionales_vacios_salen_como_null(self):
        d = self.client.get(url_detalle(self.org)).data
        for campo in ["sector", "correo", "contacto_nombre", "plan", "fecha_fin_contrato"]:
            self.assertIsNone(d[campo], campo)

    def test_null_en_opcional_se_guarda_vacio(self):
        r = self.client.patch(url_detalle(self.org), {"ciudad": None}, format="json")
        self.assertEqual(r.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.ciudad, "")

    def test_desactivar_no_borra_y_sale_del_dashboard(self):
        ticket = Ticket.objects.create(organizacion=self.org, titulo="A")
        antes = self.client.get("/api/dashboard/admin/").data["resumen_operativo"]["clientes_activos"]

        r = self.client.patch(url_detalle(self.org), {"activa": False}, format="json")
        self.assertEqual(r.status_code, 200)

        despues = self.client.get("/api/dashboard/admin/").data["resumen_operativo"]["clientes_activos"]
        self.assertEqual(despues, antes - 1)
        self.assertTrue(Ticket.objects.filter(pk=ticket.pk).exists())


class ListaOrganizacionesTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(Usuario.objects.create_user("admin1", rol="admin"))
        Organizacion.objects.create(nombre="Beta", nit="800000001", ciudad="Cali", plan="basico")
        Organizacion.objects.create(
            nombre="alfa", nit="900000002", ciudad="Bogotá", plan="premium",
            contacto_nombre="Ana Ruiz",
        )
        Organizacion.objects.create(nombre="Gamma", nit="700000003", activa=False)

    def nombres(self, query=""):
        return [o["nombre"] for o in self.client.get(f"{URL}{query}").data["results"]]

    def test_orden_por_defecto_por_nombre(self):
        self.assertEqual(self.nombres(), ["alfa", "Beta", "Gamma"])

    def test_orden_descendente(self):
        self.assertEqual(self.nombres("?ordering=-nombre"), ["Gamma", "Beta", "alfa"])

    def test_busqueda_por_nombre_nit_ciudad_y_contacto(self):
        self.assertEqual(self.nombres("?q=bogo"), ["alfa"])
        self.assertEqual(self.nombres("?q=ana"), ["alfa"])
        self.assertEqual(self.nombres("?q=BETA"), ["Beta"])
        self.assertEqual(self.nombres("?q=7000"), ["Gamma"])

    def test_busqueda_solo_espacios_no_filtra(self):
        self.assertEqual(self.client.get(f"{URL}?q=%20%20").data["count"], 3)

    def test_filtro_activa(self):
        self.assertEqual(self.nombres("?activa=false"), ["Gamma"])
        self.assertEqual(self.nombres("?activa=true"), ["alfa", "Beta"])

    def test_filtro_plan(self):
        self.assertEqual(self.nombres("?plan=premium"), ["alfa"])

    def test_page_size_maximo_100(self):
        Organizacion.objects.bulk_create(
            [Organizacion(nombre=f"Org {n:03d}", nit=f"6{n:08d}") for n in range(101)]
        )
        r = self.client.get(f"{URL}?page_size=500")
        self.assertEqual(len(r.data["results"]), 100)
        self.assertEqual(r.data["count"], 104)

    def test_lista_trae_solo_campos_resumidos(self):
        r = self.client.get(URL)
        self.assertEqual(
            set(r.data["results"][0]),
            {"id", "nombre", "nit", "ciudad", "plan", "contacto_nombre", "fecha_fin_contrato", "activa"},
        )
