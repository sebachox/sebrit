# Módulo 02: Clientes y organizaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de organizaciones cliente (sin borrado) con permisos por rol en el backend y un panel Angular compartido entre admin y técnico donde lo no permitido aparece bloqueado.

**Architecture:** Backend: `ModelViewSet` de DRF en `apps/organizations` registrado en un router (`/api/organizaciones/`), con un permiso por rol, dos serializers (lista y detalle) y paginación propia. Frontend: un mapa de permisos único (`core/auth/permisos.ts`) que consumen `AuthService`, un guard parametrizado, el sidebar y los botones; tres pantallas bajo `features/admin/clientes/`.

**Tech Stack:** Django 5.2, DRF, SimpleJWT, PostgreSQL 16; Angular 20 (standalone, signals, reactive forms), Bootstrap 5, Bootstrap Icons, Karma/Jasmine.

**Spec:** `docs/superpowers/specs/2026-11-05-modulo-02-clientes-design.md`

## Global Constraints

- Nombres de dominio en español sin tildes (modelos, campos, claves JSON); código del framework en inglés.
- Enumeración `plan`: exactamente `basico`, `estandar`, `premium`.
- Claves siempre presentes; opcionales vacíos salen como `null`; entrada acepta `null` y `""`.
- Fechas de contrato `YYYY-MM-DD`; `creado_en`/`actualizado_en` ISO 8601 con `-05:00`.
- Paginación: `page_size` por defecto 20, máximo 100; respuesta `{count, next, previous, results}`.
- Las URLs terminan en `/`.
- Todo endpoint con pruebas 401/403/200; la autorización se valida en el servidor.
- Frontend: estilo visual del `CLAUDE.md` (solo Bootstrap + Bootstrap Icons, fondo `#f5f6fa`, `card shadow-sm border-0`). Texto de bloqueo: **"Solo administradores"**.
- Usar la skill `impeccable` en las tareas de UI (5, 7, 8, 9) y `api-design-principles` en las de API (2–4).
- Comandos de prueba:
  - Backend: `docker compose exec -T backend python manage.py test apps.organizations`
  - Frontend (desde `frontend/`): `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless --include <ruta-spec>`

## Review Focus

1. **NIT con espacios o puntos** (`" 900123456-7 "`, `"900.123.456-7"`): se recortan los espacios; los puntos dan 400 con el mensaje "Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7." → prueba en Tarea 3.
2. **Nombre duplicado con otras mayúsculas** (`"empresa ejemplo s.a.s."`): 400 de duplicado, también al editar otra organización; editar la misma con su propio nombre sí se permite → prueba en Tarea 3.
3. **PATCH solo de `fecha_fin_contrato`** anterior a la `fecha_inicio_contrato` ya guardada: 400 (se valida contra la instancia, no solo contra el body) → prueba en Tarea 3.
4. **Búsqueda solo con espacios** (`?q=%20%20`): se trata como sin filtro → prueba en Tarea 4. **Página fuera de rango** tras desactivar el último cliente de la última página: el frontend vuelve a la página 1 → prueba en Tarea 7.
5. **Doble clic en "Guardar"**: el botón queda deshabilitado mientras se envía y solo sale un POST → prueba en Tarea 9.

---

### Task 1: Modelo `Organizacion` ampliado y protección del historial

**Files:**
- Modify: `backend/apps/organizations/models.py`
- Modify: `backend/apps/assets/models.py` (FK de `Activo` y `Backup`), `backend/apps/tickets/models.py`, `backend/apps/incidents/models.py`, `backend/apps/maintenance/models.py`
- Create: migraciones generadas en cada app afectada
- Modify: `backend/apps/dashboard/management/commands/seed_demo.py`
- Test: `backend/apps/organizations/tests.py`

**Interfaces:**
- Produces: `Organizacion.Plan` (`TextChoices`: `BASICO="basico"`, `ESTANDAR="estandar"`, `PREMIUM="premium"`) y los campos de la tabla de la spec §2. `creado_en = DateTimeField(default=timezone.now, editable=False)` (mismo patrón que `Ticket`) y `actualizado_en = DateTimeField(auto_now=True)`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `apps/organizations/tests.py`, clase `ModeloOrganizacionTests`:
  - `test_borrar_con_datos_relacionados_esta_protegido`: crea `Organizacion(nombre="Org")` + un `Ticket`; `with self.assertRaises(ProtectedError): org.delete()`; el ticket sigue existiendo.
  - `test_varias_organizaciones_sin_nit`: crea dos organizaciones con `nit=None` sin error.
  - `test_plan_acepta_solo_la_enumeracion`: `Organizacion(nombre="X", nit="900000001", plan="oro").full_clean()` lanza `ValidationError`.
- [ ] **Step 2: Correr y ver que fallan** — Expected: `test_borrar...` falla (el borrado en cascada no lanza) y el resto falla por `TypeError`/campo inexistente.
- [ ] **Step 3: Implementar** los campos y cambiar `on_delete=models.CASCADE` → `models.PROTECT` en las 5 FK. Generar migraciones: `docker compose exec backend python manage.py makemigrations organizations assets tickets incidents maintenance` (sin `-T`; si pide un valor por defecto para `actualizado_en`, elegir `timezone.now`). Revisar los archivos generados.
- [ ] **Step 4: `seed_demo`**: agregar `nit`, `ciudad` y `plan` a las 3 organizaciones creadas (`900123456-7`/Bogotá/`premium`, `800987654-3`/Cali/`estandar`, `901555222-1`/Medellín/`basico`).
- [ ] **Step 5: Migrar y correr pruebas** — `docker compose exec -T backend python manage.py migrate` y `... test` (todas las apps). Expected: OK, incluidas las 9 existentes.
- [ ] **Step 6: Commit** — `feat(backend): campos de contrato y contacto en Organizacion y FK protegidas`

### Task 2: Endpoint `/api/organizaciones/` con permisos por rol

**Files:**
- Create: `backend/apps/organizations/permissions.py`, `serializers.py`, `views.py`, `pagination.py`
- Modify: `backend/config/urls.py`
- Test: `backend/apps/organizations/tests.py`

**Interfaces:**
- Consumes: modelo de la Tarea 1.
- Produces:
  - `EsAdminOTecnicoLectura(BasePermission)`: autenticado y (`rol == "admin"` o (`rol == "tecnico"` y método en `SAFE_METHODS`)).
  - `PaginacionEstandar(PageNumberPagination)`: `page_size=20`, `page_size_query_param="page_size"`, `max_page_size=100`.
  - `OrganizacionListaSerializer` (campos: `id, nombre, nit, ciudad, plan, contacto_nombre, fecha_fin_contrato, activa`) y `OrganizacionDetalleSerializer` (todos los campos + `resumen` de solo lectura; `creado_en` y `actualizado_en` de solo lectura).
  - `OrganizacionViewSet(ModelViewSet)` con `http_method_names = ["get", "post", "patch", "head", "options"]`; `get_serializer_class()` devuelve el de lista en `list` y el de detalle en el resto.
  - Ruta: `DefaultRouter(trailing_slash=True)`, `router.register("organizaciones", OrganizacionViewSet, basename="organizacion")`, incluido bajo `api/`.

- [ ] **Step 1: Pruebas que fallan**, clase `PermisosOrganizacionesTests` (usuarios `admin`, `tecnico`, `cliente` en `setUp`; `URL = "/api/organizaciones/"`):
  - `test_sin_token_da_401` (GET lista y POST).
  - `test_cliente_da_403` (GET lista, GET detalle, POST, PATCH).
  - `test_tecnico_puede_leer` (GET lista 200, GET detalle 200).
  - `test_tecnico_no_puede_escribir` (POST 403, PATCH 403, PUT 403, DELETE 403).
  - `test_admin_crea_201_y_edita_200` (POST con `{"nombre": "Nueva", "nit": "900111222"}` → 201 y la respuesta trae `resumen`; PATCH `{"activa": false}` → 200 y `activa` es `false`).
  - `test_admin_put_y_delete_dan_405`.
  - `test_detalle_inexistente_da_404`.
- [ ] **Step 2: Correr y ver que fallan** — Expected: 404 en todas las rutas (no existen).
- [ ] **Step 3: Implementar** permiso, paginación, serializers (por ahora `resumen` puede devolver ceros fijos; la Tarea 3 lo calcula), viewset y router.
- [ ] **Step 4: Correr** `apps.organizations` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(backend): endpoint de organizaciones con permisos por rol`

### Task 3: Validación y representación del detalle

**Files:**
- Modify: `backend/apps/organizations/serializers.py`
- Test: `backend/apps/organizations/tests.py`

**Interfaces:**
- Consumes: `OrganizacionDetalleSerializer` (Tarea 2).
- Produces: el mismo serializer con:
  - `validate_nit(valor)`: recorta espacios; obligatorio en creación y no vaciable en edición; regex `^\d{6,10}(-\d)?$`; único sin distinguir mayúsculas, excluyendo la instancia. Mensajes exactos: `"El NIT es obligatorio."`, `"Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7."`, `"Ya existe una organización con este NIT."`.
  - `validate_nombre(valor)`: recorta espacios; único con `iexact`, excluyendo la instancia; mensaje `"Ya existe una organización con este nombre."`.
  - `validate(attrs)`: compara `fecha_fin_contrato` y `fecha_inicio_contrato` tomando de `self.instance` la que no venga en `attrs`; error en `fecha_fin_contrato`: `"La fecha de fin no puede ser anterior a la de inicio."`.
  - `get_resumen(obj) -> dict`: `{"activos", "tickets_abiertos", "incidentes_activos", "usuarios"}` con la regla de estados activos `["abierto", "en_progreso"]`.
  - `to_representation`: los campos de texto opcionales con `""` salen como `None`. Entrada: un `None` en un campo de texto opcional se guarda como `""`.

- [ ] **Step 1: Pruebas que fallan**, clase `ValidacionOrganizacionTests` (como admin):
  - `test_nit_obligatorio_al_crear` → 400, `r.data["nit"] == ["El NIT es obligatorio."]`.
  - `test_nit_formato_invalido` con `"900.123.456-7"` → 400 con el mensaje de formato.
  - `test_nit_con_espacios_se_recorta` con `" 900123456-7 "` → 201 y `nit == "900123456-7"`. *(Review Focus 1)*
  - `test_nit_duplicado` → 400 con el mensaje de duplicado.
  - `test_nombre_duplicado_sin_importar_mayusculas` (crear "Empresa Ejemplo", luego "empresa ejemplo") → 400. *(Review Focus 2)*
  - `test_editar_con_su_propio_nombre_es_valido` (PATCH con el mismo `nombre` y `nit`) → 200. *(Review Focus 2)*
  - `test_plan_invalido_da_400` con `plan="oro"`.
  - `test_fecha_fin_anterior_a_inicio_da_400` en POST.
  - `test_patch_solo_fecha_fin_valida_contra_la_guardada` (org con inicio `2026-06-01`; PATCH fin `2026-01-01`) → 400. *(Review Focus 3)*
  - `test_vaciar_nit_al_editar_da_400` (PATCH `{"nit": ""}`).
- [ ] **Step 2: Pruebas que fallan**, clase `DetalleOrganizacionTests`:
  - `test_resumen_cuenta_solo_lo_activo`: 2 `Activo`, ticket `abierto` + ticket `cerrado`, incidente `en_progreso` + incidente `resuelto`, 1 usuario con esa organización → `resumen == {"activos": 2, "tickets_abiertos": 1, "incidentes_activos": 1, "usuarios": 1}`.
  - `test_opcionales_vacios_salen_como_null`: `sector`, `correo`, `contacto_nombre`, `plan`, `fecha_fin_contrato` son `None`.
  - `test_desactivar_no_borra_y_sale_del_dashboard`: org con un ticket; PATCH `activa=false`; el ticket existe y `GET /api/dashboard/admin/` reporta `clientes_activos` uno menos.
- [ ] **Step 3: Correr y ver que fallan** — Expected: fallos de aserción (mensajes y conteos), no errores de importación.
- [ ] **Step 4: Implementar** lo descrito en *Produces*.
- [ ] **Step 5: Correr** `apps.organizations` — Expected: PASS.
- [ ] **Step 6: Commit** — `feat(backend): validaciones y resumen del detalle de organizaciones`

### Task 4: Búsqueda, filtros, orden y contrato documentado

**Files:**
- Modify: `backend/apps/organizations/views.py`
- Modify: `docs/api-contract.md` (sección "Organizaciones", según la spec §3)
- Create: `docs/examples/organizacion.json` (respuesta de detalle completa con `resumen`)
- Test: `backend/apps/organizations/tests.py`

**Interfaces:**
- Produces: en `OrganizacionViewSet.get_queryset()`: `q` (recortado; vacío = sin filtro) con `Q(nombre__icontains) | Q(nit__icontains) | Q(ciudad__icontains) | Q(contacto_nombre__icontains)`; `activa` solo si vale `"true"` o `"false"`; `plan` solo si es un valor de la enumeración. `filter_backends = [OrderingFilter]`, `ordering_fields = ["nombre", "creado_en"]`, `ordering = ["nombre"]`.

- [ ] **Step 1: Pruebas que fallan**, clase `ListaOrganizacionesTests` (3 orgs: "Beta" en Cali activa `basico`, "alfa" en Bogotá activa `premium` con contacto "Ana Ruiz", "Gamma" inactiva):
  - `test_orden_por_defecto_por_nombre` → `["alfa", "Beta", "Gamma"]` (orden sin distinguir mayúsculas: usar `Lower("nombre")` si hace falta).
  - `test_busqueda_por_nombre_nit_ciudad_y_contacto` (`q=bogo`, `q=ana`, `q=beta`, parte del NIT) → 1 resultado cada una.
  - `test_busqueda_solo_espacios_no_filtra` (`q=%20%20`) → `count == 3`. *(Review Focus 4)*
  - `test_filtro_activa` (`activa=false` → solo Gamma) y `test_filtro_plan` (`plan=premium` → solo alfa).
  - `test_page_size_maximo_100` (`page_size=500` sobre 101 orgs → `len(results) == 100`).
  - `test_lista_trae_solo_campos_resumidos` → `set(results[0]) == {"id","nombre","nit","ciudad","plan","contacto_nombre","fecha_fin_contrato","activa"}`.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** `get_queryset` y el orden.
- [ ] **Step 4: Correr todas las pruebas del backend** — `docker compose exec -T backend python manage.py test` — Expected: OK.
- [ ] **Step 5: Documentar** la sección del contrato y el JSON de ejemplo (debe coincidir con la respuesta real de un `GET` de detalle sobre los datos del seed).
- [ ] **Step 6: Commit** — `feat(backend): búsqueda, filtros y orden de organizaciones; docs del contrato`

### Task 5: Mapa de permisos, guard, ruta de inicio y sidebar con bloqueo

**Files:**
- Create: `frontend/src/app/core/auth/permisos.ts` (+ `permisos.spec.ts`)
- Create: `frontend/src/app/core/guards/permiso.guard.ts` (+ spec)
- Modify: `frontend/src/app/core/services/auth.service.ts` (+ spec), `frontend/src/app/core/layout/layout/layout.{ts,html,scss}` (+ spec), `frontend/src/app/app.routes.ts`

**Interfaces:**
- Produces:
  - `type Modulo = 'dashboard' | 'clientes'`, `type Accion = 'ver' | 'editar'`, `function puede(rol: Rol | null | undefined, modulo: Modulo, accion: Accion): boolean` con la tabla de la spec §4.
  - `AuthService.puede(modulo: Modulo, accion: Accion): boolean` (usa `usuario()`).
  - `AuthService.rutaInicio()`: admin → `/admin/dashboard`; tecnico → `/admin/clientes`; otro → `/sin-permiso`.
  - `permisoGuard(modulo: Modulo, accion: Accion): CanActivateFn` → `true` o `UrlTree('/sin-permiso')`.
  - Layout: `enlaces: { ruta: string; icono: string; texto: string; modulo: Modulo }[]` con Dashboard (`bi-speedometer2`) y Clientes (`bi-building`, ruta `/admin/clientes`); el enlace bloqueado se renderiza como `<span class="nav-link disabled bloqueado" aria-disabled="true" tabindex="0" title="Solo administradores">` con `bi-lock`.
  - Rutas: `/admin/dashboard` con `permisoGuard('dashboard','ver')`; el `redirectTo` de `''` pasa a un guard/función que usa `rutaInicio()`.

- [ ] **Step 1: Pruebas que fallan:**
  - `permisos.spec.ts`: `puede('admin','clientes','editar') === true`; `puede('tecnico','clientes','ver') === true`; `puede('tecnico','clientes','editar') === false`; `puede('tecnico','dashboard','ver') === false`; `puede('cliente','clientes','ver') === false`; `puede(null,'dashboard','ver') === false`.
  - `auth.service.spec.ts`: reemplazar la prueba del técnico → `'/admin/clientes'`; agregar cliente → `'/sin-permiso'`.
  - `permiso.guard.spec.ts`: técnico en `('dashboard','ver')` → UrlTree `/sin-permiso`; admin → `true`.
  - `layout.spec.ts`: con usuario técnico, el enlace "Dashboard" tiene `aria-disabled="true"` y no tiene `href`; "Clientes" sí tiene `href="/admin/clientes"`. El navbar dice "Panel técnico".
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** (cargar `impeccable` para el estilo del enlace bloqueado: contraste suficiente sobre `bg-dark`, foco visible, tooltip accesible).
- [ ] **Step 4: Correr toda la suite del frontend** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(frontend): mapa de permisos por rol y sidebar con módulos bloqueados`

### Task 6: Modelo y servicio de organizaciones

**Files:**
- Create: `frontend/src/app/core/models/organizacion.ts`
- Create: `frontend/src/app/core/services/organizaciones.service.ts` (+ spec)
- Modify: `frontend/src/app/shared/components/status-badge/status-badge.ts` (valores nuevos)

**Interfaces:**
- Produces:
  - `type Plan = 'basico' | 'estandar' | 'premium'`; `interface Paginado<T> { count: number; next: string | null; previous: string | null; results: T[] }`; `interface OrganizacionResumida` (campos de la lista); `interface ResumenOrganizacion { activos; tickets_abiertos; incidentes_activos; usuarios: number }`; `interface Organizacion` (detalle completo + `resumen`); `type OrganizacionEntrada = Partial<Omit<Organizacion, 'id' | 'resumen' | 'creado_en' | 'actualizado_en'>>`; `interface FiltrosOrganizaciones { q?: string; activa?: boolean | null; plan?: Plan | null; page?: number }`.
  - `OrganizacionesService`: `listar(f: FiltrosOrganizaciones): Observable<Paginado<OrganizacionResumida>>`, `obtener(id: number): Observable<Organizacion>`, `crear(d: OrganizacionEntrada): Observable<Organizacion>`, `actualizar(id: number, d: OrganizacionEntrada): Observable<Organizacion>`, `cambiarEstado(id: number, activa: boolean): Observable<Organizacion>`. Base `${API_URL}/organizaciones/`.
  - `StatusBadge`: `activa` (Activo, success), `inactiva` (Inactivo, secondary), `basico` (Básico, secondary), `estandar` (Estándar, info), `premium` (Premium, primary).

- [ ] **Step 1: Pruebas que fallan** (`HttpTestingController`):
  - `listar({ q: 'ana', activa: true, plan: 'premium', page: 2 })` → GET a `/organizaciones/` con params `q=ana&activa=true&plan=premium&page=2`.
  - `listar({ q: '  ', activa: null })` → sin params `q` ni `activa`.
  - `cambiarEstado(5, false)` → `PATCH /organizaciones/5/` con body `{ activa: false }`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar. Step 4: Correr la suite — PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): modelo y servicio de organizaciones`

### Task 7: Pantalla de lista de clientes

**Files:**
- Create: `frontend/src/app/features/admin/clientes/clientes-lista/clientes-lista.{ts,html,scss,spec.ts}`
- Modify: `frontend/src/app/app.routes.ts` (`admin/clientes` con `permisoGuard('clientes','ver')`)

**Interfaces:**
- Consumes: `OrganizacionesService.listar`, `AuthService.puede`, `StatusBadge`.
- Produces: componente `ClientesLista`; signals `estado: 'cargando' | 'error' | 'listo'`, `pagina`, `datos`; filtros por defecto `{ activa: true, page: 1 }`; búsqueda con espera de 300 ms.

- [ ] **Step 1: Pruebas que fallan:**
  - Muestra la tabla con los resultados y el badge de plan y estado.
  - `count === 0` sin filtros → mensaje de "Aún no hay clientes"; con `q` → "No hay clientes que coincidan con «…»".
  - Error 500 → botón "Reintentar" que vuelve a llamar a `listar`.
  - Respuesta 404 en `page > 1` → vuelve a pedir `page: 1`. *(Review Focus 4)*
  - Con usuario técnico, "Nuevo cliente" está `disabled` y con `title="Solo administradores"`.
  - Una fecha de fin pasada se renderiza con clase `text-danger`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar con `impeccable`** (tabla legible, números/fechas tabulares, estados vacío/error/carga, responsive: en móvil la tabla pasa a `table-responsive`).
- [ ] **Step 4: Correr la suite — PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): lista de clientes con búsqueda, filtros y paginación`

### Task 8: Ficha del cliente

**Files:**
- Create: `frontend/src/app/features/admin/clientes/cliente-ficha/cliente-ficha.{ts,html,scss,spec.ts}`
- Modify: `frontend/src/app/app.routes.ts` (`admin/clientes/:id`, `permisoGuard('clientes','ver')`)

**Interfaces:**
- Consumes: `obtener`, `cambiarEstado`, `AuthService.puede`, `StatCard`, `StatusBadge`.
- Produces: componente `ClienteFicha`; lee `id` de la ruta y `guardado=1` de los query params (muestra "Cliente guardado correctamente.").

- [ ] **Step 1: Pruebas que fallan:**
  - Muestra nombre, NIT y las 4 `StatCard` con los valores del `resumen`; los `null` se muestran como "—".
  - "Desactivar" abre la confirmación en la página; "Confirmar" llama a `cambiarEstado(id, false)` y actualiza el badge a "Inactivo".
  - 404 → "Cliente no encontrado" con enlace a `/admin/clientes`.
  - Técnico: "Editar" y "Desactivar" deshabilitados con `title="Solo administradores"`.
  - Con `?guardado=1` → alerta de éxito.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar con `impeccable`. Step 4: Suite — PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): ficha del cliente con resumen y desactivación`

### Task 9: Formulario de crear y editar

**Files:**
- Create: `frontend/src/app/features/admin/clientes/cliente-form/cliente-form.{ts,html,scss,spec.ts}`
- Modify: `frontend/src/app/app.routes.ts` (`admin/clientes/nuevo` y `admin/clientes/:id/editar`, ambas con `permisoGuard('clientes','editar')`; `nuevo` va antes de `:id`)

**Interfaces:**
- Consumes: `obtener`, `crear`, `actualizar`.
- Produces: componente `ClienteForm`; modo edición si la ruta trae `id`. Validadores: `nombre` y `nit` requeridos; `nit` con `Validators.pattern(/^\d{6,10}(-\d)?$/)` tras recortar; correos con `Validators.email`; validador de grupo `finNoAnteriorAInicio`. `aplicarErroresServidor(errores: Record<string, string[]>)`: pone `{ servidor: mensaje }` en cada control y guarda `non_field_errors`/`detail` en `errorGeneral`. Al guardar navega a `/admin/clientes/<id>?guardado=1`.

- [ ] **Step 1: Pruebas que fallan:**
  - Enviar vacío no hace POST y marca `nombre` y `nit` como inválidos.
  - NIT `"900.123"` → error de formato en el navegador.
  - Fin anterior a inicio → error en `fecha_fin_contrato`.
  - Respuesta 400 `{ nit: ['Ya existe una organización con este NIT.'] }` → ese texto aparece bajo el campo NIT.
  - Doble clic en "Guardar" → un solo POST (`HttpTestingController.expectOne`) y el botón `disabled` durante el envío. *(Review Focus 5)*
  - Modo edición: carga los datos y envía `PATCH` a `/organizaciones/<id>/`.
- [ ] **Step 2: Ver que fallan. Step 3: Implementar con `impeccable`** (secciones Empresa/Contacto/Contrato, etiquetas visibles, errores que nombran el problema y cómo arreglarlo, `select` de plan con "Sin plan").
- [ ] **Step 4: Suite — PASS.**
- [ ] **Step 5: Commit** — `feat(frontend): formulario de cliente para crear y editar`

### Task 10: Verificación final y CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (módulo 02 "Hecho", endpoints, tabla de permisos, criterio 5: técnico llega a `/admin/clientes`, pruebas, estructura)

- [ ] **Step 1: Cargar `superpowers:verification-before-completion`.**
- [ ] **Step 2: Suites completas** — backend `manage.py test` y frontend `ng test` completos. Expected: todo OK; reportar cualquier fallo por nombre.
- [ ] **Step 3: `npx ng build`** — Expected: compila (solo el aviso de presupuesto conocido).
- [ ] **Step 4: Capturas** (script CDP del scratchpad) de lista, ficha y formulario en 1440 px y 390 px, como admin y como técnico (sesión inyectada en `localStorage`); revisar y corregir lo que se vea mal en una sola pasada.
- [ ] **Step 5: Detector** — `frontend/.claude/skills/impeccable/scripts/impeccable detect --json <archivos de features/admin/clientes y layout>` → `[]` o hallazgos resueltos.
- [ ] **Step 6: Actualizar `CLAUDE.md`.**
- [ ] **Step 7: Commit** — `docs: CLAUDE.md con el módulo 02`
