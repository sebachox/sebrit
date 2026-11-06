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
