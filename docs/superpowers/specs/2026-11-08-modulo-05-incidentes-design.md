# Módulo 05: Incidentes — Diseño

Fecha: 2026-11-08 · Estado: aprobado en conversación, pendiente de revisión escrita · Rama: `sebas`

## 1. Objetivo

Registrar y gestionar las **interrupciones del servicio** de cada cliente: cuándo empezaron, cuándo se detectaron, cuánto duraron, qué activos afectaron, qué se hizo, cuál fue la causa raíz y qué tickets originaron o acompañaron la caída.

**Diferencia con tickets.** Un ticket es una solicitud de soporte de uno o varios usuarios. Un incidente es la caída o degradación de un servicio: agrupa varios tickets y activos, mide tiempos y exige causa raíz. Un ticket puede escalarse a incidente o asociarse a uno existente.

**Criterio de éxito:** desde Angular, admin y técnico listan, filtran, crean, editan, asignan y cambian el estado de los incidentes, registran acciones en la bitácora, corrigen la severidad con un motivo, asocian tickets y escalan un ticket a incidente. El rol cliente no tiene acceso. Los permisos se validan en el backend con pruebas 401/403/200 por rol y método.

### Fuera de alcance

- Portal del cliente.
- Reglas de SLA y metas de tiempo (módulo 07).
- Notificaciones por correo.
- Alertas automáticas y creación de incidentes por monitoreo (módulo 08).
- Adjuntos.
- Volver una severidad corregida a automática.
- Recalcular la severidad cuando cambia el estado de un activo sin editar el incidente.
- Reabrir tickets al reabrir su incidente.

## 2. Modelo de datos

### `Incidente` (app `incidents`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `codigo` | `CharField(20, unique=True, null=True, editable=False)` | Automático: `INC-` + id con 4 dígitos. Si ese código ya existe, se toma el siguiente número libre. Solo lectura |
| `organizacion` | FK `Organizacion`, `PROTECT` | Ya existe. Se fija al crear |
| `titulo` | `CharField(200)` | Ya existe. Obligatorio |
| `descripcion` | `TextField(blank=True)` | Obligatoria en `POST` |
| `impacto` | `CharField(choices, default="parcial")` | `degradado`, `parcial`, `total`. Obligatorio en `POST` |
| `activos` | M2M `Activo`, `related_name="incidentes"`, `blank=True` | Opcional. Mismo cliente. Los que se agregan no pueden estar dados de baja |
| `severidad` | `CharField(choices)` | Ya existe. Calculada. Solo lectura en `POST`/`PATCH` |
| `severidad_manual` | `BooleanField(default=False)` | Solo lectura |
| `estado` | `CharField(choices)` | Ya existe. Solo lectura en `POST`/`PATCH` |
| `tecnico` | FK `Usuario`, `null=True`, `SET_NULL` | Ya existe. Opcional. Rol `admin` o `tecnico` y activo; se valida solo al cambiar |
| `reportado_por` | FK `Usuario`, `null=True`, `SET_NULL`, `related_name="incidentes_reportados"` | Automático: usuario de la sesión |
| `fecha_origen` | `DateTimeField` | **La escribe el usuario.** Obligatoria en `POST`. No futura ni posterior a la detección |
| `creado_en` | `DateTimeField(default=timezone.now)` | Ya existe. La API lo expone como `fecha_deteccion`: momento en que se abre el incidente |
| `fecha_fin` | `DateTimeField(null=True, blank=True)` | Automática al resolver. Se vacía al reabrir |
| `cerrado_en` | `DateTimeField(null=True, blank=True)` | Automática al cerrar. Se vacía al reabrir |
| `solucion` | `TextField(blank=True)` | Se llena al resolver. Se vacía al reabrir |
| `causa_raiz` | `TextField(blank=True)` | Se llena al cerrar. Se vacía al reabrir |
| `actualizado_en` | `DateTimeField(auto_now=True)` | Automático |

`duracion_minutos` no se guarda: son los minutos enteros de `fecha_origen` a `fecha_fin`, o `null` si no hay `fecha_fin`.

### `AccionIncidente` (app `incidents`)

Es la bitácora y la línea de tiempo. El FK `incidente` pasa a `related_name="acciones"`.

| Campo | Tipo Django | Reglas |
|---|---|---|
| `incidente` | FK `Incidente`, `CASCADE` | Ya existe |
| `tipo` | `CharField(choices, default="accion")` | `creacion`, `accion`, `estado`, `tecnico`, `severidad`, `ticket` |
| `autor` | FK `Usuario`, `null=True`, `SET_NULL` | Usuario de la sesión. `null` en datos anteriores |
| `descripcion` | `TextField` | Antes `CharField(255)`. Texto de la acción, motivo o solución |
| `valor_anterior`, `valor_nuevo` | `TextField(null=True, blank=True)` | Según el tipo |
| `fecha` | `DateTimeField(default=timezone.now)` | Ya existe |

La `ultima_accion` del dashboard solo toma las de tipo `accion`. El contrato del dashboard no cambia.

### Cambios en `tickets`

- `Ticket.incidente`: FK `Incidente`, `null=True`, `blank=True`, `SET_NULL`, `related_name="tickets"`. Un ticket pertenece como máximo a un incidente.
- `EventoTicket.tipo` agrega `incidente`, para asociar, desasociar y escalar.

### Migración de datos

Los incidentes existentes:

- Conservan su `severidad` con `severidad_manual = True`.
- Toman `impacto = parcial`, `fecha_origen = creado_en` y `descripcion = titulo`.
- Si están `resuelto` o `cerrado`, toman `fecha_fin` de su acción más reciente o, si no tienen acciones, de `creado_en`. Si están `cerrado`, `cerrado_en` toma el mismo valor.
- Conservan su `codigo`.

Las acciones existentes quedan con `tipo = accion` y `autor = null`.

## 3. Reglas de negocio

### Severidad (`apps/incidents/severidad.py`, función pura)

`calcular_severidad(impacto, activos) -> str`

| Factor | Puntos |
|---|---|
| Impacto `degradado` / `parcial` / `total` | 1 / 2 / 3 |
| Algún activo es `servidor` | +1 |
| Algún activo está `critico` | +1 |

Total 1 → `baja`, 2 → `media`, 3 → `alta`, 4–5 → `critica`.

Se calcula al crear y se recalcula cuando cambia el impacto o el conjunto de activos, salvo que `severidad_manual` sea verdadero. Cada cambio deja una acción de tipo `severidad`. La corrección manual exige motivo y deja `severidad_manual = True`.

### Flujo de estados (`apps/incidents/servicios.py`)

| Desde | Hacia | Requisito | Efecto |
|---|---|---|---|
| `abierto` | `en_progreso` | Técnico asignado | |
| `en_progreso` | `abierto` | | |
| `en_progreso` | `resuelto` | `solucion` | Guarda `solucion` y `fecha_fin`; resuelve los tickets activos |
| `resuelto` | `cerrado` | `causa_raiz` | Guarda `causa_raiz` y `cerrado_en` |
| `resuelto`, `cerrado` | `abierto` | | Vacía `solucion`, `causa_raiz`, `fecha_fin` y `cerrado_en`. La línea de tiempo los conserva |

- Un incidente `en_progreso` no puede quedar sin técnico.
- Un incidente `cerrado` no se edita ni recibe acciones ni tickets hasta reabrirlo.
- Los incidentes no se borran.
- Toda operación deja su `AccionIncidente` con autor y fecha.
- Las operaciones de varios pasos se ejecutan en `transaction.atomic`.

### Relación con tickets

- **Asociar:** el ticket debe ser del mismo cliente, no estar `cerrado` y no tener incidente. Se permite con el incidente `abierto`, `en_progreso` o `resuelto`. Asociar no cambia el estado del ticket.
- **Quitar:** vacía `Ticket.incidente` y no cambia su estado.
- **Al resolver el incidente:** sus tickets `abierto` y `en_progreso` pasan a `resuelto` con la solución del incidente y `resuelto_en`, por una ruta propia que salta el flujo normal (no exige técnico). Cada uno deja un `EventoTicket` de tipo `estado`, con el texto `Resuelto por el incidente INC-XXXX.`
- **Reabrir el incidente** no reabre sus tickets.
- **Trabajo independiente:** un ticket asociado sigue su propio flujo y puede reabrirse sin afectar al incidente. Reabrirlo no le quita la asociación.
- **Escalar:** ver sección 4. Requiere que el ticket no esté `cerrado` y no tenga incidente.

## 4. API

Permiso: `EsAdminOTecnico`. Sin token 401; rol cliente 403; admin y técnico iguales.

| Método | Ruta | Respuesta | Cuerpo |
|---|---|---|---|
| GET | `/api/incidentes/` | 200, paginada | |
| GET | `/api/incidentes/{id}/` | 200, detalle | |
| POST | `/api/incidentes/` | 201, detalle | `organizacion`, `titulo`, `descripcion`, `impacto`, `fecha_origen`, y opcionales `activos` (ids) y `tecnico` |
| PATCH | `/api/incidentes/{id}/` | 200, detalle | Los mismos campos, sin cambiar `organizacion` |
| POST | `/api/incidentes/{id}/estado/` | 200, detalle | `estado` y, según el caso, `solucion` o `causa_raiz` |
| POST | `/api/incidentes/{id}/severidad/` | 200, detalle | `severidad`, `motivo` |
| POST | `/api/incidentes/{id}/acciones/` | 201, acción | `descripcion` |
| POST | `/api/incidentes/{id}/tickets/` | 200, detalle | `ticket` |
| DELETE | `/api/incidentes/{id}/tickets/{ticket_id}/` | 200, detalle | |
| POST | `/api/tickets/{id}/escalar/` | 201, detalle del incidente | `impacto`, `fecha_origen` |
| PUT, DELETE | `/api/incidentes/{id}/` | 405 | |

### Lista

**Filtros** (los valores inválidos se ignoran; los ids se validan con `isdecimal()`):

- `q`: código y título.
- `organizacion`, `activo`, `estado`, `severidad`, `impacto`.
- `abiertos=true`: solo `abierto` y `en_progreso`.
- `tecnico`: id o `sin_asignar`.
- `desde`, `hasta`: fecha de origen, inclusivos, en hora de Colombia.

**Orden** (`ordering`): por defecto `severidad` (críticos primero y, dentro de cada nivel, los más antiguos primero). También `fecha_deteccion` y `-fecha_deteccion`.

**Paginación:** 20, máximo 100.

**Fila:** `id`, `codigo`, `titulo`, `organizacion {id, nombre}`, `severidad`, `severidad_manual`, `impacto`, `estado`, `tecnico {id, nombre} | null`, `fecha_origen`, `fecha_deteccion`, `fecha_fin`, `duracion_minutos`, `total_activos`, `total_tickets`. Sin consultas N+1.

### Detalle

Los campos de la fila, más `descripcion`, `reportado_por {id, nombre} | null`, `solucion`, `causa_raiz`, `cerrado_en`, `actualizado_en` y:

- `activos: [{id, nombre, tipo, estado}]`
- `tickets: [{id, codigo, titulo, estado}]`
- `acciones: [{id, tipo, autor {id, nombre} | null, descripcion, valor_anterior, valor_nuevo, fecha}]`, en orden cronológico.

Los textos vacíos salen como `null`, igual que en tickets.

### Escalar

`POST /api/tickets/{id}/escalar/` crea el incidente con el cliente, el título, la descripción y el activo del ticket, y con su técnico. No copia un activo dado de baja ni un técnico inactivo. Deja el ticket asociado y registra el hecho en ambas líneas de tiempo. El `impacto` y la `fecha_origen` los indica el usuario.

### Cambios en la API de tickets

La lista y el detalle agregan `incidente: {id, codigo} | null`.

### Errores 400

| Campo | Mensaje |
|---|---|
| `estado` | `No se puede pasar de «X» a «Y».` |
| `tecnico` | `Asigna un técnico antes de pasar a En progreso.` |
| `tecnico` | `Un incidente en progreso debe tener un técnico asignado.` |
| `tecnico` | `El usuario debe ser un técnico o administrador activo.` |
| `solucion` | `Describe cómo se restableció el servicio.` |
| `causa_raiz` | `Indica la causa raíz para cerrar el incidente.` |
| `motivo` | `Explica por qué cambias la severidad.` |
| `descripcion` | `Describe la acción realizada.` |
| `fecha_origen` | `La fecha de origen no puede ser futura.` |
| `fecha_origen` | `La fecha de origen no puede ser posterior a la detección.` |
| `organizacion` | `No se puede cambiar el cliente de un incidente.` |
| `activos` | `Todos los activos deben ser de este cliente.` |
| `activos` | `Hay activos dados de baja.` |
| `ticket` | `El ticket no pertenece a este cliente.` |
| `ticket` | `El ticket ya está asociado a un incidente.` |
| `ticket` | `El ticket está cerrado.` |
| `non_field_errors` | `El incidente está cerrado. Reábrelo para modificarlo.` |

Un título o descripción vacíos o con solo espacios devuelven el mensaje en español del campo. Quitar un ticket que no pertenece al incidente da 404.

### Documentación

Sección "Incidentes" en `docs/api-contract.md` y `docs/examples/incidente.json`. Se agrega `incidente` a `docs/examples/ticket.json`.

## 5. Frontend

### Permisos y navegación

- `incidentes` en `core/auth/permisos.ts`: ver y editar para admin y técnico.
- Enlace "Incidentes" en el sidebar, después de Tickets.
- Los códigos de la tabla del dashboard abren la ficha del incidente.
- La ficha de cliente enlaza a `/admin/incidentes?organizacion=`.

### Pantallas

| Pantalla | Ruta | Contenido |
|---|---|---|
| Lista | `/admin/incidentes` | Por defecto activos, más severos primero. Búsqueda; filtros de cliente, severidad, impacto, estado, técnico y fechas. Columnas: código, título, cliente, severidad, estado, técnico, inicio y duración ("En curso" si sigue activo) |
| Formulario | `/admin/incidentes/nuevo`, `/:id/editar` | Cliente, título, descripción, impacto, fecha y hora de origen, técnico y activos con casillas según el cliente. Acepta `?organizacion=`. Al editar, el cliente queda fijo. Nota: la severidad se calcula sola |
| Ficha | `/admin/incidentes/:id` | Ver abajo |

`nuevo` se declara antes de `:id`. `fecha_origen` se trata igual que la fecha de backups: `datetime-local` en la hora del navegador, enviada con `toISOString()`.

### Ficha

- **Encabezado:** código, título, severidad (con marca si es manual), estado e impacto.
- **Tiempos:** origen, detección, fin y duración en un solo bloque.
- **Acciones según el estado:** Tomar, Iniciar, Devolver a abierto, Resolver (pide solución y avisa "N tickets asociados pasarán a resuelto"), Cerrar (pide causa raíz), Reabrir (con confirmación, porque vacía solución, causa raíz y fechas) y Corregir severidad (con motivo).
- **Activos afectados** y **tickets asociados**. Cada ticket enlaza a su ficha y se puede quitar. Para agregar, un selector muestra los tickets abiertos del cliente sin incidente, usando `GET /api/tickets/?organizacion=&abiertos=true&page_size=100`.
- **Bitácora:** campo para agregar acciones y línea de tiempo con acciones y cambios automáticos diferenciados.
- **Incidente cerrado:** todo queda deshabilitado menos Reabrir.

### Ficha de ticket

- Con incidente: aviso con enlace, "Parte del incidente INC-0003".
- Sin incidente y sin estar cerrado: "Escalar a incidente" (panel con impacto y fecha de origen; lleva a la ficha nueva) y "Asociar a incidente" (selector de incidentes activos del mismo cliente).
- La línea de tiempo muestra los eventos de tipo `incidente`.

### Estilo

Se reutilizan `StatusBadge`, las variables de los dos temas y los patrones de tickets. `StatusBadge` agrega `degradado` (`medio`), `parcial` (`alto`) y `total` (`critico`). Estados de carga, error con "Reintentar" y lista vacía en todas las pantallas. Verificación con capturas en tema oscuro, claro y móvil, y con el detector de `impeccable`.

## 6. Datos de demostración

`seed_demo` deja de fijar los códigos a mano y crea incidentes con impactos, fechas de origen, activos y tickets variados, incluido uno resuelto con duración y uno cerrado con causa raíz. Sigue siendo idempotente y conserva los conteos que usa el dashboard: 5 incidentes, 3 críticos activos y uno sin técnico.

## 7. Pruebas

**Backend**

- Permisos 401/403/200 y 405 en cada endpoint, incluido escalar.
- Función de severidad con todas las combinaciones, recálculo y respeto de la corrección manual.
- Cada transición válida e inválida con sus requisitos.
- `fecha_fin` al resolver y al reabrir, `duracion_minutos` y validaciones de `fecha_origen`.
- Asociar y quitar tickets con cada error. Resolución en cascada: activos pasan a resuelto con evento, cerrados no cambian, reabrir no reabre.
- Escalar: copia de datos, activo dado de baja, técnico inactivo, ticket cerrado o ya asociado.
- Atomicidad de resolver con tickets y de escalar.
- Migración con `MigrationExecutor`: severidad manual, impacto, fechas, descripción, tipos de acción.
- Dashboard: `ultima_accion` ignora eventos automáticos y el contrato no cambia.
- Seed y generación de código cuando el número ya existe.
- Filtros, valores inválidos (incluido `?organizacion=²`), orden, paginación y ausencia de N+1.

**Frontend**

Servicio, lista, formulario y ficha, escribiendo en el DOM real. Acciones por estado, aviso de tickets al resolver, confirmación al reabrir, incidente cerrado bloqueado, y escalar y asociar desde la ficha de ticket.

## 8. Entrega

- Commits pequeños en `sebas`, revisión final de toda la rama y PR a `develop`.
- `CLAUDE.md` se actualiza al terminar (Seb ya está avisado).
- Hay migraciones nuevas en `incidents` y `tickets`: tras sincronizar, cada equipo corre `migrate`. No hace falta reiniciar la base.
