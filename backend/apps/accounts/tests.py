from rest_framework.test import APITestCase

from apps.accounts.models import Usuario

LOGIN = "/api/auth/login/"
ME = "/api/auth/me/"
DASHBOARD = "/api/dashboard/admin/"


class LoginTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            "admin1", password="clave-segura", rol="admin", first_name="Ana", last_name="Ruiz"
        )

    def test_login_valido_devuelve_tokens_y_usuario(self):
        r = self.client.post(LOGIN, {"username": "admin1", "password": "clave-segura"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        self.assertEqual(
            r.data["usuario"],
            {"id": self.admin.id, "username": "admin1", "nombre": "Ana Ruiz", "rol": "admin"},
        )

    def test_login_con_clave_incorrecta_da_401(self):
        r = self.client.post(LOGIN, {"username": "admin1", "password": "mala"})
        self.assertEqual(r.status_code, 401)

    def test_token_del_login_permite_ver_el_dashboard(self):
        access = self.client.post(
            LOGIN, {"username": "admin1", "password": "clave-segura"}
        ).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get(DASHBOARD).status_code, 200)

    def test_me_sin_token_da_401(self):
        self.assertEqual(self.client.get(ME).status_code, 401)

    def test_me_devuelve_el_usuario_actual(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(ME)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["rol"], "admin")
        self.assertEqual(r.data["nombre"], "Ana Ruiz")
