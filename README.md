# SEBRIT

Aplicación web para **gestionar la infraestructura tecnológica de varias empresas clientes**. El equipo de soporte (administradores y técnicos) lleva desde un solo panel los clientes, sus servidores y equipos de red, los backups, los tickets de soporte y los incidentes. Cada empresa cliente tiene un **portal** donde abre tickets y consulta el estado de su infraestructura, viendo solo los datos de su propia empresa.

> Principio de diseño: **la autorización se valida en el servidor**. Ocultar una opción en la interfaz no reemplaza los permisos del backend.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Dashboard** | Resumen operativo: clientes activos, tickets abiertos, activos críticos e incidentes críticos; incidentes activos y estado de servidores, redes y backups |
| **Clientes** | Alta y edición de empresas (NIT, contacto, plan, contrato), desactivación sin borrado y gestión de los usuarios del portal |
| **Infraestructura** | Inventario de servidores y equipos de red por cliente, cambio de estado, baja y reactivación, y registro de backups |
| **Tickets** | Prioridad calculada automáticamente, flujo de estados, asignación de técnico, comentarios internos o visibles para el cliente y línea de tiempo |
| **Incidentes** | Interrupciones del servicio con severidad automática, equipos afectados, bitácora, duración, causa raíz y tickets asociados; un ticket puede escalarse a incidente |
| **Portal del cliente** | Abrir y seguir tickets, comentar, y consultar en solo lectura la empresa, sus activos, backups e incidentes |
| **Mi perfil** | Datos personales y cambio de contraseña para cualquier rol |

### Roles

| Rol | Acceso |
|---|---|
| `admin` | Todo el panel |
| `tecnico` | El mismo panel; opera activos, backups, tickets e incidentes. Lo que no puede usar (crear o editar clientes) aparece bloqueado |
| `cliente` | Solo el portal de su empresa, si la empresa está activa |

### Reglas automáticas

- **Prioridad del ticket:** suma puntos por alcance (un usuario, varios, toda la empresa), categoría de red o seguridad, activo de tipo servidor y activo en estado crítico. Se puede corregir a mano con un motivo.
- **Severidad del incidente:** suma puntos por impacto (degradado, parcial, total), servidores afectados y activos críticos.
- **Flujo de estados:** `abierto` ↔ `en_progreso` (exige técnico) → `resuelto` (exige solución) → `cerrado` (en incidentes exige causa raíz). Al resolver un incidente, sus tickets abiertos se resuelven con la misma solución.

## Arquitectura

```
Navegador ── Angular 20 (SPA)
                │  HTTP + JSON, JWT en la cabecera Authorization
                ▼
            Django 5.2 + Django REST Framework + SimpleJWT
                │  ORM
                ▼
            PostgreSQL 16

Los tres servicios corren con Docker Compose: frontend, backend y db.
```

| Capa | Tecnología |
|---|---|
| Frontend | Angular 20, TypeScript, componentes standalone y signals, Bootstrap 5, Bootstrap Icons, SCSS. Temas oscuro y claro |
| Backend | Python 3.12, Django 5.2, Django REST Framework, SimpleJWT, django-cors-headers |
| Base de datos | PostgreSQL 16 |
| Infraestructura | Docker Compose |

El contrato de la API está escrito en [`docs/api-contract.md`](docs/api-contract.md), con respuestas de ejemplo en [`docs/examples/`](docs/examples/). El frontend y el backend se construyen contra ese contrato.

### Estructura del repositorio

```
sebrit/
├── backend/
│   ├── config/              # settings.py y urls.py
│   └── apps/
│       ├── accounts/        # Usuario con rol y empresa, login JWT, perfil, límite de intentos
│       ├── organizations/   # Clientes y usuarios del portal
│       ├── assets/          # Activos y backups
│       ├── tickets/         # Tickets, línea de tiempo, regla de prioridad
│       ├── incidents/       # Incidentes, bitácora, regla de severidad
│       ├── dashboard/       # Dashboard administrativo y datos de demostración
│       └── portal/          # API del portal del cliente
├── frontend/src/app/
│   ├── core/                # Autenticación, interceptor, guards, servicios, layouts
│   ├── shared/              # Componentes reutilizables
│   └── features/            # Un módulo por funcionalidad (admin, portal, login)
├── docs/                    # Contrato de la API, ejemplos, diseños y planes de cada módulo
└── docker-compose.yml
```

## Seguridad

- Cada endpoint declara sus permisos por rol y tiene pruebas de 401, 403 y 200.
- **Aislamiento por empresa:** en el portal, la empresa siempre se toma del usuario autenticado, nunca de un parámetro. Pedir un recurso de otra empresa responde 404.
- Los serializers del portal son listas blancas: el cliente nunca recibe prioridad, severidad, causa raíz, notas internas, IP ni hostname.
- Login con JWT (token de acceso de 60 minutos y renovación automática en el frontend).
- Límite de intentos: 5 por minuto por usuario y 30 por IP en el login; 5 por minuto en el cambio de contraseña.
- Las claves salen de variables de entorno; con `DJANGO_DEBUG=0` se exige HTTPS (redirección, cookies seguras y HSTS).

## Cómo ejecutarlo

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) y Git.

```bash
git clone https://github.com/sebachox/sebrit.git
cd sebrit
cp .env.example .env
```

Edita `.env`: pon una contraseña en `POSTGRES_PASSWORD` y una clave aleatoria de **32 caracteres o más** en `DJANGO_SECRET_KEY`. Luego:

```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate
```

Carga los datos de demostración (empresas, activos, backups, tickets e incidentes ficticios) y crea los usuarios:

```bash
docker compose exec backend python manage.py seed_completo --reiniciar --clave <clave-usuarios> --clave-admin <clave-admin>
```

- `--clave-admin` crea el superusuario `admin`.
- `--clave` es la contraseña de los técnicos (por ejemplo `dmartinez`) y de los usuarios del portal (por ejemplo `mrodriguez.clinica`).
- Las contraseñas deben tener al menos 8 caracteres y no ser comunes. No se guardan en el repositorio.
- `--reiniciar` borra los datos de negocio y los usuarios que no son administradores antes de cargar.

| Servicio | Dirección |
|---|---|
| Aplicación | http://localhost:4200 |
| API | http://localhost:8000/api/ |
| Administración de Django | http://localhost:8000/admin/ |

Para detener todo: `docker compose down` (agrega `-v` para borrar también la base de datos).

## Pruebas

```bash
# Backend
docker compose exec backend python manage.py test

# Frontend (necesita Chrome o Edge; en Windows con Edge:)
cd frontend
CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" npx ng test --watch=false --browsers=ChromeHeadless
```

El backend tiene más de 440 pruebas: permisos por rol, reglas de negocio, flujo de estados, aislamiento entre empresas y consultas sin N+1. El frontend tiene más de 410.

## Equipo

Proyecto desarrollado por **Sebastián Ordóñez** y **Brigith**.

Flujo de trabajo: ramas `main` (estable) y `develop` (integración) protegidas; los cambios entran por pull request con revisión.
