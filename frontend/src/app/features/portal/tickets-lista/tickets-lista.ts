import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Paginado } from '../../../core/models/organizacion';
import { FiltrosPortal, TicketPortalResumido } from '../../../core/models/portal';
import { CATEGORIAS, CategoriaTicket, ESTADOS_TICKET, EstadoTicket } from '../../../core/models/ticket';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;
const NOMBRE_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.texto]));

type FiltroEstado = 'abiertos' | 'todos' | EstadoTicket;

@Component({
  selector: 'app-portal-tickets-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './tickets-lista.html',
})
export class PortalTicketsLista implements OnInit, OnDestroy {
  private portal = inject(PortalService);
  private router = inject(Router);
  /** Toda la fila abre la ficha; el enlace del código queda para el teclado. */
  abrir = (id: number) => this.router.navigate(['/portal/tickets', id]);

  readonly estados = ESTADOS_TICKET;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<TicketPortalResumido> | null>(null);
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
    // Una respuesta vieja no debe pisar a la nueva.
    this.peticion?.unsubscribe();
    this.peticion = this.portal.listarTickets(this.filtros()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404 && this.pagina() > 1) {
          this.pagina.set(1);
          this.cargar();
        } else if (e.status !== 403) {
          this.estado.set('error');
        }
      },
    });
  }

  nombreCategoria(c: CategoriaTicket): string {
    return NOMBRE_CATEGORIA[c] ?? c;
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

  private filtros(): FiltrosPortal {
    const e = this.filtroEstado();
    return {
      q: this.q(),
      abiertos: e === 'abiertos',
      estado: e === 'abiertos' || e === 'todos' ? null : e,
      page: this.pagina(),
    };
  }
}
