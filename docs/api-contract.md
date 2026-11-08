# Contrato de API SEBRIT (v1)

Fuente de verdad entre backend (Django) y frontend (Angular). Cualquier cambio se acuerda por PR a este archivo.

## Autenticación

Las peticiones protegidas llevan `Authorization: Bearer <access>`. El `access` dura 60 minutos.

### `POST /api/auth/login/` (público)

Recibe `{"username": "...", "password": "..."}`.

| Código | Cuándo |
|---|---|
| 200 | Credenciales válidas |
| 400 | Falta `username` o `password` |
| 401 | Credenciales incorrectas o usuario inactivo |

Respuesta 200:

```json
{
  "access": "<jwt>",
  "refresh": "<jwt>",
  "usuario": { "id": 1, "username": "admin", "nombre": "Ana Ruiz", "rol": "admin" }
}
```

### `POST /api/auth/refresh/` (público)

Recibe `{"refresh": "..."}` y devuelve `{"access": "..."}`. 401 si el `refresh` es inválido o venció.

### `GET /api/auth/me/` (autenticado)

Devuelve el usuario de la sesión, con la misma forma que `usuario` del login. 401 sin token.

### Objeto `usuario`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | entero | |
| `username` | string | |
| `nombre` | string | Nombre completo; si está vacío, el `username` |
| `rol` | string | `admin`, `tecnico` o `cliente` |

## Endpoint

`GET /api/dashboard/admin/`

| Código | Cuándo |
|---|---|
| 200 | Usuario autenticado con rol `admin` o `tecnico` (solo lectura) |
| 401 | Sin token o token inválido |
| 403 | Usuario con rol `cliente` (o método distinto de GET para el técnico) |

Ejemplo completo: [`docs/examples/dashboard-admin.json`](examples/dashboard-admin.json)

## Campos

| Campo | Tipo | Notas |
|---|---|---|
| `generado_en` | string | ISO 8601 con zona America/Bogota (`-05:00`) |
| `resumen_operativo.clientes_activos` | entero | Organizaciones con `activa = true` |
| `resumen_operativo.tickets_abiertos` | entero | Tickets en estado `abierto` o `en_progreso` |
| `resumen_operativo.mantenimientos_hoy` | entero | Programados para la fecha de hoy en America/Bogota |
| `resumen_operativo.incidentes_criticos` | entero | Incidentes activos con severidad `critica` |
| `incidentes` | arreglo | Máximo 10 incidentes activos, del más reciente al más antiguo. Puede ser `[]` |
| `incidentes[].id` | entero | |
| `incidentes[].codigo` | string | Ej. `INC-0001` |
| `incidentes[].titulo` | string | |
| `incidentes[].empresa` | objeto | `{ "id": entero, "nombre": string }` |
| `incidentes[].severidad` | string | Ver enumeraciones |
| `incidentes[].estado` | string | Ver enumeraciones |
| `incidentes[].tecnico_asignado` | objeto o `null` | `{ "id": entero, "nombre": string }` |
| `incidentes[].ultima_accion` | objeto o `null` | `{ "descripcion": string, "fecha": string ISO 8601 }` |
| `infraestructura.servidores` | objeto | `total`, `operativos`, `advertencia`, `criticos` (enteros) |
| `infraestructura.redes` | objeto | Mismas claves que servidores |
| `infraestructura.backups` | objeto | `total`, `exitosos`, `fallidos`, `pendientes` (enteros) |
| `infraestructura.incidentes_criticos` | objeto | `total`, `abiertos`, `en_progreso`, `sin_tecnico` (enteros) |

## Invariantes

- `servidores.total` = `operativos` + `advertencia` + `criticos` (igual para `redes`).
- `backups.total` = `exitosos` + `fallidos` + `pendientes`.
- `incidentes_criticos.total` = `abiertos` + `en_progreso` y es igual a `resumen_operativo.incidentes_criticos`.
- `sin_tecnico` es un subconjunto aparte: no suma al total.

## Enumeraciones

| Campo | Valores |
|---|---|
| `severidad` | `baja`, `media`, `alta`, `critica` |
| `estado` (incidente) | `abierto`, `en_progreso`, `resuelto`, `cerrado` |
| Estado de activo | `operativo`, `advertencia`, `critico` |
| Estado de backup | `exitoso`, `fallido`, `pendiente` |
| `rol` (usuario) | `admin`, `tecnico`, `cliente` |

Un incidente o ticket está **activo** si su estado es `abierto` o `en_progreso`.

Los activos dados de baja (`de_baja = true`) no cuentan en `infraestructura.servidores` ni en `infraestructura.redes`.

## Convenciones

- Nombres en `snake_case`, sin tildes en claves ni valores de enumeración.
- Las claves siempre están presentes. Cuando no hay valor se usa `null`; las listas vacías son `[]`, nunca `null`.
- Contadores: enteros mayores o iguales a 0.
- Fechas: ISO 8601 con zona horaria.

---

# Organizaciones (clientes)

Recurso `/api/organizaciones/`. No hay borrado: un cliente se desactiva con `PATCH {"activa": false}` y se reactiva con `{"activa": true}`.

## Permisos

| Método | Ruta | Admin | Técnico | Cliente | Sin token |
|---|---|---|---|---|---|
| GET | `/api/organizaciones/` | 200 | 200 | 403 | 401 |
| GET | `/api/organizaciones/{id}/` | 200 | 200 | 403 | 401 |
| POST | `/api/organizaciones/` | 201 | 403 | 403 | 401 |
| PATCH | `/api/organizaciones/{id}/` | 200 | 403 | 403 | 401 |
| PUT, DELETE | `/api/organizaciones/{id}/` | 405 | 403 | 403 | 401 |

Un `id` inexistente da 404.

## Lista: `GET /api/organizaciones/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Texto. Busca, sin distinguir mayúsculas, en `nombre`, `nit`, `ciudad` y `contacto_nombre`. Solo espacios = sin filtro | — |
| `activa` | `true`, `false` (otro valor se ignora) | Sin filtro |
| `plan` | `basico`, `estandar`, `premium` (otro valor se ignora) | Sin filtro |
| `ordering` | `nombre`, `-nombre`, `creado_en`, `-creado_en` | `nombre` (sin distinguir mayúsculas) |
| `page` | Entero ≥ 1. Una página fuera de rango da 404 | 1 |
| `page_size` | Entero; máximo 100 | 20 |

Respuesta:

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "nombre": "Empresa Ejemplo S.A.S.",
      "nit": "900123456-7",
      "ciudad": "Bogotá",
      "plan": "premium",
      "contacto_nombre": "Ana Ruiz",
      "fecha_fin_contrato": "2027-01-31",
      "activa": true
    }
  ]
}
```

## Detalle, creación y edición

`GET /api/organizaciones/{id}/`, `POST` (201) y `PATCH` (200) responden con el detalle completo. Ejemplo: [`docs/examples/organizacion.json`](examples/organizacion.json).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | entero | Solo lectura |
| `nombre` | string | Obligatorio, máx. 150. Único sin distinguir mayúsculas |
| `nit` | string | Obligatorio al crear; no se puede vaciar. Formato `^\d{6,10}(-\d)?$` (sin puntos ni espacios). Único. Puede ser `null` solo en organizaciones anteriores al módulo |
| `sector`, `telefono`, `correo`, `direccion`, `ciudad` | string o `null` | Opcionales. `correo` debe ser un email válido |
| `contacto_nombre`, `contacto_cargo`, `contacto_correo`, `contacto_telefono` | string o `null` | Contacto principal, opcional |
| `plan` | string o `null` | `basico`, `estandar`, `premium` |
| `fecha_inicio_contrato`, `fecha_fin_contrato` | string `YYYY-MM-DD` o `null` | Fin no puede ser anterior a inicio (también en `PATCH` parcial) |
| `activa` | booleano | Por defecto `true` |
| `creado_en`, `actualizado_en` | string ISO 8601 | Solo lectura |
| `resumen` | objeto | Solo lectura, solo en el detalle (ver abajo) |

`resumen`:

| Campo | Regla |
|---|---|
| `activos` | Activos de la organización que no están dados de baja |
| `tickets_abiertos` | Tickets en `abierto` o `en_progreso` |
| `incidentes_activos` | Incidentes en `abierto` o `en_progreso` |
| `usuarios` | Usuarios asignados a la organización |

En la entrada, los opcionales aceptan `null` o `""`; en la salida, vacío siempre es `null`.

## Errores de validación (400)

Errores por campo:

```json
{ "nit": ["Ya existe una organización con este NIT."] }
```

| Campo | Mensaje |
|---|---|
| `nit` | `El NIT es obligatorio.` |
| `nit` | `Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7.` |
| `nit` | `Ya existe una organización con este NIT.` |
| `nombre` | `Ya existe una organización con este nombre.` |
| `fecha_fin_contrato` | `La fecha de fin no puede ser anterior a la de inicio.` |

---

# Activos

Recurso `/api/activos/`. No hay borrado: un activo se da de baja con `PATCH {"de_baja": true}` y se reactiva con `{"de_baja": false}`.

## Permisos (activos y backups)

Admin y técnico tienen los mismos permisos. Sin token: 401. Cliente: 403.

| Método | Ruta | Admin y técnico |
|---|---|---|
| GET | `/api/activos/`, `/api/activos/{id}/` | 200 |
| POST | `/api/activos/` | 201 |
| PATCH | `/api/activos/{id}/` | 200 |
| PUT, DELETE | `/api/activos/{id}/` | 405 |
| GET | `/api/backups/`, `/api/backups/{id}/` | 200 |
| POST | `/api/backups/` | 201 |
| PATCH | `/api/backups/{id}/` | 200 |
| DELETE | `/api/backups/{id}/` | 204 |
| PUT | `/api/backups/{id}/` | 405 |

## Lista: `GET /api/activos/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Busca, sin distinguir mayúsculas, en `nombre`, `hostname`, `ip`, `numero_serie`, `fabricante`, `modelo` | — |
| `organizacion` | id (no numérico se ignora) | Sin filtro |
| `tipo` | `servidor`, `red` (otro valor se ignora) | Sin filtro |
| `estado` | `operativo`, `advertencia`, `critico` (otro valor se ignora) | Sin filtro |
| `de_baja` | `true` muestra solo los dados de baja | Se excluyen los dados de baja |
| `ordering` | `nombre`, `-nombre`, `estado` (critico → advertencia → operativo), `creado_en`, `-creado_en` | `nombre` |
| `page`, `page_size` | Como organizaciones | 20, máximo 100 |

Cada fila: `id`, `nombre`, `tipo`, `estado`, `organizacion: {id, nombre}`, `ip`, `hostname`, `ubicacion`, `de_baja`, `ultimo_backup: {id, fecha, estado} | null` (el de `fecha` más reciente).

## Detalle, creación y edición

Ejemplo: [`docs/examples/activo.json`](examples/activo.json). Además de los campos de la lista: `sistema_operativo`, `fabricante`, `modelo`, `numero_serie`, `notas`, `fecha_baja` (solo lectura), `creado_en`, `actualizado_en` y `resumen_backups: {total, exitosos, fallidos, pendientes}`.

- `POST` recibe `organizacion` (id), `tipo`, `nombre`, `estado` y los opcionales.
- `PATCH` acepta los mismos campos; `organizacion` no puede cambiar. El cambio rápido de estado es `PATCH {"estado": "critico"}`.
- Un activo dado de baja solo admite reactivarse (`{"de_baja": false}`, opcionalmente con otros cambios); cualquier otro cambio da 400.

# Backups

Recurso `/api/backups/`. Ejemplo: [`docs/examples/backup.json`](examples/backup.json).

## Lista: `GET /api/backups/`

Filtros: `organizacion`, `activo` (ids), `estado` (`exitoso`, `fallido`, `pendiente`), `tipo` (`completo`, `incremental`, `diferencial`), `desde` y `hasta` (`YYYY-MM-DD`, inclusivos, en hora de America/Bogota). Orden: más recientes primero. Paginación 20/100.

Cada backup: `id`, `activo: {id, nombre} | null`, `organizacion: {id, nombre}`, `fecha`, `estado`, `tipo | null`, `tamano_gb` (número o `null`), `notas | null`, `registrado_por: {id, nombre} | null`, `creado_en`.

## Registrar y editar

- `POST` recibe `activo` (id), `estado`, `tipo` y opcionales `fecha` (por defecto ahora), `tamano_gb`, `notas`. `organizacion` se toma del activo y `registrado_por` es el usuario de la sesión.
- `PATCH` acepta los mismos campos; si cambia `activo`, `organizacion` se actualiza.
- `DELETE` responde 204.
- `activo` y `tipo` pueden ser `null` solo en backups anteriores al módulo 03.

## Errores de validación (400): activos y backups

| Campo | Mensaje |
|---|---|
| `nombre` | `Ya existe un activo con este nombre en este cliente.` |
| `ip` | `Escribe una dirección IP válida, por ejemplo 192.168.1.10.` |
| `organizacion` | `No se puede cambiar el cliente de un activo.` |
| `estado`, `activo` o `non_field_errors` | `El activo está dado de baja.` |
| `fecha` | `La fecha del backup no puede ser futura.` (se toleran 5 minutos de diferencia de reloj) |
| `tamano_gb` | `El tamaño no puede ser negativo.` |

---

# Tickets

Recurso `/api/tickets/`. Admin y técnico tienen los mismos permisos. Sin token: 401. Cliente: 403. Los tickets no se borran.

## Permisos

| Método | Ruta | Admin y técnico |
|---|---|---|
| GET | `/api/tickets/`, `/api/tickets/{id}/` | 200 |
| POST | `/api/tickets/` | 201 |
| PATCH | `/api/tickets/{id}/` | 200 |
| POST | `/api/tickets/{id}/estado/` | 200 |
| POST | `/api/tickets/{id}/prioridad/` | 200 |
| POST | `/api/tickets/{id}/comentarios/` | 201 |
| PUT, DELETE | `/api/tickets/{id}/` | 405 |
| GET | `/api/tecnicos/` | 200 |

`GET /api/tecnicos/` devuelve `[{id, nombre}]` con los usuarios activos con rol `admin` o `tecnico`, sin paginar.

## Lista: `GET /api/tickets/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Busca, sin distinguir mayúsculas, en `codigo` y `titulo` | — |
| `organizacion`, `activo` | id | Sin filtro |
| `estado` | `abierto`, `en_progreso`, `resuelto`, `cerrado` | Sin filtro |
| `abiertos` | `true`: solo `abierto` y `en_progreso` | Sin filtro |
| `prioridad` | `baja`, `media`, `alta`, `critica` | Sin filtro |
| `categoria` | `hardware`, `software`, `red`, `seguridad`, `accesos`, `otro` | Sin filtro |
| `tecnico` | id o `sin_asignar` | Sin filtro |
| `ordering` | `prioridad` (critica → baja; el más antiguo primero), `creado_en`, `-creado_en` | `prioridad` |
| `page`, `page_size` | Como organizaciones | 20, máximo 100 |

Los valores inválidos se ignoran.

Cada fila: `id`, `codigo`, `titulo`, `organizacion: {id, nombre}`, `categoria`, `prioridad`, `prioridad_manual`, `estado`, `tecnico: {id, nombre} | null`, `activo: {id, nombre} | null`, `creado_en`.

## Detalle, creación y edición

Ejemplo: [`docs/examples/ticket.json`](examples/ticket.json). Además de los campos de la lista: `descripcion`, `alcance` (`un_usuario`, `varios_usuarios`, `toda_empresa`), `reportado_por: {id, nombre} | null`, `solucion | null`, `actualizado_en`, `resuelto_en | null`, `cerrado_en | null` y `eventos` en orden cronológico.

Cada evento: `id`, `tipo` (`creacion`, `comentario`, `estado`, `tecnico`, `prioridad`), `autor: {id, nombre} | null`, `texto | null`, `valor_anterior | null`, `valor_nuevo | null`, `fecha`.

- `POST` recibe `organizacion` (id), `titulo`, `descripcion`, `categoria`, `alcance` y opcionales `activo` y `tecnico` (id o `null`).
- `PATCH` acepta los mismos campos; `organizacion` no puede cambiar.
- `codigo` (`TCK-0001`), `prioridad`, `estado`, `solucion`, `reportado_por` y las fechas no se envían.

## Prioridad automática

| Factor | Puntos |
|---|---|
| Alcance `un_usuario` / `varios_usuarios` / `toda_empresa` | 1 / 2 / 3 |
| Categoría `red` o `seguridad` | +1 |
| Activo de tipo `servidor` | +1 |
| Activo en estado `critico` | +1 |

Total: 1 → `baja`; 2 → `media`; 3–4 → `alta`; 5–6 → `critica`. Se calcula al crear y al editar `alcance`, `categoria` o `activo`, salvo que `prioridad_manual` sea `true`.

`POST /{id}/prioridad/` con `{"prioridad": "alta", "motivo": "..."}` la corrige a mano y marca `prioridad_manual`.

## Flujo de estados

`POST /{id}/estado/` con `{"estado": "resuelto", "solucion": "..."}` (`solucion` solo al resolver).

| Desde | Hacia | Requisito |
|---|---|---|
| `abierto` | `en_progreso` | Técnico asignado |
| `en_progreso` | `abierto` | — |
| `en_progreso` | `resuelto` | `solucion` |
| `resuelto` | `cerrado` | — |
| `resuelto`, `cerrado` | `abierto` | Reabrir: vacía `solucion`, `resuelto_en` y `cerrado_en` |

Un ticket `cerrado` solo admite reabrirse.

## Comentarios

`POST /{id}/comentarios/` con `{"texto": "..."}` responde 201 con el evento creado.

## Errores de validación (400)

| Campo | Mensaje |
|---|---|
| `estado` | `No se puede pasar de «Abierto» a «Resuelto».` |
| `tecnico` | `Asigna un técnico antes de pasar a En progreso.` |
| `tecnico` | `Un ticket en progreso debe tener un técnico asignado.` |
| `tecnico` | `El usuario debe ser un técnico o administrador activo.` |
| `solucion` | `Describe la solución para resolver el ticket.` |
| `motivo` | `Explica por qué cambias la prioridad.` |
| `texto` | `Escribe el comentario.` |
| `organizacion` | `No se puede cambiar el cliente de un ticket.` |
| `activo` | `El activo no pertenece a este cliente.` |
| `activo` | `El activo está dado de baja.` |
| `non_field_errors` | `El ticket está cerrado. Reábrelo para modificarlo.` |
