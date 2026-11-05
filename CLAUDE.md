# SEBRIT: contexto del proyecto para Claude Code

Última actualización: 2026-11-04. Este archivo resume lo que ya está construido y lo que se va a desarrollar. Léelo completo antes de proponer o hacer cambios.

## 1. Qué es SEBRIT

SaaS de **gestión de infraestructura tecnológica para múltiples empresas clientes**. El personal de SEBRIT (administradores y técnicos) gestiona clientes, activos (servidores, redes, backups), tickets, incidentes y mantenimientos. Más adelante los clientes tendrán un portal con acceso solo a los datos de su propia empresa.

Principio clave: **la autorización se hace en el backend**. Ocultar opciones en Angular no sustituye los permisos de Django.

### Módulos previstos (en orden de desarrollo)

| # | Módulo | Estado |
|---|---|---|
| 01 | Dashboard (administrativo primero) | Sprint 1, casi cerrado |
| 02 | Clientes y organizaciones | Solo modelo base |
| 03 | Infraestructura y activos | Solo modelo base |
| 04 | Tickets y soporte | Solo modelo base |
| 05 | Incidentes | Solo modelo base |
| 06 | Mantenimientos | Solo modelo base |
| 07 | Reportes y SLA | Pendiente (las reglas de SLA no están definidas) |
| 08 | Monitoreo y alertas (integraciones externas) | Pendiente, módulo posterior |

Transversal: usuarios, roles, permisos, autenticación y auditoría. Más adelante: dashboard del técnico y del cliente (no están en el Sprint 1).

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
│       ├── organizations/   # Organizacion
│       ├── assets/          # Activo, Backup
│       ├── tickets/         # Ticket
│       ├── incidents/       # Incidente, AccionIncidente
│       ├── maintenance/     # Mantenimiento
│       └── dashboard/       # AdminDashboardView, seed_demo, tests
├── frontend/
│   ├── .claude/skills/      # impeccable, frontend-design
│   ├── Dockerfile
│   ├── public/mock/dashboard-admin.json   # ya no se usa; queda para pruebas
│   └── src/app/
│       ├── core/            # config/api.ts, models, services (auth, dashboard), interceptors, guards, layout
│       ├── shared/components/   # stat-card, status-badge
│       └── features/        # admin/dashboard, auth/login, errors/sin-permiso
├── docs/
│   ├── api-contract.md      # fuente de verdad del contrato de la API
│   └── examples/dashboard-admin.json
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

Datos de `seed_demo` (idempotente: no hace nada si ya hay organizaciones): 3 organizaciones (una inactiva), 25 servidores y 15 equipos de red, 20 backups, 28 tickets abiertos y 5 cerrados, 5 incidentes (3 críticos activos, uno sin técnico), 5 mantenimientos (4 de hoy). Los números se parecen al JSON de ejemplo pero no son iguales (por ejemplo 2 clientes activos, no 12).

### Usuarios en la base local de Seb

| Usuario | Rol | Notas |
|---|---|---|
| `sebri` | admin, superusuario | |
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
| `Organizacion` | `nombre` (único), `activa` |
| `Activo` (assets) | `organizacion`, `tipo` (`servidor`, `red`), `nombre`, `estado` (`operativo`, `advertencia`, `critico`) |
| `Backup` (assets) | `organizacion`, `activo` (opcional), `estado` (`exitoso`, `fallido`, `pendiente`), `fecha` |
| `Ticket` | `organizacion`, `titulo`, `estado`, `creado_en` |
| `Incidente` | `codigo` (único, ej. `INC-0001`), `titulo`, `organizacion`, `severidad`, `estado`, `tecnico` (FK a Usuario, **puede ser null**), `creado_en` |
| `AccionIncidente` | `incidente`, `descripcion`, `fecha` (la más reciente es la `ultima_accion`) |
| `Mantenimiento` | `organizacion`, `titulo`, `fecha_programada`, `estado` (`programado`, `en_curso`, `completado`) |

Los estados usan `TextChoices` con los valores del contrato. Los nombres de dominio (modelos, campos, claves JSON) van **en español, sin tildes**; el código del framework en inglés.

El admin de Django (`accounts/admin.py`) permite elegir rol y organización al crear usuarios, con filtros por rol, organización y permisos.

### Endpoints implementados

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login/` | Público. Recibe `username` y `password`; devuelve `access`, `refresh` y `usuario` (`id`, `username`, `nombre`, `rol`) |
| POST | `/api/auth/refresh/` | Público. Recibe `refresh`, devuelve un nuevo `access` |
| GET | `/api/auth/me/` | JWT. Devuelve el `usuario` de la sesión |
| GET | `/api/dashboard/admin/` | JWT y `rol = admin`. 401 sin token, 403 si no es admin |

El login usa `LoginSerializer` (`accounts/serializers.py`), que además agrega el claim `rol` al token. El permiso `EsAdmin` (en `apps/dashboard/views.py`) comprueba `rol == "admin"`. Los permisos de Django por usuario no se usan en la API; si más adelante hacen falta, preferir grupos o clases de permiso por `rol`.

### Reglas de cálculo del dashboard

- Un incidente o ticket está **activo** si su estado es `abierto` o `en_progreso`.
- `clientes_activos`: organizaciones con `activa = True`.
- `tickets_abiertos`: tickets activos (los incidentes son un modelo aparte y no cuentan aquí).
- `mantenimientos_hoy`: `fecha_programada__date` igual a hoy en America/Bogota.
- `incidentes_criticos`: incidentes activos con severidad `critica`.
- `incidentes`: máximo 10 activos, del más reciente al más antiguo.
- Infraestructura sale del `estado` de cada `Activo` y de los `Backup`; no hay monitoreo real todavía.

### Pruebas

- `apps/dashboard/tests.py` (4): sin token 401, técnico 403, admin 200 con las claves del contrato, conteos con un incidente sin técnico.
- `apps/accounts/tests.py` (5): login válido con `usuario`, clave incorrecta 401, el token del login abre el dashboard, `/me` sin token 401 y con token 200.

Todo endpoint nuevo debe traer pruebas de permisos (401 / 403 / 200).

## 8. Contrato de la API

Fuente de verdad: **`docs/api-contract.md`** y **`docs/examples/dashboard-admin.json`**. Cualquier cambio se refleja en el contrato, backend, frontend, mock y pruebas.

```
GET /api/dashboard/admin/
{
  generado_en: string ISO 8601 (-05:00),
  resumen_operativo: { clientes_activos, tickets_abiertos, mantenimientos_hoy, incidentes_criticos },
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
- Manejar siempre los `null` (`tecnico_asignado` → "Sin asignar", `ultima_accion` → "—") y los estados cargando, error (con "Reintentar") y lista vacía.
- Revisar si ya existe un componente equivalente antes de crear uno nuevo.

### Estilo visual

Mismo mundo en todas las pantallas: panel/sidebar `bg-dark` con la marca "SEBRIT" en negrita, fondo de página `#f5f6fa`, tarjetas `card shadow-sm border-0` (radio `1rem` en login y pantallas de error), azul primario de Bootstrap y colores de estado de los badges (`success`, `warning`, `danger`). Iconos solo de Bootstrap Icons. No agregar fuentes ni colores fuera de Bootstrap sin acordarlo.

### Pantallas del Sprint 1

| Pantalla | Ruta | Datos |
|---|---|---|
| Login (panel de marca con diagrama de red + formulario) | `/login` | `POST /api/auth/login/` |
| Layout administrativo (sidebar; navbar con nombre del usuario y "Salir") | contenedor de `/admin/...` | Usuario de la sesión |
| Dashboard admin: 4 tarjetas, tabla de incidentes, indicadores de servidores, redes, backups e incidentes críticos | `/admin/dashboard` | `GET /api/dashboard/admin/` |
| Sin permiso (nombre y rol del usuario, botón "Ingresar con otra cuenta") | `/sin-permiso` | Usuario de la sesión |

### Autenticación en el frontend (implementada)

- `AuthService` (`core/services/auth.service.ts`): guarda en `localStorage` `sebrit.access`, `sebrit.refresh` y `sebrit.usuario`; expone `usuario()` y `autenticado()` como signals; `logout()` borra todo y redirige a `/login`; `rutaInicio()` devuelve `/admin/dashboard` para `admin` y `/sin-permiso` para los demás roles.
- `authInterceptor`: añade `Authorization: Bearer <token>` **solo** a peticiones a `API_URL` (excepto login y refresh). Ante 401 intenta **un** refresh compartido y reintenta; si falla, cierra sesión. Ante 403 redirige a `/sin-permiso`.
- `authGuard`: sin sesión redirige a `/login?volver=<ruta>`. `invitadoGuard`: con sesión, `/login` redirige a `rutaInicio()`.

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
5. Un usuario con rol `tecnico` termina en `/sin-permiso`. ✅
6. "Cerrar sesión" borra el token y vuelve al login. ✅
7. Con el backend apagado, el dashboard muestra el estado de error con "Reintentar". ✅

## 11. Qué sigue después del Sprint 1

1. Dashboard del técnico y del cliente (mismos endpoints con datos filtrados por rol y organización).
2. CRUD de clientes y activos, luego tickets e incidentes (creación, asignación, estados, comentarios, historial), luego mantenimientos.
3. Aislamiento por organización en el backend (un cliente nunca ve datos de otra empresa), con pruebas con dos organizaciones.
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
| Un usuario válido termina en `/sin-permiso` | Su `rol` no es `admin`: editarlo en `/admin/` |
| Sesión cerrada tras un rato | El refresh token venció o es inválido: iniciar sesión de nuevo |
| `InsecureKeyLengthWarning` en las pruebas | `DJANGO_SECRET_KEY` tiene menos de 32 caracteres: cambiarla en `.env` (cierra las sesiones abiertas) |
| `Cannot start ChromeHeadless` en `ng test` | No hay Chrome: usar `CHROME_BIN` apuntando a Edge (ver sección 6) |
| Error de CORS | El origen debe ser exactamente `http://localhost:4200`; reiniciar el backend tras cambiar settings |
| `Found 0 test(s)` | El `tests.py` quedó vacío: debe contener las clases de prueba |
| `mantenimientos_hoy` da menos de lo esperado | El seed envejece: reiniciar la base y volver a correr `seed_demo` |

Al cambiar el modelo de usuario o reiniciar la base, cada desarrollador debe correr: `docker compose down -v`, `docker compose up --build -d`, `migrate`, `createsuperuser` y `seed_demo`.
