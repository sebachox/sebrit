import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DashboardAdmin } from '../../../../core/models/dashboard-admin';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-admin-dashboard',
  imports: [StatCard, StatusBadge, DatePipe],
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
      error: () => this.estado.set('error'),
    });
  }
}