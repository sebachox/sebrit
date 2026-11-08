# Módulo 04: Tickets y soporte — Diseño

Fecha: 2026-11-08 · Estado: aprobado en conversación, pendiente de revisión escrita · Rama: `sebas`

## 1. Objetivo

Permitir que el personal de SEBRIT registre las solicitudes de soporte de cada cliente, las asigne, las trabaje y las cierre, con una prioridad calculada automáticamente según lo afectado y una línea de tiempo de comentarios y cambios.

**Criterio de éxito:** desde Angular, admin y técnico listan, filtran, crean, editan, asignan, comentan y cambian el estado de los tickets, y pueden corregir la prioridad con un motivo. El rol cliente no tiene acceso. Los permisos se validan en el backend con pruebas 401/403/200 por rol y método.

### Fuera de alcance

- Portal para que el cliente abra tickets.
- Reglas de SLA y tiempos de respuesta (módulo 07).
- Notificaciones por correo.
- Adjuntos.
- Volver una prioridad corregida a automática.
- Recalcular la prioridad cuando cambia el estado del activo sin editar el ticket.

## 2. Modelo de datos

### `Ticket` (app `tickets`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `codigo` | `CharField(20, unique=True, editable=False)` | Automático: `TCK-` + id con 4 dígitos (`TCK-0001`). Solo lectura |
| `organizacion` | FK `Organizacion`, `PROTECT` | Ya existe. Se fija al crear |
| `titulo` | `CharField(200)` | Ya existe. Obligatorio |
| `descripcion` | `TextField(blank=True)` | Obligatoria en `POST`; vacía solo en tickets anteriores al módulo |
| `categoria` | `CharField(choices, default="otro")` | `hardware`, `software`, `red`, `seguridad`, `accesos`, `otro`. Obligatoria en `POST` |
| `alcance` | `CharField(choices, default="un_usuario")` | `un_usuario`, `varios_usuarios`, `toda_empresa`. Obligatorio en `POST` |
| `activo` | FK `Activo`, `null=True`, `blank=True`, `PROTECT` | Opcional. Mismo cliente y no dado de baja |
| `prioridad` | `CharField(choices, default="baja")` | `baja`, `media`, `alta`, `critica`. Solo lectura en `POST`/`PATCH` |
| `prioridad_manual` | `BooleanField(default=False)` | Solo lectura |
| `estado` | `CharField(choices)` | Ya existe: `abierto`, `en_progreso`, `resuelto`, `cerrado`. Solo lectura en `POST`/`PATCH` |
| `tecnico` | FK `Usuario`, `null=True`, `blank=True`, `SET_NULL` | Opcional. Rol `admin` o `tecnico` y activo |
| `reportado_por` | FK `Usuario`, `null=True`, `blank=True`, `SET_NULL` | Automático: usuario de la sesión. Solo lectura |
| `solucion` | `TextField(blank=True)` | Se llena al resolver. Solo lectura en `POST`/`PATCH` |
| `creado_en` | `DateTimeField(default=timezone.now)` | Ya existe |
| `actualizado_en` | `DateTimeField(auto_now=True)` | Automático |
| `resuelto_en`, `cerrado_en` | `DateTimeField(null=True, blank=True)` | Automáticos; se vacían al reabrir |

### `EventoTicket` (app `tickets`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `ticket` | FK `Ticket`, `CASCADE`, `related_name="eventos"` | |
| `tipo` | `CharField(choices)` | `creacion`, `comentario`, `estado`, `tecnico`, `prioridad` |
| `autor` | FK `Usuario`, `null=True`, `SET_NULL` | Usuario de la sesión |
| `texto` | `TextField(blank=True)` | Comentario, motivo de corrección o solución |
| `valor_anterior`, `valor_nuevo` | `CharField(100, blank=True)` | Para `estado`, `tecnico` y `prioridad` (en `tecnico`, el nombre del técnico) |
| `fecha` | `DateTimeField(default=timezone.now)` | Automática |

### Regla de prioridad

Función pura `calcular_prioridad(alcance: str, categoria: str, activo: Activo | None) -> str` en `apps/tickets/prioridad.py`.

| Factor | Puntos |
|---|---|
| Alcance `un_usuario` / `varios_usuarios` / `toda_empresa` | 1 / 2 / 3 |
| Categoría `red` o `seguridad` | +1 |
| Activo de tipo `servidor` | +1 |
| Activo en estado `critico` | +1 |

Total: 1 → `baja`; 2 → `media`; 3–4 → `alta`; 5–6 → `critica`.

Se calcula al crear y al editar `alcance`, `categoria` o `activo`, salvo que `prioridad_manual` sea `true`. Si el valor calculado cambia, se registra un evento `prioridad` sin texto.

### Flujo de estados

| Desde | Hacia | Requisito |
|---|---|---|
| `abierto` | `en_progreso` | Tener técnico asignado |
| `en_progreso` | `abierto` | — |
| `en_progreso` | `resuelto` | `solucion` no vacía |
| `resuelto` | `cerrado` | — |
| `resuelto`, `cerrado` | `abierto` | Reabrir: vacía `solucion`, `resuelto_en` y `cerrado_en`; el evento de resolución conserva el texto |

Cualquier otra transición da 400. Un ticket `cerrado` no admite `PATCH`, comentarios, corrección de prioridad ni cambios de estado distintos de reabrir. Los tickets no se borran.

Cada cambio deja un evento con autor y fecha. Editar sin cambiar `tecnico` o `prioridad` no crea eventos.

### Datos existentes y seed

La migración asigna `codigo` a los tickets existentes; quedan con `un_usuario`, `otro` y `baja` por los valores por defecto. `seed_demo` crea tickets con datos variados (descripción, categoría, alcance y prioridad calculada, algunos con técnico).

El dashboard no cambia.

## 3. API

Un `ModelViewSet` en `apps/tickets` registrado en el router existente, con acciones `@action` para `estado`, `prioridad` y `comentarios`. La clase de permiso es `EsAdminOTecnico` (`apps/assets/permissions.py`).

### Permisos

Sin token: 401 en todo. Cliente: 403 en todo. Admin y técnico:

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/tickets/`, `/api/tickets/{id}/` | 200 |
| POST | `/api/tickets/` | 201 |
| PATCH | `/api/tickets/{id}/` | 200 |
| POST | `/api/tickets/{id}/estado/` | 200 |
| POST | `/api/tickets/{id}/prioridad/` | 200 |
| POST | `/api/tickets/{id}/comentarios/` | 201 |
| PUT, DELETE | `/api/tickets/{id}/` | 405 |
| GET | `/api/tecnicos/` | 200 |

Un `id` inexistente da 404.

`GET /api/tecnicos/`: lista sin paginar `[{id, nombre}]` de usuarios activos con rol `admin` o `tecnico`, ordenada por nombre.

### Lista: `GET /api/tickets/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Busca, sin distinguir mayúsculas, en `codigo` y `titulo`. Solo espacios = sin filtro | — |
| `organizacion`, `activo` | id | Sin filtro |
| `estado` | `abierto`, `en_progreso`, `resuelto`, `cerrado` | Sin filtro |
| `abiertos` | `true`: solo `abierto` y `en_progreso` | Sin filtro |
| `prioridad` | `baja`, `media`, `alta`, `critica` | Sin filtro |
| `categoria` | Valores de la enumeración | Sin filtro |
| `tecnico` | id o `sin_asignar` | Sin filtro |
| `ordering` | `prioridad` (critica → baja; dentro de cada nivel, el más antiguo primero), `creado_en`, `-creado_en` | `prioridad` |
| `page`, `page_size` | Como organizaciones | 20, máximo 100 |

Los valores inválidos se ignoran.

Cada fila: `id`, `codigo`, `titulo`, `organizacion: {id, nombre}`, `categoria`, `prioridad`, `prioridad_manual`, `estado`, `tecnico: {id, nombre} | null`, `activo: {id, nombre} | null`, `creado_en`. La lista hace un número fijo de consultas.

### Detalle: `GET /api/tickets/{id}/`

Todos los campos de la sección 2, con `organizacion`, `tecnico`, `activo` y `reportado_por` como `{id, nombre} | null`, más `eventos` en orden cronológico; cada evento: `id`, `tipo`, `autor: {id, nombre} | null`, `texto | null`, `valor_anterior | null`, `valor_nuevo | null`, `fecha`.

### Crear y editar

- `POST` recibe `organizacion` (id), `titulo`, `descripcion`, `categoria`, `alcance` y opcionales `activo` (id o `null`) y `tecnico` (id o `null`). Calcula la prioridad, fija `reportado_por` y crea el evento `creacion`. Responde 201 con el detalle.
- `PATCH` acepta los mismos campos; enviar una `organizacion` distinta da 400. Si cambia `tecnico`, crea el evento `tecnico`. Responde con el detalle.
- `codigo`, `prioridad`, `prioridad_manual`, `estado`, `solucion`, `reportado_por` y las fechas no se modifican por `POST`/`PATCH`.

### Acciones

- `POST /{id}/estado/` — `{"estado": "<valor>", "solucion": "<texto>"}`. `solucion` solo se usa al resolver; responde con el detalle.
- `POST /{id}/prioridad/` — `{"prioridad": "<valor>", "motivo": "<texto>"}`. Marca `prioridad_manual`; crea el evento `prioridad` con el motivo en `texto`; responde con el detalle.
- `POST /{id}/comentarios/` — `{"texto": "<texto>"}`; responde 201 con el evento creado.

### Errores 400 (mensajes)

| Campo | Mensaje |
|---|---|
| `estado` | `No se puede pasar de «X» a «Y».` (nombres legibles: Abierto, En progreso, Resuelto, Cerrado) |
| `tecnico` | `Asigna un técnico antes de pasar a En progreso.` |
| `tecnico` | `El usuario debe ser un técnico o administrador activo.` |
| `solucion` | `Describe la solución para resolver el ticket.` |
| `motivo` | `Explica por qué cambias la prioridad.` |
| `texto` | `Escribe el comentario.` |
| `organizacion` | `No se puede cambiar el cliente de un ticket.` |
| `activo` | `El activo no pertenece a este cliente.` |
| `activo` | `El activo está dado de baja.` |
| `non_field_errors` | `El ticket está cerrado. Reábrelo para modificarlo.` |

Convenciones del contrato: claves siempre presentes; opcionales vacíos como `null`; entrada acepta `null` y `""` en textos opcionales.

### Documentación

Sección "Tickets" en `docs/api-contract.md` (incluye la regla de prioridad y el flujo de estados) y ejemplo en `docs/examples/ticket.json`.

## 4. Frontend

### Permisos

`Modulo` agrega `tickets`, con `ver` y `editar` para `admin` y `tecnico`. Sidebar: "Tickets" (`bi-ticket-perforated`).

### Pantallas

| Pantalla | Ruta | Acceso |
|---|---|---|
| Lista | `/admin/tickets` | ver `tickets` |
| Ficha | `/admin/tickets/:id` | ver `tickets` |
| Formulario | `/admin/tickets/nuevo`, `/admin/tickets/:id/editar` | editar `tickets` |

**Lista:** búsqueda (300 ms), cliente (todos, incluidos inactivos, marcados "(inactivo)"), estado ("Abiertos" por defecto = `abiertos=true`; "Todos"; cada estado), prioridad, categoría, técnico (incluye "Sin asignar"), orden ("Más urgentes primero" / "Más recientes"). Acepta `?organizacion=<id>` y lo refleja en el selector. Tabla: Código, Título, Cliente, Prioridad (badge con marca si `prioridad_manual`), Estado, Técnico ("Sin asignar"), Categoría, Fecha. Botón "Nuevo ticket". Estados de carga, error, vacío y sin resultados. Una búsqueda nueva cancela la anterior.

**Ficha:** código, título, badges de prioridad y estado, enlaces al cliente y al activo. Acciones según estado:

| Estado | Acciones |
|---|---|
| `abierto` | Empezar |
| `en_progreso` | Resolver (abre campo de solución en la página), Devolver a abierto |
| `resuelto` | Cerrar, Reabrir |
| `cerrado` | Reabrir |

Sin técnico, "Empezar" se muestra deshabilitado con el motivo "Asigna un técnico primero". Asignación: selector de técnico y botón "Tomarlo yo" (asigna al usuario de la sesión). Prioridad: badge, texto "Automática" o "Corregida a mano" y botón "Corregir" (selector y motivo obligatorio en la página). Bloques: Descripción, Solución (si hay) y Datos (categoría, alcance, reportado por, fechas; `null` → "—"). Línea de tiempo cronológica con autor y fecha, y caja para comentar. Ticket cerrado: aviso visible; todo deshabilitado salvo Reabrir. 404 → "Ticket no encontrado". Con `?guardado=1`: "Ticket guardado correctamente."

**Formulario:** cliente (solo al crear; clientes activos, hasta 100), título, descripción, categoría, alcance, activo (solo los del cliente elegido, se recarga al cambiar de cliente) y técnico. Nota: la prioridad se calcula sola según alcance, categoría y activo. Validación local (requeridos) y errores 400 bajo cada campo. Al guardar vuelve a la ficha con `?guardado=1`.

**Ficha de cliente:** la tarjeta "Tickets abiertos" enlaza a `/admin/tickets?organizacion=<id>`.

### Código

- `core/models/ticket.ts`, `core/services/tickets.service.ts`.
- `features/admin/tickets/` (`tickets-lista`, `ticket-ficha`, `ticket-form`).
- Reutiliza `StatusBadge` y la paleta de `styles.scss`; sin colores fijos. Implementación con la skill `impeccable`; verificación en ambos temas.

## 5. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Red caída o 500 | Estado de error con "Reintentar" |
| 400 | Errores por campo + mensaje general |
| 404 | "Ticket no encontrado" + enlace a la lista |
| 403 | El interceptor redirige a `/sin-permiso` |
| 401 | Refresh automático; si falla, cierra sesión |

## 6. Pruebas (TDD)

### Backend

- `calcular_prioridad`: cada factor, los límites de nivel y los ejemplos de la sección 2.
- Permisos de la tabla de la sección 3, incluidos 405 y `/api/tecnicos/`.
- Recálculo al crear y al editar alcance, categoría o activo; sin recálculo con `prioridad_manual`; corrección con motivo obligatorio y evento.
- Flujo: cada transición válida e inválida; requisitos de técnico y solución; `resuelto_en`, `cerrado_en`; reabrir conserva la solución en el historial.
- Validación: activo de otro cliente o dado de baja, técnico inválido, cliente fijo, ticket cerrado.
- Derivados: código automático, `reportado_por`, autor de eventos, un evento por cambio y ninguno si no hay cambios.
- Lista: filtros, `abiertos`, `sin_asignar`, orden, filtros inválidos ignorados, número de consultas constante.
- Migración y `seed_demo`; `tickets_abiertos` del dashboard no cambia.

### Frontend

- Mapa de permisos y enlace en el sidebar.
- Servicio: parámetros y acciones.
- Lista: filtro por defecto, `?organizacion=`, estados, cancelación de búsqueda.
- Ficha: acciones por estado, solución y motivo obligatorios, "Tomarlo yo", comentario en la línea de tiempo, ticket cerrado.
- Formulario: validación, recarga de activos al cambiar de cliente, error del servidor en su campo, doble envío. Las pruebas escriben en el DOM real cuando el tipo de dato dependa del input.

### Verificación final

Suites completas y build; capturas de las pantallas en tema oscuro y claro, escritorio y móvil, como admin y técnico; detector de `impeccable`; revisión final de toda la rama con un revisor independiente.

## 7. Documentación y entrega

- `docs/api-contract.md`, `docs/examples/ticket.json`.
- `CLAUDE.md`: módulo 04, modelos, endpoints, regla de prioridad, flujo de estados y mapa de permisos.
- Commits en `sebas` (verificando la rama antes de cada uno); PR a `develop` al terminar el módulo.
