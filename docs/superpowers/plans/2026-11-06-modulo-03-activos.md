# Módulo 03: Infraestructura y activos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inventario de activos (servidores y redes) y registro manual de backups por cliente, gestionables por admin y técnico desde el panel.

**Architecture:** Backend: dos `ModelViewSet` en `apps/assets` (`/api/activos/`, `/api/backups/`) registrados en el router existente, con la clase de permiso `EsAdminOTecnico`, serializers de lista/detalle y la paginación de `apps/organizations/pagination.py`. Frontend: modelos y servicios en `core/`, pantallas en `features/admin/activos/` y `features/admin/backups/`, permisos en `core/auth/permisos.ts`.

**Tech Stack:** Django 5.2, DRF, PostgreSQL 16; Angular 20 (standalone, signals, reactive forms), Bootstrap 5.3 con temas, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-06-modulo-03-activos-design.md`

## Global Constraints

- **Rama `sebas`:** verificar `git branch --show-current` antes de cada commit; si no es `sebas`, parar.
- Nombres de dominio en español sin tildes (`tamano_gb`, `numero_serie`, `de_baja`).
- Enumeraciones: tipo de activo `servidor`, `red`; estado de activo `operativo`, `advertencia`, `critico`; estado de backup `exitoso`, `fallido`, `pendiente`; tipo de backup `completo`, `incremental`, `diferencial`.
- Claves siempre presentes; opcionales vacíos como `null`; entrada acepta `null` y `""` en textos opcionales.
- Admin y técnico tienen los mismos permisos en activos y backups; cliente 403; sin token 401.
- Paginación 20, máximo 100 (`PaginacionEstandar`).
- Mensajes de error exactos de la spec §3 "Errores 400".
- Frontend: solo variables de `styles.scss` (sin colores fijos), verificar ambos temas; skill `impeccable` en tareas de UI (6–10); `api-design-principles` en tareas de API (2–4).
- Comandos de prueba: backend `docker compose exec -T backend python manage.py test apps.assets`; frontend (desde `frontend/`) `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless`.

## Review Focus

1. **Reactivar y editar en el mismo PATCH** (`{"de_baja": false, "estado": "operativo"}` sobre un activo dado de baja): 200 y ambos cambios aplicados; `{"estado": "critico"}` solo, sobre el mismo activo: 400 → prueba en Tarea 2.
2. **Backup con fecha "ahora"** (el formulario manda la hora actual al minuto): no debe rechazarse como futura; se tolera hasta 5 minutos de adelanto del reloj → prueba en Tarea 4.
3. **Filtro `hasta` inclusivo en hora local:** un backup a las 23:30 (America/Bogota) del día `hasta` aparece, aunque en UTC sea el día siguiente → prueba en Tarea 4.
4. **Editar un backup moviéndolo a un activo dado de baja**: 400 `El activo está dado de baja.`; moverlo a un activo de otro cliente actualiza su `organizacion` → prueba en Tarea 4.
5. **Filtros con valores inválidos** (`?organizacion=abc`, `?estado=raro`): se ignoran (200 sin filtrar), igual que en organizaciones → prueba en Tarea 3.

---

### Task 1: Modelos, migraciones y conteos sin activos dados de baja

**Files:**
- Modify: `backend/apps/assets/models.py`, `backend/apps/assets/admin.py` (listas y filtros básicos)
- Create: migración de `assets`
- Modify: `backend/apps/dashboard/views.py` (`conteo_activos`), `backend/apps/organizations/serializers.py` (`get_resumen`), `backend/apps/dashboard/management/commands/seed_demo.py`
- Test: `backend/apps/assets/tests.py`

**Interfaces:**
- Produces: `Activo` con los campos de spec §2 y `Activo.save()` que llena `fecha_baja = timezone.now()` al pasar a `de_baja=True` y la vacía al volver a `False`. `Backup` con `tipo` (`Backup.Tipo`: `COMPLETO`, `INCREMENTAL`, `DIFERENCIAL`), `tamano_gb`, `notas`, `registrado_por`, `creado_en`; `activo` con `on_delete=PROTECT`.

- [ ] **Step 1: Pruebas que fallan** (`ModeloActivoTests`):
  - `test_fecha_baja_se_llena_y_se_vacia`: crear activo, `de_baja=True; save()` → `fecha_baja` no es `None`; `de_baja=False; save()` → `None`.
  - `test_borrar_activo_con_backups_esta_protegido`: `ProtectedError`.
  - `test_dashboard_excluye_dados_de_baja`: 2 servidores, uno dado de baja → `infraestructura.servidores.total == 1` (como admin vía `/api/dashboard/admin/`).
  - `test_resumen_de_organizacion_excluye_dados_de_baja`: `resumen.activos == 1`.
  - `test_seed_crea_backups_con_activo_y_tipo`: `call_command("seed_demo")`; ningún `Backup` con `activo` o `tipo` vacío.
- [ ] **Step 2: Ver que fallan.**
- [ ] **Step 3: Implementar** modelos y `makemigrations assets` (sin `-T`; si pide default para `actualizado_en`, elegir `timezone.now`); `conteo_activos` y `get_resumen` filtran `de_baja=False`; el seed asocia cada backup a un servidor de `org1` y le pone `tipo` (`completo` el primero, `incremental` el resto).
- [ ] **Step 4: Migrar y correr todo el backend** — `docker compose exec -T backend python manage.py migrate` y `... test` → OK.
- [ ] **Step 5: Commit** — `feat(backend): ficha técnica de activos, baja y datos de backup`

### Task 2: Endpoint `/api/activos/`: permisos, CRUD y reglas de baja

**Files:**
- Create: `backend/apps/assets/permissions.py`, `serializers.py`, `views.py`
- Modify: `backend/config/urls.py` (router)
- Test: `backend/apps/assets/tests.py`

**Interfaces:**
- Consumes: modelos de Tarea 1; `PaginacionEstandar` de `apps.organizations.pagination`; `VacioComoNullMixin`/patrón de `to_internal_value` de `apps.organizations.serializers` (reutilizar o generalizar recibiendo la lista de campos).
- Produces:
  - `EsAdminOTecnico(BasePermission)`: autenticado y `rol in ("admin", "tecnico")`.
  - `ActivoListaSerializer`, `ActivoDetalleSerializer` (organización de salida `{id, nombre}`; de entrada `organizacion` como id).
  - `ActivoViewSet` con `http_method_names = ["get", "post", "patch", "head", "options"]`.
  - Router: `router.register("activos", ActivoViewSet, basename="activo")`.

- [ ] **Step 1: Pruebas que fallan** (`PermisosActivosTests`, `ReglasActivoTests`):
  - Sin token 401 (GET, POST); cliente 403 (GET lista, GET detalle, POST, PATCH); técnico 201 al crear y 200 al editar; admin igual; PUT y DELETE 405 para admin y técnico; id inexistente 404.
  - `test_nombre_unico_por_cliente`: mismo nombre con otras mayúsculas en el mismo cliente → 400 `Ya existe un activo con este nombre en este cliente.`; en otro cliente → 201.
  - `test_ip_invalida` → 400 `Escribe una dirección IP válida, por ejemplo 192.168.1.10.`
  - `test_no_se_cambia_la_organizacion` → 400 `No se puede cambiar el cliente de un activo.`; enviar la misma organización → 200.
  - `test_activo_de_baja_no_cambia_estado` → `{"estado": "critico"}` 400 con `{"estado": ["El activo está dado de baja."]}`.
  - `test_reactivar_y_cambiar_estado_juntos` → 200. *(Review Focus 1)*
  - `test_opcionales_vacios_salen_como_null` (`hostname`, `ip`, `notas`).
- [ ] **Step 2: Ver que fallan** (404, rutas inexistentes).
- [ ] **Step 3: Implementar** permiso, serializers, viewset y router. La regla de baja vive en `ActivoDetalleSerializer.validate`: si `instance.de_baja` y el resultado no lleva `de_baja=False`, cualquier otro cambio da 400 en el campo enviado (`estado` si viene; si no, `non_field_errors`). `fecha_baja` y `creado_en`/`actualizado_en` solo lectura.
- [ ] **Step 4: Correr `apps.assets`** → PASS.
- [ ] **Step 5: Commit** — `feat(backend): endpoint de activos con permisos admin/técnico`

### Task 3: Lista de activos: filtros, orden, último backup y resumen

**Files:**
- Modify: `backend/apps/assets/views.py`, `serializers.py`
- Test: `backend/apps/assets/tests.py`

**Interfaces:**
- Produces: en la lista, `ultimo_backup: {id, fecha, estado} | null` vía `Subquery` (annotate `ub_id`, `ub_fecha`, `ub_estado` sobre `Backup.objects.filter(activo=OuterRef("pk")).order_by("-fecha", "-id")`); en el detalle, además `resumen_backups: {total, exitosos, fallidos, pendientes}`. `ORDENES` con `estado` = `Case(When(estado="critico", then=0), When(estado="advertencia", then=1), default=2)`.

- [ ] **Step 1: Pruebas que fallan** (`ListaActivosTests`):
  - `test_excluye_dados_de_baja_por_defecto` y `test_de_baja_true_muestra_solo_esos`.
  - `test_filtros_organizacion_tipo_estado` y `test_busqueda_en_nombre_hostname_ip_serie_fabricante_modelo` (`q` por cada campo).
  - `test_filtros_invalidos_se_ignoran` (`?organizacion=abc`, `?estado=raro`, `?tipo=x` → mismo `count` que sin filtro). *(Review Focus 5)*
  - `test_orden_por_estado_criticos_primero`.
  - `test_ultimo_backup_es_el_mas_reciente` (dos backups, sale el de `fecha` mayor) y `test_sin_backups_es_null`.
  - `test_resumen_backups_en_el_detalle`.
  - `test_lista_sin_n_mas_1`: con 1 activo y con 10 activos (cada uno con backups) el número de consultas es el mismo (`CaptureQueriesContext`).
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: `apps.assets` → PASS.**
- [ ] **Step 5: Commit** — `feat(backend): filtros, orden y último backup en la lista de activos`

### Task 4: Endpoint `/api/backups/` y contrato documentado

**Files:**
- Modify: `backend/apps/assets/serializers.py`, `views.py`, `backend/config/urls.py`
- Modify: `docs/api-contract.md` (secciones Activos y Backups; nota en el dashboard); Create: `docs/examples/activo.json`, `docs/examples/backup.json` (generados con los serializers reales dentro de una transacción revertida)
- Test: `backend/apps/assets/tests.py`

**Interfaces:**
- Produces: `BackupSerializer` (salida: `activo {id, nombre}|null`, `organizacion {id, nombre}`, `registrado_por {id, nombre}|null`, `tamano_gb` número con `coerce_to_string=False`); `BackupViewSet` con `http_method_names = ["get", "post", "patch", "delete", "head", "options"]`; `router.register("backups", BackupViewSet, basename="backup")`. `perform_create` fija `registrado_por=request.user`; `organizacion` siempre = `activo.organizacion` en create y update.

- [ ] **Step 1: Pruebas que fallan** (`PermisosBackupsTests`, `ReglasBackupTests`, `ListaBackupsTests`):
  - Permisos de la spec (técnico: POST 201, PATCH 200, DELETE 204; cliente 403; sin token 401; PUT 405).
  - `test_organizacion_y_registrado_por_se_derivan`.
  - `test_activo_y_tipo_obligatorios_al_registrar`; `test_tipo_invalido`.
  - `test_activo_de_baja_no_recibe_backups` → `{"activo": ["El activo está dado de baja."]}`.
  - `test_mover_backup_a_activo_de_baja_da_400` y `test_mover_backup_a_otro_cliente_actualiza_organizacion`. *(Review Focus 4)*
  - `test_fecha_futura` (1 hora adelante) → `La fecha del backup no puede ser futura.`; `test_fecha_ahora_mas_dos_minutos_se_acepta`. *(Review Focus 2)*
  - `test_tamano_negativo` → `El tamaño no puede ser negativo.`; `test_tamano_sale_como_numero`.
  - `test_orden_por_defecto_mas_recientes_primero`; filtros `organizacion`, `activo`, `estado`, `tipo`.
  - `test_hasta_es_inclusivo_en_hora_local`: backup el 2026-03-10 23:30 -05:00, `?hasta=2026-03-10` lo incluye y `?desde=2026-03-11` no. *(Review Focus 3)*
- [ ] **Step 2: Ver que fallan. Step 3: Implementar** (`desde`/`hasta` con `fecha__date__gte/lte`, que usa `TIME_ZONE`; tolerancia de 5 minutos en la validación de fecha). **Step 4: Todo el backend → OK.**
- [ ] **Step 5: Documentar** contrato y ejemplos.
- [ ] **Step 6: Commit** — `feat(backend): endpoint de backups; docs de activos y backups`

### Task 5: Frontend: modelos, servicios, permisos y sidebar

**Files:**
- Create: `frontend/src/app/core/models/activo.ts`, `backup.ts`; `core/services/activos.service.ts`, `backups.service.ts` (+ specs)
- Modify: `core/auth/permisos.ts` (+ spec), `core/layout/layout/layout.ts`, `shared/components/status-badge/status-badge.ts`

**Interfaces:**
- Produces:
  - `type TipoActivo = 'servidor' | 'red'`; `type EstadoActivo = 'operativo' | 'advertencia' | 'critico'`; `interface Referencia { id: number; nombre: string }`; `interface ActivoResumido` (campos de la lista) y `interface Activo` (detalle con `resumen_backups`); `type ActivoEntrada`; `interface FiltrosActivos { q?; organizacion?: number | null; tipo?; estado?; de_baja?: boolean; page? }`.
  - `type TipoBackup = 'completo' | 'incremental' | 'diferencial'`; `interface Backup`; `type BackupEntrada`; `interface FiltrosBackups { organizacion?; activo?; estado?; tipo?; desde?: string; hasta?: string; page? }`.
  - `ActivosService`: `listar(f)`, `obtener(id)`, `crear(d)`, `actualizar(id, d)`, `cambiarEstado(id, estado)`, `darDeBaja(id, deBaja: boolean)`. `BackupsService`: `listar(f)`, `obtener(id)`, `registrar(d)`, `actualizar(id, d)`, `borrar(id)`. Reutilizan `Paginado<T>` de `core/models/organizacion.ts`.
  - `Modulo` agrega `'activos' | 'backups'` con `ver` y `editar` = `['admin', 'tecnico']`.
  - Layout: enlaces "Activos" (`/admin/activos`, `bi-hdd-rack`) y "Backups" (`/admin/backups`, `bi-cloud-arrow-up`).
  - `StatusBadge`: `servidor` (Servidor, primario), `red` (Red, info), `completo` (Completo, ok), `incremental` (Incremental, info), `diferencial` (Diferencial, neutro).

- [ ] **Step 1: Pruebas que fallan:** `permisos.spec` (técnico edita activos y backups; cliente no los ve); servicios: `listar` de activos envía `organizacion`, `tipo`, `estado`, `de_baja=true` solo cuando es `true`, omite vacíos; `listar` de backups envía `desde`/`hasta`; `cambiarEstado(3,'critico')` → `PATCH /activos/3/` `{estado:'critico'}`; `darDeBaja(3,true)` → `{de_baja:true}`; `borrar(5)` → `DELETE /backups/5/`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: Suite → PASS. Step 5: Commit** — `feat(frontend): modelos, servicios y permisos de activos y backups`

### Task 6: Lista de activos

**Files:** Create `frontend/src/app/features/admin/activos/activos-lista/*`; Modify `app.routes.ts` (`admin/activos`, `permisoGuard('activos','ver')`).

**Interfaces:** Consumes `ActivosService.listar`, `OrganizacionesService.listar({activa: true, page_size?})` (si hace falta, agregar `pageSize?: number` a `FiltrosOrganizaciones` y enviarlo como `page_size`). Produces `ActivosLista`; lee `?organizacion=` del query param al iniciar.

- [ ] **Step 1: Pruebas que fallan:** pide por defecto sin `de_baja`; con `?organizacion=4` la primera petición lleva `organizacion=4` y el selector muestra ese cliente; la tabla muestra tipo, estado y último backup ("Sin backups" si es `null`); vacío sin filtros ("Aún no hay activos registrados") vs. con búsqueda ("No hay activos que coincidan con «…»"); error con "Reintentar"; una búsqueda nueva cancela la anterior.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable` (patrón de `clientes-lista`), suite PASS.
- [ ] **Step 5: Commit** — `feat(frontend): lista de activos con filtros y último backup`

### Task 7: Formulario de backup (`BackupForm`)

**Files:** Create `frontend/src/app/features/admin/backups/backup-form/*`.

**Interfaces:** Produces `BackupForm` standalone con inputs `activoId = input<number | null>(null)` (si viene, el campo activo queda fijo y oculto) y `backup = input<Backup | null>(null)` (modo edición), y output `guardado = output<Backup>()`, `cancelado = output<void>()`. Campos: activo, estado, tipo, fecha (`datetime-local`, por defecto ahora), tamaño, notas. Validación local: requeridos, fecha no futura (más de 5 min), tamaño ≥ 0; errores 400 bajo cada campo.

- [ ] **Step 1: Pruebas que fallan:** con `activoId` fijo envía `POST /backups/` con ese activo; fecha futura no envía; tamaño negativo no envía; error 400 `{fecha: [...]}` aparece bajo Fecha; en modo edición envía `PATCH`; doble envío produce una sola petición.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable`, suite PASS. **Step 5: Commit** — `feat(frontend): formulario de backup reutilizable`

### Task 8: Ficha del activo

**Files:** Create `frontend/src/app/features/admin/activos/activo-ficha/*`; Modify `app.routes.ts` (`admin/activos/:id`).

**Interfaces:** Consumes `ActivosService.obtener/cambiarEstado/darDeBaja`, `BackupsService.listar({activo})`, `BackupForm`. Produces `ActivoFicha`.

- [ ] **Step 1: Pruebas que fallan:** muestra datos, enlace al cliente y "—" para `null`; clic en "Crítico" envía `PATCH {estado:'critico'}` y el badge cambia; "Dar de baja" pide confirmación y envía `{de_baja:true}`; dado de baja → aviso visible, botones de estado y "Registrar backup" deshabilitados, "Reactivar" habilitado; "Registrar backup" abre `BackupForm` y al `guardado` recarga historial y `resumen_backups`; 404 → "Activo no encontrado"; con `?guardado=1` muestra "Activo guardado correctamente.".
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable`, suite PASS. **Step 5: Commit** — `feat(frontend): ficha del activo con estado, baja e historial de backups`

### Task 9: Formulario de activo

**Files:** Create `frontend/src/app/features/admin/activos/activo-form/*`; Modify `app.routes.ts` (`admin/activos/nuevo` antes de `:id`, y `admin/activos/:id/editar`, con `permisoGuard('activos','editar')`).

**Interfaces:** Consumes `ActivosService.crear/actualizar/obtener`, `OrganizacionesService.listar`. Produces `ActivoForm`; al crear acepta `?organizacion=` para preseleccionar el cliente; al guardar navega a `/admin/activos/<id>?guardado=1`.

- [ ] **Step 1: Pruebas que fallan:** requeridos (cliente, tipo, nombre, estado); IP inválida (`999.1.1.1`) no envía; error 400 en `nombre` aparece bajo Nombre; en edición el cliente no es editable y no se envía `organizacion`; doble envío → una sola petición.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable` (patrón de `cliente-form`), suite PASS. **Step 5: Commit** — `feat(frontend): formulario de activo`

### Task 10: Lista de backups y edición

**Files:** Create `frontend/src/app/features/admin/backups/backups-lista/*`, `backup-editar/*` (página que carga el backup y usa `BackupForm`); Modify `app.routes.ts` (`admin/backups`, `admin/backups/:id/editar`).

**Interfaces:** Consumes `BackupsService`, `OrganizacionesService.listar`, `BackupForm`.

- [ ] **Step 1: Pruebas que fallan:** filtros envían `desde`/`hasta`; orden por defecto sin `ordering`; "Borrar" pide confirmación en la fila y envía `DELETE`, luego recarga; la fila enlaza al activo; estados de carga/error/vacío; la página de edición carga el backup y al `guardado` vuelve a la lista.
- [ ] **Step 2–4:** ver fallar, implementar con `impeccable`, suite PASS. **Step 5: Commit** — `feat(frontend): lista de backups con filtros, edición y borrado`

### Task 11: Enlace desde la ficha de cliente, verificación final y CLAUDE.md

**Files:** Modify `frontend/src/app/features/admin/clientes/cliente-ficha/cliente-ficha.html` (+ spec); `CLAUDE.md`.

- [ ] **Step 1: Prueba que falla:** en la ficha de cliente, la tarjeta "Activos" es un enlace a `/admin/activos?organizacion=<id>`. **Step 2–4:** ver fallar, implementar, suite PASS.
- [ ] **Step 5:** cargar `superpowers:verification-before-completion`; suites completas backend y frontend; `npx ng build`.
- [ ] **Step 6:** capturas (script CDP) de lista, ficha y formulario de activo y lista de backups, en oscuro y claro, 1440 px y 390 px, como admin y técnico (sesiones reales con usuario temporal que se borra al final); corregir en una pasada.
- [ ] **Step 7:** detector `impeccable detect --json` sobre los archivos nuevos → `[]` o resuelto.
- [ ] **Step 8:** actualizar `CLAUDE.md` (módulo 03 hecho, modelos, endpoints, permisos, regla del dashboard, pruebas, estructura).
- [ ] **Step 9: Commit** — `feat(frontend): enlace a activos desde la ficha de cliente` y `docs: CLAUDE.md con el módulo 03`.
