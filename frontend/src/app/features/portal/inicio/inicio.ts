import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ResumenPortal, TicketPortalResumido } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatCard } from '../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-portal-inicio',
  imports: [DatePipe, RouterLink, StatCard, StatusBadge],
  templateUrl: './inicio.html',
})
export class PortalInicio implements OnInit {
  private portal = inject(PortalService);

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  resumen = signal<ResumenPortal | null>(null);
  tickets = signal<TicketPortalResumido[]>([]);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    forkJoin({
      resumen: this.portal.resumen(),
      tickets: this.portal.listarTickets({ abiertos: true, pageSize: 5 }),
    }).subscribe({
      next: ({ resumen, tickets }) => {
        this.resumen.set(resumen);
        this.tickets.set(tickets.results);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }
}
