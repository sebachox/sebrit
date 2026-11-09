from rest_framework.test import APITestCase

from apps.accounts.models import Usuario
from apps.organizations.models import Organizacion

LOGIN = "/api/auth/login/"
ME = "/api/auth/me/"
PERFIL = "/api/auth/perfil/"
CLAVE = "/api/auth/perfil/clave/"
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


class PerfilTests(APITestCase):
    def setUp(self):
        self.org = Organizacion.objects.create(nombre="Org", nit="900000001")
        self.usuario = Usuario.objects.create_user(
            "tec1", password="clave-segura", rol="tecnico", first_name="Laura", last_name="Gómez",
            email="laura@ejemplo.com", organizacion=self.org,
        )

    def entrar(self):
        self.client.force_authenticate(self.usuario)

    def test_sin_token_da_401(self):
        self.assertEqual(self.client.get(PERFIL).status_code, 401)
        self.assertEqual(self.client.patch(PERFIL, {}, format="json").status_code, 401)

    def test_devuelve_los_datos_del_usuario_de_la_sesion(self):
        Usuario.objects.create_user("otro", first_name="Otro", rol="admin")
        self.entrar()
        r = self.client.get(PERFIL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.data,
            {
                "id": self.usuario.id,
                "username": "tec1",
                "nombres": "Laura",
                "apellidos": "Gómez",
                "nombre_completo": "Laura Gómez",
                "correo": "laura@ejemplo.com",
                "rol": "tecnico",
                "organizacion": {"id": self.org.id, "nombre": "Org"},
            },
        )

    def test_rol_cliente_tambien_ve_su_perfil(self):
        self.usuario.rol = "cliente"
        self.usuario.save()
        self.entrar()
        self.assertEqual(self.client.get(PERFIL).status_code, 200)

    def test_vacios_salen_como_null(self):
        u = Usuario.objects.create_user("solo", rol="admin")
        self.client.force_authenticate(u)
        d = self.client.get(PERFIL).data
        self.assertIsNone(d["nombres"])
        self.assertIsNone(d["apellidos"])
        self.assertIsNone(d["correo"])
        self.assertIsNone(d["organizacion"])
        self.assertEqual(d["nombre_completo"], "solo")

    def test_editar_datos_personales(self):
        self.entrar()
        r = self.client.patch(
            PERFIL, {"nombres": " Ana ", "apellidos": "Ruiz", "correo": "ana@ejemplo.com"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["nombre_completo"], "Ana Ruiz")
        self.usuario.refresh_from_db()
        self.assertEqual(
            (self.usuario.first_name, self.usuario.last_name, self.usuario.email),
            ("Ana", "Ruiz", "ana@ejemplo.com"),
        )
        self.assertEqual(self.client.get(ME).data["nombre"], "Ana Ruiz")

    def test_se_pueden_vaciar_los_datos(self):
        self.entrar()
        r = self.client.patch(PERFIL, {"nombres": "", "apellidos": "", "correo": ""}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(r.data["correo"])
        self.assertEqual(r.data["nombre_completo"], "tec1")

    def test_no_se_puede_cambiar_usuario_rol_ni_organizacion(self):
        otra = Organizacion.objects.create(nombre="Otra", nit="900000002")
        self.entrar()
        r = self.client.patch(
            PERFIL,
            {"username": "nuevo", "rol": "admin", "organizacion": otra.id, "is_superuser": True, "is_staff": True},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.username, "tec1")
        self.assertEqual(self.usuario.rol, "tecnico")
        self.assertEqual(self.usuario.organizacion, self.org)
        self.assertFalse(self.usuario.is_superuser)
        self.assertFalse(self.usuario.is_staff)

    def test_correo_invalido(self):
        self.entrar()
        r = self.client.patch(PERFIL, {"correo": "no-es-correo"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["correo"], ["Escribe un correo válido."])

    def test_textos_demasiado_largos(self):
        self.entrar()
        r = self.client.patch(PERFIL, {"nombres": "a" * 151, "apellidos": "b" * 151}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["nombres"], ["Usa máximo 150 caracteres."])
        self.assertEqual(r.data["apellidos"], ["Usa máximo 150 caracteres."])

    def test_null_vacia_el_campo(self):
        self.entrar()
        r = self.client.patch(PERFIL, {"nombres": None}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(r.data["nombres"])
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.first_name, "")

    def test_cuerpo_no_objeto_da_400(self):
        self.entrar()
        r = self.client.patch(PERFIL, [1, 2], format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["non_field_errors"], ["El cuerpo de la petición no es válido."])

    def test_put_post_y_delete_dan_405(self):
        self.entrar()
        self.assertEqual(self.client.put(PERFIL, {}, format="json").status_code, 405)
        self.assertEqual(self.client.post(PERFIL, {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(PERFIL).status_code, 405)


class CambiarClaveTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user("tec1", password="clave-segura-1", rol="tecnico")
        self.client.force_authenticate(self.usuario)

    def cambiar(self, **datos):
        return self.client.post(CLAVE, datos, format="json")

    def clave_intacta(self):
        self.usuario.refresh_from_db()
        return self.usuario.check_password("clave-segura-1")

    def test_sin_token_da_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.cambiar(clave_actual="a", clave_nueva="b").status_code, 401)

    def test_cambia_la_clave_y_el_login_usa_la_nueva(self):
        r = self.cambiar(clave_actual="clave-segura-1", clave_nueva="otra-clave-larga-2")
        self.assertEqual(r.status_code, 204, getattr(r, "data", None))
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.post(LOGIN, {"username": "tec1", "password": "otra-clave-larga-2"}).status_code, 200
        )
        self.assertEqual(
            self.client.post(LOGIN, {"username": "tec1", "password": "clave-segura-1"}).status_code, 401
        )

    def test_clave_actual_incorrecta(self):
        r = self.cambiar(clave_actual="mala", clave_nueva="otra-clave-larga-2")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["clave_actual"], ["La contraseña actual no es correcta."])
        self.assertTrue(self.clave_intacta())

    def test_campos_obligatorios(self):
        r = self.cambiar()
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["clave_actual"], ["Escribe tu contraseña actual."])
        self.assertEqual(r.data["clave_nueva"], ["Escribe la nueva contraseña."])

    def test_valores_que_no_son_texto(self):
        r = self.cambiar(clave_actual=["x"], clave_nueva={"a": 1})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["clave_actual"], ["Escribe tu contraseña actual."])
        self.assertEqual(r.data["clave_nueva"], ["Escribe la nueva contraseña."])
        self.assertTrue(self.clave_intacta())

    def test_clave_nueva_debil_explica_en_espanol(self):
        r = self.cambiar(clave_actual="clave-segura-1", clave_nueva="a1b")
        self.assertEqual(r.status_code, 400)
        self.assertIn("corta", " ".join(r.data["clave_nueva"]))
        self.assertTrue(self.clave_intacta())

    def test_clave_nueva_igual_a_la_actual(self):
        r = self.cambiar(clave_actual="clave-segura-1", clave_nueva="clave-segura-1")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["clave_nueva"], ["La nueva contraseña debe ser distinta de la actual."])

    def test_clave_demasiado_larga(self):
        r = self.cambiar(clave_actual="clave-segura-1", clave_nueva="x" * 129)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["clave_nueva"], ["Usa máximo 128 caracteres."])
        self.assertTrue(self.clave_intacta())

    def test_cuerpo_no_objeto_da_400(self):
        r = self.client.post(CLAVE, [1], format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["non_field_errors"], ["El cuerpo de la petición no es válido."])

    def test_get_da_405(self):
        self.assertEqual(self.client.get(CLAVE).status_code, 405)


class UsuariosEmpresaBase(APITestCase):
    def setUp(self):
        self.org = Organizacion.objects.create(nombre="Empresa A", nit="900000001")
        self.otra = Organizacion.objects.create(nombre="Empresa B", nit="900000002")
        self.admin = Usuario.objects.create_user("adm", rol="admin")
        self.tecnico = Usuario.objects.create_user("tec", rol="tecnico", organizacion=self.org)
        self.cliente = Usuario.objects.create_user(
            "cli_a", password="clave-inicial-1", rol="cliente", organizacion=self.org,
            first_name="Ana", last_name="Ríos", email="ana@ejemplo.com",
        )
        self.ajeno = Usuario.objects.create_user("cli_b", rol="cliente", organizacion=self.otra)
        self.url = f"/api/organizaciones/{self.org.id}/usuarios/"
        self.client.force_authenticate(self.admin)

    def url_de(self, usuario, sufijo=""):
        return f"{self.url}{usuario.id}/{sufijo}"

    def crear(self, **datos):
        datos = {"username": "nuevo", "clave_inicial": "clave-larga-segura-1", **datos}
        return self.client.post(self.url, datos, format="json")


class UsuariosEmpresaPermisosTests(UsuariosEmpresaBase):
    def llamadas(self):
        return [
            self.client.get(self.url).status_code,
            self.crear().status_code,
            self.client.patch(self.url_de(self.cliente), {"nombres": "X"}, format="json").status_code,
            self.client.post(self.url_de(self.cliente, "clave/"), {"clave_nueva": "otra-clave-larga-2"}, format="json").status_code,
        ]

    def test_sin_token_da_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.llamadas(), [401, 401, 401, 401])

    def test_cliente_da_403(self):
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.llamadas(), [403, 403, 403, 403])

    def test_tecnico_solo_consulta(self):
        self.client.force_authenticate(self.tecnico)
        self.assertEqual(self.llamadas(), [200, 403, 403, 403])

    def test_admin_gestiona(self):
        self.assertEqual(self.llamadas(), [200, 201, 200, 204])

    def test_organizacion_inexistente_da_404(self):
        url = "/api/organizaciones/99999/usuarios/"
        self.assertEqual(self.client.get(url).status_code, 404)
        r = self.client.post(url, {"username": "x", "clave_inicial": "clave-larga-segura-1"}, format="json")
        self.assertEqual(r.status_code, 404)
        self.assertFalse(Usuario.objects.filter(username="x").exists())


class UsuariosEmpresaListaTests(UsuariosEmpresaBase):
    def test_solo_clientes_de_la_empresa_con_claves_exactas(self):
        self.assertEqual(
            self.client.get(self.url).data,
            [
                {
                    "id": self.cliente.id,
                    "username": "cli_a",
                    "nombres": "Ana",
                    "apellidos": "Ríos",
                    "correo": "ana@ejemplo.com",
                    "activo": True,
                }
            ],
        )

    def test_vacios_salen_como_null(self):
        u = Usuario.objects.create_user("sin_datos", rol="cliente", organizacion=self.org)
        fila = next(f for f in self.client.get(self.url).data if f["id"] == u.id)
        self.assertIsNone(fila["nombres"])
        self.assertIsNone(fila["correo"])

    def test_put_y_delete_dan_405(self):
        self.assertEqual(self.client.put(self.url_de(self.cliente), {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(self.url_de(self.cliente)).status_code, 405)


class UsuariosEmpresaCrearTests(UsuariosEmpresaBase):
    def test_rol_y_organizacion_los_fija_el_servidor(self):
        r = self.crear(rol="admin", organizacion=self.otra.id, is_superuser=True, is_staff=True)
        self.assertEqual(r.status_code, 201, r.data)
        u = Usuario.objects.get(username="nuevo")
        self.assertEqual(u.rol, "cliente")
        self.assertEqual(u.organizacion, self.org)
        self.assertFalse(u.is_superuser)
        self.assertFalse(u.is_staff)
        self.assertNotIn("clave_inicial", r.data)

    def test_datos_opcionales(self):
        r = self.crear(nombres="Luis", apellidos="Paz", correo="luis@ejemplo.com")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["nombres"], r.data["apellidos"], r.data["correo"]), ("Luis", "Paz", "luis@ejemplo.com"))

    def test_el_usuario_creado_inicia_sesion(self):
        self.crear()
        self.client.force_authenticate(None)
        r = self.client.post(LOGIN, {"username": "nuevo", "password": "clave-larga-segura-1"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["usuario"]["rol"], "cliente")

    def test_campos_obligatorios(self):
        r = self.client.post(self.url, {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["username"], ["Escribe el usuario."])
        self.assertEqual(r.data["clave_inicial"], ["Escribe la contraseña inicial."])

    def test_clave_inicial_debil_explica_en_espanol(self):
        r = self.crear(clave_inicial="a1b")
        self.assertEqual(r.status_code, 400)
        self.assertIn("corta", " ".join(r.data["clave_inicial"]))
        self.assertFalse(Usuario.objects.filter(username="nuevo").exists())

    def test_username_duplicado_sin_distinguir_mayusculas(self):
        for nombre in ("cli_a", "CLI_A", "ADM"):
            r = self.crear(username=nombre)
            self.assertEqual(r.status_code, 400, nombre)
            self.assertEqual(r.data["username"], ["Ese usuario ya existe."])

    def test_username_invalido(self):
        for nombre in ("con espacio", "ñ!", "a" * 151):
            r = self.crear(username=nombre)
            self.assertEqual(r.status_code, 400, nombre)
            self.assertEqual(r.data["username"], ["Usa solo letras, números y @ . + - _ (máximo 150)."])

    def test_correo_invalido(self):
        r = self.crear(correo="no-es-correo")
        self.assertEqual(r.data["correo"], ["Escribe un correo válido."])

    def test_cuerpo_no_objeto_da_400(self):
        r = self.client.post(self.url, [1], format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["non_field_errors"], ["El cuerpo de la petición no es válido."])


class UsuariosEmpresaEditarTests(UsuariosEmpresaBase):
    def editar(self, usuario=None, **datos):
        return self.client.patch(self.url_de(usuario or self.cliente), datos, format="json")

    def test_edita_datos(self):
        r = self.editar(nombres="Luisa", apellidos="Mar", correo="luisa@ejemplo.com")
        self.assertEqual(r.status_code, 200, r.data)
        self.cliente.refresh_from_db()
        self.assertEqual(
            (self.cliente.first_name, self.cliente.last_name, self.cliente.email),
            ("Luisa", "Mar", "luisa@ejemplo.com"),
        )

    def test_campos_protegidos_se_ignoran(self):
        self.assertEqual(
            self.editar(username="otro", rol="admin", organizacion=self.otra.id, is_staff=True).status_code, 200
        )
        self.cliente.refresh_from_db()
        self.assertEqual((self.cliente.username, self.cliente.rol), ("cli_a", "cliente"))
        self.assertEqual(self.cliente.organizacion, self.org)
        self.assertFalse(self.cliente.is_staff)

    def test_desactivar_y_reactivar(self):
        self.assertIs(self.editar(activo=False).data["activo"], False)
        self.cliente.refresh_from_db()
        self.assertFalse(self.cliente.is_active)
        self.assertIs(self.editar(activo=True).data["activo"], True)

    def test_activo_no_booleano_da_400(self):
        r = self.editar(activo="quizas")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["activo"], ["Indica si el usuario está activo."])

    def test_uid_de_otra_empresa_da_404(self):
        self.assertEqual(self.editar(self.ajeno, nombres="X").status_code, 404)
        r = self.client.post(self.url_de(self.ajeno, "clave/"), {"clave_nueva": "otra-clave-larga-2"}, format="json")
        self.assertEqual(r.status_code, 404)

    def test_uid_de_cuenta_interna_da_404(self):
        for interno in (self.tecnico, self.admin):
            self.assertEqual(self.editar(interno, activo=False).status_code, 404)
            r = self.client.post(self.url_de(interno, "clave/"), {"clave_nueva": "otra-clave-larga-2"}, format="json")
            self.assertEqual(r.status_code, 404)
            interno.refresh_from_db()
            self.assertTrue(interno.is_active)

    def test_usuario_desactivado_no_autentica(self):
        token = self.client.post(LOGIN, {"username": "cli_a", "password": "clave-inicial-1"}).data["access"]
        self.editar(activo=False)
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(ME).status_code, 401)

    def test_definir_clave_cambia_el_login(self):
        r = self.client.post(self.url_de(self.cliente, "clave/"), {"clave_nueva": "otra-clave-larga-2"}, format="json")
        self.assertEqual(r.status_code, 204)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(LOGIN, {"username": "cli_a", "password": "otra-clave-larga-2"}).status_code, 200)
        self.assertEqual(self.client.post(LOGIN, {"username": "cli_a", "password": "clave-inicial-1"}).status_code, 401)

    def test_definir_clave_debil_o_vacia_da_400(self):
        url = self.url_de(self.cliente, "clave/")
        r = self.client.post(url, {"clave_nueva": "a1b"}, format="json")
        self.assertIn("corta", " ".join(r.data["clave_nueva"]))
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.data["clave_nueva"], ["Escribe la nueva contraseña."])
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password("clave-inicial-1"))
