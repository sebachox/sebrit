"""Base de datos de demostración completa e idéntica en cualquier equipo.

    python manage.py seed_completo --reiniciar --clave <clave-usuarios> --clave-admin <clave-admin>

Usa una semilla fija: dos personas que lo corran obtienen los mismos datos (las fechas se
calculan desde el día en que se corre). Las contraseñas no viven en el repositorio: se pasan
por argumento. Sin --clave, técnicos y usuarios del portal quedan sin contraseña usable.
"""

import random
import string
import unicodedata
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError as ErrorDeValidacion

from apps.accounts.models import Usuario
from apps.accounts.serializers import validar_clave
from apps.assets.models import Activo, Backup
from apps.dashboard import datos_completos as D
from apps.incidents.models import AccionIncidente, Incidente
from apps.incidents.severidad import calcular_severidad
from apps.maintenance.models import Mantenimiento
from apps.organizations.models import Organizacion
from apps.tickets.models import EventoTicket, Ticket
from apps.tickets.prioridad import calcular_prioridad
from apps.tickets.servicios import nombre_usuario

SEMILLA = 20261112
DIAS_TICKETS = 180
DIAS_BACKUPS = 45
TOTAL_TICKETS = 190
TOTAL_INCIDENTES = 22
PRIORIDADES = ["baja", "media", "alta", "critica"]

MODELOS_DEMO = [Organizacion, Activo, Backup, Ticket, EventoTicket, Incidente, AccionIncidente, Mantenimiento]


def sin_tildes(texto):
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower().replace(" ", "")


def minutos(n):
    return timedelta(minutes=n)


class Command(BaseCommand):
    help = "Carga una base de demostración completa y determinista (empresas, activos, backups, tickets e incidentes)."

    def add_arguments(self, parser):
        parser.add_argument("--reiniciar", action="store_true", help="Borra los datos de negocio y los usuarios que no son administradores.")
        parser.add_argument("--clave", help="Contraseña para técnicos y usuarios del portal.")
        parser.add_argument("--clave-admin", dest="clave_admin", help="Crea o actualiza el superusuario 'admin' con esta contraseña.")

    def handle(self, *args, reiniciar=False, clave=None, clave_admin=None, **opciones):
        # Primero las validaciones: si una contraseña no sirve, no se borra nada.
        for valor, usuario in ((clave, None), (clave_admin, Usuario(username="admin"))):
            if valor is not None:
                try:
                    validar_clave(valor, usuario)
                except ErrorDeValidacion as e:
                    raise CommandError("Contraseña no válida: " + " ".join(str(m) for m in e.detail))

        if Organizacion.objects.exists() and not reiniciar:
            self.stdout.write(
                "Ya hay datos. Usa --reiniciar para borrarlos y cargar la base completa "
                "(los administradores y superusuarios se conservan)."
            )
            return

        with transaction.atomic():
            if reiniciar:
                self._borrar()
            resumen = Generador(clave).cargar()
            if clave_admin:
                self._crear_admin(clave_admin)

        self.stdout.write(self.style.SUCCESS("Base de demostración cargada:"))
        for etiqueta, cantidad in resumen.items():
            self.stdout.write(f"  {etiqueta}: {cantidad}")
        if not clave:
            self.stdout.write(self.style.WARNING("Sin --clave: técnicos y usuarios del portal no pueden iniciar sesión."))

    def _borrar(self):
        Ticket.objects.all().delete()
        Incidente.objects.all().delete()
        Backup.objects.all().delete()
        Activo.objects.all().delete()
        Mantenimiento.objects.all().delete()
        Usuario.objects.exclude(Q(rol=Usuario.Rol.ADMIN) | Q(is_superuser=True) | Q(is_staff=True)).delete()
        Organizacion.objects.all().delete()
        # Los ids vuelven a empezar en 1: así los códigos (TCK-0001, INC-0001) coinciden en todos los equipos.
        with connection.cursor() as cursor:
            for sql in connection.ops.sequence_reset_sql(no_style(), MODELOS_DEMO):
                cursor.execute(sql)

    def _crear_admin(self, clave):
        admin, _ = Usuario.objects.get_or_create(username="admin")
        admin.is_superuser = True
        admin.is_staff = True
        admin.is_active = True
        admin.rol = Usuario.Rol.ADMIN
        admin.first_name = "Administrador"
        admin.email = "admin@sebrit.example"
        admin.set_password(clave)
        admin.save()


class Generador:
    def __init__(self, clave):
        self.clave = clave
        self.rnd = random.Random(SEMILLA)
        self.ahora = timezone.localtime().replace(second=0, microsecond=0)
        self.hoy = self.ahora.date()
        self.tecnicos = []
        self.empresas = []
        self.clientes = {}
        self.activos = {}
        self.eventos = []
        self.acciones = []

    # ---------- utilidades ----------

    def momento(self, dias_atras, hora, minuto):
        dia = self.hoy - timedelta(days=dias_atras)
        return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))

    def usuario(self, username, nombre, apellido, rol, correo, organizacion=None):
        u = Usuario(
            username=username, first_name=nombre, last_name=apellido, email=correo,
            rol=rol, organizacion=organizacion,
        )
        if self.clave:
            u.set_password(self.clave)
        else:
            u.set_unusable_password()
        u.save()
        return u

    def entre(self, inicio, fin, desde=0.1, hasta=0.9):
        return inicio + (fin - inicio) * self.rnd.uniform(desde, hasta)

    # ---------- carga ----------

    def cargar(self):
        self.crear_tecnicos()
        backups = []
        for indice, datos in enumerate(D.EMPRESAS):
            backups += self.crear_empresa(indice, datos)
        Backup.objects.bulk_create(backups)
        tickets, incidentes = self.crear_historial()
        EventoTicket.objects.bulk_create(self.eventos)
        AccionIncidente.objects.bulk_create(self.acciones)
        return {
            "Empresas": len(self.empresas),
            "Activos": sum(len(a) for a in self.activos.values()),
            "Backups": len(backups),
            "Tickets": tickets,
            "Incidentes": incidentes,
            "Técnicos": len(self.tecnicos),
            "Usuarios del portal": sum(len(c) for c in self.clientes.values()),
        }

    def crear_tecnicos(self):
        for username, nombre, apellido in D.TECNICOS:
            self.tecnicos.append(self.usuario(username, nombre, apellido, Usuario.Rol.TECNICO, f"{username}@sebrit.example"))

    def crear_empresa(self, indice, e):
        rnd = self.rnd
        dominio = f"{e['sigla']}.example"
        if e["activa"]:
            inicio = self.hoy - timedelta(days=rnd.randint(200, 900))
            fin = inicio + timedelta(days=365 * rnd.choice([1, 2, 3]))
            while fin <= self.hoy:
                fin += timedelta(days=365)
        else:
            fin = self.hoy - timedelta(days=70)
            inicio = fin - timedelta(days=365)
        contacto, cargo, telefono = e["contacto"]
        nombre_c, apellido_c = contacto.split(" ", 1)
        org = Organizacion.objects.create(
            nombre=e["nombre"], nit=e["nit"], sector=e["sector"], telefono=e["telefono"],
            correo=f"contacto@{dominio}", direccion=e["direccion"], ciudad=e["ciudad"],
            contacto_nombre=contacto, contacto_cargo=cargo,
            contacto_correo=f"{sin_tildes(nombre_c)}.{sin_tildes(apellido_c)}@{dominio}",
            contacto_telefono=telefono, plan=e["plan"], fecha_inicio_contrato=inicio,
            fecha_fin_contrato=fin, activa=e["activa"],
        )
        self.empresas.append(org)
        self.clientes[org.id] = [
            self.usuario(
                f"{sin_tildes(n)[0]}{sin_tildes(a)}.{e['sigla']}", n, a, Usuario.Rol.CLIENTE,
                f"{sin_tildes(n)}.{sin_tildes(a)}@{dominio}", org,
            )
            for n, a in e["usuarios"]
        ]
        activos, roles = self.crear_activos(indice, org, e)
        self.activos[org.id] = activos
        return self.crear_backups(org, activos, roles) if e["activa"] else []

    def crear_activos(self, indice, org, e):
        rnd = self.rnd
        activos, roles, contador = [], {}, {}
        for k in range(e["servidores"]):
            rol = D.ROLES_SERVIDOR[k % len(D.ROLES_SERVIDOR)]
            contador[rol[0]] = contador.get(rol[0], 0) + 1
            nombre = f"SRV-{rol[0]}{contador[rol[0]]:02d}"
            fabricante, modelo = rnd.choice(D.EQUIPOS_SERVIDOR)
            de_baja = k == e["servidores"] - 1 and e["servidores"] >= 5
            activo = Activo.objects.create(
                organizacion=org, tipo="servidor", nombre=nombre,
                estado="operativo" if de_baja else rnd.choices(["operativo", "advertencia", "critico"], [85, 10, 5])[0],
                hostname=f"{nombre.lower()}.{e['sigla']}.local", ip=f"10.{20 + indice}.1.{10 + k}",
                sistema_operativo=rnd.choice(rol[2]), fabricante=fabricante, modelo=modelo,
                numero_serie="".join(rnd.choices(string.ascii_uppercase + string.digits, k=10)),
                ubicacion=rnd.choice(D.UBICACIONES), notas=rnd.choice(D.NOTAS_ACTIVO), de_baja=de_baja,
                fecha_baja=self.momento(rnd.randint(20, 120), 10, 0) if de_baja else None,
            )
            activos.append(activo)
            roles[activo.id] = rol
        for k in range(e["redes"]):
            prefijo, _, fabricante, modelo, sistema = D.ROLES_RED[k % len(D.ROLES_RED)]
            contador[prefijo] = contador.get(prefijo, 0) + 1
            nombre = f"{prefijo}-{contador[prefijo]:02d}"
            activos.append(Activo.objects.create(
                organizacion=org, tipo="red", nombre=nombre,
                estado=rnd.choices(["operativo", "advertencia", "critico"], [85, 10, 5])[0],
                hostname=f"{nombre.lower()}.{e['sigla']}.local", ip=f"10.{20 + indice}.0.{k + 1}",
                sistema_operativo=sistema, fabricante=fabricante, modelo=modelo,
                numero_serie="".join(rnd.choices(string.ascii_uppercase + string.digits, k=10)),
                ubicacion=rnd.choice(D.UBICACIONES), notas=rnd.choice(D.NOTAS_ACTIVO),
            ))
        return activos, roles

    def crear_backups(self, org, activos, roles):
        rnd = self.rnd
        backups = []
        for activo in activos:
            if activo.tipo != "servidor":
                continue
            prefijo, _, _, tamano_base, diario = roles[activo.id]
            for dias in range(DIAS_BACKUPS - 1, -1, -1):
                if not diario and dias % 2:
                    continue
                fecha = self.momento(dias, rnd.randint(1, 3), rnd.randint(0, 59))
                if fecha > self.ahora or (activo.fecha_baja and fecha >= activo.fecha_baja):
                    continue
                dia = fecha.weekday()
                tipo = "completo" if dia == 6 else ("diferencial" if dia == 2 and prefijo == "FS" else "incremental")
                if dias == 0 and rnd.random() < 0.3:
                    estado = "pendiente"
                else:
                    estado = rnd.choices(["exitoso", "fallido"], [94, 6])[0]
                factor = {"completo": (0.92, 1.08), "diferencial": (0.2, 0.35), "incremental": (0.03, 0.12)}[tipo]
                tamano = None if estado != "exitoso" else Decimal(f"{tamano_base * rnd.uniform(*factor):.2f}")
                backups.append(Backup(
                    organizacion=org, activo=activo, estado=estado, tipo=tipo, fecha=fecha, tamano_gb=tamano,
                    notas=rnd.choice([
                        "Falló por espacio insuficiente en el destino.",
                        "Se interrumpió por pérdida de conexión con el NAS.",
                        "Error de permisos en la carpeta de destino.",
                    ]) if estado == "fallido" else "",
                    registrado_por=rnd.choice(self.tecnicos),
                ))
        return backups

    # ---------- tickets e incidentes ----------

    def empresa_al_azar(self, dias_atras):
        pesos = {"premium": 3, "estandar": 2, "basico": 1}
        candidatas = [o for o in self.empresas if o.activa or dias_atras > 75]
        return self.rnd.choices(candidatas, [pesos[o.plan] for o in candidatas])[0]

    def crear_historial(self):
        rnd = self.rnd
        planes = []
        for _ in range(TOTAL_TICKETS):
            dias = (rnd.random() ** 1.5) * DIAS_TICKETS
            inicio = (self.ahora - timedelta(days=dias)).replace(hour=rnd.randint(7, 18), minute=rnd.randint(0, 59))
            if inicio > self.ahora:
                inicio = self.ahora - minutos(rnd.randint(5, 180))
            planes.append((inicio, "ticket", {"org": self.empresa_al_azar((self.ahora - inicio).days)}))

        recientes = sorted(rnd.uniform(0.06, 1.5) for _ in range(3))
        antiguos = [rnd.uniform(3, 175) for _ in range(TOTAL_INCIDENTES - 3)]
        for dias in antiguos + recientes:
            origen = self.ahora - timedelta(days=dias)
            planes.append((origen + minutos(rnd.randint(5, 45)), "incidente", {
                "origen": origen, "org": self.empresa_al_azar(int(dias)),
                "plantilla": rnd.choice(D.PLANTILLAS_INCIDENTE),
            }))

        # El estado de los incidentes depende de qué tan recientes son.
        incidentes = sorted((p for p in planes if p[1] == "incidente"), key=lambda p: p[0])
        estados = ["cerrado"] * (len(incidentes) - 4) + ["resuelto", "en_progreso", "abierto", "en_progreso"]
        for plan, estado in zip(incidentes, estados):
            plan[2]["estado"] = estado

        planes.sort(key=lambda p: (p[0], p[1]))
        tickets = 0
        pendientes = list(planes)
        while pendientes:
            fecha, tipo, datos = pendientes.pop(0)
            if tipo == "ticket":
                self.crear_ticket(fecha, datos)
                tickets += 1
            else:
                incidente, ligado = self.crear_incidente(fecha, datos)
                # El ticket del incidente entra en su lugar cronológico.
                pendientes.append((ligado["inicio"], "ticket", ligado))
                pendientes.sort(key=lambda p: (p[0], p[1]))
        return tickets, len(incidentes)

    def estado_por_antiguedad(self, dias):
        if dias < 1:
            opciones = (["abierto", "en_progreso"], [60, 40])
        elif dias < 5:
            opciones = (["abierto", "en_progreso", "resuelto"], [20, 40, 40])
        elif dias < 20:
            opciones = (["en_progreso", "resuelto", "cerrado"], [10, 30, 60])
        else:
            opciones = (["resuelto", "cerrado"], [5, 95])
        return self.rnd.choices(*opciones)[0]

    def evento(self, ticket, tipo, autor, fecha, texto="", anterior="", nuevo="", visible=False):
        self.eventos.append(EventoTicket(
            ticket=ticket, tipo=tipo, autor=autor, fecha=fecha, texto=texto,
            valor_anterior=anterior, valor_nuevo=nuevo, visible_cliente=visible,
        ))

    def crear_ticket(self, inicio, datos):
        rnd = self.rnd
        org = datos["org"]
        incidente = datos.get("incidente")
        clientes = self.clientes[org.id]
        disponibles = [a for a in self.activos[org.id] if not a.de_baja]

        if incidente:
            categoria = datos["categoria"]
            titulo, descripcion, solucion = datos["titulo"], datos["descripcion"], incidente.solucion
            alcance = rnd.choice(["varios_usuarios", "toda_empresa"])
            activo = datos["activo"]
            estado = {"abierto": "abierto", "en_progreso": "en_progreso"}.get(incidente.estado, incidente.estado)
            tecnico = incidente.tecnico
        else:
            categoria, titulo, descripcion, tipo_activo, solucion = rnd.choice(D.PLANTILLAS_TICKET)
            alcance = rnd.choices(["un_usuario", "varios_usuarios", "toda_empresa"], [50, 30, 20])[0]
            candidatos = [a for a in disponibles if a.tipo == tipo_activo] if tipo_activo else []
            activo = rnd.choice(candidatos) if candidatos else None
            dias = (self.ahora - inicio).days
            estado = "cerrado" if not org.activa else self.estado_por_antiguedad(dias)
            tecnico = rnd.choice(self.tecnicos) if estado != "abierto" or rnd.random() < 0.4 else None

        reportado = rnd.choice(clientes) if clientes and rnd.random() < 0.65 else rnd.choice(self.tecnicos)
        ticket = Ticket(
            organizacion=org, titulo=titulo, descripcion=descripcion, categoria=categoria, alcance=alcance,
            activo=activo, prioridad=calcular_prioridad(alcance, categoria, activo), estado=estado,
            tecnico=tecnico, reportado_por=reportado, creado_en=inicio, incidente=incidente,
        )
        limite = incidente.fecha_fin if incidente and incidente.fecha_fin else self.ahora
        ventana = limite - inicio
        momento = inicio
        pasos = []

        if tecnico:
            momento += min(ventana * 0.05, minutos(rnd.randint(10, 120)))
            pasos.append(("tecnico", tecnico, momento, "", "", nombre_usuario(tecnico)))
        if estado in ("en_progreso", "resuelto", "cerrado"):
            momento += min(ventana * 0.05, minutos(rnd.randint(5, 60)))
            pasos.append(("estado", tecnico, momento, "", "abierto", "en_progreso"))

        if incidente:
            ticket.solucion = solucion if estado in ("resuelto", "cerrado") else ""
            resuelto = incidente.fecha_fin
        else:
            ticket.solucion = solucion if estado in ("resuelto", "cerrado") else ""
            resuelto = momento + min(ventana * 0.4, timedelta(hours=rnd.randint(1, 48))) if ticket.solucion else None
        fin_conversacion = resuelto or self.ahora

        if rnd.random() < 0.05 and tecnico:
            nueva = rnd.choice([p for p in PRIORIDADES if p != ticket.prioridad])
            pasos.append(("prioridad", tecnico, self.entre(momento, fin_conversacion, 0.05, 0.2),
                          rnd.choice(D.MOTIVOS_PRIORIDAD), ticket.prioridad, nueva))
            ticket.prioridad, ticket.prioridad_manual = nueva, True

        for _ in range(1 if incidente else rnd.randint(0, 3)):
            fecha = self.entre(momento, fin_conversacion, 0.2, 0.9)
            tipo = rnd.choice(["cliente", "equipo", "interna"]) if clientes else rnd.choice(["equipo", "interna"])
            if tipo == "cliente":
                pasos.append(("comentario", rnd.choice(clientes), fecha, rnd.choice(D.COMENTARIOS_CLIENTE), "", "", True))
            elif tipo == "equipo":
                pasos.append(("comentario", tecnico or rnd.choice(self.tecnicos), fecha, rnd.choice(D.COMENTARIOS_EQUIPO), "", "", True))
            else:
                pasos.append(("comentario", tecnico or rnd.choice(self.tecnicos), fecha, rnd.choice(D.NOTAS_INTERNAS), "", "", False))

        if ticket.solucion:
            ticket.resuelto_en = resuelto
            texto = f"Resuelto por el incidente {incidente.codigo}." if incidente else ticket.solucion
            pasos.append(("estado", incidente.tecnico if incidente else tecnico, resuelto, texto, "en_progreso", "resuelto"))
        if estado == "cerrado":
            ticket.cerrado_en = resuelto + min((self.ahora - resuelto) * 0.5, timedelta(hours=rnd.randint(4, 72)))
            pasos.append(("estado", tecnico or rnd.choice(self.tecnicos), ticket.cerrado_en, "", "resuelto", "cerrado"))

        ticket.save()
        self.evento(ticket, "creacion", reportado, inicio)
        if incidente:
            vinculo = inicio + minutos(1)
            self.evento(ticket, "incidente", incidente.tecnico or reportado, vinculo, nuevo=incidente.codigo)
            self.acciones.append(AccionIncidente(
                incidente=incidente, tipo="ticket", autor=incidente.tecnico or reportado, fecha=vinculo,
                valor_nuevo=ticket.codigo,
            ))
        for paso in sorted(pasos, key=lambda p: p[2]):
            tipo, autor, fecha, texto, anterior, nuevo, *visible = paso
            self.evento(ticket, tipo, autor, fecha, texto, anterior, nuevo, visible[0] if visible else False)

    def crear_incidente(self, detectado, datos):
        rnd = self.rnd
        org, estado, origen = datos["org"], datos["estado"], datos["origen"]
        titulo, descripcion, impacto, tipo_activo, acciones, solucion, causa, ticket_titulo = datos["plantilla"]
        disponibles = [a for a in self.activos[org.id] if not a.de_baja and a.tipo == tipo_activo]
        if estado in ("abierto", "en_progreso"):
            # Un incidente en curso afecta equipos que ya están en problemas.
            en_problemas = [a for a in disponibles if a.estado != "operativo"]
            disponibles = en_problemas or disponibles
        activos = rnd.sample(disponibles, min(len(disponibles), rnd.randint(1, 2))) if disponibles else []

        tecnico = None if estado == "abierto" else rnd.choice(self.tecnicos)
        reportado = rnd.choice(self.tecnicos)
        ventana = self.ahora - detectado
        asignado = detectado + min(ventana * 0.05, minutos(rnd.randint(5, 30)))
        en_progreso = asignado + min(ventana * 0.05, minutos(rnd.randint(5, 30)))
        fin = cerrado = None
        if estado in ("resuelto", "cerrado"):
            fin = en_progreso + min(ventana * 0.4, minutos(rnd.randint(30, 600)))
        if estado == "cerrado":
            cerrado = fin + min((self.ahora - fin) * 0.5, timedelta(hours=rnd.randint(2, 48)))

        incidente = Incidente(
            organizacion=org, titulo=titulo, descripcion=descripcion, impacto=impacto,
            severidad=calcular_severidad(impacto, activos), estado=estado, tecnico=tecnico,
            reportado_por=reportado, fecha_origen=origen, creado_en=detectado,
            solucion=solucion if fin else "", causa_raiz=causa if cerrado else "",
            fecha_fin=fin, cerrado_en=cerrado,
        )
        incidente.save()
        incidente.activos.set(activos)

        def accion(tipo, autor, fecha, descripcion="", anterior=None, nuevo=None):
            self.acciones.append(AccionIncidente(
                incidente=incidente, tipo=tipo, autor=autor, fecha=fecha, descripcion=descripcion,
                valor_anterior=anterior, valor_nuevo=nuevo,
            ))

        accion("creacion", reportado, detectado, "Incidente registrado.")
        limite = fin or self.ahora
        if tecnico:
            accion("tecnico", reportado, asignado, nuevo=nombre_usuario(tecnico))
            accion("estado", tecnico, en_progreso, anterior="abierto", nuevo="en_progreso")
            pasos = acciones if fin else acciones[: rnd.randint(1, len(acciones))]
            for k, texto in enumerate(pasos):
                fecha = en_progreso + (limite - en_progreso) * ((k + 1) / (len(pasos) + 1))
                accion("accion", tecnico, fecha, texto)
        else:
            accion("accion", reportado, self.entre(detectado, self.ahora, 0.1, 0.3), "Se registró el reporte y se está asignando un técnico.")
        if fin:
            accion("estado", tecnico, fin, solucion, "en_progreso", "resuelto")
        if cerrado:
            accion("estado", tecnico, cerrado, causa, "resuelto", "cerrado")

        candidatos = [a for a in activos]
        ligado = {
            "org": org, "incidente": incidente, "titulo": ticket_titulo,
            "descripcion": f"Desde hace un rato: {descripcion[0].lower()}{descripcion[1:]}",
            "categoria": "red" if tipo_activo == "red" else "software",
            "activo": candidatos[0] if candidatos else None,
            "inicio": detectado + (limite - detectado) * rnd.uniform(0.05, 0.3),
        }
        return incidente, ligado
