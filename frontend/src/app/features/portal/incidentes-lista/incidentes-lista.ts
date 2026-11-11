import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ESTADOS_INCIDENTE, EstadoIncidente } from '../../../core/models/incidente';
import { Paginado } from '../../../core/models/organizacion';
import { IncidentePortalResumido } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;

export const IMPACTO_CORTO: Record<string, string> = {
  degradado: 'Degradado',
  parcial: 'Parcial',
  total: 'Total',
};

type FiltroEstado = 'abiertos' | 'todos' | EstadoIncidente;

@Component({
  selector: 'app-portal-incidentes-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './incidentes-lista.html',
})
export class PortalIncidentesLista implements OnInit, OnDestroy {
  private portal = inject(PortalService);
  private router = inject(Router);
  /** Toda la fila abre la ficha; el enlace del código queda para el teclado. */
  abrir = (id: number) => this.router.navigate(['/portal/incidentes', id]);

  readonly estados = ESTADOS_INCIDENTE;
  readonly impacto = IMPACTO_CORTO;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<IncidentePortalResumido> | null>(null);
  q = signal('');
  filtroEstado = signal<FiltroEstado>('abiertos');
  pagina = signal(1);

  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(() => !!this.q() || this.filtroEstado() !== 'abiertos');

  private temporizador?: ReturnType<typeof setTimeout>;
  private peticion?: Subscription;

  ngOnInit() {
    this.cargar();
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
    this.peticion?.unsubscribe();
  }

  cargar() {
    this.estado.set('cargando');
    this.peticion?.unsubscribe();
    const e = this.filtroEstado();
    this.peticion = this.portal
      .listarIncidentes({
        q: this.q(),
        abiertos: e === 'abiertos',
        estado: e === 'abiertos' || e === 'todos' ? null : e,
        page: this.pagina(),
      })
      .subscribe({
        next: (d) => {
          this.datos.set(d);
          this.estado.set('listo');
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404 && this.pagina() > 1) {
            this.pagina.set(1);
            this.cargar();
          } else if (err.status !== 403) {
            this.estado.set('error');
          }
        },
      });
  }

  alEscribir(texto: string) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.aplicarBusqueda(texto), ESPERA_BUSQUEDA_MS);
  }

  aplicarBusqueda(texto: string) {
    clearTimeout(this.temporizador);
    this.q.set(texto.trim());
    this.reiniciar();
  }

  cambiarEstado(valor: string) {
    this.filtroEstado.set(valor as FiltroEstado);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }
}
