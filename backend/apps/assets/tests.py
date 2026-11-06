from io import StringIO

from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.organizations.models import Organizacion


class ModeloActivoTests(APITestCase):
    def setUp(self):
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.client.force_authenticate(Usuario.objects.create_user("admin1", rol="admin"))

    def test_fecha_baja_se_llena_y_se_vacia(self):
        a = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        a.de_baja = True
        a.save()
        self.assertIsNotNone(a.fecha_baja)
        a.de_baja = False
        a.save()
        self.assertIsNone(a.fecha_baja)

    def test_borrar_activo_con_backups_esta_protegido(self):
        a = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        Backup.objects.create(organizacion=self.org, activo=a, estado="exitoso", tipo="completo")
        with self.assertRaises(ProtectedError):
            a.delete()

    def test_dashboard_excluye_dados_de_baja(self):
        Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S2", de_baja=True)
        d = self.client.get("/api/dashboard/admin/").data
        self.assertEqual(d["infraestructura"]["servidores"]["total"], 1)

    def test_resumen_de_organizacion_excluye_dados_de_baja(self):
        Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="S1")
        Activo.objects.create(organizacion=self.org, tipo="red", nombre="R1", de_baja=True)
        d = self.client.get(f"/api/organizaciones/{self.org.pk}/").data
        self.assertEqual(d["resumen"]["activos"], 1)


class SeedBackupsTests(TestCase):
    def test_seed_crea_backups_con_activo_y_tipo(self):
        call_command("seed_demo", stdout=StringIO())
        self.assertTrue(Backup.objects.exists())
        self.assertFalse(Backup.objects.filter(activo__isnull=True).exists())
        self.assertFalse(Backup.objects.filter(tipo="").exists())


URL_ACTIVOS = "/api/activos/"


def url_activo(a):
    return f"{URL_ACTIVOS}{a.pk}/"


class BaseActivos(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin1", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec1", rol="tecnico")
        self.cliente = Usuario.objects.create_user("cli1", rol="cliente")
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.otra = Organizacion.objects.create(nombre="Otra", nit="900000002")
        self.activo = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="SRV-01")

    def nuevo(self, **extra):
        datos = {"organizacion": self.org.pk, "tipo": "servidor", "nombre": "SRV-02", "estado": "operativo"}
        datos.update(extra)
        return self.client.post(URL_ACTIVOS, datos, format="json")


class PermisosActivosTests(BaseActivos):
    def test_sin_token_da_401(self):
        self.assertEqual(self.client.get(URL_ACTIVOS).status_code, 401)
        self.assertEqual(self.nuevo().status_code, 401)

    def test_cliente_da_403(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get(URL_ACTIVOS).status_code, 403)
        self.assertEqual(self.client.get(url_activo(self.activo)).status_code, 403)
        self.assertEqual(self.nuevo().status_code, 403)
        self.assertEqual(
            self.client.patch(url_activo(self.activo), {"estado": "critico"}, format="json").status_code, 403
        )

    def test_tecnico_crea_y_edita(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.nuevo().status_code, 201)
        r = self.client.patch(url_activo(self.activo), {"estado": "critico", "ip": "10.0.0.5"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["estado"], "critico")

    def test_admin_crea_y_edita(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.nuevo().status_code, 201)
        self.assertEqual(
            self.client.patch(url_activo(self.activo), {"de_baja": True}, format="json").status_code, 200
        )

    def test_put_y_delete_dan_405(self):
        for u in (self.admin, self.tecnico):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.put(url_activo(self.activo), {}, format="json").status_code, 405)
            self.assertEqual(self.client.delete(url_activo(self.activo)).status_code, 405)

    def test_inexistente_da_404(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f"{URL_ACTIVOS}99999/").status_code, 404)


class ReglasActivoTests(BaseActivos):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.tecnico)

    def test_nombre_unico_por_cliente(self):
        r = self.nuevo(nombre="srv-01")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nombre"], ["Ya existe un activo con este nombre en este cliente."])
        self.assertEqual(self.nuevo(nombre="SRV-01", organizacion=self.otra.pk).status_code, 201)

    def test_editar_con_su_propio_nombre_es_valido(self):
        r = self.client.patch(url_activo(self.activo), {"nombre": "SRV-01"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_ip_invalida(self):
        r = self.nuevo(ip="999.1.1.1")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["ip"], ["Escribe una dirección IP válida, por ejemplo 192.168.1.10."])

    def test_no_se_cambia_la_organizacion(self):
        r = self.client.patch(url_activo(self.activo), {"organizacion": self.otra.pk}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["organizacion"], ["No se puede cambiar el cliente de un activo."])
        r = self.client.patch(url_activo(self.activo), {"organizacion": self.org.pk}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_activo_de_baja_no_cambia_estado(self):
        self.activo.de_baja = True
        self.activo.save()
        r = self.client.patch(url_activo(self.activo), {"estado": "critico"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["estado"], ["El activo está dado de baja."])

    def test_activo_de_baja_no_cambia_ficha(self):
        self.activo.de_baja = True
        self.activo.save()
        r = self.client.patch(url_activo(self.activo), {"notas": "x"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["non_field_errors"], ["El activo está dado de baja."])

    def test_reactivar_y_cambiar_estado_juntos(self):
        self.activo.de_baja = True
        self.activo.save()
        r = self.client.patch(
            url_activo(self.activo), {"de_baja": False, "estado": "advertencia"}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        self.activo.refresh_from_db()
        self.assertFalse(self.activo.de_baja)
        self.assertIsNone(self.activo.fecha_baja)
        self.assertEqual(self.activo.estado, "advertencia")

    def test_opcionales_vacios_salen_como_null(self):
        d = self.client.get(url_activo(self.activo)).data
        for campo in ["hostname", "ip", "notas", "ubicacion"]:
            self.assertIsNone(d[campo], campo)
        self.assertEqual(d["organizacion"], {"id": self.org.pk, "nombre": "Org"})


class ListaActivosTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(Usuario.objects.create_user("tec1", rol="tecnico"))
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.otra = Organizacion.objects.create(nombre="Otra", nit="900000002")
        self.a = Activo.objects.create(
            organizacion=self.org, tipo="servidor", nombre="alfa", estado="operativo",
            hostname="db-prod", ip="10.0.0.1", numero_serie="SN-123", fabricante="Dell", modelo="R740",
        )
        self.b = Activo.objects.create(organizacion=self.org, tipo="red", nombre="Beta", estado="critico")
        self.c = Activo.objects.create(organizacion=self.otra, tipo="servidor", nombre="gamma", estado="advertencia")
        self.baja = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre="Viejo", de_baja=True)

    def nombres(self, query=""):
        return [x["nombre"] for x in self.client.get(f"{URL_ACTIVOS}{query}").data["results"]]

    def test_excluye_dados_de_baja_por_defecto(self):
        self.assertEqual(self.nombres(), ["alfa", "Beta", "gamma"])

    def test_de_baja_true_muestra_solo_esos(self):
        self.assertEqual(self.nombres("?de_baja=true"), ["Viejo"])

    def test_filtros_organizacion_tipo_estado(self):
        self.assertEqual(self.nombres(f"?organizacion={self.otra.pk}"), ["gamma"])
        self.assertEqual(self.nombres("?tipo=red"), ["Beta"])
        self.assertEqual(self.nombres("?estado=critico"), ["Beta"])

    def test_busqueda_en_nombre_hostname_ip_serie_fabricante_modelo(self):
        for q in ["ALFA", "db-pro", "10.0.0.1", "sn-12", "dell", "r740"]:
            self.assertEqual(self.nombres(f"?q={q}"), ["alfa"], q)

    def test_filtros_invalidos_se_ignoran(self):
        for q in ["?organizacion=abc", "?estado=raro", "?tipo=x", "?q=%20%20"]:
            self.assertEqual(self.client.get(f"{URL_ACTIVOS}{q}").data["count"], 3, q)

    def test_orden_por_estado_criticos_primero(self):
        self.assertEqual(self.nombres("?ordering=estado"), ["Beta", "gamma", "alfa"])

    def test_ultimo_backup_es_el_mas_reciente(self):
        from datetime import timedelta
        from django.utils import timezone

        ahora = timezone.now()
        Backup.objects.create(organizacion=self.org, activo=self.a, estado="exitoso", tipo="completo",
                              fecha=ahora - timedelta(days=2))
        reciente = Backup.objects.create(organizacion=self.org, activo=self.a, estado="fallido",
                                         tipo="incremental", fecha=ahora - timedelta(hours=1))
        fila = next(x for x in self.client.get(URL_ACTIVOS).data["results"] if x["nombre"] == "alfa")
        self.assertEqual(fila["ultimo_backup"]["id"], reciente.pk)
        self.assertEqual(fila["ultimo_backup"]["estado"], "fallido")

    def test_sin_backups_es_null(self):
        fila = next(x for x in self.client.get(URL_ACTIVOS).data["results"] if x["nombre"] == "Beta")
        self.assertIsNone(fila["ultimo_backup"])

    def test_resumen_backups_en_el_detalle(self):
        for estado in ["exitoso", "exitoso", "fallido"]:
            Backup.objects.create(organizacion=self.org, activo=self.a, estado=estado, tipo="completo")
        d = self.client.get(url_activo(self.a)).data
        self.assertEqual(d["resumen_backups"], {"total": 3, "exitosos": 2, "fallidos": 1, "pendientes": 0})
        self.assertEqual(d["ultimo_backup"]["estado"] in ("exitoso", "fallido"), True)

    def test_lista_sin_n_mas_1(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        def consultas():
            with CaptureQueriesContext(connection) as ctx:
                self.client.get(URL_ACTIVOS)
            return len(ctx)

        antes = consultas()
        for n in range(10):
            act = Activo.objects.create(organizacion=self.org, tipo="servidor", nombre=f"N{n}")
            Backup.objects.create(organizacion=self.org, activo=act, estado="exitoso", tipo="completo")
        self.assertEqual(consultas(), antes)
