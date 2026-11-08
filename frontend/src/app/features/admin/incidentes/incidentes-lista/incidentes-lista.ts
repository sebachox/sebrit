import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Referencia } from '../../../../core/models/activo';
import {
  ESTADOS_INCIDENTE,
  EstadoIncidente,
  FiltrosIncidentes,
  IMPACTOS,
  ImpactoIncidente,
  IncidenteResumido,
  SEVERIDADES,
  SeveridadIncidente,
  textoDuracion,
} from '../../../../core/models/incidente';
import { Paginado } from '../../../../core/models/organizacion';
import { AuthService } from '../../../../core/services/auth.service';
import { IncidentesService } from '../../../../core/services/incidentes.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { TicketsService } from '../../../../core/services/tickets.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const ESPERA_BUSQUEDA_MS = 300;

@Component({
  selector: 'app-incidentes-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './incidentes-lista.html',
  styleUrl: './incidentes-lista.scss',
})
export class IncidentesLista implements OnInit, OnDestroy {
  private servicio = inject(IncidentesService);
  private ticketsServicio = inject(TicketsService);
  private organizaciones = inject(OrganizacionesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthService);

  readonly estados = ESTADOS_INCIDENTE;
  readonly severidades = SEVERIDADES;
  readonly impactos = IMPACTOS;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<IncidenteResumido> | null>(null);
  clientes = signal<Referencia[]>([]);
  tecnicos = signal<Referencia[]>([]);

  q = signal('');
  organizacion = signal<number | null>(this.leerOrganizacion());
  filtroEstado = signal<'abiertos' | 'todos' | EstadoIncidente>('abiertos');
  severidad = signal<SeveridadIncidente | null>(null);
  impacto = signal<ImpactoIncidente | null>(null);
  tecnico = signal<number | 'sin_asignar' | null>(null);
  fechaDesde = signal('');
  fechaHasta = signal('');
  orden = signal<string | null>(null);
  pagina = signal(1);

  puedeEditar = computed(() => this.auth.puede('incidentes', 'editar'));
  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(
    () =>
      !!(
        this.organizacion() ||
        this.severidad() ||
        this.impacto() ||
        this.tecnico() ||
        this.fechaDesde() ||
        this.fechaHasta()
      ) || this.filtroEstado() !== 'abiertos',
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
    this.ticketsServicio.tecnicos().subscribe({
      next: (t) => this.tecnicos.set(t),
      error: () => this.tecnicos.set([]),
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

  duracion(i: IncidenteResumido): string {
    return i.duracion_minutos === null ? 'En curso' : textoDuracion(i.duracion_minutos);
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

  cambiarCliente(v: string) {
    this.organizacion.set(v ? Number(v) : null);
    this.reiniciar();
  }

  cambiarEstado(v: string) {
    this.filtroEstado.set(v as 'abiertos' | 'todos' | EstadoIncidente);
    this.reiniciar();
  }

  cambiarSeveridad(v: string) {
    this.severidad.set((v || null) as SeveridadIncidente | null);
    this.reiniciar();
  }

  cambiarImpacto(v: string) {
    this.impacto.set((v || null) as ImpactoIncidente | null);
    this.reiniciar();
  }

  cambiarTecnico(v: string) {
    this.tecnico.set(v === 'sin_asignar' ? 'sin_asignar' : v ? Number(v) : null);
    this.reiniciar();
  }

  cambiarDesde(v: string) {
    this.fechaDesde.set(v);
    this.reiniciar();
  }

  cambiarHasta(v: string) {
    this.fechaHasta.set(v);
    this.reiniciar();
  }

  cambiarOrden(v: string) {
    this.orden.set(v || null);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  abrir(id: number) {
    this.router.navigate(['/admin/incidentes', id]);
  }

  nuevo() {
    const org = this.organizacion();
    this.router.navigate(['/admin/incidentes/nuevo'], org ? { queryParams: { organizacion: org } } : {});
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }

  private leerOrganizacion(): number | null {
    const v = Number(this.route.snapshot.queryParamMap.get('organizacion'));
    return Number.isInteger(v) && v > 0 ? v : null;
  }

  private filtros(): FiltrosIncidentes {
    const e = this.filtroEstado();
    return {
      q: this.q(),
      organizacion: this.organizacion(),
      abiertos: e === 'abiertos',
      estado: e === 'abiertos' || e === 'todos' ? null : e,
      severidad: this.severidad(),
      impacto: this.impacto(),
      tecnico: this.tecnico(),
      desde: this.fechaDesde(),
      hasta: this.fechaHasta(),
      ordering: this.orden(),
      page: this.pagina(),
    };
  }
}
