import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardAdmin } from '../../../../core/models/dashboard-admin';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-admin-dashboard',
  imports: [StatCard, StatusBadge, DatePipe, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private servicio = inject(DashboardService);

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<DashboardAdmin | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.getAdmin().subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('listo');
      },
      // Un 403 lo maneja el interceptor redirigiendo a /sin-permiso.
      error: (e: HttpErrorResponse) => {
        if (e.status !== 403) this.estado.set('error');
      },
    });
  }
}