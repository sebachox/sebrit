import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/guards/auth.guard';
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
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard/admin-dashboard').then(
            (m) => m.AdminDashboard,
          ),
      },
      { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
