# Módulo 05: Incidentes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestión de interrupciones del servicio (tiempos, activos, bitácora, causa raíz, severidad calculada y vínculo con tickets) para admin y técnico.

**Architecture:** Backend en `apps/incidents`: `ModelViewSet` con `@action` para `estado`, `severidad`, `acciones` y `tickets`; la severidad es una función pura y las operaciones con rastro viven en `servicios.py`. `apps/tickets` gana `Ticket.incidente` y la acción `escalar`. Frontend: modelo y servicio en `core/`, tres pantallas en `features/admin/incidentes/` y cambios en la ficha de ticket.

**Tech Stack:** Django 5.2, DRF, PostgreSQL 16; Angular 20 (standalone, signals, reactive forms), Bootstrap 5.3 con temas, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-08-modulo-05-incidentes-design.md`

## Global Constraints

- **Rama `sebas`:** verificar `git branch --show-current` antes de cada commit; si no es `sebas`, parar.
- Nombres de dominio en español sin tildes. Claves siempre presentes; textos opcionales vacíos como `null` (`VacioComoNullMixin`).
- Enumeraciones: `impacto` `degradado`, `parcial`, `total`; `severidad` `baja`, `media`, `alta`, `critica`; `estado` `abierto`, `en_progreso`, `resuelto`, `cerrado`; tipo de acción `creacion`, `accion`, `estado`, `tecnico`, `severidad`, `ticket`; `EventoTicket.tipo` agrega `incidente`.
- Permiso `EsAdminOTecnico` (`apps/assets/permissions.py`); cliente 403; sin token 401. Paginación `PaginacionEstandar`.
- Mensajes de error exactos de la spec §4, más estos, que la spec deja "en español" sin fijar:
  - `organizacion`: `Elige el cliente.`; `titulo`: `Escribe un título corto.`; `descripcion` del incidente: `Describe qué está pasando.`; `impacto`: `Indica el impacto.`; `fecha_origen` faltante o inválida: `Indica cuándo empezó el incidente.`; `ticket` faltante, inválido o inexistente: `Elige un ticket válido.`; `severidad`: `Elige una severidad válida.`; `estado` inválido: `Elige un estado válido.`; cuerpo que no es objeto JSON: `non_field_errors`, `El cuerpo de la petición no es válido.`
- Filtros numéricos con `isdecimal()`. Fechas de filtro con `fecha_param` de `apps/assets/views.py`.
- Frontend: solo variables de `styles.scss`; skill `impeccable` en tareas de UI (7–11); `api-design-principles` en tareas de API (2–5).
- Archivos grandes con la herramienta Write, no con heredocs de Bash.
- Comandos: backend `docker compose exec -T backend python manage.py test apps.incidents`; frontend (desde `frontend/`) `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless`.

## Review Focus

1. **Resolver un incidente con un ticket `abierto` sin técnico:** el ticket pasa a `resuelto` sin el error de técnico, por la ruta propia → prueba en Tarea 3.
2. **`PATCH` con los mismos `activos` en otro orden o repetidos, y con `activos: []`:** los primeros no recalculan ni dejan acción; el vacío recalcula solo con el impacto → prueba en Tarea 2.
3. **Filtros con fechas imposibles o dígitos Unicode** (`?desde=2026-13-45`, `?organizacion=²`): se ignoran, sin 500 → prueba en Tarea 5.
4. **Cuerpo que no es objeto o `ticket` no numérico** (`[1,2]`, `{"ticket":"abc"}`, `{"ticket":[1]}`): 400 con mensaje, sin 500 → prueba en Tareas 3 y 4.
5. **Escalar un ticket anterior al módulo 04 sin descripción:** el incidente toma el título como descripción → prueba en Tarea 4.

---

### Task 1: Modelos, severidad, migraciones, seed y dashboard

**Files:**
- Modify: `backend/apps/incidents/models.py`, `backend/apps/tickets/models.py`, `backend/apps/dashboard/views.py`, `backend/apps/dashboard/management/commands/seed_demo.py`
- Create: `backend/apps/incidents/severidad.py`; migraciones de `incidents` (esquema y datos) y `tickets`
- Test: `backend/apps/incidents/tests.py`

**Interfaces:**
- Produces: campos de spec §2; `Incidente.Impacto`; `AccionIncidente.Tipo`; `AccionIncidente.incidente` con `related_name="acciones"`; `Ticket.incidente` con `related_name="tickets"`; `EventoTicket.Tipo.INCIDENTE`.
- `calcular_severidad(impacto: str, activos: Iterable[Activo]) -> str`. `activos` puede estar vacío.
- `Incidente.duracion_minutos` (propiedad, `int | None`).
- `Incidente.fecha_origen` lleva `default=timezone.now` en el modelo: las pruebas de otras apps crean incidentes sin ella. La obligatoriedad se aplica en el serializer.

- [ ] **Step 1: Pruebas que fallan** (`CalcularSeveridadTests`, `ModeloIncidenteTests`, `MigracionIncidentesTests`, `SeedIncidentesTests`):
  - `calcular_severidad("degradado", []) == "baja"`; `("parcial", []) == "media"`; `("total", []) == "alta"`; `("total", [servidor_operativo]) == "critica"` (4); `("parcial", [servidor_critico]) == "critica"` (4); `("total", [servidor_critico]) == "critica"` (5); `("degradado", [red_critico]) == "media"` (2); dos servidores suman +1, no +2.
  - `test_codigo_automatico`: `i.codigo == f"INC-{i.pk:04d}"` y no cambia al guardar de nuevo.
  - `test_codigo_toma_siguiente_libre`: si otro incidente ya tiene el código del pk, el nuevo usa el siguiente número libre.
  - `test_codigo_explicito_se_conserva`.
  - `test_duracion_minutos`: origen 10:00, fin 11:30 → `90`; sin fin → `None`.
  - `test_migracion_datos`: con `MigrationExecutor`, un incidente `abierto` y uno `cerrado` con una acción quedan con `severidad_manual=True`, `impacto="parcial"`, `fecha_origen == creado_en`, `descripcion == titulo`; el cerrado con `fecha_fin` y `cerrado_en` iguales a la fecha de su acción; la acción con `tipo="accion"`; `codigo` sin cambios.
  - `test_seed`: 5 incidentes, 3 críticos activos, 1 crítico sin técnico; uno `resuelto` con `duracion_minutos` y solución; uno `cerrado` con `causa_raiz`; todos con `descripcion` y `severidad == calcular_severidad(impacto, activos)`.
  - En `apps/dashboard/tests.py`: `test_ultima_accion_ignora_automaticas`: una acción `accion` antigua y una `estado` reciente → `ultima_accion.descripcion` es la de tipo `accion`; con solo automáticas → `None`.
- [ ] **Step 2: Ver que fallan.**
- [ ] **Step 3: Implementar.** `codigo` igual que `Ticket.save()`, buscando desde el pk el primer `INC-{n:04d}` libre. `makemigrations` de ambas apps; migración de datos aparte en `incidents` con `RunPython` (reverso `noop`). `Ticket.incidente` depende de la migración de esquema de `incidents`, nunca al revés. Dashboard: `i.acciones.filter(tipo="accion").order_by("-fecha").first()`. Seed: sin códigos a mano; severidad con `calcular_severidad`, usando servidores del cliente (críticos = `total` + servidor; "Lentitud en el correo" pasa a `cerrado` con `causa_raiz`, para conservar 5 incidentes y 3 críticos activos; "Certificado vencido" sigue `resuelto`, `parcial` sin activos).
- [ ] **Step 4: `migrate` y todo el backend → OK.**
- [ ] **Step 5: Commit** — `feat(backend): modelo de incidentes, severidad y migraciones`

### Task 2: `/api/incidentes/`: permisos, crear y editar

**Files:**
- Create: `backend/apps/incidents/serializers.py`, `backend/apps/incidents/servicios.py`; reemplazar `backend/apps/incidents/views.py`
- Modify: `backend/config/urls.py`
- Test: `backend/apps/incidents/tests.py`

**Interfaces:**
- Consumes: Tarea 1; `VacioComoNullMixin`; `referencia`, `referencia_usuario`; `EsAdminOTecnico`; `PaginacionEstandar`; `nombre_usuario` de `apps.tickets.servicios`.
- Produces:
  - `registrar_accion(incidente, tipo, autor, descripcion="", anterior=None, nuevo=None) -> AccionIncidente`.
  - `recalcular_severidad(incidente, autor) -> None` (sin efecto si es manual; acción solo si cambia).
  - `MSG_CERRADO = "El incidente está cerrado. Reábrelo para modificarlo."`.
  - `validar_fecha_origen(valor, deteccion=None) -> datetime` (lanza `serializers.ValidationError`).
  - `AccionSerializer`, `IncidenteListaSerializer`, `IncidenteDetalleSerializer`.
  - `IncidenteViewSet` con `http_method_names = ["get", "post", "patch", "delete", "head", "options"]` y `_detalle(incidente)`. El DELETE sobre el recurso principal se define devolviendo 405, porque Tarea 4 agrega DELETE en la subruta. `router.register("incidentes", IncidenteViewSet, basename="incidente")`.

- [ ] **Step 1: Pruebas que fallan** (`PermisosIncidentesTests`, `CrearEditarIncidenteTests`):
  - Sin token 401; cliente 403 (GET, POST, PATCH); técnico y admin 201/200; PUT y DELETE 405; id inexistente 404.
  - `test_crear_calcula_severidad_y_deja_accion`: `total` + servidor → `critica`, `reportado_por` es el usuario, `codigo` presente, `fecha_deteccion` presente, acción `creacion`.
  - `test_campos_obligatorios_al_crear`: sin `organizacion`, `titulo`, `descripcion`, `impacto` o `fecha_origen` → 400 con los mensajes de Global Constraints. Título y descripción con solo espacios → su mensaje.
  - `test_no_se_envian_severidad_ni_estado`: POST con `severidad="baja"`, `estado="cerrado"`, `fecha_fin` los ignora.
  - `test_fecha_origen_futura`, `test_fecha_origen_posterior_a_deteccion` (PATCH), con sus mensajes.
  - `test_editar_impacto_recalcula_y_deja_accion`; `test_severidad_manual_no_se_recalcula`.
  - `test_cambiar_activos_recalcula`; `test_mismos_activos_no_recalcula` (otro orden y repetidos); `test_quitar_todos_los_activos_recalcula`. *(Review Focus 2)*
  - `test_activo_de_otro_cliente`, `test_activo_de_baja_al_agregar` con sus mensajes.
  - `test_editar_con_activo_ya_de_baja_es_valido`: enviar la misma lista da 200.
  - `test_cambiar_tecnico_deja_accion`; `test_patch_sin_cambios_no_crea_acciones`.
  - `test_desasignar_en_progreso_da_400`; `test_tecnico_invalido`; `test_no_se_cambia_organizacion`.
  - `test_incidente_cerrado_no_se_edita` → `non_field_errors`.
  - `test_detalle_trae_activos_tickets_y_acciones` con las formas de spec §4 y acciones en orden cronológico; `test_textos_vacios_como_null`.
- [ ] **Step 2: Ver que fallan.**
- [ ] **Step 3: Implementar.** `activos` como `PrimaryKeyRelatedField(many=True, required=False)`; deduplicar con `set`. Solo se validan los activos que se agregan. `create`/`update` atómicos. Recálculo solo si cambian `impacto` o el conjunto de ids de `activos`. `fecha_deteccion = DateTimeField(source="creado_en", read_only=True)`.
- [ ] **Step 4: `apps.incidents` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): endpoint de incidentes con severidad automática`

### Task 3: Estado, severidad, bitácora y resolución en cascada

**Files:**
- Modify: `backend/apps/incidents/servicios.py`, `backend/apps/incidents/views.py`
- Test: `backend/apps/incidents/tests.py`

**Interfaces:**
- Consumes: Tarea 2; `registrar_evento` de `apps.tickets.servicios`.
- Produces: `cambiar_estado(incidente, nuevo, solucion, causa_raiz, autor) -> Incidente`; `corregir_severidad(incidente, severidad, motivo, autor) -> Incidente`; `agregar_accion(incidente, descripcion, autor) -> AccionIncidente`; `_cuerpo(request) -> dict` en `views.py`, que lanza el 400 de cuerpo inválido.

- [ ] **Step 1: Pruebas que fallan** (`FlujoIncidenteTests`, `CorreccionSeveridadTests`, `BitacoraTests`, `CascadaTicketsTests`):
  - Permisos 401/403/200 (201 en acciones) de los tres endpoints.
  - Cada transición válida de spec §3 y las inválidas (`abierto`→`resuelto`, `abierto`→`cerrado`, `en_progreso`→`cerrado`, `cerrado`→`resuelto`) con `No se puede pasar de «X» a «Y».`. Estado inválido → su mensaje.
  - `test_en_progreso_exige_tecnico`; `test_resolver_exige_solucion` y con solo espacios; `test_cerrar_exige_causa_raiz` y con solo espacios.
  - `test_resolver_guarda_fecha_fin_y_duracion`; `test_cerrar_guarda_cerrado_en`.
  - `test_reabrir_vacia_campos`: `solucion`, `causa_raiz`, `fecha_fin`, `cerrado_en` vacíos, y la solución y la causa raíz siguen en `acciones`.
  - `test_cada_cambio_deja_accion` con `valor_anterior`, `valor_nuevo`, `autor`.
  - `test_corregir_severidad`: `severidad_manual=True`, acción con el motivo; motivo vacío o con espacios → su mensaje; severidad inválida → su mensaje.
  - `test_agregar_accion` 201 con `tipo="accion"` y autor; descripción vacía → `Describe la acción realizada.`.
  - `test_cerrado_no_admite_severidad_ni_acciones` → `non_field_errors`.
  - `test_resolver_resuelve_tickets_activos`: ticket `en_progreso` queda `resuelto`, con `solucion`, `resuelto_en` y `EventoTicket` tipo `estado`, texto `Resuelto por el incidente INC-XXXX.` y autor.
  - `test_resolver_ticket_sin_tecnico`. *(Review Focus 1)*
  - `test_resolver_no_toca_tickets_cerrados_ni_resueltos`; `test_reabrir_no_reabre_tickets`.
  - `test_cascada_atomica`: si guardar un ticket falla (`mock.patch`), el incidente sigue `en_progreso`.
  - `test_cuerpo_no_objeto_da_400` en `/estado/`, `/severidad/` y `/acciones/`. *(Review Focus 4)*
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** con `transaction.atomic`; la solución y la causa raíz se copian en `descripcion` de la acción `estado`. **Step 4: `apps.incidents` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): flujo de estados, bitácora y resolución de tickets`

### Task 4: Asociar tickets y escalar

**Files:**
- Modify: `backend/apps/incidents/servicios.py`, `backend/apps/incidents/views.py`, `backend/apps/incidents/serializers.py`, `backend/apps/tickets/views.py`, `backend/apps/tickets/serializers.py`
- Test: `backend/apps/incidents/tests.py`

**Interfaces:**
- Consumes: Tareas 1–3.
- Produces: `asociar_ticket(incidente, ticket_id, autor) -> Incidente`; `quitar_ticket(incidente, ticket_id, autor) -> Incidente`; `escalar_ticket(ticket, impacto, fecha_origen, autor) -> Incidente`; `EscalarSerializer`. La subruta DELETE: `@action(detail=True, methods=["delete"], url_path=r"tickets/(?P<ticket_id>[^/.]+)")`.

- [ ] **Step 1: Pruebas que fallan** (`AsociarTicketsTests`, `EscalarTests`):
  - Permisos 401/403/200 en `/tickets/`, `DELETE /tickets/{id}/` y 401/403/201 en `escalar`.
  - `test_asociar` deja `ticket.incidente`, acción `ticket` (`valor_nuevo` = código del ticket), evento `incidente` (`valor_nuevo` = código del incidente) y no cambia el estado del ticket.
  - `test_asociar_con_incidente_resuelto_se_permite`.
  - Errores con sus mensajes: otro cliente, ya asociado, ticket cerrado, incidente cerrado (`non_field_errors`).
  - `test_ticket_invalido`: `"abc"`, `[1]`, `null`, id inexistente, `{}` → `Elige un ticket válido.`. *(Review Focus 4)*
  - `test_quitar` vacía la relación, deja acción y evento con `valor_anterior`, y no cambia el estado.
  - `test_quitar_ticket_ajeno_da_404`; `test_quitar_con_incidente_cerrado` → `non_field_errors`.
  - `test_escalar_copia_datos`: cliente, título, descripción, técnico y activo; severidad calculada; `fecha_origen` e `impacto` enviados; 201 con detalle; ticket asociado; acción `creacion` y `ticket`; evento `incidente`.
  - `test_escalar_sin_descripcion_usa_titulo`. *(Review Focus 5)*
  - `test_escalar_no_copia_activo_de_baja_ni_tecnico_inactivo`.
  - `test_escalar_ticket_cerrado`, `test_escalar_ya_asociado` con sus mensajes; `test_escalar_valida_campos` (sin impacto; fecha futura).
  - `test_escalar_atomico`: si falla registrar el evento, no queda incidente.
  - `test_ticket_expone_incidente`: lista y detalle con `{id, codigo}` o `null`, sin N+1 en la lista (`assertNumQueries` igual con 1 y 3 tickets).
  - Las pruebas previas de tickets siguen pasando.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar.** `asociar_ticket` valida el id con `isinstance(ticket_id, (int, str))` y `str(ticket_id).isdecimal()`; rechaza `bool`. `select_related("incidente")` en `TicketViewSet`. **Step 4: `apps.incidents apps.tickets` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): asociar tickets a incidentes y escalar tickets`

### Task 5: Filtros, orden y contrato

**Files:**
- Modify: `backend/apps/incidents/views.py`, `docs/api-contract.md`, `docs/examples/ticket.json`
- Create: `docs/examples/incidente.json`
- Test: `backend/apps/incidents/tests.py`

**Interfaces:**
- Consumes: Tareas 2–4; `fecha_param`.

- [ ] **Step 1: Pruebas que fallan** (`ListaIncidentesTests`):
  - Forma exacta de la fila (spec §4), incluidos `total_activos` y `total_tickets`.
  - Un caso por filtro: `q` (código y título), `organizacion`, `activo`, `estado`, `severidad`, `impacto`, `abiertos=true`, `tecnico` (id y `sin_asignar`), `desde` y `hasta` inclusivos en hora de Colombia.
  - `test_filtro_activo_no_recorta_total_activos`: incidente con 3 activos filtrado por uno → `total_activos == 3`.
  - `test_valores_invalidos_se_ignoran`: `?desde=2026-13-45`, `?organizacion=²`, `?tecnico=²`, `?activo=abc`, `?severidad=x`, `?ordering=x` → 200 con todos. *(Review Focus 3)*
  - `test_orden_por_defecto`: críticos primero y, en empate, el más antiguo; `fecha_deteccion` y `-fecha_deteccion`.
  - `test_paginacion`: 20 y `page_size=100`; `test_lista_sin_n_mas_1` (`assertNumQueries` igual con 1 y 5 incidentes).
- [ ] **Step 2: Ver que fallan.**
- [ ] **Step 3: Implementar.** Anotar con `Count(..., distinct=True)` y filtrar `activo` con `pk__in` sobre `Incidente.activos.through`, para no recortar el conteo. Orden con `Case/When`. Escribir la sección "Incidentes" del contrato (todo lo de spec §4) y `incidente.json` a mano, verificando que sus claves coinciden con el detalle real.
- [ ] **Step 4: Todo el backend → OK.**
- [ ] **Step 5: Commit** — `feat(backend): filtros y orden de incidentes` y `docs: contrato de incidentes`

### Task 6: Frontend: modelo, servicio, permisos y rutas

**Files:**
- Create: `frontend/src/app/core/models/incidente.ts`, `frontend/src/app/core/services/incidentes.service.ts` (y `.spec.ts`)
- Modify: `core/auth/permisos.ts`, `core/layout/layout/layout.ts`, `shared/components/status-badge/status-badge.ts`, `core/models/ticket.ts`, `core/services/tickets.service.ts`
- Test: los `.spec.ts` correspondientes

**Interfaces:**
- Produces:
  - Tipos `ImpactoIncidente`, `SeveridadIncidente`, `EstadoIncidente`, `TipoAccion`; constantes `IMPACTOS`, `SEVERIDADES`, `ESTADOS_INCIDENTE` (`{valor, texto}[]`); interfaces `IncidenteResumido`, `Incidente`, `AccionIncidente`, `IncidenteEntrada`, `FiltrosIncidentes` (incluye `pageSize`).
  - `IncidentesService`: `listar(f)`, `obtener(id)`, `crear(d)`, `actualizar(id, d)`, `cambiarEstado(id, estado, extra?: {solucion?: string; causa_raiz?: string})`, `corregirSeveridad(id, severidad, motivo)`, `agregarAccion(id, descripcion): Observable<AccionIncidente>`, `asociarTicket(id, ticket)`, `quitarTicket(id, ticket)`.
  - `TicketsService.escalar(id, {impacto, fecha_origen}): Observable<Incidente>`; `FiltrosTickets.pageSize`; `TicketResumido.incidente: {id: number; codigo: string} | null`; `TipoEvento` agrega `'incidente'`.
  - Módulo `'incidentes'`.

- [ ] **Step 1: Pruebas que fallan:** cada método del servicio con URL (barra final), método y cuerpo; filtros omiten vacíos; `page_size` se envía; `puede()` para `incidentes` por rol; `StatusBadge` da tono `medio`, `alto` y `critico` a `degradado`, `parcial` y `total`; `Layout.enlaces` incluye Incidentes después de Tickets.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar.** Icono `bi-exclamation-octagon`. Las rutas se agregan en la tarea que crea cada componente, con `permisoGuard('incidentes', accion)` y `nuevo` antes de `:id`. **Step 4: frontend → PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): modelo, servicio y permisos de incidentes`

### Task 7: Lista de incidentes

**Files:**
- Create: `frontend/src/app/features/admin/incidentes/incidentes-lista/incidentes-lista.{ts,html,scss,spec.ts}`
- Modify: `app.routes.ts`

**Interfaces:**
- Consumes: Tarea 6; `TicketsService.tecnicos()`.
- Produces: clase `IncidentesLista`.

- [ ] **Step 1: Pruebas que fallan** (patrón de `tickets-lista.spec.ts`): por defecto pide `abiertos=true`; `?organizacion=` preselecciona el filtro; cada filtro recarga en página 1 y cancela la petición anterior; duración: `null` y activo → "En curso"; `90` → "1 h 30 min"; `45` → "45 min"; estados de carga, error con "Reintentar" y vacío; fila enlaza a la ficha; "Nuevo incidente" conserva el cliente filtrado.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** basándose en `tickets-lista`, cargando la skill `impeccable`. **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): lista de incidentes`

### Task 8: Formulario de incidente

**Files:**
- Create: `frontend/src/app/features/admin/incidentes/incidente-form/incidente-form.{ts,html,scss,spec.ts}`
- Modify: `app.routes.ts`

**Interfaces:**
- Consumes: Tarea 6; `ActivosService.listar`; `OrganizacionesService.listar`.
- Produces: clase `IncidenteForm`.

- [ ] **Step 1: Pruebas que fallan** (patrón de `ticket-form.spec.ts`, escribiendo en el DOM real):
  - Crear envía los campos con `activos` como números y `fecha_origen` en ISO; navega a la ficha con `guardado=1`.
  - Obligatorios con sus mensajes; `fecha_origen` futura se marca en el navegador con `La fecha de origen no puede ser futura.`.
  - Cambiar de cliente vacía los activos marcados y recarga la lista.
  - `?organizacion=` solo preselecciona un cliente listado.
  - Editar: cliente fijo y no enviado; casillas marcadas; incluye un activo vinculado que ya no aparece en la lista (dado de baja).
  - `test_editar_sin_tocar_fecha_no_la_envia`: `fecha_origen` solo va en el PATCH si el control está `dirty`, para no perder los segundos.
  - Errores 400 van al campo; 404 y error de carga muestran su estado.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** basándose en `ticket-form` y en `aLocal` de `backup-form`, con la skill `impeccable`. **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): formulario de incidente`

### Task 9: Ficha de incidente

**Files:**
- Create: `frontend/src/app/features/admin/incidentes/incidente-ficha/incidente-ficha.{ts,html,scss,spec.ts}`
- Modify: `app.routes.ts`

**Interfaces:**
- Consumes: Tarea 6; `TicketsService.listar` y `tecnicos()`.
- Produces: clase `IncidenteFicha`.

- [ ] **Step 1: Pruebas que fallan** (patrón de `ticket-ficha.spec.ts`):
  - Botones por estado: `abierto` Tomar (sin técnico) e Iniciar; `en_progreso` Resolver y Devolver a abierto; `resuelto` Cerrar y Reabrir; `cerrado` solo Reabrir.
  - Resolver: exige solución, muestra "2 tickets asociados pasarán a resuelto" contando solo los activos, sin aviso si son 0.
  - Cerrar exige causa raíz. Reabrir pide confirmación en la misma página antes de enviar.
  - Corregir severidad exige motivo.
  - Bloque de tiempos con duración o "En curso".
  - Bitácora: agrega la acción a la línea de tiempo sin recargar y limpia el campo; `descripcionAccion()` da una frase para cada `tipo`.
  - Tickets: el selector pide `organizacion`, `abiertos=true`, `page_size=100` y excluye los que tienen incidente; quitar llama a `quitarTicket`.
  - Cerrado: controles deshabilitados menos Reabrir. 400 muestra el mensaje; 404, error y carga con su estado.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** basándose en `ticket-ficha` (`ocupado`, `ejecutar`, `fallo`, `opcionesTecnico`, `viewChild` del selector), con la skill `impeccable`. **Step 4: PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): ficha de incidente`

### Task 10: Ficha de ticket, dashboard y ficha de cliente

**Files:**
- Modify: `features/admin/tickets/ticket-ficha/ticket-ficha.{ts,html,scss,spec.ts}`, `features/admin/dashboard/admin-dashboard/admin-dashboard.{html,spec.ts}`, `features/admin/clientes/cliente-ficha/cliente-ficha.{html,spec.ts}`

**Interfaces:**
- Consumes: Tarea 6.

- [ ] **Step 1: Pruebas que fallan:**
  - Con incidente: aviso "Parte del incidente INC-0003" con enlace; sin botones de escalar ni asociar.
  - Sin incidente y no cerrado: ambas opciones. Cerrado: ninguna.
  - Escalar: exige impacto y fecha, envía `fecha_origen` en ISO y navega a `/admin/incidentes/:id`.
  - Asociar: el selector pide `organizacion` y `abiertos=true`; tras asociar, la ficha muestra el aviso sin el spinner de carga.
  - `descripcionEvento` para `incidente`: "asoció al incidente X", "quitó del incidente X".
  - Dashboard: el código enlaza a `/admin/incidentes/:id`. Ficha de cliente: enlace a `/admin/incidentes?organizacion=7` en la tarjeta Incidentes activos.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** con `.enlace-tarjeta` y la skill `impeccable`. **Step 4: frontend → PASS y `npx ng build` → OK.**
- [ ] **Step 5: Commit** — `feat(frontend): escalar y asociar tickets, enlaces a incidentes`

### Task 11: Verificación visual y documentación

**Files:**
- Modify: `CLAUDE.md`; correcciones visuales que resulten

- [ ] **Step 1:** Levantar con `migrate` y datos de `seed_demo` en una base de prueba o la local existente. Capturas de lista, formulario, ficha (abierto, resuelto y cerrado) y ficha de ticket en tema oscuro, claro y móvil 375 px. Comprobar flujo real: crear, tomar, resolver con ticket asociado, cerrar, reabrir y escalar.
- [ ] **Step 2:** `frontend/.claude/skills/impeccable/scripts/impeccable detect --json` sobre los archivos nuevos. Corregir lo que aplique.
- [ ] **Step 3:** Actualizar `CLAUDE.md` (estado del módulo, modelos, endpoints, reglas, pantallas, permisos, número de pruebas).
- [ ] **Step 4:** Backend y frontend completos → OK; `ng build` → OK.
- [ ] **Step 5: Commit** — `docs: CLAUDE.md con el módulo 05`
