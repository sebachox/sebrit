import { Routes } from '@angular/router';
import { Layout } from './core/layout/layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
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
];