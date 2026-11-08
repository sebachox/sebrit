import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/guards/auth.guard';
import { inicioGuard, permisoGuard } from './core/guards/permiso.guard';
import { Layout } from './core/layout/layout/layout';

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
      { path: '', pathMatch: 'full', canActivate: [inicioGuard], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
