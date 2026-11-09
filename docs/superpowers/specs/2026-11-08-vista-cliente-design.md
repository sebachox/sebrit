# Vista del cliente: diseño

Fecha: 2026-11-08. Estado: aprobado por secciones; pendiente de revisión escrita.

## Objetivo

Que un usuario con rol `cliente` entre a SEBRIT, vea el estado del servicio de su empresa, abra tickets, los siga y los comente, sin poder ver nunca datos de otra empresa ni información interna del equipo.

Éxito: aunque un cliente manipule URLs o ids, solo obtiene datos de su organización, y los endpoints internos le siguen dando 403.

## Decisiones

| Tema | Decisión |
|---|---|
| Alcance | Inicio con resumen en números y tickets (abrir, seguir, comentar) |
| Comentarios del equipo | Internos por defecto; el técnico marca "Visible para el cliente". Los existentes quedan internos |
| Visibilidad entre compañeros | Cada usuario ve y comenta todos los tickets de su empresa |
| Cuentas | El admin las gestiona desde la ficha del cliente, con contraseña inicial que la persona cambia en Mi perfil |
| Arquitectura | API propia `/api/portal/...` con serializers de lista blanca y layout Angular propio en `/portal/...` |
| Cambios de estado | El cliente no los hace. Para reabrir un ticket resuelto lo pide comentando; uno cerrado no admite comentarios |

## Fuera de alcance

Listas y fichas de activos, backups e incidentes para el cliente; dashboards adicionales; adjuntos; notificaciones y correos; registro público; recuperación de contraseña por correo; que el cliente cambie estados.

## Modelo de datos

`EventoTicket` agrega `visible_cliente` (booleano, por defecto `False`). La migración no toca los registros existentes, así que los comentarios actuales quedan internos.

`comentar(ticket, texto, autor, visible_cliente=False)` en `apps/tickets/servicios.py` guarda el valor. No hay otros cambios de modelo.

## Permiso del portal

`EsClienteDelPortal`: exige rol `cliente`, `organizacion` asignada y organización con `activa = True`. Si no se cumple, 403. Sin token, 401. Los endpoints internos no cambian y siguen rechazando al rol `cliente`.

Toda consulta parte de `request.user.organizacion`. Ningún endpoint del portal acepta un id de organización.

## API del portal

Convenciones del contrato: `snake_case`, claves siempre presentes, `null` sin valor, mensajes en español, cuerpo que no es objeto o con carácter NUL da 400. PUT y DELETE dan 405.

### `GET /api/portal/resumen/`

```json
{
  "generado_en": "2026-11-08T10:00:00-05:00",
  "empresa": { "id": 1, "nombre": "Metropolis 21" },
  "tickets": { "abiertos": 3, "en_progreso": 1, "resueltos": 2 },
  "incidentes_activos": 1,
  "infraestructura": {
    "servidores": { "total": 12, "operativos": 10, "advertencia": 1, "criticos": 1 },
    "redes": { "total": 6, "operativos": 6, "advertencia": 0, "criticos": 0 },
    "backups": { "total": 20, "exitosos": 18, "fallidos": 1, "pendientes": 1 }
  }
}
```

Los activos dados de baja no cuentan. Un incidente activo es el que está `abierto` o `en_progreso`.

### `GET, POST /api/portal/tickets/`

Lista paginada (20, máximo 100), del más reciente al más antiguo. Parámetros: `q` (código o título), `estado`, `abiertos=true`, `page`, `page_size`.

Cada fila: `id`, `codigo`, `titulo`, `categoria`, `estado`, `activo` (`{id, nombre}` o `null`), `tecnico` (nombre o `null`), `creado_en`, `actualizado_en`.

POST recibe `titulo`, `descripcion`, `categoria`, `alcance` y `activo` (opcional). El activo debe ser de la empresa y no estar dado de baja; si no, 400 en `activo`. El servidor fija `organizacion` y `reportado_por`, calcula la prioridad con la regla actual y registra el evento de creación. Responde 201 con el detalle.

### `GET /api/portal/tickets/{id}/`

Lo de la fila más `descripcion`, `alcance`, `solucion`, `reportado_por` (nombre o `null`), `resuelto_en`, `cerrado_en` y `eventos`. Un ticket de otra empresa o inexistente da 404.

`eventos` trae solo los de tipo `creacion` y `estado` y los `comentario` con `visible_cliente = True`, en orden cronológico. Cada uno: `id`, `tipo`, `autor` (nombre o `null`), `autor_es_cliente`, `texto`, `valor_anterior`, `valor_nuevo`, `fecha`.

Nunca se exponen `prioridad`, `prioridad_manual`, `incidente`, los eventos `tecnico`, `prioridad` e `incidente` ni las notas internas.

### `POST /api/portal/tickets/{id}/comentarios/`

Recibe `texto`, siempre visible. Responde 201 con el evento. Texto vacío o ticket cerrado: 400.

### `GET /api/portal/activos/`

`[{id, nombre, tipo}]` de los activos no dados de baja de la empresa, ordenados por nombre.

## Cambios en la API interna

`POST /api/tickets/{id}/comentarios/` acepta `visible_cliente` (booleano opcional, por defecto `false`; otro tipo da 400). `EventoSerializer` expone `visible_cliente` y `autor_es_cliente`.

## Usuarios de la empresa

Admin: todo. Técnico: solo GET; escribir da 403. Cliente: 403. Organización inexistente: 404. Un `uid` que no sea un usuario `cliente` de esa organización da 404, de modo que estos endpoints no alcanzan cuentas internas.

| Método | Ruta | Detalle |
|---|---|---|
| GET | `/api/organizaciones/{id}/usuarios/` | `[{id, username, nombres, apellidos, correo, activo}]` |
| POST | `/api/organizaciones/{id}/usuarios/` | `username`, `clave_inicial`, y opcionales `nombres`, `apellidos`, `correo`. Rol y organización los fija el servidor. 201 |
| PATCH | `/api/organizaciones/{id}/usuarios/{uid}/` | `nombres`, `apellidos`, `correo`, `activo`. El `username` no cambia |
| POST | `/api/organizaciones/{id}/usuarios/{uid}/clave/` | `clave_nueva`; 204 |

`username` es único sin distinguir mayúsculas. Las contraseñas pasan los validadores de Django con mensajes en español. Un usuario desactivado deja de autenticarse en su siguiente petición.

## Frontend

### Acceso

`rutaInicio()` lleva al cliente a `/portal/inicio`. Un guard nuevo saca de `/portal` a quien no sea cliente, hacia su inicio. Los módulos de `/admin` siguen rechazándolo con `permisoGuard`. Un 403 lleva a `/sin-permiso`, que cubre empresa inactiva o sin organización.

### Layout

`PortalLayout`: barra superior con Inicio y Mis tickets, nombre de la empresa, enlace a Mi perfil, selector de tema y Salir; se colapsa en móvil. Usa los dos temas y las variables de `styles.scss`.

### Pantallas

| Pantalla | Ruta | Contenido |
|---|---|---|
| Inicio | `/portal/inicio` | Tarjetas de tickets abiertos, en progreso e incidentes activos; servidores, redes y backups por estado; últimos 5 tickets abiertos; botón "Abrir ticket" |
| Mis tickets | `/portal/tickets` | Por defecto abiertos; búsqueda, filtro de estado y paginación |
| Abrir ticket | `/portal/tickets/nuevo` | Título, descripción, categoría, "¿A quién afecta?" (Solo a mí, A varias personas, A toda la empresa) y activo opcional |
| Ficha | `/portal/tickets/:id` | Datos, solución si existe, conversación y caja para comentar. Cerrado: "Este ticket está cerrado. Si el problema volvió, abre uno nuevo." |
| Mi perfil | `/portal/perfil` | La pantalla existente de Mi perfil dentro del layout del portal |

Todas con estados de carga, error con "Reintentar" y lista vacía. Se reutilizan `StatCard`, `StatusBadge` y `SelectorTema`.

### Panel interno

- Ficha de ticket: casilla "Visible para el cliente", desmarcada, al comentar. Cada comentario se marca "Nota interna", "Visible al cliente" o "Cliente".
- Ficha de cliente: sección "Usuarios del portal" con lista, crear, editar, desactivar o reactivar y definir contraseña nueva. Para el técnico las acciones aparecen bloqueadas con "Solo administradores".

## Pruebas

**Backend**
- 401, 403 y 200 en cada endpoint nuevo, incluidos cliente sin organización y con organización inactiva.
- Aislamiento con dos empresas: leer, comentar y usar activos de la otra da 404 o 400; el resumen solo cuenta lo propio.
- Un cliente recibe 403 en cada endpoint interno.
- Lista blanca: las respuestas del portal tienen exactamente las claves del contrato y no incluyen notas internas ni eventos ocultos.
- Usuarios: no se puede fijar rol ni organización, no se alcanzan cuentas internas, un usuario desactivado no autentica.

**Frontend**
- Pantallas con sus estados, guards por rol, casilla desmarcada por defecto, bloqueo para el técnico.

**Entrega**
- Actualizar `docs/api-contract.md`, ejemplos JSON nuevos y `CLAUDE.md`.
- Revisar con capturas en los dos temas y en móvil, y correr el detector de `impeccable`.
