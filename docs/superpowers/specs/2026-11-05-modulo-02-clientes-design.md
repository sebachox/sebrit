# Módulo 02: Clientes y organizaciones — Diseño

Fecha: 2026-11-05 · Estado: aprobado en conversación, pendiente de revisión escrita · Rama: `sebas`

## 1. Objetivo

Permitir que el personal de SEBRIT gestione las empresas cliente desde el panel: listar, buscar, ver la ficha con un resumen de lo relacionado, crear, editar, desactivar y reactivar. Es la base de los módulos 03–06, cuyos registros pertenecen a una organización.

**Criterio de éxito:** un admin hace todo lo anterior desde Angular; un técnico, dentro del mismo panel, puede ver la lista y la ficha, y lo demás le aparece bloqueado. Los permisos se validan en el backend y están cubiertos por pruebas 401/403/200.

### Fuera de alcance

- Varios contactos por cliente (un solo contacto principal).
- Borrado de clientes (solo desactivar y reactivar).
- Listas completas de activos, tickets o usuarios dentro de la ficha (solo conteos).
- Portal del cliente y dashboard del técnico.
- Reglas de SLA ligadas al plan.

## 2. Modelo de datos

### `Organizacion` (app `organizations`)

| Campo | Tipo Django | Reglas |
|---|---|---|
| `nombre` | `CharField(150, unique=True)` | Obligatorio (ya existe) |
| `nit` | `CharField(20, unique=True, null=True, blank=True)` | Obligatorio en la API. Formato `^\d{6,10}(-\d)?$` (ej. `900123456` o `900123456-7`) |
| `sector` | `CharField(100, blank=True)` | Opcional |
| `telefono` | `CharField(30, blank=True)` | Opcional |
| `correo` | `EmailField(blank=True)` | Opcional |
| `direccion` | `CharField(200, blank=True)` | Opcional |
| `ciudad` | `CharField(100, blank=True)` | Opcional |
| `contacto_nombre` | `CharField(150, blank=True)` | Opcional |
| `contacto_cargo` | `CharField(100, blank=True)` | Opcional |
| `contacto_correo` | `EmailField(blank=True)` | Opcional |
| `contacto_telefono` | `CharField(30, blank=True)` | Opcional |
| `plan` | `CharField(10, choices=Plan, blank=True)` | Opcional. `TextChoices`: `basico`, `estandar`, `premium` |
| `fecha_inicio_contrato` | `DateField(null=True, blank=True)` | Opcional |
| `fecha_fin_contrato` | `DateField(null=True, blank=True)` | Opcional. Si hay ambas fechas, fin ≥ inicio |
| `activa` | `BooleanField(default=True)` | Ya existe |
| `creado_en` | `DateTimeField(auto_now_add=True)` | Automático |
| `actualizado_en` | `DateTimeField(auto_now=True)` | Automático |

- `nit` es nulo en la base solo para migrar las organizaciones existentes (PostgreSQL permite varios `NULL` en un campo único). La API lo exige en `POST` y no permite vaciarlo en `PATCH`.
- `seed_demo` asigna NIT, ciudad y plan a sus organizaciones.

### Protección del historial

En `Activo`, `Backup`, `Ticket`, `Incidente` y `Mantenimiento`, la FK `organizacion` pasa de `on_delete=CASCADE` a `on_delete=PROTECT`. `Usuario.organizacion` se mantiene en `SET_NULL`. Desactivar no modifica registros relacionados.

## 3. API

Recurso único `/api/organizaciones/`, implementado con un `ModelViewSet` de DRF registrado en un router. Sin versión en la URL, igual que las demás rutas `/api/...`.

### Permisos (`EsAdminOTecnicoLectura`)

| Método | Ruta | Admin | Técnico | Cliente | Sin token |
|---|---|---|---|---|---|
| GET | `/api/organizaciones/` | 200 | 200 | 403 | 401 |
| GET | `/api/organizaciones/{id}/` | 200 | 200 | 403 | 401 |
| POST | `/api/organizaciones/` | 201 | 403 | 403 | 401 |
| PATCH | `/api/organizaciones/{id}/` | 200 | 403 | 403 | 401 |
| PUT, DELETE | `/api/organizaciones/{id}/` | 405 | 403 | 403 | 401 |

Desactivar y reactivar: `PATCH {"activa": false}` / `PATCH {"activa": true}`.

### Lista: `GET /api/organizaciones/`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `q` | Texto; busca (sin distinguir mayúsculas) en `nombre`, `nit`, `ciudad`, `contacto_nombre` | — |
| `activa` | `true`, `false` | Sin filtro |
| `plan` | `basico`, `estandar`, `premium` | Sin filtro |
| `ordering` | `nombre`, `-nombre`, `creado_en`, `-creado_en` | `nombre` |
| `page` | Entero ≥ 1 | 1 |
| `page_size` | Entero 1–100 | 20 |

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

### Detalle: `GET /api/organizaciones/{id}/`

Todos los campos de la sección 2 más `resumen`:

```json
"resumen": { "activos": 12, "tickets_abiertos": 5, "incidentes_activos": 2, "usuarios": 3 }
```

- `activos`: todos los `Activo` de la organización.
- `tickets_abiertos` / `incidentes_activos`: estado `abierto` o `en_progreso` (misma regla del dashboard).
- `usuarios`: `Usuario` con esa organización.

### Crear y editar

- `POST` (201) y `PATCH` (200) reciben los campos editables de la sección 2 y responden con el detalle completo.
- Validación: 400 con errores por campo, p. ej. `{"nit": ["Ya existe una organización con este NIT."]}`.
- Id inexistente: 404.

### Convenciones

- Claves siempre presentes; opcionales vacíos salen como `null` (no `""`); en la entrada se aceptan `null` y `""`.
- Fechas de contrato `YYYY-MM-DD`; `creado_en` y `actualizado_en` ISO 8601 con `-05:00`.
- Documentación: sección "Organizaciones" en `docs/api-contract.md` y ejemplo en `docs/examples/organizacion.json`.

## 4. Frontend

### Panel compartido con permisos por rol

Admin y técnico usan el mismo layout. Lo que un rol no puede usar **se muestra bloqueado**, no se oculta.

Mapa único en `core/auth/permisos.ts`:

| Módulo | Ver | Editar |
|---|---|---|
| `dashboard` | `admin` | — |
| `clientes` | `admin`, `tecnico` | `admin` |

- **Sidebar:** enlace bloqueado = atenuado, icono `bi-lock`, texto "Solo administradores" (tooltip accesible con teclado), sin navegación y con `aria-disabled="true"`.
- **Botones:** para el técnico, "Nuevo cliente", "Editar" y "Desactivar/Reactivar" se muestran deshabilitados con candado y el mismo texto.
- **Guards:** `permisoGuard(modulo, accion)` redirige a `/sin-permiso` si se entra por URL. El interceptor sigue redirigiendo ante 403.
- **Ruta de inicio (`rutaInicio()`):** admin → `/admin/dashboard`; técnico → `/admin/clientes`; cliente → `/sin-permiso`. **Cambia el criterio 5 del Sprint 1.**
- **Navbar:** "Panel de administración" (admin) o "Panel técnico" (técnico), con nombre y rol.

### Pantallas

| Pantalla | Ruta | Acceso |
|---|---|---|
| Lista | `/admin/clientes` | ver `clientes` |
| Ficha | `/admin/clientes/:id` | ver `clientes` |
| Formulario (crear) | `/admin/clientes/nuevo` | editar `clientes` |
| Formulario (editar) | `/admin/clientes/:id/editar` | editar `clientes` |

**Lista:** encabezado "Clientes" + "Nuevo cliente"; búsqueda con espera de 300 ms; filtro de estado (Activos por defecto / Inactivos / Todos) y de plan; tabla con Nombre, NIT, Ciudad, Plan, Contacto, Fin de contrato (en rojo si ya venció) y Estado; clic en fila → ficha; paginación. Estados: cargando, error con "Reintentar", sin clientes (con acción de crear para el admin), sin resultados.

**Ficha:** nombre, badge de estado, "Editar" y "Desactivar"/"Reactivar" (confirmación dentro de la página, no modal). 4 `StatCard` con el `resumen`. Bloques Empresa, Contacto principal y Contrato; los `null` se muestran como "—". 404 → "Cliente no encontrado" con enlace a la lista.

**Formulario:** un componente para crear y editar, secciones Empresa / Contacto / Contrato. Validación en el navegador igual a la del backend (obligatorios, NIT, correos, fecha fin ≥ inicio). Errores 400 del servidor bajo cada campo y mensaje general arriba si aplica. "Cancelar" y "Guardar"; al guardar vuelve a la ficha con mensaje de éxito.

### Código

- `core/auth/permisos.ts`, `core/guards/permiso.guard.ts`
- `core/models/organizacion.ts`, `core/services/organizaciones.service.ts`
- `features/admin/clientes/clientes-lista/`, `cliente-ficha/`, `cliente-form/`
- Reutiliza `StatCard` y `StatusBadge`. Estilo visual del `CLAUDE.md`; implementación con la skill `impeccable`.

## 5. Manejo de errores

| Caso | Comportamiento |
|---|---|
| Red caída o 500 | Estado de error con "Reintentar" |
| 400 | Errores por campo + mensaje general |
| 404 en ficha o edición | "Cliente no encontrado" + enlace a la lista |
| 403 | Interceptor redirige a `/sin-permiso` |
| 401 | Refresh automático; si falla, cierra sesión (comportamiento actual) |

## 6. Pruebas (TDD)

### Backend

- Permisos de cada método y rol según la tabla de la sección 3, incluidos 405 para PUT y DELETE.
- Validación: NIT obligatorio, formato y único; nombre único; `plan` inválido; fin < inicio → 400; id inexistente → 404.
- Lista: búsqueda `q` en los 4 campos, filtros `activa` y `plan`, orden por defecto, `page_size` máximo 100.
- Ficha: `resumen` correcto (un ticket cerrado no cuenta) y opcionales vacíos como `null`.
- Desactivar no borra relacionados y el dashboard deja de contarlo en `clientes_activos`.
- `PROTECT`: borrar una organización con datos lanza `ProtectedError`.
- `seed_demo` sigue funcionando.

### Frontend

- `permisos.ts` por rol; `permisoGuard` redirige; sidebar con Dashboard bloqueado para técnico; botones de edición deshabilitados para técnico.
- `rutaInicio()` para admin, técnico y cliente.
- Servicio: parámetros de búsqueda, filtros y página.
- Lista: estados de carga, error, vacío y sin resultados.
- Formulario: validación local y error del servidor en el campo correcto.

### Verificación final

Suites completas de backend y frontend, capturas en escritorio y móvil como admin y como técnico, y detector de `impeccable`.

## 7. Documentación y entrega

- `docs/api-contract.md` (sección Organizaciones) y `docs/examples/organizacion.json`.
- `CLAUDE.md`: módulo 02, endpoints, mapa de permisos, criterio 5 actualizado.
- Commits en `sebas`: `feat(backend)`, `feat(frontend)`, `docs`.
