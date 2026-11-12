import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { textoDuracion } from '../../../core/models/incidente';
import { IncidentePortalDetalle } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { IMPACTO_CORTO } from '../incidentes-lista/incidentes-lista';

@Component({
  selector: 'app-portal-incidente-ficha',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './incidente-ficha.html',
  styles: `
    .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
  `,
})
export class PortalIncidenteFicha implements OnInit {
  private portal = inject(PortalService);
  private route = inject(ActivatedRoute);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly impacto = IMPACTO_CORTO;
  readonly duracion = textoDuracion;

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  incidente = signal<IncidentePortalDetalle | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.portal.obtenerIncidente(this.id).subscribe({
      next: (i) => {
        this.incidente.set(i);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error');
      },
    });
  }
}
