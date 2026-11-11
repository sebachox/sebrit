# Portal: empresa, activos y backups (plan de implementación)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El cliente consulta en solo lectura los datos de su empresa, sus activos y sus backups desde el portal.

**Architecture:** Tres recursos de solo lectura en `apps/portal` (vistas y serializers de lista blanca que parten de `request.user.organizacion`) y cuatro pantallas nuevas en `features/portal`, más ajustes al selector de activos, a Inicio y a la navegación.

**Tech Stack:** Django 5.2, DRF; Angular 20 standalone con signals, Bootstrap 5.3, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-11-portal-empresa-activos-backups-design.md` (y las reglas de `docs/superpowers/specs/2026-11-08-vista-cliente-design.md`).

## Global Constraints

- Rama `sebas`; verificar antes de cada commit. Commits con prefijo y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Permiso `EsClienteDelPortal` en toda vista nueva; ningún parámetro de organización.
- Nunca exponer `ip`, `hostname`, `notas` (activo y backup), `registrado_por`, `creado_en`, `actualizado_en`, `activa`.
- Mensajes en español; claves `snake_case`; vacíos `null`; listas `[]`.
- Frontend: variables de `styles.scss`, Bootstrap Icons, estados de carga, error con "Reintentar", vacío y 404.
- Backend: `MSYS_NO_PATHCONV=1 docker compose exec -T backend python manage.py test <etiqueta>`. Frontend: desde `frontend/`, `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless`.

## Review Focus

1. `?activo=` de otra empresa, inexistente, no numérico o enorme en `/api/portal/backups/`: lista vacía, nunca 500 ni datos ajenos (Tarea 3).
2. `desde`/`hasta` inválidos o al revés: se ignoran o dan lista vacía, nunca 500 (Tarea 3).
3. Un activo dado de baja enlazado desde un backup abre su ficha marcada y sin botón de abrir ticket (Tareas 2 y 7).
4. `?activo=` en "Abrir ticket" con un id ajeno o que no está en el selector: el campo queda vacío (Tarea 4).
5. El selector de "Abrir ticket" sigue funcionando con la nueva forma paginada (Tareas 2 y 4).

---

### Tarea 1: Mi empresa (backend)

**Files:** Modify `backend/apps/portal/{views,serializers,tests}.py`, `backend/config/urls.py`.

**Interfaces:** Produces `EmpresaPortalSerializer`, `EmpresaView` en `api/portal/empresa/`.

- [ ] **Paso 1: Pruebas** `EmpresaPortalTests`: 401; admin y técnico 403; empresa inactiva 403; cliente 200 con claves exactas de la spec; vacíos `null`; no trae `activa`, `creado_en`, `actualizado_en`; POST 405.
- [ ] **Paso 2:** Correr `apps.portal`. Esperado: fallan.
- [ ] **Paso 3:** Implementar reutilizando `VacioComoNullMixin`.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(backend): datos de la empresa en el portal`.

### Tarea 2: Activos (backend)

**Files:** Modify `backend/apps/portal/{views,serializers,tests}.py`, `backend/config/urls.py`.

**Interfaces:** Consumes `con_ultimo_backup(qs)` de `apps/assets/views.py`. Produces `ActivoPortalViewSet` (lista y detalle) en `portal/activos`, `lookup_value_regex = r"\d{1,18}"`, `PaginacionEstandar`; reemplaza a `ActivosView`.

- [ ] **Paso 1: Pruebas:** permisos de lista y ficha; claves exactas de fila y de ficha; sin `ip`, `hostname`, `notas`; sin dados de baja en la lista; ficha de un dado de baja abre con `de_baja` verdadero; ajeno, `abc` y 400 dígitos dan 404; filtros `q`, `tipo`, `estado`; orden por nombre y `ordering=estado` con críticos primero; `ultimo_backup` correcto y lista sin N+1; `page_size=100`; entradas anómalas (`q=%00`, `page=x`) sin 500. Ajustar `ActivosPortalTests` a la forma paginada.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar.
- [ ] **Paso 4:** Correr `apps.portal`. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(backend): activos del portal`.

### Tarea 3: Backups (backend) y contrato

**Files:** Modify `backend/apps/portal/{views,serializers,tests}.py`, `backend/config/urls.py`, `docs/api-contract.md`; Create `docs/examples/portal-activo.json`.

**Interfaces:** Consumes `fecha_param` de `apps/assets/views.py`. Produces `BackupsPortalView` en `api/portal/backups/`.

- [ ] **Paso 1: Pruebas:** permisos; claves exactas de fila (`id, activo, tipo, estado, fecha, tamano_gb`), `activo` como `{id, nombre}`; sin `notas` ni `registrado_por`; solo de la empresa; orden del más reciente; filtros `estado`, `tipo`, `activo`, `desde`, `hasta` en hora local; `activo` ajeno, inexistente, `x` y 400 dígitos dan lista vacía; fechas inválidas se ignoran; lista sin N+1.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar; actualizar contrato y ejemplo.
- [ ] **Paso 4:** Correr la suite completa del backend. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(backend): backups del portal y contrato`.

### Tarea 4: Modelos, servicio y selector (frontend)

**Files:** Modify `core/models/portal.ts`, `core/services/portal.service.ts`, `features/portal/ticket-nuevo/*`, `core/layout/portal-layout/*`.

**Interfaces:** Produces tipos `EmpresaPortal`, `ActivoPortalResumido`, `ActivoPortalDetalle`, `BackupPortal`, `FiltrosActivosPortal`, `FiltrosBackupsPortal`; servicio `empresa()`, `listarActivos(f)`, `obtenerActivo(id)`, `listarBackups(f)`; `activos()` del selector pasa a `listarActivos({ pageSize: 100 })`.

- [ ] **Paso 1: Pruebas:** el selector pide `page_size=100` y usa `results`; `?activo=7` lo deja elegido si está en la lista; un id que no está deja el campo vacío; la navegación del portal muestra Mis activos, Backups y Mi empresa con sus enlaces.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): servicio y navegación del portal ampliados`.

### Tarea 5: Mi empresa (frontend)

**Files:** Create `features/portal/empresa/empresa.{ts,html,spec.ts}` (clase `PortalEmpresa`); Modify `app.routes.ts`.

- [ ] **Paso 1: Pruebas:** tres bloques con sus datos; `null` como "—"; fechas con `'UTC'`; correo como enlace `mailto:`; enlace "Abre un ticket" a `/portal/tickets/nuevo`; carga y error con "Reintentar"; sin botones de edición.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar y agregar la ruta.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): mi empresa en el portal`.

### Tarea 6: Mis activos (frontend)

**Files:** Create `features/portal/activos-lista/activos-lista.{ts,html,spec.ts}` (clase `PortalActivosLista`); Modify `app.routes.ts`.

- [ ] **Paso 1: Pruebas:** lee `?tipo=` y `?estado=` válidos de la URL e ignora los desconocidos; búsqueda con espera y cancelación; filtros; paginación; fila con estado, ubicación y último backup ("Sin backups" si es `null`); enlace a la ficha; vacío sin filtros y sin resultados; error con "Reintentar"; no muestra IP.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar y agregar la ruta.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): lista de activos del portal`.

### Tarea 7: Ficha de activo (frontend)

**Files:** Create `features/portal/activo-ficha/activo-ficha.{ts,html,spec.ts}` (clase `PortalActivoFicha`); Modify `app.routes.ts`.

- [ ] **Paso 1: Pruebas:** datos del activo; "—" para nulos; historial de backups (`activo=<id>`) con paginación, vacío y error propio sin tumbar la ficha; botón "Abrir ticket sobre este equipo" a `/portal/tickets/nuevo?activo=<id>`; dado de baja: aviso y sin botón; 404 "Activo no encontrado" con enlace a la lista; error con "Reintentar".
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar y agregar la ruta.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): ficha de activo del portal`.

### Tarea 8: Backups (frontend)

**Files:** Create `features/portal/backups-lista/backups-lista.{ts,html,spec.ts}` (clase `PortalBackupsLista`); Modify `app.routes.ts`.

- [ ] **Paso 1: Pruebas:** filtros de estado, tipo, activo (opciones de `listarActivos({ pageSize: 100 })`; si fallan, sin ese filtro) y fechas; paginación; enlace al activo; tamaño `null` como "—"; vacío y sin resultados; error con "Reintentar".
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar y agregar la ruta.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): backups del portal`.

### Tarea 9: Enlaces de Inicio

**Files:** Modify `features/portal/inicio/inicio.{html,spec.ts}`.

- [ ] **Paso 1: Pruebas:** las tarjetas de servidores, redes y backups enlazan a `/portal/activos?tipo=servidor`, `/portal/activos?tipo=red` y `/portal/backups`.
- [ ] **Paso 2:** Correr. Esperado: fallan.
- [ ] **Paso 3:** Implementar.
- [ ] **Paso 4:** Correr. Esperado: OK.
- [ ] **Paso 5:** `git commit` `feat(frontend): inicio enlaza a activos y backups`.

### Tarea 10: Verificación y documentación

- [ ] **Paso 1:** Suites completas, `npx ng build`, `makemigrations --check`. Esperado: OK y solo el aviso de presupuesto conocido.
- [ ] **Paso 2:** Flujo real con dos empresas y usuarios temporales: cada cliente ve solo lo suyo; ficha y backups ajenos no aparecen. Borrar los datos temporales.
- [ ] **Paso 3:** Capturas de las pantallas nuevas en oscuro, claro y móvil; detector de `impeccable`.
- [ ] **Paso 4:** Actualizar `CLAUDE.md` (endpoints, pantallas, reglas del portal, conteo de pruebas) y commit `docs: CLAUDE.md con empresa, activos y backups del portal`.
- [ ] **Paso 5:** Revisión final de toda la rama.
