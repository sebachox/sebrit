# SEBRIT: contexto del proyecto para Claude Code

Última actualización: 2026-11-08. Este archivo resume lo que ya está construido y lo que se va a desarrollar. Léelo completo antes de proponer o hacer cambios.

## 1. Qué es SEBRIT

SaaS de **gestión de infraestructura tecnológica para múltiples empresas clientes**. El personal de SEBRIT (administradores y técnicos) gestiona clientes, activos (servidores, redes, backups), tickets e incidentes. Los clientes tienen un portal con acceso solo a los datos de su propia empresa.

Principio clave: **la autorización se hace en el backend**. Ocultar opciones en Angular no sustituye los permisos de Django.

### Módulos previstos (en orden de desarrollo)

| # | Módulo | Estado |
|---|---|---|
| 01 | Dashboard (administrativo primero) | Sprint 1, hecho |
| 02 | Clientes y organizaciones | Hecho (CRUD sin borrado, panel compartido admin/técnico) |
| 03 | Infraestructura y activos | Hecho (inventario de activos y registro manual de backups; admin y técnico) |
| 04 | Tickets y soporte | Hecho (prioridad automática, flujo de estados y línea de tiempo; admin y técnico). El portal para que el cliente abra tickets va con la vista del cliente |
| 05 | Incidentes | Hecho (interrupciones del servicio: tiempos, activos, bitácora, causa raíz, severidad automática y vínculo con tickets; admin y técnico) |
| 06 | Mantenimientos | Descartado (2026-11-08): no se construye. El modelo y su tabla quedan sin uso |
| — | Vista del cliente (portal) | Hecho (inicio con resumen; tickets: abrir, seguir y comentar; empresa, activos, backups e incidentes en solo lectura; aislado por organización). Usuarios gestionados desde la ficha del cliente |
| 07 | Reportes y SLA | Pendiente (las reglas de SLA no están definidas) |
| 08 | Monitoreo y alertas (integraciones externas) | Pendiente, módulo posterior |

Transversal: usuarios, roles, permisos, autenticación y auditoría. El técnico usa el mismo dashboard del admin, con sus permisos. El cliente tiene su portal en `/portal`.

## 2. Equipo y flujo de trabajo

- **Dos desarrolladores:** Seb (dueño del repo) y su compañera Brigith (`brigi` en la app).
- **Por ahora se desarrolla frontend y backend desde la rama `sebas`.** La regla anterior (backend en `sebas`, frontend en `brigit`, separación estricta por carpetas) está **suspendida** hasta nuevo aviso. Si Brigith trabaja en paralelo en `brigit`, coordinar antes de tocar los mismos archivos.
- Seb **revisa todos los commits y PRs**.
- Ramas: `main` (estable) y `develop` (integración), ambas protegidas (PR obligatorio, 1 aprobación, revisión de Code Owners, sin force push). **No se crean ramas por tarea**: se trabaja en la rama larga y se abre PR a `develop` por bloques terminados.
- Los PR se mergean con **"Create a merge commit"**, no con squash (las ramas viven mucho y el squash causa conflictos repetidos).
- Después de cada merge a `develop`, sincronizar: `git fetch origin && git merge origin/develop`.
- Los archivos de la raíz (`docker-compose.yml`, `.env.example`, `README.md`, `CLAUDE.md`) se avisan antes de editarlos.
- Commits pequeños con prefijo: `feat(backend):`, `feat(frontend):`, `fix:`, `docs:`, `chore:`.

### Seguridad: el repositorio es PÚBLICO

- Nunca subir `.env`, contraseñas, tokens, claves de API ni datos reales de clientes.
- `.env.example` solo lleva valores falsos.
- Los usuarios técnicos del seed se crean sin contraseña a propósito.
- Si se sube un secreto por error, hay que **cambiarlo** (borrarlo en otro commit no basta: queda en el historial).
- En `settings.py` no debe quedar la línea original `SECRET_KEY = 'django-insecure-...'`; la clave sale de `DJANGO_SECRET_KEY`. Debe tener **32 caracteres o más** (SimpleJWT avisa si es corta).
- GitHub: secret scanning, push protection y Dependabot activados.

## 3. Uso obligatorio de skills

Antes de trabajar, carga la skill que corresponda con la herramienta Skill. No basta con "seguir buenas prácticas" de memoria.

**Frontend (`frontend/`)**
- **`impeccable`**: cualquier trabajo de UI: crear o rediseñar pantallas, componentes, formularios, estados vacíos/carga/error, accesibilidad, responsive, pulido visual. Verificar con capturas y correr su detector (`frontend/.claude/skills/impeccable/scripts/impeccable detect --json <archivos>`).
- **`frontend-design`**: al crear pantallas o componentes nuevos, para la dirección estética.

**Backend (`backend/`)**
- **`api-design-principles`**: al crear o modificar endpoints, URLs, serializers o contratos de respuesta.
- **`skill-creator`**: cuando haya que crear o mejorar una skill del proyecto.
- **`find-skills`**: cuando falte una capacidad y pueda existir una skill para ello.

**Proceso (plugin superpowers)**
- **`superpowers:brainstorming`**: antes de construir una funcionalidad nueva.
- **`superpowers:writing-plans`**: para tareas de varios pasos.
- **`superpowers:test-driven-development`**: al implementar funcionalidades o arreglar bugs (prueba primero, verla fallar, luego implementar).
- **`superpowers:systematic-debugging`**: ante cualquier error o prueba fallida.
- **`superpowers:verification-before-completion`**: antes de decir que algo está terminado.

Para cambios triviales (un texto, un typo) no hace falta el proceso completo.

## 4. Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 20, TypeScript, Bootstrap 5, Bootstrap Icons, SCSS, componentes standalone y signals |
| Backend | Python 3.12, Django 5.2, Django REST Framework, SimpleJWT, django-cors-headers |
| Base de datos | PostgreSQL 16 |
| Infraestructura | Docker Compose (servicios `db`, `backend`, `frontend`), Node 22 en el contenedor del frontend |

Seb trabaja en **Windows con Git Bash y Docker Desktop**.

## 5. Estructura del repositorio

```
sebrit/
├── backend/
│   ├── .claude/skills/      # api-design-principles, skill-creator, find-skills
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/              # settings.py, urls.py
│   └── apps/
│       ├── accounts/        # Usuario personalizado (rol, organizacion), login JWT, /me
│       ├── organizations/   # Organizacion, API /api/organizaciones/ (viewset, permisos, serializers)
│       ├── assets/          # Activo, Backup, API /api/activos/ y /api/backups/
│       ├── tickets/         # Ticket, EventoTicket, regla de prioridad, API /api/tickets/
│       ├── incidents/       # Incidente, AccionIncidente, regla de severidad, API /api/incidentes/
│       ├── maintenance/     # Mantenimiento (sin uso: módulo descartado)
│       ├── dashboard/       # AdminDashboardView, seed_demo, tests
│       └── portal/          # API /api/portal/ del cliente (sin modelos)
├── frontend/
│   ├── .claude/skills/      # impeccable, frontend-design
│   ├── Dockerfile
│   ├── public/mock/dashboard-admin.json   # ya no se usa; queda para pruebas
│   └── src/app/
│       ├── core/            # auth/permisos.ts, config/api.ts, models, services, interceptors, guards, layout
│       ├── shared/components/   # stat-card, status-badge
│       └── features/        # admin/dashboard, admin/clientes, admin/activos, admin/backups, admin/tickets, admin/incidentes, admin/perfil, portal (inicio, tickets, activos, backups, incidentes, empresa), auth/login, errors/sin-permiso
├── docs/
│   ├── api-contract.md      # fuente de verdad del contrato de la API
│   ├── examples/            # dashboard-admin.json, organizacion.json, activo.json, backup.json, ticket.json, incidente.json, portal-resumen.json, portal-ticket.json, portal-activo.json, portal-incidente.json
│   └── superpowers/         # specs/ y plans/ de cada módulo
├── docker-compose.yml
├── .env.example
├── .github/                 # CODEOWNERS, plantilla de PR
└── CLAUDE.md
```

## 6. Cómo levantar el proyecto

Siempre desde la raíz del repo:

```bash
cp .env.example .env                 # solo la primera vez
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_demo
```

- Frontend: http://localhost:4200
- Backend: http://localhost:8000 (panel en `/admin/`)
- Logs: `docker compose logs --tail 30 backend`

Pruebas y build:

```bash
# Backend (todas las apps)
docker compose exec backend python manage.py test

# Frontend (no hay Chrome instalado; se usa Edge)
cd frontend && CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless

# Build del frontend (el aviso de presupuesto de 500 kB viene del CSS de Bootstrap)
cd frontend && npx ng build
```

Variables de `.env`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` (=`db`), `POSTGRES_PORT`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`.

Datos de `seed_demo` (idempotente: no hace nada si ya hay organizaciones): 3 organizaciones con NIT, ciudad y plan (una inactiva), 25 servidores y 15 equipos de red, 20 backups, 28 tickets abiertos y 5 cerrados, 5 incidentes (3 críticos activos, uno sin técnico, uno resuelto y uno cerrado). Los números se parecen al JSON de ejemplo pero no son iguales (por ejemplo 2 clientes activos, no 12).

### Usuarios en la base local de Seb

| Usuario | Rol | Notas |
|---|---|---|
| `sebri` | admin, superusuario | |
| `sebas` | tecnico | Cuenta de pruebas creada el 2026-11-05 |
| `brigi` | admin, superusuario | Promovida el 2026-11-04 |
| `carlos`, `laura` | tecnico | Del seed, sin contraseña |

### Conectar DBeaver (solo local)

La base no publica puerto en `docker-compose.yml`. Para DBeaver se crea un `docker-compose.override.yml` local (está en `.gitignore`, **no se sube**):

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5433:5432"
```

Conexión: host `localhost`, puerto `5433`, base y usuario de `POSTGRES_DB` / `POSTGRES_USER`, contraseña de `POSTGRES_PASSWORD`. Son credenciales de PostgreSQL, distintas del superusuario de la aplicación.

## 7. Backend (Django)

### Configuración relevante (`config/settings.py`)

- `AUTH_USER_MODEL = "accounts.Usuario"` (se definió antes de las primeras migraciones de negocio; no se puede cambiar después sin reiniciar la base).
- `TIME_ZONE = "America/Bogota"`: las fechas salen con `-05:00` y "hoy" es hoy en Colombia.
- `REST_FRAMEWORK`: autenticación `JWTAuthentication` y permiso por defecto `IsAuthenticated`.
- `SIMPLE_JWT`: token de acceso de 60 minutos.
- CORS permitido solo para `http://localhost:4200` (el origen debe coincidir exactamente).
- Las apps se importan como `apps.<nombre>` (el `name` en cada `apps.py` es `apps.<nombre>`).

### Modelos

| Modelo (app) | Campos principales |
|---|---|
| `Usuario` (accounts) | Extiende `AbstractUser`. `rol` (`admin`, `tecnico`, `cliente`), `organizacion` (FK opcional). Todo superusuario recibe `rol = admin` en `save()` |
| `Organizacion` | `nombre` (único), `nit` (único; nulo solo en registros anteriores al módulo 02), `sector`, `telefono`, `correo`, `direccion`, `ciudad`, `contacto_*` (nombre, cargo, correo, teléfono), `plan` (`basico`, `estandar`, `premium`), `fecha_inicio_contrato`, `fecha_fin_contrato`, `activa`, `creado_en`, `actualizado_en` |
| `Activo` (assets) | `organizacion` (fija al crear), `tipo` (`servidor`, `red`), `nombre` (único por cliente, sin mayúsculas), `estado` (`operativo`, `advertencia`, `critico`), `hostname`, `ip`, `sistema_operativo`, `fabricante`, `modelo`, `numero_serie`, `ubicacion`, `notas`, `de_baja`, `fecha_baja` (automática), `creado_en`, `actualizado_en` |
| `Backup` (assets) | `activo` (`PROTECT`; obligatorio en la API), `organizacion` (se toma del activo), `estado` (`exitoso`, `fallido`, `pendiente`), `tipo` (`completo`, `incremental`, `diferencial`), `fecha` (no futura), `tamano_gb`, `notas`, `registrado_por` (automático), `creado_en` |
| `Ticket` | `codigo` (`TCK-0001`, automático), `organizacion` (fija al crear), `titulo`, `descripcion`, `categoria` (`hardware`, `software`, `red`, `seguridad`, `accesos`, `otro`), `alcance` (`un_usuario`, `varios_usuarios`, `toda_empresa`), `activo` (opcional), `incidente` (opcional, `SET_NULL`), `prioridad` (`baja`, `media`, `alta`, `critica`), `prioridad_manual`, `estado`, `tecnico`, `reportado_por`, `solucion`, `creado_en`, `actualizado_en`, `resuelto_en`, `cerrado_en` |
| `EventoTicket` | `ticket`, `tipo` (`creacion`, `comentario`, `estado`, `tecnico`, `prioridad`, `incidente`), `autor`, `texto`, `valor_anterior`, `valor_nuevo`, `visible_cliente` (por defecto falso: nota interna), `fecha`. Es la línea de tiempo del ticket |
| `Incidente` | `codigo` (`INC-0001`, automático; si ya existe toma el siguiente libre), `organizacion` (fija al crear), `titulo`, `descripcion`, `impacto` (`degradado`, `parcial`, `total`), `activos` (M2M), `severidad`, `severidad_manual`, `estado`, `tecnico` (**puede ser null**), `reportado_por`, `solucion`, `causa_raiz`, `fecha_origen` (la escribe el usuario), `creado_en` (la API lo expone como `fecha_deteccion`), `fecha_fin` (automática al resolver), `cerrado_en`, `actualizado_en`. `duracion_minutos` es calculado |
| `AccionIncidente` | `incidente` (`related_name="acciones"`), `tipo` (`creacion`, `accion`, `estado`, `tecnico`, `severidad`, `ticket`), `autor`, `descripcion`, `valor_anterior`, `valor_nuevo`, `fecha`. Es la bitácora; la `ultima_accion` del dashboard es la más reciente de tipo `accion` |
| `Mantenimiento` | `organizacion`, `titulo`, `fecha_programada`, `estado` (`programado`, `en_curso`, `completado`) |

Las FK `organizacion` de `Activo`, `Backup`, `Ticket`, `Incidente` y `Mantenimiento` usan `on_delete=PROTECT`: un cliente con datos no se puede borrar (se desactiva). Los activos tampoco se borran: se dan de baja (`de_baja`); un activo dado de baja solo admite reactivarse y no recibe backups nuevos.

Los estados usan `TextChoices` con los valores del contrato. Los nombres de dominio (modelos, campos, claves JSON) van **en español, sin tildes**; el código del framework en inglés.

El admin de Django (`accounts/admin.py`) permite elegir rol y organización al crear usuarios, con filtros por rol, organización y permisos.

### Endpoints implementados

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login/` | Público. Recibe `username` y `password`; devuelve `access`, `refresh` y `usuario` (`id`, `username`, `nombre`, `rol`) |
| POST | `/api/auth/refresh/` | Público. Recibe `refresh`, devuelve un nuevo `access` |
| GET | `/api/auth/me/` | JWT. Devuelve el `usuario` de la sesión |
| GET, PATCH | `/api/auth/perfil/` | JWT, cualquier rol. Datos personales propios; solo se editan `nombres`, `apellidos` y `correo`. PUT, POST y DELETE 405 |
| POST | `/api/auth/perfil/clave/` | JWT, cualquier rol. Cambia la contraseña propia con `clave_actual` y `clave_nueva`; 204. Los tokens ya emitidos siguen válidos hasta vencer |
| GET | `/api/dashboard/admin/` | JWT, admin o técnico. 401 sin token, 403 para cliente |
| GET | `/api/organizaciones/` | admin y técnico. Paginada (20, máx. 100); `q`, `activa`, `plan`, `ordering` |
| GET | `/api/organizaciones/{id}/` | admin y técnico. Incluye `resumen` |
| POST, PATCH | `/api/organizaciones/`, `/{id}/` | Solo admin. PUT y DELETE dan 405 |
| GET, POST, PATCH | `/api/activos/`, `/{id}/` | Admin y técnico. Lista: `q`, `organizacion`, `tipo`, `estado`, `de_baja` (por defecto se excluyen), `ordering` (`estado` = críticos primero); cada fila trae `ultimo_backup`. PUT y DELETE 405 |
| GET, POST, PATCH, DELETE | `/api/backups/`, `/{id}/` | Admin y técnico. Lista: `organizacion`, `activo`, `estado`, `tipo`, `desde`, `hasta` (hora local). PUT 405 |
| GET, POST, PATCH | `/api/tickets/`, `/{id}/` | Admin y técnico. Lista: `q`, `organizacion`, `activo`, `estado`, `abiertos`, `prioridad`, `categoria`, `tecnico` (id o `sin_asignar`), `ordering` (`prioridad` por defecto). PUT y DELETE 405 |
| POST | `/api/tickets/{id}/estado/`, `/prioridad/`, `/comentarios/` | Admin y técnico. Cambio de estado, corrección de prioridad con motivo y comentarios |
| POST | `/api/tickets/{id}/escalar/` | Admin y técnico. Crea un incidente desde el ticket y lo asocia |
| GET, POST, PATCH | `/api/incidentes/`, `/{id}/` | Admin y técnico. Lista: `q`, `organizacion`, `activo`, `estado`, `abiertos`, `severidad`, `impacto`, `tecnico` (id o `sin_asignar`), `desde`, `hasta` (sobre `fecha_origen`, hora local), `ordering` (`severidad` por defecto). PUT y DELETE 405 |
| POST | `/api/incidentes/{id}/estado/`, `/severidad/`, `/acciones/`, `/tickets/` | Admin y técnico. Flujo de estados, corrección con motivo, bitácora y asociar tickets |
| DELETE | `/api/incidentes/{id}/tickets/{ticket_id}/` | Admin y técnico. Quita el ticket del incidente |
| GET | `/api/tecnicos/` | Admin y técnico. `[{id, nombre}]` de usuarios activos admin o técnico |
| GET, POST | `/api/organizaciones/{id}/usuarios/` | Admin; técnico solo GET. Cuentas `cliente` de la empresa |
| PATCH | `/api/organizaciones/{id}/usuarios/{uid}/` | Solo admin. `nombres`, `apellidos`, `correo`, `activo` |
| POST | `/api/organizaciones/{id}/usuarios/{uid}/clave/` | Solo admin. Define una contraseña nueva; 204 |
| GET | `/api/portal/resumen/`, `/api/portal/empresa/` | Cliente de empresa activa. Resumen en números y datos de la empresa |
| GET | `/api/portal/activos/`, `/{id}/` | Cliente de empresa activa. Lista paginada sin dados de baja (`q`, `tipo`, `estado`, `ordering`); la ficha abre también los dados de baja. Sin IP, hostname ni notas |
| GET | `/api/portal/backups/` | Cliente de empresa activa. Lista paginada (`activo`, `estado`, `tipo`, `desde`, `hasta`); activo ajeno: lista vacía. Ficha `/{id}/` con las mismas claves. Sin notas ni quién lo registró |
| GET | `/api/portal/incidentes/`, `/{id}/` | Cliente de empresa activa. Lista (`q`, `estado`, `abiertos`) y ficha con equipos y tickets de la empresa. Sin severidad, causa raíz, bitácora ni `reportado_por` |
| GET, POST | `/api/portal/tickets/`, `/{id}/` | Cliente de empresa activa. Lista: `q`, `estado`, `abiertos`. Ticket ajeno: 404. PUT, PATCH y DELETE 405 |
| POST | `/api/portal/tickets/{id}/comentarios/` | Cliente de empresa activa. Siempre visible; cerrado 400 |

El login usa `LoginSerializer` (`accounts/serializers.py`), que además agrega el claim `rol` al token. `EsAdminOTecnicoLectura` (en `apps/organizations/permissions.py`) da todo al admin y solo lectura al técnico; la usan el dashboard y organizaciones. `EsAdminOTecnico` (en `apps/assets/permissions.py`) da acceso completo a ambos; la usan activos, backups, tickets e incidentes (los técnicos levantan el inventario). `EsClienteDelPortal` (en `apps/portal/permissions.py`) exige rol `cliente`, organización asignada y organización activa. Los permisos de Django por usuario no se usan en la API; si más adelante hacen falta, preferir grupos o clases de permiso por `rol`.

### Reglas de cálculo del dashboard

- Un incidente o ticket está **activo** si su estado es `abierto` o `en_progreso`.
- `clientes_activos`: organizaciones con `activa = True`.
- `tickets_abiertos`: tickets activos (los incidentes son un modelo aparte y no cuentan aquí).
- `activos_criticos`: activos en estado `critico`, sin los dados de baja (igual a `servidores.criticos` + `redes.criticos`).
- `incidentes_criticos`: incidentes activos con severidad `critica`.
- `incidentes`: máximo 10 activos, del más reciente al más antiguo.
- Infraestructura sale del `estado` de cada `Activo` y de los `Backup`; no hay monitoreo real todavía. **Los activos dados de baja no cuentan** (ni en el dashboard ni en `resumen.activos` de la ficha de cliente).

### Reglas de tickets

- **Prioridad** (`apps/tickets/prioridad.py`): alcance `un_usuario`/`varios_usuarios`/`toda_empresa` = 1/2/3; +1 si la categoría es `red` o `seguridad`; +1 si el activo es `servidor`; +1 si el activo está `critico`. Total 1 → `baja`, 2 → `media`, 3–4 → `alta`, 5–6 → `critica`. Se recalcula al editar alcance, categoría o activo, salvo que `prioridad_manual` sea verdadero.
- **Estados** (`apps/tickets/servicios.py`): `abierto` ↔ `en_progreso` (exige técnico); `en_progreso` → `resuelto` (exige solución); `resuelto` → `cerrado`; `resuelto`/`cerrado` → `abierto` (reabrir). Un ticket cerrado solo admite reabrirse. Los tickets no se borran.
- Cada cambio deja un `EventoTicket` con autor y fecha.

### Reglas del portal del cliente

- La empresa siempre sale de `request.user.organizacion`; ningún endpoint del portal acepta un id de organización. Los serializers de `apps/portal` son listas blancas.
- El cliente ve todos los tickets de su empresa. Nunca ve `prioridad`, `prioridad_manual`, `incidente`, las notas internas ni los eventos `tecnico`, `prioridad` e `incidente`. En los eventos `estado` el `texto` sale `null` (puede citar un incidente; la solución va en `solucion`).
- El cliente no cambia estados. Puede comentar salvo en tickets cerrados.
- Los comentarios del equipo son internos salvo que se marque `visible_cliente`.
- Empresa, activos y backups son de solo lectura. Nunca se exponen `ip`, `hostname`, `notas` ni `registrado_por`. Hay backups antiguos sin activo: `activo` sale `null`.
- Incidentes: el cliente ve impacto, tiempos, técnico, solución, equipos y tickets; nunca severidad, causa raíz ni bitácora. El formulario de resolver avisa que la solución la verá el cliente.
- En las listas del portal toda la fila abre la ficha (clase global `.fila-enlace`); el código sigue siendo un enlace para el teclado.

### Reglas de incidentes

- Un incidente es la interrupción de un servicio; un ticket es una solicitud de soporte. Un ticket puede escalarse a incidente o asociarse a uno (máximo uno por ticket).
- **Severidad** (`apps/incidents/severidad.py`): impacto `degradado`/`parcial`/`total` = 1/2/3; +1 si algún activo es `servidor`; +1 si alguno está `critico`. Total 1 → `baja`, 2 → `media`, 3 → `alta`, 4–5 → `critica`. Se recalcula al cambiar impacto o el conjunto de activos, salvo que `severidad_manual` sea verdadero.
- **Estados** (`apps/incidents/servicios.py`): `abierto` ↔ `en_progreso` (exige técnico); `en_progreso` → `resuelto` (exige solución, guarda `fecha_fin`); `resuelto` → `cerrado` (exige causa raíz); `resuelto`/`cerrado` → `abierto` (vacía solución, causa raíz y fechas; la bitácora las conserva). Un incidente cerrado no se edita ni recibe acciones ni tickets. Los incidentes no se borran.
- Al resolver un incidente, sus tickets `abierto` y `en_progreso` pasan a `resuelto` con la misma solución, sin exigir técnico. Reabrir el incidente no los reabre.
- `fecha_origen` no puede ser futura ni posterior a la detección. `duracion_minutos` va de `fecha_origen` a `fecha_fin`.

### Pruebas

- `apps/dashboard/tests.py` (9): sin token 401, técnico 200 y sin escritura, cliente 403, admin 200 con las claves del contrato, conteos con un incidente sin técnico, `ultima_accion` solo de tipo `accion`.
- `apps/accounts/tests.py` (53): login válido con `usuario`, clave incorrecta 401, el token del login abre el dashboard, `/me` sin token 401 y con token 200, perfil (ver, editar, campos de solo lectura, validaciones), cambio de contraseña y usuarios de la empresa.
- `apps/organizations/tests.py` (33): modelo y `PROTECT`, seed, permisos por rol y método, validaciones, `resumen`, nulos, búsqueda, filtros, orden y paginación.
- `apps/tickets/tests.py` (69): regla de prioridad, migración de códigos, seed, permisos, crear/editar, recálculo, eventos, flujo de estados, corrección, comentarios, filtros, orden y consultas sin N+1.
- `apps/assets/tests.py` (47): modelo, baja, conteos sin dados de baja, seed, permisos de activos y backups, validaciones (nombre por cliente, IP, cliente fijo, baja, fecha futura, tamaño), datos derivados, filtros, orden, `ultimo_backup` sin N+1 y fechas en hora local.

- `apps/incidents/tests.py` (107): regla de severidad, código automático, migración de datos, seed, permisos, crear/editar, recálculo, flujo de estados, corrección, bitácora, resolución en cascada, asociar y escalar, filtros, orden y consultas sin N+1.

- `apps/portal/tests.py` (99): permisos, efecto inmediato de desactivar o mover, resumen, listas blancas, crear, línea de tiempo filtrada, comentarios, empresa, activos, backups, incidentes y aislamiento con dos empresas.

Todo endpoint nuevo debe traer pruebas de permisos (401 / 403 / 200).

## 8. Contrato de la API

Fuente de verdad: **`docs/api-contract.md`** y **`docs/examples/`** (`dashboard-admin.json`, `organizacion.json`, `activo.json`, `backup.json`, `ticket.json`, `incidente.json`, `portal-resumen.json`, `portal-ticket.json`, `portal-activo.json`, `portal-incidente.json`). Cualquier cambio se refleja en el contrato, backend, frontend, mock y pruebas.

```
GET /api/dashboard/admin/
{
  generado_en: string ISO 8601 (-05:00),
  resumen_operativo: { clientes_activos, tickets_abiertos, activos_criticos, incidentes_criticos },
  incidentes: [ {
      id, codigo, titulo,
      empresa: { id, nombre },
      severidad, estado,
      tecnico_asignado: { id, nombre } | null,
      ultima_accion: { descripcion, fecha } | null
  } ],
  infraestructura: {
    servidores: { total, operativos, advertencia, criticos },
    redes:      { total, operativos, advertencia, criticos },
    backups:    { total, exitosos, fallidos, pendientes },
    incidentes_criticos: { total, abiertos, en_progreso, sin_tecnico }
  }
}
```

Enumeraciones (minúscula, sin tildes): `severidad` = `baja`, `media`, `alta`, `critica`. `estado` de incidente = `abierto`, `en_progreso`, `resuelto`, `cerrado`. Estado de activo = `operativo`, `advertencia`, `critico`. Estado de backup = `exitoso`, `fallido`, `pendiente`. `rol` = `admin`, `tecnico`, `cliente`.

Invariantes: `total` de servidores y redes es la suma de sus estados; `backups.total` es la suma de sus estados; `incidentes_criticos.total` = `abiertos` + `en_progreso` y es igual a `resumen_operativo.incidentes_criticos`; `sin_tecnico` es un subconjunto aparte que no suma.

Convenciones: claves `snake_case`; claves siempre presentes; `null` cuando no hay valor; listas vacías `[]`, nunca `null`; contadores enteros mayores o iguales a 0.

## 9. Frontend (Angular 20)

- Estructura por funcionalidades: `core/` (servicios globales, auth, guards, interceptors, layout), `shared/` (componentes reutilizables) y `features/` (cada módulo de negocio con carga diferida).
- El CLI de Angular 20 genera archivos sin sufijo `.component` (`admin-dashboard.ts`, clase `AdminDashboard`). Los servicios se generan con `--type=service` (`dashboard.service.ts`).
- Generar archivos dentro del contenedor: `docker compose exec frontend npx ng g c <ruta>`.
- Bootstrap 5 y Bootstrap Icons están instalados con npm y referenciados en `angular.json` (`styles`).
- URL base de la API: `core/config/api.ts` (`API_URL = 'http://localhost:8000/api'`). Las URLs terminan en `/` (Django devuelve 404 sin la barra final).
- `DashboardService` llama siempre a la API real (`${API_URL}/dashboard/admin/`); el mock ya no se usa.
- Las fechas `YYYY-MM-DD` se formatean con `DatePipe` en `'UTC'` (si no, en Bogotá se ven un día antes).
- Manejar siempre los `null` (`tecnico_asignado` → "Sin asignar", `ultima_accion` → "—") y los estados cargando, error (con "Reintentar") y lista vacía.
- Revisar si ya existe un componente equivalente antes de crear uno nuevo.

### Estilo visual y temas

Estilo de consola de monitoreo con **dos temas**: oscuro (por defecto) y claro. `TemaService` (`core/services/tema.service.ts`) guarda la elección en `localStorage` (`sebrit.tema`) y la aplica con `data-bs-theme` en `<html>` (modo de color nativo de Bootstrap 5.3); `index.html` la aplica antes de arrancar Angular. El selector (`shared/components/selector-tema`) está en el navbar y en el login.

- **Nunca** usar colores fijos (`bg-white`, `bg-dark`, `table-light`, `text-bg-*`, hex en componentes): usar las variables de `styles.scss`.
- Superficies: `--sb-fondo` (página), `--sb-superficie` (tarjetas, tablas, navbar), `--sb-superficie-2` (encabezados de tabla), `--sb-borde`, `--sb-sidebar` (sidebar y panel del login).
- Estados: clases `.estado-<tono>` (fondo + texto con contraste ≥ 4.5:1 en ambos temas). Tonos: `critico` (rojo), `alto` (naranja), `medio` (amarillo), `ok` (verde), `info` (cian), `neutro` (gris), `primario` (azul). `StatusBadge` mapea cada valor del contrato a un tono; `StatCard` acepta `primary`, `info`, `warning`, `danger`, `secondary`, `success`.
- Iconos solo de Bootstrap Icons. Nuevos colores o tonos se agregan en `styles.scss` para los dos temas y se verifica su contraste.

### Pantallas del Sprint 1

| Pantalla | Ruta | Datos |
|---|---|---|
| Login (panel de marca con diagrama de red + formulario) | `/login` | `POST /api/auth/login/` |
| Layout administrativo (sidebar plegable, recordada en `sebrit.sidebar`; navbar con enlace a Mi perfil y "Salir") | contenedor de `/admin/...` | Usuario de la sesión |
| Dashboard admin: 4 tarjetas enlazadas a su módulo, tabla de incidentes, indicadores de servidores, redes, backups e incidentes críticos | `/admin/dashboard` | `GET /api/dashboard/admin/` |
| Mi perfil: datos personales y cambio de contraseña (toda sesión; no usa `PERMISOS`) | `/admin/perfil` | `/api/auth/perfil/` y `/clave/` |
| Portal del cliente: layout con barra superior | contenedor de `/portal/...` | `GET /api/portal/resumen/` |
| Portal: inicio con resumen y últimos tickets abiertos | `/portal/inicio` | `/api/portal/resumen/` y `/tickets/` |
| Portal: mis tickets, abrir ticket y ficha con conversación | `/portal/tickets`, `/portal/tickets/nuevo`, `/portal/tickets/:id` | `/api/portal/tickets/` y `/activos/` |
| Portal: mi empresa (solo lectura) | `/portal/empresa` | `/api/portal/empresa/` |
| Portal: mis activos (acepta `?tipo=` y `?estado=`) y ficha con historial de backups y "Abrir ticket sobre este equipo" | `/portal/activos`, `/portal/activos/:id` | `/api/portal/activos/`, `/api/portal/backups/?activo=` |
| Portal: backups con filtros y ficha | `/portal/backups`, `/portal/backups/:id` | `/api/portal/backups/` |
| Portal: incidentes (por defecto activos) y ficha con tiempos, equipos y tickets | `/portal/incidentes`, `/portal/incidentes/:id` | `/api/portal/incidentes/` |
| Portal: Mi perfil (misma pantalla del panel) | `/portal/perfil` | `/api/auth/perfil/` |
| Sin permiso (nombre y rol del usuario, botón "Ingresar con otra cuenta") | `/sin-permiso` | Usuario de la sesión |
| Clientes: lista con búsqueda, filtros y paginación | `/admin/clientes` | `GET /api/organizaciones/` |
| Clientes: ficha con resumen, desactivar/reactivar y usuarios del portal | `/admin/clientes/:id` | `GET`/`PATCH /api/organizaciones/{id}/`, `/usuarios/` |
| Clientes: formulario crear/editar (solo admin) | `/admin/clientes/nuevo`, `/admin/clientes/:id/editar` | `POST`/`PATCH` |
| Activos: lista (acepta `?organizacion=`; la tarjeta Activos de la ficha de cliente enlaza aquí) | `/admin/activos` | `GET /api/activos/` |
| Activos: ficha con cambio de estado, baja/reactivar e historial de backups (registrar backup en la misma página) | `/admin/activos/:id` | `GET`/`PATCH /api/activos/{id}/`, `/api/backups/?activo=` |
| Activos: formulario crear/editar | `/admin/activos/nuevo`, `/admin/activos/:id/editar` | `POST`/`PATCH` |
| Backups: lista con filtros, editar y borrar | `/admin/backups`, `/admin/backups/:id/editar` | `/api/backups/` |
| Tickets: lista (por defecto abiertos y más urgentes primero; acepta `?organizacion=`) | `/admin/tickets` | `GET /api/tickets/` |
| Tickets: ficha con flujo, asignación, corrección de prioridad, comentarios, línea de tiempo y escalar o asociar a incidente | `/admin/tickets/:id` | `/api/tickets/{id}/` y acciones |
| Tickets: formulario crear/editar | `/admin/tickets/nuevo`, `/admin/tickets/:id/editar` | `POST`/`PATCH` |
| Incidentes: lista (por defecto activos y más severos primero; acepta `?organizacion=`) | `/admin/incidentes` | `GET /api/incidentes/` |
| Incidentes: ficha con tiempos, flujo, asignación, corrección de severidad, activos, tickets y bitácora | `/admin/incidentes/:id` | `/api/incidentes/{id}/` y acciones |
| Incidentes: formulario crear/editar | `/admin/incidentes/nuevo`, `/admin/incidentes/:id/editar` | `POST`/`PATCH` |

### Panel compartido y permisos en el frontend

Admin y técnico usan el mismo layout. Lo que un rol no puede usar **se muestra bloqueado** (candado y "Solo administradores"), no se oculta. El mapa está en `core/auth/permisos.ts`:

| Módulo | Ver | Editar |
|---|---|---|
| `dashboard` | admin, técnico | — |
| `clientes` | admin, técnico | admin |
| `activos` | admin, técnico | admin, técnico |
| `backups` | admin, técnico | admin, técnico |
| `tickets` | admin, técnico | admin, técnico |
| `incidentes` | admin, técnico | admin, técnico |

Al agregar un módulo: una fila en `PERMISOS`, un enlace en `Layout.enlaces` y `permisoGuard(modulo, accion)` en sus rutas. El mapa solo refleja lo que el backend ya permite.

### Autenticación en el frontend (implementada)

- `AuthService` (`core/services/auth.service.ts`): guarda en `localStorage` `sebrit.access`, `sebrit.refresh` y `sebrit.usuario`; expone `usuario()` y `autenticado()` como signals; `logout()` borra todo y redirige a `/login`; `puede(modulo, accion)`; `rutaInicio()` devuelve `/admin/dashboard` para `admin` y `tecnico`, y `/portal/inicio` para `cliente`.
- `authInterceptor`: añade `Authorization: Bearer <token>` **solo** a peticiones a `API_URL` (excepto login y refresh). Ante 401 intenta **un** refresh compartido y reintenta; si falla, cierra sesión. Ante 403 redirige a `/sin-permiso`.
- `authGuard`: sin sesión redirige a `/login?volver=<ruta>`. `invitadoGuard`: con sesión, `/login` redirige a `rutaInicio()`. `permisoGuard(modulo, accion)`: sin permiso redirige a `/sin-permiso` (al cliente, a su portal). `inicioGuard`: la raíz del panel va a `rutaInicio()`. `portalGuard`: `/portal` es solo para clientes. `equipoGuard`: `/admin/perfil` envía al cliente a `/portal/perfil`.

## 10. Estado del Sprint 1

Objetivo: versión vertical mínima, desde el login hasta los datos reales del dashboard administrativo. Solo el dashboard del administrador (no el de técnico ni el de cliente).

| Tarea | Estado |
|---|---|
| Base Docker (Django + Angular + PostgreSQL + Bootstrap) | Hecho |
| Contrato `docs/api-contract.md` y JSON de ejemplo | Hecho (incluye auth y `/me`) |
| Usuario personalizado, roles, organizaciones, modelos y migraciones | Hecho |
| `seed_demo` | Hecho |
| `GET /api/dashboard/admin/` con permiso por rol, login JWT, `/me` y pruebas | Hecho, probado |
| Dashboard Angular | Hecho, conectado a la API real |
| Login, interceptor (con refresh), guards y pantalla `/sin-permiso` | Hecho, con pruebas |
| Validar que todo levanta desde cero en ambos equipos | Pendiente |
| README actualizado | Pendiente |

### Criterios para cerrar la integración

1. Sin sesión, `/admin/dashboard` redirige a `/login`. ✅
2. Una clave incorrecta muestra "Credenciales incorrectas". ✅
3. Con un usuario admin entra y los números coinciden con los del admin de Django. ✅
4. `INC-0002` muestra "Sin asignar" y "—". ✅ (manejado en el template)
5. Un usuario con rol `tecnico` entra al mismo panel: ve Dashboard y Clientes, pero crear, editar y desactivar clientes aparecen bloqueados (cambiado en el módulo 02; antes terminaba en `/sin-permiso`). ✅
6. "Cerrar sesión" borra el token y vuelve al login. ✅
7. Con el backend apagado, el dashboard muestra el estado de error con "Reintentar". ✅

## 11. Qué sigue después del Sprint 1

1. ~~Vista del cliente~~ hecha. El técnico no tendrá dashboard propio: usa el del admin con sus permisos.
2. ~~CRUD de clientes~~ (módulo 02), ~~activos y backups~~ (módulo 03), ~~tickets~~ (módulo 04) e ~~incidentes~~ (módulo 05) hechos; los mantenimientos (módulo 06) se descartaron.
3. ~~Aislamiento por organización en el backend~~ hecho en el portal. Activos, backups e incidentes ya están en el portal, en solo lectura (incidentes sin severidad, causa raíz ni bitácora).
4. Reportes y SLA cuando se definan las reglas de negocio.
5. Monitoreo y alertas con integraciones externas.
6. CI con GitHub Actions (pruebas en cada PR). Cuando se agregue, exigir aprobación para workflows de forks (repo público).

## 12. Reglas para Claude Code

- Responde en **español**. Seb prefiere guía concisa y orientada a la acción.
- Usa las skills de la sección 3 según corresponda.
- Si el cambio toca archivos de la raíz, avísalo antes.
- **Nunca** hagas commit de `.env`, contraseñas, tokens ni `docker-compose.override.yml`. No uses `git push --force`. Para PR usa merge commit, no squash.
- Antes de cambiar la API: lee `docs/api-contract.md`; si cambia la forma de una respuesta, actualiza el contrato, el JSON de ejemplo, las pruebas y el frontend.
- No inventes campos ni estados fuera de las enumeraciones del contrato.
- Todo endpoint nuevo lleva permisos explícitos y pruebas de 401, 403 y 200. La autorización siempre se valida en el servidor.
- Nunca ejecutes `npm audit fix --force` (puede romper versiones de Angular).
- Cambios en `requirements.txt`, `package.json` o `Dockerfile` requieren `docker compose up --build`. Tras cambiar `package.json` usa `docker compose up --build -V` para renovar el volumen de `node_modules`.
- Si cambias modelos: `makemigrations`, revisa el archivo generado y súbelo. Los archivos de migración sí van al repo.

## 13. Problemas conocidos (Windows y Docker)

| Síntoma | Causa y solución |
|---|---|
| `no configuration file provided` | Estás fuera de la carpeta del repo: `cd ~/GitHub/sebrit` |
| `the working directory 'C:/Program Files/Git/work' is invalid` | Git Bash convierte rutas: ejecutar con `MSYS_NO_PATHCONV=1` delante |
| `bash: $'\302\203docker': command not found` | Carácter invisible al pegar: escribir el comando a mano |
| `could not translate host name "db"` | El backend no está en la misma red que la base: levantar solo con `docker compose up`, sin contenedores sueltos |
| `InconsistentMigrationHistory` | La base tiene migraciones del usuario por defecto: `docker compose down -v` y migrar de nuevo |
| El frontend no encuentra Bootstrap | Falta `bootstrap` en `package.json` o un volumen viejo: `docker compose run --rm --no-deps frontend npm install bootstrap` y luego `down -v` y `up --build` |
| Un usuario válido termina en `/sin-permiso` | Es un cliente sin organización o de una empresa inactiva, o una ruta exige otro permiso: revisarlo en `/admin/` o en la ficha del cliente |
| Al editar un cliente antiguo pide NIT | Las organizaciones creadas antes del módulo 02 no tienen NIT; hay que completarlo para guardar |
| Sesión cerrada tras un rato | El refresh token venció o es inválido: iniciar sesión de nuevo |
| `InsecureKeyLengthWarning` en las pruebas | `DJANGO_SECRET_KEY` tiene menos de 32 caracteres: cambiarla en `.env` (cierra las sesiones abiertas) |
| `Cannot start ChromeHeadless` en `ng test` | No hay Chrome: usar `CHROME_BIN` apuntando a Edge (ver sección 6) |
| Error de CORS | El origen debe ser exactamente `http://localhost:4200`; reiniciar el backend tras cambiar settings |
| `Found 0 test(s)` | El `tests.py` quedó vacío: debe contener las clases de prueba |

Al cambiar el modelo de usuario o reiniciar la base, cada desarrollador debe correr: `docker compose down -v`, `docker compose up --build -d`, `migrate`, `createsuperuser` y `seed_demo`.
