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
| `activos` | Todos los activos de la organización |
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
