import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ActivoResumido,
  ESTADOS_ACTIVO,
  EstadoActivo,
  FiltrosActivos,
  Referencia,
  TIPOS_ACTIVO,
  TipoActivo,
} from '../../../../core/models/activo';
import { Paginado } from '../../../../core/models/organizacion';
import { ActivosService } from '../../../../core/services/activos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;

@Component({
  selector: 'app-activos-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './activos-lista.html',
  styleUrl: './activos-lista.scss',
})
export class ActivosLista implements OnInit, OnDestroy {
  private servicio = inject(ActivosService);
  private organizaciones = inject(OrganizacionesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthService);

  readonly tipos = TIPOS_ACTIVO;
  readonly estados = ESTADOS_ACTIVO;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<ActivoResumido> | null>(null);
  clientes = signal<Referencia[]>([]);

  q = signal('');
  organizacion = signal<number | null>(this.leerOrganizacion());
  tipo = signal<TipoActivo | null>(null);
  filtroEstado = signal<EstadoActivo | null>(this.leerEstado());
  deBaja = signal(false);
  pagina = signal(1);

  puedeEditar = computed(() => this.auth.puede('activos', 'editar'));
  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(
    () => !!(this.organizacion() || this.tipo() || this.filtroEstado() || this.deBaja()),
  );

  private temporizador?: ReturnType<typeof setTimeout>;
  private peticion?: Subscription;

  ngOnInit() {
    // Todos los clientes, también inactivos: la ficha de un cliente inactivo enlaza aquí.
    this.organizaciones.listar({ pageSize: 100 }).subscribe({
      next: (p) =>
        this.clientes.set(
          p.results.map((o) => ({ id: o.id, nombre: o.activa ? o.nombre : `${o.nombre} (inactivo)` })),
        ),
      error: () => this.clientes.set([]),
    });
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
    this.peticion = this.servicio.listar(this.filtros()).subscribe({
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

  cambiarCliente(valor: string) {
    this.organizacion.set(valor ? Number(valor) : null);
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

  cambiarDeBaja(valor: boolean) {
    this.deBaja.set(valor);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  abrir(id: number) {
    this.router.navigate(['/admin/activos', id]);
  }

  nuevo() {
    const org = this.organizacion();
    this.router.navigate(['/admin/activos/nuevo'], org ? { queryParams: { organizacion: org } } : {});
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }

  private leerOrganizacion(): number | null {
    const v = Number(this.route.snapshot.queryParamMap.get('organizacion'));
    return Number.isInteger(v) && v > 0 ? v : null;
  }

  private leerEstado(): EstadoActivo | null {
    const v = this.route.snapshot.queryParamMap.get('estado');
    return ESTADOS_ACTIVO.find((e) => e.valor === v)?.valor ?? null;
  }

  private filtros(): FiltrosActivos {
    return {
      q: this.q(),
      organizacion: this.organizacion(),
      tipo: this.tipo(),
      estado: this.filtroEstado(),
      de_baja: this.deBaja(),
      page: this.pagina(),
    };
  }
}
