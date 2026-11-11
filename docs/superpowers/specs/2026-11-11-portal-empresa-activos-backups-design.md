# Portal del cliente: empresa, activos y backups (diseño)

Fecha: 2026-11-11. Estado: aprobado en conversación; pendiente de revisión escrita.

Amplía la vista del cliente (`docs/superpowers/specs/2026-11-08-vista-cliente-design.md`), cuyas reglas siguen vigentes: permiso `EsClienteDelPortal`, la empresa siempre sale de la sesión y los serializers son listas blancas.

## Objetivo

Que el cliente consulte los datos de su empresa, su inventario y sus backups, **solo en lectura**. Si algo está mal, lo pide con un ticket.

Éxito: el cliente encuentra el estado de un equipo y su último backup sin escribirle a soporte, y nunca ve datos de otra empresa ni datos que faciliten un ataque si le roban la cuenta.

## Decisiones

| Tema | Decisión |
|---|---|
| Edición | Ninguna: el inventario lo mantiene el equipo de SEBRIT |
| Se ocultan | `ip`, `hostname`, `notas` del activo, `notas` y `registrado_por` del backup, `creado_en` y `actualizado_en` |
| Activos dados de baja | Fuera de la lista; su ficha sigue abierta y los marca, para que el historial de backups enlace siempre a algo |
| Incidentes | Solo el número en Inicio; listas y fichas quedan para después |
| Extras | "Abrir ticket sobre este equipo" desde la ficha del activo; las tarjetas de Inicio enlazan a las listas filtradas |

## Fuera de alcance

Editar datos, adjuntos, exportar, incidentes en detalle, notificaciones.

## API

Convenciones del contrato. Sin token 401; rol distinto de cliente o empresa inactiva 403; solo GET (otros métodos 405).

### `GET /api/portal/empresa/`

`id`, `nombre`, `nit`, `sector`, `telefono`, `correo`, `direccion`, `ciudad`, `contacto_nombre`, `contacto_cargo`, `contacto_correo`, `contacto_telefono`, `plan`, `fecha_inicio_contrato`, `fecha_fin_contrato`. Vacíos salen `null`. No expone `activa`, `creado_en` ni `actualizado_en`.

### `GET /api/portal/activos/`

**Cambia de forma:** hoy devuelve `[{id, nombre, tipo}]` sin paginar para el selector de "Abrir ticket". Pasa a la lista paginada (20, máximo 100) y el selector pide `page_size=100`. Una empresa con más de 100 activos verá solo los primeros 100 en el selector; se acepta.

Parámetros: `q` (nombre, ubicación, fabricante o modelo), `tipo`, `estado`, `page`, `page_size`, `ordering` (`nombre` por defecto; `estado` = críticos primero). Sin los dados de baja.

Fila: `id`, `nombre`, `tipo`, `estado`, `ubicacion`, `ultimo_backup` (`{fecha, estado}` o `null`), sin N+1.

### `GET /api/portal/activos/{id}/`

Lo de la fila más `fabricante`, `modelo`, `sistema_operativo`, `numero_serie`, `de_baja` y `fecha_baja`. Abre también un activo dado de baja de la empresa. Ajeno, inexistente o id no numérico: 404.

### `GET /api/portal/backups/`

Paginada, del más reciente al más antiguo. Parámetros: `activo`, `estado`, `tipo`, `desde`, `hasta` (fechas en hora de Bogotá, como en la API interna), `page`, `page_size`. Un `activo` de otra empresa devuelve una lista vacía, igual que uno inexistente.

Cada fila: `id`, `activo` (`{id, nombre}`), `tipo`, `estado`, `fecha`, `tamano_gb`.

## Frontend

Navegación del portal: Inicio, Mis tickets, Mis activos, Backups y Mi empresa.

| Pantalla | Ruta | Contenido |
|---|---|---|
| Mi empresa | `/portal/empresa` | Datos en tres bloques (empresa, contacto, contrato), como la ficha interna, sin acciones. Pie: "¿Algún dato está mal? Abre un ticket" |
| Mis activos | `/portal/activos` | Búsqueda, filtros por tipo y estado (aceptan `?tipo=` y `?estado=`), paginación, estado y último backup por fila |
| Ficha de activo | `/portal/activos/:id` | Datos, aviso si está dado de baja, historial de backups paginado y botón "Abrir ticket sobre este equipo" (oculto si está de baja) |
| Backups | `/portal/backups` | Filtros por estado, tipo, activo y fechas; enlace al activo |

- "Abrir ticket" acepta `?activo=` y lo deja elegido si está en la lista del selector.
- Inicio: las tarjetas de servidores, redes y backups enlazan a `/portal/activos?tipo=servidor`, `/portal/activos?tipo=red` y `/portal/backups`.
- Estados de carga, error con "Reintentar", vacío y 404 en cada pantalla; dos temas y móvil.

## Pruebas

**Backend**
- 401, 403 y 200 en cada endpoint, más cliente sin organización y empresa inactiva.
- Claves exactas de cada respuesta y comprobación explícita de que no aparecen `ip`, `hostname`, `notas` ni `registrado_por`.
- Aislamiento con dos empresas: activo ajeno 404, backups filtrados por activo ajeno dan lista vacía, listas solo con lo propio.
- Filtros, orden, paginación, entradas anómalas sin 500 (NUL, ids enormes, fechas inválidas) y listas sin N+1.

**Frontend**
- Cada pantalla con sus estados, filtros leídos de la URL, enlaces de Inicio, preselección del activo al abrir ticket y que ninguna pantalla muestre IP ni notas.

**Entrega**
- Contrato, ejemplo `docs/examples/portal-activo.json` y `CLAUDE.md` actualizados.
- Flujo real con dos empresas, capturas en ambos temas y móvil, y detector de `impeccable`.
