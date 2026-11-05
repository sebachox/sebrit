# Contrato de API: Dashboard administrativo (v1)

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
| 200 | Usuario autenticado con rol `admin` |
| 401 | Sin token o token inválido |
| 403 | Usuario autenticado sin rol `admin` |

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

## Convenciones

- Nombres en `snake_case`, sin tildes en claves ni valores de enumeración.
- Las claves siempre están presentes. Cuando no hay valor se usa `null`; las listas vacías son `[]`, nunca `null`.
- Contadores: enteros mayores o iguales a 0.
- Fechas: ISO 8601 con zona horaria.