import json

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import Usuario
from apps.assets.models import Activo, Backup
from apps.incidents.models import Incidente
from apps.organizations.models import Organizacion
from apps.tickets.models import EventoTicket, Ticket
from apps.tickets.prioridad import calcular_prioridad

RESUMEN = "/api/portal/resumen/"
ACTIVOS = "/api/portal/activos/"
TICKETS = "/api/portal/tickets/"

CLAVES_FILA = {
    "id", "codigo", "titulo", "categoria", "estado", "activo", "tecnico", "creado_en", "actualizado_en",
}
CLAVES_DETALLE = CLAVES_FILA | {
    "descripcion", "alcance", "solucion", "reportado_por", "resuelto_en", "cerrado_en", "eventos",
}
CLAVES_EVENTO = {
    "id", "tipo", "autor", "autor_es_cliente", "texto", "valor_anterior", "valor_nuevo", "fecha",
}


def url_ticket(ticket, sufijo=""):
    return f"{TICKETS}{ticket.pk}/{sufijo}"


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


class BaseTicketsPortal(BasePortal):
    def setUp(self):
        super().setUp()
        self.entrar(self.cliente_a)

    def ticket(self, org=None, **datos):
        datos.setdefault("titulo", "Sin internet")
        datos.setdefault("descripcion", "No hay conexión")
        return Ticket.objects.create(organizacion=org or self.org_a, **datos)

    def filas(self, consulta=""):
        return self.client.get(f"{TICKETS}{consulta}").data["results"]

    def assertError(self, r, campo, mensaje):
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual([str(m) for m in r.data[campo]], [mensaje])


class TicketsPortalTests(BaseTicketsPortal):
    def test_permisos(self):
        t = self.ticket()
        for usuario, esperado in ((None, 401), (self.tecnico, 403), (self.admin, 403), (self.cliente_a, 200)):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get(TICKETS).status_code, esperado)
            self.assertEqual(self.client.get(url_ticket(t)).status_code, esperado)

    def test_escritura_exige_cliente(self):
        t = self.ticket()
        for usuario, esperado in ((None, 401), (self.tecnico, 403), (self.admin, 403)):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.post(TICKETS, {}, format="json").status_code, esperado)
            self.assertEqual(
                self.client.post(url_ticket(t, "comentarios/"), {"texto": "x"}, format="json").status_code, esperado
            )

    def test_claves_exactas_de_fila_y_detalle(self):
        t = self.ticket()
        self.assertEqual(set(self.filas()[0]), CLAVES_FILA)
        self.assertEqual(set(self.client.get(url_ticket(t)).data), CLAVES_DETALLE)

    def test_no_expone_datos_internos(self):
        t = self.ticket(prioridad="critica", prioridad_manual=True)
        for d in (self.filas()[0], self.client.get(url_ticket(t)).data):
            for clave in ("prioridad", "prioridad_manual", "incidente", "organizacion"):
                self.assertNotIn(clave, d)

    def test_tecnico_y_reportado_son_nombres(self):
        t = self.ticket(tecnico=self.tecnico, reportado_por=self.cliente_a)
        d = self.client.get(url_ticket(t)).data
        self.assertEqual(d["tecnico"], "Laura Gómez")
        self.assertEqual(d["reportado_por"], "Ana Ríos")
        self.assertEqual(self.filas()[0]["tecnico"], "Laura Gómez")

    def test_sin_tecnico_ni_reportado_ni_solucion_salen_null(self):
        d = self.client.get(url_ticket(self.ticket())).data
        self.assertIsNone(d["tecnico"])
        self.assertIsNone(d["reportado_por"])
        self.assertIsNone(d["solucion"])
        self.assertIsNone(d["activo"])

    def test_activo_es_referencia(self):
        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1", notas="secreto")
        t = self.ticket(activo=a)
        self.assertEqual(self.client.get(url_ticket(t)).data["activo"], {"id": a.id, "nombre": "S1"})

    def test_activo_dado_de_baja_sigue_visible_en_el_ticket(self):
        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1", de_baja=True)
        t = self.ticket(activo=a)
        self.assertEqual(self.client.get(url_ticket(t)).status_code, 200)

    def test_filtros(self):
        a = self.ticket(titulo="Correo caído", estado="abierto")
        b = self.ticket(titulo="Impresora", estado="en_progreso")
        c = self.ticket(titulo="Red", estado="cerrado")
        ids = lambda consulta: {f["id"] for f in self.filas(consulta)}
        self.assertEqual(ids("?q=correo"), {a.id})
        self.assertEqual(ids(f"?q={c.codigo}"), {c.id})
        self.assertEqual(ids("?estado=en_progreso"), {b.id})
        self.assertEqual(ids("?abiertos=true"), {a.id, b.id})
        self.assertEqual(ids(""), {a.id, b.id, c.id})

    def test_orden_del_mas_reciente_al_mas_antiguo(self):
        a, b = self.ticket(), self.ticket()
        self.assertEqual([f["id"] for f in self.filas()], [b.id, a.id])

    def test_lista_paginada(self):
        for _ in range(3):
            self.ticket()
        r = self.client.get(f"{TICKETS}?page_size=2").data
        self.assertEqual(r["count"], 3)
        self.assertEqual(len(r["results"]), 2)

    def test_lista_sin_n_mas_1(self):
        def consultas():
            with CaptureQueriesContext(connection) as c:
                self.client.get(TICKETS)
            return len(c)

        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1")
        self.ticket(activo=a, tecnico=self.tecnico)
        una = consultas()
        for _ in range(4):
            self.ticket(activo=a, tecnico=self.tecnico)
        self.assertEqual(consultas(), una)


class CrearTicketPortalTests(BaseTicketsPortal):
    def datos(self, **cambios):
        return {
            "titulo": "Sin correo",
            "descripcion": "No llegan mensajes",
            "categoria": "red",
            "alcance": "toda_empresa",
            **cambios,
        }

    def crear(self, **cambios):
        return self.client.post(TICKETS, self.datos(**cambios), format="json")

    def test_crea_con_la_empresa_de_la_sesion(self):
        r = self.crear(organizacion=self.org_b.id, prioridad="baja", tecnico=self.tecnico.id)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(set(r.data), CLAVES_DETALLE)
        t = Ticket.objects.get(pk=r.data["id"])
        self.assertEqual(t.organizacion, self.org_a)
        self.assertEqual(t.reportado_por, self.cliente_a)
        self.assertIsNone(t.tecnico)
        self.assertEqual(t.prioridad, calcular_prioridad("toda_empresa", "red", None))
        self.assertEqual([e.tipo for e in t.eventos.all()], ["creacion"])

    def test_con_activo_de_la_empresa_y_prioridad_automatica(self):
        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1", estado="critico")
        r = self.crear(activo=a.id)
        self.assertEqual(r.status_code, 201, r.data)
        t = Ticket.objects.get(pk=r.data["id"])
        self.assertEqual(t.activo, a)
        self.assertEqual(t.prioridad, calcular_prioridad("toda_empresa", "red", a))

    def test_activo_null_es_valido(self):
        self.assertEqual(self.crear(activo=None).status_code, 201)

    def test_campos_obligatorios(self):
        r = self.client.post(TICKETS, {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["titulo"], ["Escribe el título."])
        self.assertEqual(r.data["descripcion"], ["Describe lo que ocurre."])
        self.assertEqual(r.data["categoria"], ["Elige una categoría."])
        self.assertEqual(r.data["alcance"], ["Indica a quién afecta."])

    def test_textos_en_blanco(self):
        r = self.crear(titulo="   ", descripcion="   ")
        self.assertEqual(r.data["titulo"], ["Escribe el título."])
        self.assertEqual(r.data["descripcion"], ["Describe lo que ocurre."])

    def test_valores_fuera_del_contrato(self):
        r = self.crear(categoria="x", alcance="x")
        self.assertEqual(r.data["categoria"], ["Elige una categoría."])
        self.assertEqual(r.data["alcance"], ["Indica a quién afecta."])

    def test_titulo_demasiado_largo(self):
        self.assertError(self.crear(titulo="a" * 201), "titulo", "Usa máximo 200 caracteres.")

    def test_activo_ajeno_de_baja_o_inexistente(self):
        ajeno = Activo.objects.create(organizacion=self.org_b, tipo="servidor", nombre="S9")
        baja = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S8", de_baja=True)
        for valor in (ajeno.id, baja.id, 999999, "x", True, 10**30):
            self.assertError(self.crear(activo=valor), "activo", "Elige un activo de tu empresa.")
        self.assertFalse(Ticket.objects.exists())

    def test_activo_decimal_o_infinito_da_400(self):
        for valor in ("1e400", "1.5"):
            cuerpo = json.dumps(self.datos()).replace("}", f', "activo": {valor}}}')
            r = self.client.post(TICKETS, cuerpo, content_type="application/json")
            self.assertError(r, "activo", "Elige un activo de tu empresa.")

    def test_cuerpo_no_objeto_da_400(self):
        r = self.client.post(TICKETS, [1], format="json")
        self.assertError(r, "non_field_errors", "El cuerpo de la petición no es válido.")

    def test_texto_con_nul_da_400(self):
        self.assertEqual(self.crear(titulo="a\x00b").status_code, 400)


class LineaDeTiempoPortalTests(BaseTicketsPortal):
    def evento(self, ticket, tipo, autor=None, **datos):
        return EventoTicket.objects.create(ticket=ticket, tipo=tipo, autor=autor, **datos)

    def eventos(self, ticket):
        return self.client.get(url_ticket(ticket)).data["eventos"]

    def test_solo_eventos_visibles_y_en_orden(self):
        t = self.ticket()
        c = self.evento(t, "creacion", self.cliente_a)
        self.evento(t, "comentario", self.tecnico, texto="Nota interna")
        v = self.evento(t, "comentario", self.tecnico, texto="Hola", visible_cliente=True)
        e = self.evento(t, "estado", self.tecnico, valor_anterior="abierto", valor_nuevo="en_progreso")
        for tipo in ("tecnico", "prioridad", "incidente"):
            self.evento(t, tipo, self.tecnico, texto="oculto")
        eventos = self.eventos(t)
        self.assertEqual([x["id"] for x in eventos], [c.id, v.id, e.id])
        self.assertNotIn("Nota interna", json.dumps(eventos, default=str))
        self.assertNotIn("oculto", json.dumps(eventos, default=str))

    def test_claves_exactas_del_evento(self):
        t = self.ticket()
        self.evento(t, "creacion", self.cliente_a)
        self.assertEqual(set(self.eventos(t)[0]), CLAVES_EVENTO)

    def test_autor_y_marca_de_cliente(self):
        t = self.ticket()
        self.evento(t, "comentario", self.cliente_a, texto="a", visible_cliente=True)
        self.evento(t, "comentario", self.tecnico, texto="b", visible_cliente=True)
        self.assertEqual(
            [(e["autor"], e["autor_es_cliente"]) for e in self.eventos(t)],
            [("Ana Ríos", True), ("Laura Gómez", False)],
        )

    def test_autor_borrado_sale_null(self):
        t = self.ticket()
        self.evento(t, "comentario", None, texto="a", visible_cliente=True)
        e = self.eventos(t)[0]
        self.assertIsNone(e["autor"])
        self.assertIs(e["autor_es_cliente"], False)

    def test_resolucion_en_cascada_no_revela_incidente(self):
        i = Incidente.objects.create(
            titulo="Caída general", organizacion=self.org_a, severidad="alta", estado="en_progreso", tecnico=self.tecnico
        )
        t = self.ticket(incidente=i, estado="abierto")
        self.client.force_authenticate(self.tecnico)
        r = self.client.post(
            f"/api/incidentes/{i.id}/estado/", {"estado": "resuelto", "solucion": "Se reinició"}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.entrar(self.cliente_a)
        d = self.client.get(url_ticket(t)).data
        self.assertEqual(d["estado"], "resuelto")
        self.assertEqual(d["eventos"][-1]["tipo"], "estado")
        texto = json.dumps(d, default=str)
        self.assertNotIn(i.codigo, texto)
        self.assertNotIn("Caída general", texto)


class ComentariosPortalTests(BaseTicketsPortal):
    def comentar(self, ticket, **datos):
        return self.client.post(url_ticket(ticket, "comentarios/"), datos, format="json")

    def test_comentario_visible_con_marca_de_cliente(self):
        t = self.ticket()
        r = self.comentar(t, texto="  Sigue fallando  ", visible_cliente=False)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(set(r.data), CLAVES_EVENTO)
        self.assertEqual(r.data["texto"], "Sigue fallando")
        self.assertIs(r.data["autor_es_cliente"], True)
        e = t.eventos.get(tipo="comentario")
        self.assertTrue(e.visible_cliente)
        self.assertEqual(e.autor, self.cliente_a)

    def test_texto_vacio_da_400(self):
        t = self.ticket()
        for datos in ({}, {"texto": "   "}, {"texto": "a\x00b"}):
            self.assertError(self.comentar(t, **datos), "texto", "Escribe el comentario.")

    def test_texto_con_caracter_invalido_da_400(self):
        r = self.client.post(
            url_ticket(self.ticket(), "comentarios/"), r'{"texto": "\ud800"}', content_type="application/json"
        )
        self.assertError(r, "texto", "Escribe el comentario.")

    def test_resuelto_admite_comentarios(self):
        self.assertEqual(self.comentar(self.ticket(estado="resuelto"), texto="x").status_code, 201)

    def test_cerrado_da_400(self):
        t = self.ticket(estado="cerrado")
        self.assertError(
            self.comentar(t, texto="x"),
            "non_field_errors",
            "Este ticket está cerrado. Si el problema volvió, abre uno nuevo.",
        )
        self.assertFalse(t.eventos.exists())


class AislamientoTests(BaseTicketsPortal):
    def test_lista_solo_trae_la_empresa_propia(self):
        propio = self.ticket()
        self.ticket(org=self.org_b)
        self.assertEqual([f["id"] for f in self.filas()], [propio.id])

    def test_ticket_ajeno_da_404(self):
        ajeno = self.ticket(org=self.org_b)
        self.assertEqual(self.client.get(url_ticket(ajeno)).status_code, 404)

    def test_comentar_ticket_ajeno_da_404_sin_crear_evento(self):
        ajeno = self.ticket(org=self.org_b)
        r = self.client.post(url_ticket(ajeno, "comentarios/"), {"texto": "x"}, format="json")
        self.assertEqual(r.status_code, 404)
        self.assertFalse(ajeno.eventos.exists())

    def test_ajeno_e_inexistente_responden_igual(self):
        ajeno = self.ticket(org=self.org_b)
        a = self.client.get(url_ticket(ajeno))
        b = self.client.get(f"{TICKETS}99999/")
        self.assertEqual((a.status_code, a.data), (b.status_code, b.data))

    def test_id_no_numerico_o_enorme_da_404(self):
        for pk in ("abc", "9" * 400, "-1"):
            self.assertEqual(self.client.get(f"{TICKETS}{pk}/").status_code, 404, pk)
            r = self.client.post(f"{TICKETS}{pk}/comentarios/", {"texto": "x"}, format="json")
            self.assertEqual(r.status_code, 404, pk)

    def test_entradas_anomalas_no_fallan(self):
        self.ticket()
        for consulta in ("?q=%00", "?q=a%00b", "?page_size=x", "?page_size=-1", "?estado=x", "?abiertos=x"):
            self.assertEqual(self.client.get(f"{TICKETS}{consulta}").status_code, 200, consulta)
        for consulta in ("?page=x", "?page=99999"):
            self.assertEqual(self.client.get(f"{TICKETS}{consulta}").status_code, 404, consulta)

    def test_put_patch_y_delete_dan_405(self):
        t = self.ticket()
        self.assertEqual(self.client.put(url_ticket(t), {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(url_ticket(t), {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(url_ticket(t)).status_code, 405)

    def test_cliente_recibe_403_en_la_api_interna(self):
        t = self.ticket()
        i = Incidente.objects.create(titulo="i", organizacion=self.org_a, severidad="alta")
        a = Activo.objects.create(organizacion=self.org_a, tipo="servidor", nombre="S1")
        rutas = [
            ("get", "/api/dashboard/admin/"),
            ("get", "/api/organizaciones/"),
            ("get", f"/api/organizaciones/{self.org_a.id}/"),
            ("get", "/api/activos/"),
            ("get", f"/api/activos/{a.id}/"),
            ("get", "/api/backups/"),
            ("get", "/api/tickets/"),
            ("get", f"/api/tickets/{t.id}/"),
            ("post", f"/api/tickets/{t.id}/comentarios/"),
            ("post", f"/api/tickets/{t.id}/estado/"),
            ("get", "/api/incidentes/"),
            ("get", f"/api/incidentes/{i.id}/"),
            ("get", "/api/tecnicos/"),
        ]
        for metodo, ruta in rutas:
            r = getattr(self.client, metodo)(ruta, {}, format="json") if metodo == "post" else self.client.get(ruta)
            self.assertEqual(r.status_code, 403, ruta)
