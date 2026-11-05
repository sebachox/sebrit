import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FiltrosOrganizaciones,
  OrganizacionResumida,
  Paginado,
  PLANES,
  Plan,
} from '../../../../core/models/organizacion';
import { AuthService } from '../../../../core/services/auth.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

type FiltroEstado = 'activos' | 'inactivos' | 'todos';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;

/** Fecha de hoy como YYYY-MM-DD en la zona del navegador. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-clientes-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './clientes-lista.html',
  styleUrl: './clientes-lista.scss',
})
export class ClientesLista implements OnInit, OnDestroy {
  private servicio = inject(OrganizacionesService);
  private router = inject(Router);
  protected auth = inject(AuthService);

  readonly planes = PLANES;
  readonly hoy = hoyISO();

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<OrganizacionResumida> | null>(null);

  q = signal('');
  filtroEstado = signal<FiltroEstado>('activos');
  plan = signal<Plan | null>(null);
  pagina = signal(1);

  puedeEditar = computed(() => this.auth.puede('clientes', 'editar'));
  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(() => this.plan() !== null || this.filtroEstado() !== 'activos');

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.cargar();
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.listar(this.filtros()).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        // La página dejó de existir (p. ej. tras desactivar el último cliente de la última página).
        if (e.status === 404 && this.pagina() > 1) {
          this.pagina.set(1);
          this.cargar();
        } else if (e.status !== 403) {
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
    this.q.set(texto.trim());
    this.reiniciar();
  }

  cambiarEstado(valor: string) {
    this.filtroEstado.set(valor as FiltroEstado);
    this.reiniciar();
  }

  cambiarPlan(valor: string) {
    this.plan.set((valor || null) as Plan | null);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  abrir(id: number) {
    this.router.navigate(['/admin/clientes', id]);
  }

  nuevo() {
    this.router.navigate(['/admin/clientes/nuevo']);
  }

  vencido(fecha: string | null): boolean {
    return !!fecha && fecha < this.hoy;
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }

  private filtros(): FiltrosOrganizaciones {
    const estado = this.filtroEstado();
    return {
      q: this.q(),
      activa: estado === 'todos' ? null : estado === 'activos',
      plan: this.plan(),
      page: this.pagina(),
    };
  }
}
