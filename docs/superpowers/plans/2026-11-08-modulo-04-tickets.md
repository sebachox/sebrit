# Módulo 04: Tickets y soporte — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestión de tickets de soporte (crear, asignar, comentar, flujo de estados) con prioridad calculada por puntos y línea de tiempo, para admin y técnico.

**Architecture:** Backend en `apps/tickets`: un `ModelViewSet` con `@action` para `estado`, `prioridad` y `comentarios`; la regla de prioridad es una función pura (`prioridad.py`) y las operaciones que dejan eventos viven en `servicios.py`. Frontend: modelo y servicio en `core/`, tres pantallas en `features/admin/tickets/`.

**Tech Stack:** Django 5.2, DRF, PostgreSQL 16; Angular 20 (standalone, signals, reactive forms), Bootstrap 5.3 con temas, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-08-modulo-04-tickets-design.md`

## Global Constraints

- **Rama `sebas`:** verificar `git branch --show-current` antes de cada commit; si no es `sebas`, parar.
- Nombres de dominio en español sin tildes.
- Enumeraciones: `categoria` `hardware`, `software`, `red`, `seguridad`, `accesos`, `otro`; `alcance` `un_usuario`, `varios_usuarios`, `toda_empresa`; `prioridad` `baja`, `media`, `alta`, `critica`; `estado` `abierto`, `en_progreso`, `resuelto`, `cerrado`; tipo de evento `creacion`, `comentario`, `estado`, `tecnico`, `prioridad`.
- Claves siempre presentes; opcionales vacíos como `null`.
- Permiso `EsAdminOTecnico` de `apps/assets/permissions.py`; cliente 403; sin token 401.
- Paginación `PaginacionEstandar` (20, máximo 100).
- Mensajes de error exactos de la spec §3, más el de Review Focus 2.
- Filtros numéricos con `isdecimal()`, no `isdigit()`.
- Frontend: solo variables de `styles.scss`; skill `impeccable` en tareas de UI (6–9); `api-design-principles` en tareas de API (2–4).
- Archivos grandes con la herramienta Write, no con heredocs de Bash.
- Comandos: backend `docker compose exec -T backend python manage.py test apps.tickets`; frontend (desde `frontend/`) `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless`.

## Review Focus

1. **Quitar el activo de un ticket** (`PATCH {"activo": null}`): la prioridad se recalcula sin los puntos del activo y deja evento → prueba en Tarea 2.
2. **Desasignar el técnico de un ticket en progreso** (`PATCH {"tecnico": null}`): 400 en `tecnico`, `Un ticket en progreso debe tener un técnico asignado.` → prueba en Tarea 2.
3. **Editar un ticket cuyo activo se dio de baja después** (`PATCH {"titulo": "x"}`, activo sin cambios): 200; el 400 de activo dado de baja solo aplica si el activo cambia → prueba en Tarea 2.
4. **Solución, motivo o comentario con solo espacios:** 400 con su mensaje → prueba en Tarea 3.
5. **Filtro con dígitos Unicode** (`?tecnico=²`, `?organizacion=²`): se ignora, sin error 500 → prueba en Tarea 4.

---

### Task 1: Modelos, regla de prioridad, migraciones y seed

**Files:**
- Modify: `backend/apps/tickets/models.py`, `backend/apps/tickets/admin.py` (listas y filtros), `backend/apps/dashboard/management/commands/seed_demo.py`
- Create: `backend/apps/tickets/prioridad.py`; migraciones de `tickets` (esquema y datos)
- Test: `backend/apps/tickets/tests.py`

**Interfaces:**
- Produces: `Ticket` (`Categoria`, `Alcance`, `Prioridad`, `Estado` como `TextChoices`) con los campos de spec §2; `EventoTicket` (`Tipo`). `calcular_prioridad(alcance: str, categoria: str, activo: Activo | None) -> str`.
- `codigo = CharField(20, unique=True, null=True, editable=False)`: `Ticket.save()` lo asigna tras el primer insert con `TCK-{pk:04d}`.

- [ ] **Step 1: Pruebas que fallan** (`CalcularPrioridadTests`, `ModeloTicketTests`):
  - `calcular_prioridad("un_usuario","otro",None) == "baja"`; `("varios_usuarios","software",None) == "media"`; `("toda_empresa","software",None) == "alta"`; `("varios_usuarios","red",None) == "alta"` (3); `("toda_empresa","red",None) == "alta"` (4).
  - Con servidor crítico y `toda_empresa`/`software` → `"critica"` (5); con servidor crítico, `toda_empresa`/`seguridad` → `"critica"` (6); con activo `red` en `operativo`, `un_usuario`/`otro` → `"baja"`.
  - `test_codigo_automatico`: `t.codigo == f"TCK-{t.pk:04d}"` y no cambia al guardar de nuevo.
  - `test_migracion_asigna_codigo`: con `MigrationExecutor`, un ticket creado antes de la migración de datos queda con código, `alcance="un_usuario"`, `categoria="otro"`, `prioridad="baja"`.
  - `test_seed_crea_tickets_con_datos`: tras `seed_demo`, ningún ticket sin `codigo` ni `descripcion`, y hay más de un valor distinto de `prioridad`.
  - `test_dashboard_tickets_abiertos_no_cambia`: 1 `abierto` + 1 `en_progreso` + 1 `cerrado` → `tickets_abiertos == 2`.
- [ ] **Step 2: Ver que fallan.**
- [ ] **Step 3: Implementar** modelos y `prioridad.py` con la tabla de puntos de la spec; `makemigrations tickets --noinput` y una migración de datos aparte que asigne `codigo` con `RunPython` (reverso `noop`). El seed da a sus tickets descripción, categoría y alcance variados, y prioridad con `calcular_prioridad`.
- [ ] **Step 4: `migrate` y todo el backend → OK.**
- [ ] **Step 5: Commit** — `feat(backend): modelo de tickets, eventos y regla de prioridad`

### Task 2: `/api/tickets/`: permisos, crear, editar y `/api/tecnicos/`

**Files:**
- Create: `backend/apps/tickets/serializers.py`, `views.py`, `servicios.py`
- Modify: `backend/config/urls.py`, `backend/apps/accounts/views.py` (`TecnicosView`)
- Test: `backend/apps/tickets/tests.py`

**Interfaces:**
- Consumes: Tarea 1; `VacioComoNullMixin`; `referencia`, `referencia_usuario` de `apps.assets.serializers`; `EsAdminOTecnico`; `PaginacionEstandar`.
- Produces:
  - `registrar_evento(ticket, tipo, autor, texto="", anterior="", nuevo="") -> EventoTicket` en `servicios.py`.
  - `TicketListaSerializer`, `TicketDetalleSerializer`, `EventoSerializer`.
  - `TicketViewSet` con `http_method_names = ["get", "post", "patch", "head", "options"]`; `router.register("tickets", TicketViewSet, basename="ticket")`.
  - `GET /api/tecnicos/` con `permission_classes = [EsAdminOTecnico]`.

- [ ] **Step 1: Pruebas que fallan** (`PermisosTicketsTests`, `CrearEditarTicketTests`):
  - Sin token 401; cliente 403 (GET, POST, PATCH y `/api/tecnicos/`); técnico y admin 201/200; PUT y DELETE 405; id inexistente 404. `/api/tecnicos/` devuelve activos con rol admin/técnico, excluye cliente e inactivos.
  - `test_crear_calcula_prioridad_y_deja_evento`: `toda_empresa`/`red` → `prioridad == "alta"`, `reportado_por` es el usuario, `codigo` presente, un evento `creacion`.
  - `test_campos_obligatorios_al_crear`: sin `descripcion`, `categoria` o `alcance` → 400.
  - `test_no_se_envian_prioridad_ni_estado`: POST con `prioridad="critica"`, `estado="cerrado"` los ignora.
  - `test_editar_alcance_recalcula_y_deja_evento`; `test_prioridad_manual_no_se_recalcula`.
  - `test_quitar_activo_recalcula`. *(Review Focus 1)*
  - `test_cambiar_tecnico_deja_evento` (con nombres en `valor_anterior`/`valor_nuevo`); `test_patch_sin_cambios_no_crea_eventos`.
  - `test_desasignar_en_progreso_da_400` con el mensaje de Review Focus 2. *(Review Focus 2)*
  - `test_activo_de_otro_cliente`, `test_activo_de_baja_al_asignar` con sus mensajes.
  - `test_editar_con_activo_ya_de_baja_es_valido`. *(Review Focus 3)*
  - `test_tecnico_invalido` (rol cliente e inactivo); `test_no_se_cambia_organizacion`.
  - `test_ticket_cerrado_no_se_edita` → `non_field_errors`.
  - `test_detalle_trae_eventos_cronologicos`; `test_opcionales_vacios_como_null`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** (`transaction.atomic` en create/update; recálculo solo si cambian `alcance`, `categoria` o `activo` y `prioridad_manual` es `False`; evento `prioridad` solo si el valor cambia). **Step 4: `apps.tickets` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): endpoint de tickets con prioridad automática y eventos`

### Task 3: Acciones de estado, prioridad y comentarios

**Files:** Modify `backend/apps/tickets/servicios.py`, `views.py`; Test `backend/apps/tickets/tests.py`.

**Interfaces:**
- Produces en `servicios.py` (lanzan `serializers.ValidationError` con el campo de la spec):
  - `cambiar_estado(ticket, nuevo: str, solucion: str, autor) -> Ticket`
  - `corregir_prioridad(ticket, prioridad: str, motivo: str, autor) -> Ticket`
  - `comentar(ticket, texto: str, autor) -> EventoTicket`
  - `TRANSICIONES` como mapa `{origen: {destinos}}` según spec §2.

- [ ] **Step 1: Pruebas que fallan** (`FlujoEstadosTests`, `CorregirPrioridadTests`, `ComentariosTests`):
  - Cada transición válida da 200 y evento `estado` con `valor_anterior`/`valor_nuevo`; `abierto→resuelto`, `abierto→cerrado`, `en_progreso→cerrado` → 400 `No se puede pasar de «Abierto» a «Resuelto».` (nombres legibles).
  - `test_empezar_sin_tecnico` → `Asigna un técnico antes de pasar a En progreso.`
  - `test_resolver_sin_solucion` y `test_resolver_solucion_con_espacios` → `Describe la solución para resolver el ticket.` *(Review Focus 4)*
  - `test_resolver_guarda_solucion_y_resuelto_en`; `test_cerrar_guarda_cerrado_en`.
  - `test_reabrir_vacia_campos_y_conserva_solucion_en_evento`.
  - `test_corregir_marca_manual_y_deja_evento`; `test_corregir_sin_motivo` y con espacios → `Explica por qué cambias la prioridad.` *(Review Focus 4)*; `test_prioridad_invalida` → 400.
  - `test_comentar_responde_201_y_crea_evento_con_autor`; `test_comentario_vacio` y con espacios → `Escribe el comentario.` *(Review Focus 4)*
  - `test_ticket_cerrado_no_comenta_ni_corrige` → `El ticket está cerrado. Reábrelo para modificarlo.`
  - Permisos: cliente 403 y sin token 401 en las tres acciones.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: `apps.tickets` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): flujo de estados, corrección de prioridad y comentarios`

### Task 4: Lista: filtros, orden y contrato

**Files:** Modify `backend/apps/tickets/views.py`, `docs/api-contract.md`; Create `docs/examples/ticket.json` (con el serializer real, en transacción revertida; cuidar la codificación UTF-8); Test `backend/apps/tickets/tests.py`.

**Interfaces:** Produces `ORDENES_TICKETS`: `prioridad` = `Case(critica=0, alta=1, media=2, baja=3)` seguido de `creado_en`, `id`.

- [ ] **Step 1: Pruebas que fallan** (`ListaTicketsTests`):
  - `test_orden_por_defecto_critica_primero_y_antiguos_primero`; `test_orden_recientes` (`-creado_en`).
  - Filtros `q` (código y título, sin mayúsculas), `organizacion`, `activo`, `estado`, `prioridad`, `categoria`.
  - `test_abiertos_true` (solo `abierto` y `en_progreso`); `test_tecnico_id` y `test_tecnico_sin_asignar`.
  - `test_filtros_invalidos_se_ignoran` con `?estado=raro`, `?tecnico=abc`, `?tecnico=²`, `?organizacion=²`, `?q=%20`. *(Review Focus 5)*
  - `test_lista_trae_solo_campos_resumidos`.
  - `test_lista_sin_n_mas_1`: mismo número de consultas con 1 y con 10 tickets.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: Todo el backend → OK.**
- [ ] **Step 5: Documentar** la sección "Tickets" (permisos, lista, detalle, acciones, regla de prioridad, flujo y errores, incluido el mensaje de Review Focus 2) y el ejemplo.
- [ ] **Step 6: Commit** — `feat(backend): filtros y orden de tickets; docs del contrato`

### Task 5: Frontend: modelo, servicio, permisos y sidebar

**Files:** Create `frontend/src/app/core/models/ticket.ts`, `core/services/tickets.service.ts` (+ spec); Modify `core/auth/permisos.ts` (+ spec), `core/layout/layout/layout.ts`.

**Interfaces:**
- Produces:
  - Tipos `CategoriaTicket`, `AlcanceTicket`, `PrioridadTicket`, `EstadoTicket`, `TipoEvento`; constantes `CATEGORIAS`, `ALCANCES`, `PRIORIDADES`, `ESTADOS_TICKET` como `{ valor, texto }[]`.
  - `TicketResumido`, `EventoTicket`, `Ticket`, `TicketEntrada`, `FiltrosTickets { q?; organizacion?; activo?; estado?; abiertos?: boolean; prioridad?; categoria?; tecnico?: number | 'sin_asignar' | null; ordering?; page? }`.
  - `TicketsService`: `listar(f)`, `obtener(id)`, `crear(d)`, `actualizar(id, d)`, `cambiarEstado(id, estado, solucion?)`, `corregirPrioridad(id, prioridad, motivo)`, `comentar(id, texto)`, `tecnicos(): Observable<Referencia[]>`.
  - `Modulo` agrega `'tickets'`; enlace "Tickets" (`/admin/tickets`, `bi-ticket-perforated`).

- [ ] **Step 1: Pruebas que fallan:** permisos (admin y técnico ven y editan; cliente no); `listar` envía `abiertos=true`, `tecnico=sin_asignar`, `ordering`; omite vacíos; `cambiarEstado(3,'resuelto','x')` → `POST /tickets/3/estado/` con `{estado, solucion}`; `corregirPrioridad` → `POST /tickets/3/prioridad/`; `comentar` → `POST /tickets/3/comentarios/`; `tecnicos()` → `GET /tecnicos/`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: Suite → PASS. Step 5: Commit** — `feat(frontend): modelo, servicio y permisos de tickets`

### Task 6: Lista de tickets

**Files:** Create `frontend/src/app/features/admin/tickets/tickets-lista/*`; Modify `app.routes.ts` (`admin/tickets`, `permisoGuard('tickets','ver')`).

**Interfaces:** Consumes `TicketsService.listar/tecnicos`, `OrganizacionesService.listar({pageSize:100})`. Produces `TicketsLista`; el filtro de estado por defecto envía `abiertos=true`; lee `?organizacion=`.

- [ ] **Step 1: Pruebas que fallan:** por defecto pide `abiertos=true` y orden `prioridad` (sin parámetro `ordering`); elegir "Todos" quita `abiertos`; elegir `resuelto` envía `estado=resuelto` sin `abiertos`; `?organizacion=4` filtra y selecciona; un cliente inactivo sale "(inactivo)"; "Sin asignar" envía `tecnico=sin_asignar`; tabla con prioridad, estado y "Sin asignar"; marca visible si `prioridad_manual`; vacío ("Aún no hay tickets abiertos") vs. búsqueda ("No hay tickets que coincidan con «…»"); error con "Reintentar"; búsqueda nueva cancela la anterior.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable` (patrón de `activos-lista`), suite PASS. **Step 5: Commit** — `feat(frontend): lista de tickets con filtros`

### Task 7: Ficha del ticket

**Files:** Create `frontend/src/app/features/admin/tickets/ticket-ficha/*`; Modify `app.routes.ts` (`admin/tickets/:id`).

**Interfaces:** Consumes `TicketsService`, `AuthService.usuario`, `StatusBadge`. Produces `TicketFicha`.

- [ ] **Step 1: Pruebas que fallan:**
  - Botones por estado según la tabla de la spec; "Empezar" deshabilitado sin técnico con "Asigna un técnico primero".
  - "Empezar" envía `POST /estado/` y actualiza el badge.
  - "Resolver" abre el campo; sin texto no envía; con texto envía `{estado:'resuelto', solucion}`.
  - "Tomarlo yo" envía `PATCH {tecnico: <id de sesión>}`; el selector de técnico envía `PATCH` con el id elegido (escribiendo en el DOM, con `change`).
  - "Corregir": sin motivo no envía; con motivo envía `POST /prioridad/` y muestra "Corregida a mano".
  - Comentar envía y el evento aparece en la línea de tiempo.
  - Un 400 de una acción muestra el mensaje del servidor.
  - Cerrado: aviso visible; todo deshabilitado salvo "Reabrir".
  - Línea de tiempo muestra autor, y `null` como "Sistema"; datos `null` como "—"; 404 → "Ticket no encontrado"; `?guardado=1` → mensaje.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable`, suite PASS. **Step 5: Commit** — `feat(frontend): ficha del ticket con flujo, prioridad y línea de tiempo`

### Task 8: Formulario de ticket

**Files:** Create `frontend/src/app/features/admin/tickets/ticket-form/*`; Modify `app.routes.ts` (`admin/tickets/nuevo` antes de `:id`, y `admin/tickets/:id/editar`, con `permisoGuard('tickets','editar')`), `core/models/activo.ts` y `core/services/activos.service.ts` (`pageSize?` → `page_size`).

**Interfaces:** Consumes `TicketsService.crear/actualizar/obtener/tecnicos`, `ActivosService.listar({organizacion, pageSize:100})`, `OrganizacionesService.listar`. Produces `TicketForm`; acepta `?organizacion=` y `?activo=` al crear; al guardar navega a `/admin/tickets/<id>?guardado=1`.

- [ ] **Step 1: Pruebas que fallan:** requeridos (cliente, título, descripción, categoría, alcance); cambiar de cliente en el `<select>` (DOM, `change`) recarga activos y limpia el activo elegido; envía ids numéricos y `null` cuando no hay activo o técnico; en edición no envía `organizacion` y hace `PATCH`; error 400 en `activo` aparece bajo su campo; doble envío → una petición; muestra la nota de prioridad automática.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable`, suite PASS. **Step 5: Commit** — `feat(frontend): formulario de ticket`

### Task 9: Enlace desde la ficha de cliente, verificación final y CLAUDE.md

**Files:** Modify `frontend/src/app/features/admin/clientes/cliente-ficha/cliente-ficha.html` (+ spec); `CLAUDE.md`.

- [ ] **Step 1: Prueba que falla:** la tarjeta "Tickets abiertos" enlaza a `/admin/tickets?organizacion=<id>`. **Step 2–4:** ver fallar, implementar (mismo `.enlace-tarjeta`), suite PASS.
- [ ] **Step 5:** cargar `superpowers:verification-before-completion`; suites completas backend y frontend; `npx ng build`.
- [ ] **Step 6:** capturas (script CDP) de lista, ficha y formulario, oscuro y claro, 1440 px y 390 px, como admin y técnico (usuario temporal que se borra al final); corregir en una pasada.
- [ ] **Step 7:** detector `impeccable detect --json` sobre los archivos nuevos → `[]` o resuelto.
- [ ] **Step 8:** actualizar `CLAUDE.md` (módulo 04, modelos, endpoints, regla de prioridad, flujo, permisos, pruebas, estructura).
- [ ] **Step 9: Commits** — `feat(frontend): enlace a tickets desde la ficha de cliente` y `docs: CLAUDE.md con el módulo 04`.
