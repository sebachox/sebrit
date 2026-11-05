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
      { path: '', pathMatch: 'full', canActivate: [inicioGuard], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
