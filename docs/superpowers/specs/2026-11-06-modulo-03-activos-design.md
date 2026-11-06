# Módulo 03: Infraestructura y activos — Diseño

Fecha: 2026-11-06 · Estado: aprobado en conversación, pendiente de revisión escrita · Rama: `sebas`

## 1. Objetivo

Permitir que el personal de SEBRIT lleve el inventario técnico de cada cliente (servidores y equipos de red) y el historial de backups: listar y filtrar, ver la ficha, crear y editar activos, cambiar su estado, darlos de baja y registrar backups manualmente.

**Criterio de éxito:** desde Angular, el admin hace todo lo anterior; el técnico ve activos y backups, cambia el estado de un activo y registra backups, y lo demás le aparece bloqueado. Los permisos se validan en el backend con pruebas 401/403/200 por rol y método.

### Fuera de alcance

- Tipos de activo nuevos (siguen `servidor` y `red`).
- Garantías, ciclo de vida y políticas de backup (frecuencia, retención, atrasos).
- Monitoreo automático (módulo 08); todo se registra manualmente.
- Historial de cambios de estado o auditoría (transversal, más adelante).
- Aislamiento por organización para el rol cliente.

## 2. Modelo de datos

### `Activo` (app `assets`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `organizacion` | FK `Organizacion`, `PROTECT` | Ya existe. Se fija al crear; no se puede cambiar |
| `tipo` | `CharField(choices)` | Ya existe: `servidor`, `red` |
| `nombre` | `CharField(100)` | Ya existe. Único por organización, sin distinguir mayúsculas |
| `estado` | `CharField(choices)` | Ya existe: `operativo`, `advertencia`, `critico` |
| `hostname` | `CharField(150, blank=True)` | Opcional |
| `ip` | `GenericIPAddressField(null=True, blank=True)` | Opcional; IPv4 o IPv6 válida |
| `sistema_operativo` | `CharField(100, blank=True)` | Opcional (sistema operativo o firmware) |
| `fabricante` | `CharField(100, blank=True)` | Opcional |
| `modelo` | `CharField(100, blank=True)` | Opcional |
| `numero_serie` | `CharField(100, blank=True)` | Opcional |
| `ubicacion` | `CharField(150, blank=True)` | Opcional |
| `notas` | `TextField(blank=True)` | Opcional |
| `de_baja` | `BooleanField(default=False)` | |
| `fecha_baja` | `DateTimeField(null=True, blank=True)` | Se llena al pasar `de_baja` a `true`; se vacía al reactivar. Solo lectura en la API |
| `creado_en` | `DateTimeField(default=timezone.now, editable=False)` | Automático |
| `actualizado_en` | `DateTimeField(auto_now=True)` | Automático |

### `Backup` (app `assets`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `activo` | FK `Activo`, `null=True`, `PROTECT` | Obligatorio en la API al registrar. Nulo solo en backups anteriores al módulo. Pasa de `SET_NULL` a `PROTECT` |
| `organizacion` | FK `Organizacion`, `PROTECT` | Ya existe. Se toma del activo; no se envía en la API |
| `estado` | `CharField(choices)` | Ya existe: `exitoso`, `fallido`, `pendiente` |
| `tipo` | `CharField(choices, blank=True)` | Nuevo: `completo`, `incremental`, `diferencial`. Obligatorio en la API al registrar |
| `fecha` | `DateTimeField(default=timezone.now)` | Ya existe. No puede ser futura |
| `tamano_gb` | `DecimalField(10, 2, null=True, blank=True)` | Opcional, ≥ 0 |
| `notas` | `TextField(blank=True)` | Opcional |
| `registrado_por` | FK `Usuario`, `null=True`, `SET_NULL` | Automático: usuario de la sesión. Solo lectura en la API |
| `creado_en` | `DateTimeField(default=timezone.now, editable=False)` | Automático |

### Reglas de negocio

- Un activo dado de baja no admite cambio de estado ni backups nuevos (400). Su historial se conserva.
- El dashboard (`infraestructura.servidores`, `infraestructura.redes`) y el `resumen.activos` de la ficha de organización excluyen los activos dados de baja. Los conteos de backups no cambian.
- `seed_demo` asocia sus backups a un activo y les da un tipo.

## 3. API

Dos recursos planos, cada uno con un `ModelViewSet` registrado en el router existente. Sin versión en la URL.

### Permisos

Sin token: 401 en todo. Cliente: 403 en todo.

| Método | Ruta | Admin | Técnico |
|---|---|---|---|
| GET | `/api/activos/`, `/api/activos/{id}/` | 200 | 200 |
| POST | `/api/activos/` | 201 | 403 |
| PATCH | `/api/activos/{id}/` | 200 | 403 |
| PATCH | `/api/activos/{id}/estado/` | 200 | 200 |
| PUT, DELETE | `/api/activos/{id}/` | 405 | 403 |
| GET | `/api/backups/`, `/api/backups/{id}/` | 200 | 200 |
| POST | `/api/backups/` | 201 | 201 |
| PATCH | `/api/backups/{id}/` | 200 | 403 |
| DELETE | `/api/backups/{id}/` | 204 | 403 |
| PUT | `/api/backups/{id}/` | 405 | 403 |

Un `id` inexistente da 404.

### Activos

**Lista** — `GET /api/activos/`:

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Busca, sin distinguir mayúsculas, en `nombre`, `hostname`, `ip`, `numero_serie`, `fabricante`, `modelo`. Solo espacios = sin filtro | — |
| `organizacion` | id | Sin filtro |
| `tipo` | `servidor`, `red` | Sin filtro |
| `estado` | `operativo`, `advertencia`, `critico` | Sin filtro |
| `de_baja` | `true`, `false` | `false` (se excluyen los dados de baja) |
| `ordering` | `nombre`, `-nombre`, `estado` (critico → advertencia → operativo), `creado_en`, `-creado_en` | `nombre` (sin distinguir mayúsculas) |
| `page`, `page_size` | Como organizaciones | 20, máximo 100 |

Cada fila: `id`, `nombre`, `tipo`, `estado`, `organizacion: {id, nombre}`, `ip`, `hostname`, `ubicacion`, `de_baja`, `ultimo_backup: {id, fecha, estado} | null` (el de `fecha` más reciente). La lista hace un número fijo de consultas.

**Detalle** — todos los campos de la sección 2 con `organizacion: {id, nombre}`, más `ultimo_backup` y `resumen_backups: {total, exitosos, fallidos, pendientes}`.

**Crear** — `POST` con `organizacion` (id) y los campos editables. **Editar** — `PATCH /{id}/` con los campos editables y `de_baja`; enviar `organizacion` con un valor distinto da 400.

**Cambiar estado** — `PATCH /api/activos/{id}/estado/` con `{"estado": "<valor>"}`; responde el detalle. 400 si el activo está dado de baja o el valor no es de la enumeración.

### Backups

**Lista** — `GET /api/backups/`: filtros `organizacion`, `activo`, `estado`, `tipo`, `desde` y `hasta` (`YYYY-MM-DD`, inclusivos, sobre la fecha local de `fecha`); orden por defecto `-fecha`; paginación 20/100.

Cada backup (lista y detalle): `id`, `activo: {id, nombre} | null`, `organizacion: {id, nombre}`, `fecha`, `estado`, `tipo` (o `null`), `tamano_gb` (número o `null`), `notas` (o `null`), `registrado_por: {id, nombre} | null`, `creado_en`.

**Registrar** — `POST` con `activo` (id), `estado`, `tipo` y opcionales `fecha`, `tamano_gb`, `notas`. **Editar** — `PATCH` con los mismos campos (cambiar `activo` también actualiza `organizacion`). **Borrar** — `DELETE` (204).

### Errores 400 (mensajes)

| Campo | Mensaje |
|---|---|
| `nombre` | `Ya existe un activo con este nombre en este cliente.` |
| `ip` | `Escribe una dirección IP válida, por ejemplo 192.168.1.10.` |
| `organizacion` | `No se puede cambiar el cliente de un activo.` |
| `estado` / `activo` | `El activo está dado de baja.` |
| `fecha` | `La fecha del backup no puede ser futura.` |
| `tamano_gb` | `El tamaño no puede ser negativo.` |

Convenciones del contrato: claves siempre presentes, opcionales vacíos como `null`, entrada acepta `null` y `""` en textos opcionales.

### Documentación

Secciones "Activos" y "Backups" en `docs/api-contract.md`, ejemplos `docs/examples/activo.json` y `docs/examples/backup.json`, y nota en la sección del dashboard: los activos dados de baja no cuentan.

## 4. Frontend

### Permisos

`Accion` pasa a `'ver' | 'operar' | 'editar'`. Mapa en `core/auth/permisos.ts`:

| Módulo | Ver | Operar | Editar |
|---|---|---|---|
| `activos` | admin, tecnico | admin, tecnico | admin |
| `backups` | admin, tecnico | admin, tecnico | admin |

(`dashboard` y `clientes` no usan `operar`; para ellos `operar` queda vacío.) Lo bloqueado se muestra con candado y "Solo administradores".

Sidebar: "Activos" (`bi-hdd-rack`) y "Backups" (`bi-cloud-arrow-up`) debajo de Clientes.

### Pantallas

| Pantalla | Ruta | Acceso |
|---|---|---|
| Lista de activos | `/admin/activos` | ver `activos` |
| Ficha de activo | `/admin/activos/:id` | ver `activos` |
| Formulario de activo | `/admin/activos/nuevo`, `/admin/activos/:id/editar` | editar `activos` |
| Lista de backups | `/admin/backups` | ver `backups` |
| Editar backup | `/admin/backups/:id/editar` | editar `backups` |

**Lista de activos:** búsqueda (300 ms), selector de cliente (clientes activos, hasta 100), tipo, estado y casilla "Mostrar dados de baja"; acepta `?organizacion=<id>` y la refleja en el selector. Tabla: Nombre, Cliente, Tipo, IP, Estado, Último backup (badge + fecha, o "Sin backups"), Ubicación. "Nuevo activo" bloqueado para el técnico. Estados de carga, error, vacío y sin resultados.

**Ficha de activo:** nombre, tipo, badge de estado, enlace al cliente. Botones "Operativo / Advertencia / Crítico" para cambiar estado (operar). "Editar" y "Dar de baja"/"Reactivar" (editar; baja con confirmación en la página). Bloques Identificación y Ubicación y notas (`null` → "—"). Sección Backups: resumen, historial paginado del activo y "Registrar backup" (operar) que abre `BackupForm` en la página. Con el activo dado de baja: aviso visible y cambio de estado y registro deshabilitados con el motivo.

**Formulario de activo:** cliente (solo al crear), tipo, nombre y ficha técnica; validación local (requeridos, IP) y errores 400 bajo cada campo; al guardar vuelve a la ficha con mensaje de éxito.

**Lista de backups:** filtros cliente, estado, tipo, desde y hasta. Tabla: Fecha, Activo (enlace), Cliente, Tipo, Estado, Tamaño, Registrado por. Por fila (editar): "Editar" y "Borrar" con confirmación en la fila.

**`BackupForm`:** activo (fijo cuando se abre desde la ficha), estado, tipo, fecha (por defecto ahora; no futura), tamaño (≥ 0), notas. Se usa al registrar desde la ficha y en `/admin/backups/:id/editar`.

**Ficha de cliente:** la tarjeta "Activos" enlaza a `/admin/activos?organizacion=<id>`.

### Código

- `core/models/activo.ts`, `core/models/backup.ts`; `core/services/activos.service.ts`, `core/services/backups.service.ts`.
- `features/admin/activos/` (`activos-lista`, `activo-ficha`, `activo-form`) y `features/admin/backups/` (`backups-lista`, `backup-form`).
- `StatusBadge` agrega `servidor`, `red`, `completo`, `incremental`, `diferencial`. Paleta y tonos de `styles.scss`; sin colores fijos.
- Implementación con la skill `impeccable`; verificación en ambos temas.

## 5. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Red caída o 500 | Estado de error con "Reintentar" |
| 400 | Errores por campo + mensaje general |
| 404 | "Activo no encontrado" / "Backup no encontrado" + enlace a la lista |
| 403 | El interceptor redirige a `/sin-permiso` |
| 401 | Refresh automático; si falla, cierra sesión |

## 6. Pruebas (TDD)

### Backend

- Permisos de la tabla de la sección 3 por rol y método, incluidos `/estado/` para el técnico y los 405.
- Validación: nombre único por cliente (y permitido en otro cliente), IP, cambio de organización, activo dado de baja en `/estado/` y en `POST /backups/`, fecha futura, tamaño negativo, tipo inválido.
- Derivados: `organizacion` del backup sale del activo; `registrado_por` es el usuario; `fecha_baja` se llena y se vacía; `ultimo_backup` y `resumen_backups` correctos.
- Lista: excluye dados de baja por defecto; filtros, búsqueda, orden por estado; rango de fechas en backups.
- `assertNumQueries` en la lista de activos (constante con 1 y con 10 activos).
- Dashboard y `resumen.activos` excluyen dados de baja.
- `seed_demo` crea backups con activo y tipo.

### Frontend

- Mapa de permisos con `operar`; técnico con "Cambiar estado" y "Registrar backup" habilitados y "Nuevo activo", "Editar", "Dar de baja", "Editar/Borrar backup" bloqueados.
- Servicios: parámetros de filtros.
- Listas: estados y `?organizacion=`.
- Ficha: cambiar estado actualiza el badge; activo dado de baja deshabilita acciones.
- Formularios: IP, fecha futura, tamaño y error del servidor en su campo.

### Verificación final

Suites completas y build; capturas de las pantallas en tema oscuro y claro, escritorio y móvil, como admin y técnico; detector de `impeccable`; revisión final de toda la rama con un revisor independiente.

## 7. Documentación y entrega

- `docs/api-contract.md`, `docs/examples/activo.json`, `docs/examples/backup.json`.
- `CLAUDE.md`: módulo 03, modelos, endpoints, mapa de permisos con `operar`, regla del dashboard.
- Commits en `sebas` (verificando la rama antes de cada uno); PR a `develop` al terminar el módulo.
