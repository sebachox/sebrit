# Vista del cliente: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal donde un usuario `cliente` ve el resumen de su empresa y abre, sigue y comenta sus tickets, aislado por organización.

**Architecture:** App Django nueva `apps.portal`, sin modelos, con API propia bajo `/api/portal/` y serializers de lista blanca; toda consulta parte de `request.user.organizacion`. Rutas Angular `/portal/...` con `PortalLayout` propio. El panel interno gana comentarios visibles al cliente y gestión de usuarios de la empresa.

**Tech Stack:** Django 5.2, DRF, SimpleJWT, PostgreSQL 16; Angular 20 standalone con signals, Bootstrap 5.3, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-08-vista-cliente-design.md`

## Global Constraints

- Rama `sebas`; verificar antes de cada commit. Commits con prefijo y línea final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nombres de dominio y claves JSON en español, sin tildes, `snake_case`. Claves siempre presentes; `null` sin valor; listas vacías `[]`.
- `LANGUAGE_CODE` es `en-us`: todo mensaje de error debe ser explícito y en español (`errores(mensaje)` de `apps/incidents/serializers.py`; `cuerpo(request)` de `apps/incidents/views.py` para cuerpos que no son objeto).
- Ningún endpoint del portal acepta un id de organización.
- Nunca exponer al cliente `prioridad`, `prioridad_manual`, `incidente`, eventos `tecnico`, `prioridad`, `incidente` ni notas internas.
- Frontend: nunca colores fijos; variables de `styles.scss`; solo Bootstrap Icons; estados de carga, error con "Reintentar" y vacío. Cargar la skill `impeccable` antes de tocar UI.
- Backend: `MSYS_NO_PATHCONV=1 docker compose exec -T backend python manage.py test <etiqueta>`.
- Frontend: desde `frontend/`, `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless`.

## Review Focus

1. Ids no numéricos o de miles de dígitos en `/api/portal/tickets/{id}/` deben dar 404, no 500 (Tarea 3).
2. `q` con NUL, `page_size`, `page` o `estado` inválidos no deben dar 500 (Tarea 3).
3. Empresa desactivada o usuario movido de empresa con un token vigente: el efecto es inmediato, porque el permiso lee la base (Tarea 2).
4. Evento cuyo autor fue borrado y evento de resolución en cascada desde un incidente: se muestran sin 500 y sin revelar el incidente (Tarea 3).
5. Si falla la carga de activos al abrir un ticket, el formulario sigue siendo usable sin ese campo (Tarea 8).

---

### Tarea 1: Comentarios visibles al cliente en el backend

**Files:** Modify `backend/apps/tickets/models.py`, `servicios.py`, `serializers.py`, `views.py`, `tests.py`, `backend/apps/incidents/serializers.py` solo si importa; Create migración `tickets/0006_*`.

**Interfaces:** Produces `EventoTicket.visible_cliente: bool`; `comentar(ticket, texto, autor, visible_cliente=False)`; `autor_es_cliente(evento) -> bool` en `apps/tickets/servicios.py`.

- [ ] **Paso 1: Pruebas** en `tests.py`, clase `ComentariosVisiblesTests`: `test_por_defecto_es_interno` (POST sin el campo → `visible_cliente` False), `test_se_puede_marcar_visible` (True → True en respuesta y base), `test_valor_no_booleano_da_400` (`"si"`, `1`, `[]` → 400 en `visible_cliente` con "Indica si el comentario es visible para el cliente."), `test_detalle_expone_visible_y_autor_es_cliente`, `test_autor_nulo_no_es_cliente`.
- [ ] **Paso 2:** Correr `apps.tickets`. Esperado: fallan las nuevas.
- [ ] **Paso 3:** Campo con `default=False`, `makemigrations tickets`, revisar que solo agrega la columna. `views.comentarios` valida `isinstance(valor, bool)` cuando viene el campo. `EventoSerializer` agrega ambas claves.
- [ ] **Paso 4:** Correr `apps.tickets`. Esperado: OK. Corregir el conjunto de claves si alguna prueba las compara.
- [ ] **Paso 5:** `git commit` `feat(backend): comentarios visibles para el cliente`.

### Tarea 2: App portal, permiso, resumen y activos

**Files:** Create `backend/apps/portal/{__init__,apps,permissions,views,serializers,tests}.py`; Modify `backend/config/settings.py` (`apps.portal`), `backend/config/urls.py`.

**Interfaces:** Produces `EsClienteDelPortal`; clase de pruebas `BasePortal` con `org_a`, `org_b` (activas), `cliente_a`, `cliente_b`, `tecnico`, `admin`, helper `entrar(usuario)`. `conteo_activos` del dashboard recibe un queryset o se escribe una variante filtrada sin cambiar su resultado.

- [ ] **Paso 1: Pruebas** `PermisoPortalTests` sobre `/api/portal/resumen/` y `/api/portal/activos/`: sin token 401; admin 403; técnico 403; cliente sin organización 403; cliente con empresa inactiva 403; cliente 200. `test_desactivar_empresa_tiene_efecto_inmediato` y `test_mover_de_empresa_tiene_efecto_inmediato` (misma sesión, cambia la base, cambia la respuesta).
- [ ] **Paso 2: Pruebas** `ResumenTests`: claves exactas `{"generado_en","empresa","tickets","incidentes_activos","infraestructura"}`; `tickets` con `{"abiertos","en_progreso","resueltos"}` sin contar cerrados; infraestructura sin dados de baja; datos de `org_b` no cuentan. `ActivosPortalTests`: `[{id,nombre,tipo}]` exactos, ordenados por nombre, sin dados de baja ni de otra empresa; POST 405.
- [ ] **Paso 3:** Correr `apps.portal`. Esperado: fallan.
- [ ] **Paso 4:** Implementar `ResumenView` y `ActivosView` (`APIView`). Rutas `api/portal/resumen/` y `api/portal/activos/` antes de `include(router.urls)`.
- [ ] **Paso 5:** Correr `apps.portal` y `apps.dashboard`. Esperado: OK.
- [ ] **Paso 6:** `git commit` `feat(backend): resumen y activos del portal del cliente`.

### Tarea 3: Tickets del portal

**Files:** Modify `backend/apps/portal/{views,serializers,tests}.py`, `backend/config/urls.py`.

**Interfaces:** Consumes `comentar`, `autor_es_cliente`, `BasePortal`, `calcular_prioridad`, `registrar_evento`. Produces `TicketPortalViewSet` registrado como `portal/tickets` (basename `portal-ticket`), con `lookup_value_regex = r"\d{1,18}"`, `http_method_names = ["get","post","head","options"]`, `PaginacionEstandar`, orden `-creado_en, -id`.

- [ ] **Paso 1: Pruebas** `TicketsPortalTests`: claves exactas de fila y detalle según la spec; `test_no_expone_datos_internos` (ni `prioridad`, `prioridad_manual`, `incidente`, `organizacion` en fila ni detalle); `tecnico` y `reportado_por` son nombre o `null`; filtros `q`, `estado`, `abiertos`; orden; `test_lista_sin_n_mas_1` con `assertNumQueries` igual para 1 y 5 tickets.
- [ ] **Paso 2: Pruebas** de creación: 201 con `reportado_por` = el cliente, `organizacion` de la sesión aunque el cuerpo envíe otra, prioridad igual a `calcular_prioridad`, un evento `creacion`; campos obligatorios con mensajes "Escribe el título.", "Describe lo que ocurre.", "Elige una categoría.", "Indica a quién afecta."; `activo` de otra empresa, dado de baja o inexistente → 400 "Elige un activo de tu empresa.".
- [ ] **Paso 3: Pruebas** de línea de tiempo: el detalle trae `creacion`, `estado` y comentarios visibles, en orden; no trae notas internas ni `tecnico`, `prioridad`, `incidente`; claves exactas del evento (`id,tipo,autor,autor_es_cliente,texto,valor_anterior,valor_nuevo,fecha`); `test_autor_borrado_sale_null`; `test_resolucion_en_cascada_no_revela_incidente` (resolver un incidente con ticket asociado: el evento `estado` aparece y la respuesta no contiene `INC-`).
- [ ] **Paso 4: Pruebas** de comentarios: 201 visible y `autor_es_cliente` True; vacío 400; resuelto 201; cerrado 400.
- [ ] **Paso 5: Pruebas** `AislamientoTests`: ver y comentar ticket de `org_b` → 404 sin crear evento; `test_id_no_numerico_o_enorme_da_404` (`abc`, `9`×400); `test_entradas_anomalas_no_fallan` (`?q=%00`, `?page=x`, `?page_size=x`, `?estado=x` → 200 o 404, nunca 500); cuerpo no objeto 400; PUT y DELETE 405; `test_cliente_recibe_403_en_la_api_interna` recorriendo dashboard, organizaciones, activos, backups, tickets, incidentes y técnicos.
- [ ] **Paso 6:** Correr `apps.portal`. Esperado: fallan.
- [ ] **Paso 7:** Implementar serializers de lista blanca (`TicketPortalListaSerializer`, `TicketPortalDetalleSerializer`, `TicketPortalCrearSerializer`, `EventoPortalSerializer`) y el viewset con acción `comentarios`. `q` sin NUL, como en tickets. Filtro de eventos: `Q(tipo__in=["creacion","estado"]) | Q(tipo="comentario", visible_cliente=True)`.
- [ ] **Paso 8:** Correr `apps.portal`. Esperado: OK.
- [ ] **Paso 9:** `git commit` `feat(backend): tickets del portal del cliente`.

### Tarea 4: Usuarios de la empresa

**Files:** Modify `backend/apps/accounts/{serializers,views,tests}.py`, `backend/config/urls.py`.

**Interfaces:** Produces `validar_clave(valor, usuario=None) -> None` (extraído de `CambiarClaveSerializer`, lanza `serializers.ValidationError` en español); `UsuariosEmpresaView`, `UsuarioEmpresaView`, `ClaveUsuarioEmpresaView` con `EsAdminOTecnicoLectura`.

- [ ] **Paso 1: Pruebas** `UsuariosEmpresaTests`: 401; cliente 403; técnico GET 200 y POST/PATCH/clave 403; admin 200/201/204; organización inexistente 404; lista solo con clientes de esa empresa y claves exactas `{id,username,nombres,apellidos,correo,activo}`.
- [ ] **Paso 2: Pruebas** de creación: `rol` y `organizacion` del cuerpo se ignoran (queda `cliente` y la de la URL); `clave_inicial` débil → 400 en español; `test_username_duplicado_sin_distinguir_mayusculas` → 400 "Ese usuario ya existe."; `test_username_invalido` (espacios) → 400 "Usa solo letras, números y @ . + - _."; el usuario creado inicia sesión.
- [ ] **Paso 3: Pruebas** de edición: cambia `nombres`, `apellidos`, `correo`, `activo`; `username` se ignora; `test_uid_de_otra_empresa_da_404`; `test_uid_de_cuenta_interna_da_404` en PATCH y clave; `test_usuario_desactivado_no_autentica` (su token da 401); nueva clave permite login y la anterior no.
- [ ] **Paso 4:** Correr `apps.accounts`. Esperado: fallan.
- [ ] **Paso 5:** Implementar. Rutas `api/organizaciones/<int:org_id>/usuarios/`, `.../<int:uid>/` y `.../<int:uid>/clave/` antes de `include(router.urls)`.
- [ ] **Paso 6:** Correr toda la suite. Esperado: OK.
- [ ] **Paso 7:** Actualizar `docs/api-contract.md` (sección Portal, usuarios de empresa, `visible_cliente`) y crear `docs/examples/portal-resumen.json` y `docs/examples/portal-ticket.json`.
- [ ] **Paso 8:** `git commit` `feat(backend): usuarios de la empresa y contrato del portal`.

### Tarea 5: Base del portal en Angular

**Files:** Create `frontend/src/app/core/models/portal.ts`, `core/services/portal.service.ts`, `core/guards/portal.guard.ts` (+spec), `core/layout/portal-layout/portal-layout.{ts,html,scss,spec.ts}`; Modify `core/services/auth.service.ts` (+spec), `app.routes.ts`.

**Interfaces:** Produces tipos `ResumenPortal`, `TicketPortalResumido`, `TicketPortal`, `EventoPortal`, `ActivoPortal`, `TicketPortalEntrada`, `FiltrosPortal`, constante `ALCANCES_PORTAL` (`Solo a mí`, `A varias personas`, `A toda la empresa`). `PortalService`: `resumen()`, `listarTickets(f)`, `crearTicket(e)`, `obtenerTicket(id)`, `comentar(id, texto)`, `activos()`. `portalGuard` (solo cliente; otro rol va a `rutaInicio()`), `equipoGuard` (el cliente va a `/portal/perfil`).

- [ ] **Paso 1: Pruebas:** `rutaInicio()` da `/portal/inicio` para cliente (ajustar la prueba que esperaba `/sin-permiso`); guards por rol; `PortalLayout` muestra Inicio, Mis tickets, nombre de la empresa, enlace `/portal/perfil`, selector de tema y Salir; si falla la carga del resumen sigue mostrando la navegación.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar. `/admin/perfil` con `equipoGuard`; `/portal/perfil` carga `PerfilPagina`. Rutas `/portal` con `authGuard` y `portalGuard`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): base del portal del cliente`.

### Tarea 6: Inicio

**Files:** Create `features/portal/inicio/inicio.{ts,html,spec.ts}` (clase `PortalInicio`).

- [ ] **Paso 1: Pruebas:** nombre de la empresa; tarjetas con los tres números; servidores, redes y backups por estado; hasta 5 tickets abiertos con enlace a su ficha (`abiertos=true`, `page_size=5`); lista vacía "No tienes tickets abiertos."; error con "Reintentar"; botón "Abrir ticket" a `/portal/tickets/nuevo`; el texto no contiene "Prioridad".
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar con `StatCard` y las clases `.estado-*`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): inicio del portal`.

### Tarea 7: Mis tickets

**Files:** Create `features/portal/tickets-lista/tickets-lista.{ts,html,spec.ts}` (clase `PortalTicketsLista`).

- [ ] **Paso 1: Pruebas:** por defecto `abiertos=true`; búsqueda con espera y cancelación de la anterior; filtro de estado; paginación; vacío sin filtros con botón "Abrir ticket" y vacío con filtros "Sin resultados"; error con "Reintentar"; sin columna de prioridad.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar siguiendo `features/admin/tickets/tickets-lista`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): lista de tickets del portal`.

### Tarea 8: Abrir ticket

**Files:** Create `features/portal/ticket-nuevo/ticket-nuevo.{ts,html,spec.ts}` (clase `PortalTicketNuevo`).

- [ ] **Paso 1: Pruebas:** exige título, descripción, categoría y alcance con los mensajes de la Tarea 3; envía `activo: null` si no se elige; no envía `organizacion`; al crear navega a `/portal/tickets/{id}`; error 400 en su campo; doble envío ignorado; `test_si_fallan_los_activos_el_formulario_sigue` (GET activos 500: sin selector, y se puede enviar).
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar con formulario reactivo y `ALCANCES_PORTAL`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): abrir ticket desde el portal`.

### Tarea 9: Ficha del ticket

**Files:** Create `features/portal/ticket-ficha/ticket-ficha.{ts,html,spec.ts}` (clase `PortalTicketFicha`).

- [ ] **Paso 1: Pruebas:** datos del ticket; solución solo si existe; conversación en orden con frases por tipo (creó el ticket, cambió el estado, comentó) y marca del equipo cuando `autor_es_cliente` es falso; comentar agrega el evento y limpia la caja; botón deshabilitado sin texto; al fallar conserva lo escrito y muestra el error; cerrado: sin caja y con "Este ticket está cerrado. Si el problema volvió, abre uno nuevo."; 404 "Ticket no encontrado" con enlace a Mis tickets; error con "Reintentar"; autor `null` se muestra como "Sistema".
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): ficha de ticket del portal`.

### Tarea 10: Comentarios visibles en el panel interno

**Files:** Modify `core/models/ticket.ts`, `core/services/tickets.service.ts`, `features/admin/tickets/ticket-ficha/ticket-ficha.{ts,html,spec.ts}`.

**Interfaces:** `TicketsService.comentar(id, texto, visibleCliente = false)` envía `{ texto, visible_cliente }`. `EventoTicket` agrega `visible_cliente` y `autor_es_cliente`.

- [ ] **Paso 1: Pruebas:** casilla "Visible para el cliente" desmarcada por defecto; marcada envía `visible_cliente: true`; tras comentar vuelve a desmarcarse; cada comentario muestra "Nota interna", "Visible al cliente" o "Cliente". Ajustar fixtures y la prueba que comparaba el cuerpo.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar con `.estado-neutro`, `.estado-info` y `.estado-primario`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): comentarios visibles al cliente en la ficha de ticket`.

### Tarea 11: Usuarios del portal en la ficha de cliente

**Files:** Create `core/models/usuario-portal.ts`, `core/services/usuarios-portal.service.ts`, `features/admin/clientes/usuarios-portal/usuarios-portal.{ts,html,spec.ts}`; Modify `features/admin/clientes/cliente-ficha/cliente-ficha.{ts,html,spec.ts}`.

**Interfaces:** `UsuariosPortal` recibe `organizacionId = input.required<number>()`. Servicio: `listar(org)`, `crear(org, datos)`, `actualizar(org, uid, datos)`, `definirClave(org, uid, clave)`.

- [ ] **Paso 1: Pruebas:** lista, vacío y error con "Reintentar"; crear con validaciones y error 400 en su campo; editar; desactivar y reactivar actualizan la fila; definir contraseña exige repetirla y confirma; el campo de contraseña se limpia al terminar; admin habilitado; técnico ve la lista con acciones deshabilitadas, candado y "Solo administradores".
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar con paneles en la misma página, sin modales, e incluir el componente en la ficha.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): usuarios del portal en la ficha de cliente`.

### Tarea 12: Verificación y documentación

**Files:** Modify `CLAUDE.md`, `backend/apps/dashboard/management/commands/seed_demo.py` si hace falta un usuario cliente sin contraseña para la demo.

- [ ] **Paso 1:** Suites completas de backend y frontend, `npx ng build` y `makemigrations --check`. Esperado: OK y solo el aviso de presupuesto conocido.
- [ ] **Paso 2:** Flujo real con dos usuarios temporales de empresas distintas: admin crea usuario; cliente entra, abre ticket, comenta; técnico responde con nota interna y con comentario visible; el cliente solo ve el visible; intentar leer el ticket de la otra empresa da 404. Borrar los datos temporales al terminar.
- [ ] **Paso 3:** Capturas de las pantallas nuevas en tema oscuro, claro y móvil, y detector de `impeccable` sobre `features/portal`, `core/layout/portal-layout` y `features/admin/clientes/usuarios-portal`.
- [ ] **Paso 4:** Actualizar `CLAUDE.md`: módulo, endpoints, modelos, pantallas, permisos y conteo de pruebas.
- [ ] **Paso 5:** `git commit` `docs: CLAUDE.md con la vista del cliente`.
- [ ] **Paso 6:** Revisión final de toda la rama.
