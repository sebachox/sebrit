import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/guards/auth.guard';
import { inicioGuard, permisoGuard } from './core/guards/permiso.guard';
import { equipoGuard, portalGuard } from './core/guards/portal.guard';
import { Layout } from './core/layout/layout/layout';
import { PortalLayout } from './core/layout/portal-layout/portal-layout';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'sin-permiso',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/errors/sin-permiso/sin-permiso').then((m) => m.SinPermiso),
  },
  {
    path: 'portal',
    component: PortalLayout,
    canActivate: [authGuard, portalGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () => import('./features/portal/inicio/inicio').then((m) => m.PortalInicio),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/portal/tickets-lista/tickets-lista').then((m) => m.PortalTicketsLista),
      },
      {
        path: 'tickets/nuevo',
        loadComponent: () =>
          import('./features/portal/ticket-nuevo/ticket-nuevo').then((m) => m.PortalTicketNuevo),
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./features/portal/ticket-ficha/ticket-ficha').then((m) => m.PortalTicketFicha),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/admin/perfil/perfil').then((m) => m.PerfilPagina),
      },
    ],
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      {
        path: 'admin/dashboard',
        canActivate: [permisoGuard('dashboard', 'ver')],
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard/admin-dashboard').then(
            (m) => m.AdminDashboard,
          ),
      },
      {
        path: 'admin/clientes',
        canActivate: [permisoGuard('clientes', 'ver')],
        loadComponent: () =>
          import('./features/admin/clientes/clientes-lista/clientes-lista').then(
            (m) => m.ClientesLista,
          ),
      },
      {
        path: 'admin/clientes/nuevo',
        canActivate: [permisoGuard('clientes', 'editar')],
        loadComponent: () =>
          import('./features/admin/clientes/cliente-form/cliente-form').then((m) => m.ClienteForm),
      },
      {
        path: 'admin/clientes/:id/editar',
        canActivate: [permisoGuard('clientes', 'editar')],
        loadComponent: () =>
          import('./features/admin/clientes/cliente-form/cliente-form').then((m) => m.ClienteForm),
      },
      {
        path: 'admin/clientes/:id',
        canActivate: [permisoGuard('clientes', 'ver')],
        loadComponent: () =>
          import('./features/admin/clientes/cliente-ficha/cliente-ficha').then(
            (m) => m.ClienteFicha,
          ),
      },
      {
        path: 'admin/activos',
        canActivate: [permisoGuard('activos', 'ver')],
        loadComponent: () =>
          import('./features/admin/activos/activos-lista/activos-lista').then((m) => m.ActivosLista),
      },
      {
        path: 'admin/activos/nuevo',
        canActivate: [permisoGuard('activos', 'editar')],
        loadComponent: () =>
          import('./features/admin/activos/activo-form/activo-form').then((m) => m.ActivoForm),
      },
      {
        path: 'admin/activos/:id/editar',
        canActivate: [permisoGuard('activos', 'editar')],
        loadComponent: () =>
          import('./features/admin/activos/activo-form/activo-form').then((m) => m.ActivoForm),
      },
      {
        path: 'admin/activos/:id',
        canActivate: [permisoGuard('activos', 'ver')],
        loadComponent: () =>
          import('./features/admin/activos/activo-ficha/activo-ficha').then((m) => m.ActivoFicha),
      },
      {
        path: 'admin/backups',
        canActivate: [permisoGuard('backups', 'ver')],
        loadComponent: () =>
          import('./features/admin/backups/backups-lista/backups-lista').then((m) => m.BackupsLista),
      },
      {
        path: 'admin/backups/:id/editar',
        canActivate: [permisoGuard('backups', 'editar')],
        loadComponent: () =>
          import('./features/admin/backups/backup-editar/backup-editar').then((m) => m.BackupEditar),
      },
      {
        path: 'admin/tickets',
        canActivate: [permisoGuard('tickets', 'ver')],
        loadComponent: () =>
          import('./features/admin/tickets/tickets-lista/tickets-lista').then((m) => m.TicketsLista),
      },
      {
        path: 'admin/tickets/nuevo',
        canActivate: [permisoGuard('tickets', 'editar')],
        loadComponent: () =>
          import('./features/admin/tickets/ticket-form/ticket-form').then((m) => m.TicketForm),
      },
      {
        path: 'admin/tickets/:id/editar',
        canActivate: [permisoGuard('tickets', 'editar')],
        loadComponent: () =>
          import('./features/admin/tickets/ticket-form/ticket-form').then((m) => m.TicketForm),
      },
      {
        path: 'admin/tickets/:id',
        canActivate: [permisoGuard('tickets', 'ver')],
        loadComponent: () =>
          import('./features/admin/tickets/ticket-ficha/ticket-ficha').then((m) => m.TicketFicha),
      },
      {
        path: 'admin/incidentes',
        canActivate: [permisoGuard('incidentes', 'ver')],
        loadComponent: () =>
          import('./features/admin/incidentes/incidentes-lista/incidentes-lista').then((m) => m.IncidentesLista),
      },
      {
        path: 'admin/incidentes/nuevo',
        canActivate: [permisoGuard('incidentes', 'editar')],
        loadComponent: () =>
          import('./features/admin/incidentes/incidente-form/incidente-form').then((m) => m.IncidenteForm),
      },
      {
        path: 'admin/incidentes/:id/editar',
        canActivate: [permisoGuard('incidentes', 'editar')],
        loadComponent: () =>
          import('./features/admin/incidentes/incidente-form/incidente-form').then((m) => m.IncidenteForm),
      },
      {
        path: 'admin/incidentes/:id',
        canActivate: [permisoGuard('incidentes', 'ver')],
        loadComponent: () =>
          import('./features/admin/incidentes/incidente-ficha/incidente-ficha').then((m) => m.IncidenteFicha),
      },
      {
        path: 'admin/perfil',
        canActivate: [equipoGuard],
        loadComponent: () => import('./features/admin/perfil/perfil').then((m) => m.PerfilPagina),
      },
      { path: '', pathMatch: 'full', canActivate: [inicioGuard], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
