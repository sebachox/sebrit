from io import StringIO

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase

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
