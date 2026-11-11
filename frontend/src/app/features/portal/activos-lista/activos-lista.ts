import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ESTADOS_ACTIVO, EstadoActivo, TIPOS_ACTIVO, TipoActivo } from '../../../core/models/activo';
import { Paginado } from '../../../core/models/organizacion';
import { ActivoPortalResumido } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;
const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_ACTIVO.map((t) => [t.valor, t.texto]));

@Component({
  selector: 'app-portal-activos-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './activos-lista.html',
})
export class PortalActivosLista implements OnInit, OnDestroy {
  private portal = inject(PortalService);
  private route = inject(ActivatedRoute);

  readonly tipos = TIPOS_ACTIVO;
  readonly estados = ESTADOS_ACTIVO;
  readonly nombreTipo = NOMBRE_TIPO;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<ActivoPortalResumido> | null>(null);
  q = signal('');
  tipo = signal<TipoActivo | null>(this.leer('tipo', TIPOS_ACTIVO));
  filtroEstado = signal<EstadoActivo | null>(this.leer('estado', ESTADOS_ACTIVO));
  pagina = signal(1);

  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(() => !!(this.q() || this.tipo() || this.filtroEstado()));

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
    this.peticion = this.portal
      .listarActivos({ q: this.q(), tipo: this.tipo(), estado: this.filtroEstado(), page: this.pagina() })
      .subscribe({
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

  alEscribir(texto: string) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.aplicarBusqueda(texto), ESPERA_BUSQUEDA_MS);
  }

  aplicarBusqueda(texto: string) {
    clearTimeout(this.temporizador);
    this.q.set(texto.trim());
    this.reiniciar();
  }

  cambiarTipo(valor: string) {
    this.tipo.set((valor || null) as TipoActivo | null);
    this.reiniciar();
  }

  cambiarEstado(valor: string) {
    this.filtroEstado.set((valor || null) as EstadoActivo | null);
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

  private leer<T extends string>(clave: string, opciones: { valor: T }[]): T | null {
    const v = this.route.snapshot.queryParamMap.get(clave);
    return opciones.find((o) => o.valor === v)?.valor ?? null;
  }
}
