import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, switchMap } from 'rxjs';
import { Referencia } from '../../../../core/models/activo';
import { IMPACTOS, ImpactoIncidente, IncidenteResumido } from '../../../../core/models/incidente';
import {
  ALCANCES,
  CATEGORIAS,
  ESTADOS_TICKET,
  EstadoTicket,
  EventoTicket,
  PRIORIDADES,
  PrioridadTicket,
  Ticket,
} from '../../../../core/models/ticket';
import { AuthService } from '../../../../core/services/auth.service';
import { IncidentesService } from '../../../../core/services/incidentes.service';
import { TicketsService } from '../../../../core/services/tickets.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

const texto = (lista: { valor: string; texto: string }[], valor: string | null) =>
  lista.find((x) => x.valor === valor)?.texto ?? valor ?? '';

const MSG_ERROR = 'No se pudo guardar el cambio. Intenta de nuevo.';

@Component({
  selector: 'app-ticket-ficha',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './ticket-ficha.html',
  styleUrl: './ticket-ficha.scss',
})
export class TicketFicha implements OnInit {
  private servicio = inject(TicketsService);
  private incidentes = inject(IncidentesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected auth = inject(AuthService);

  readonly prioridades = PRIORIDADES;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  ticket = signal<Ticket | null>(null);
  tecnicos = signal<Referencia[]>([]);
  guardado = signal(this.route.snapshot.queryParamMap.get('guardado') === '1');

  ocupado = signal(false);
  errorAccion = signal<string | null>(null);

  resolviendo = signal(false);
  solucion = signal('');
  solucionInvalida = signal(false);

  corrigiendo = signal(false);
  prioridadNueva = signal<PrioridadTicket>('alta');
  motivo = signal('');
  motivoInvalido = signal(false);

  comentario = signal('');
  visibleCliente = signal(false);

  readonly impactos = IMPACTOS;
  panelIncidente = signal<'escalar' | 'asociar' | null>(null);
  impactoEscalar = signal('');
  impactoInvalido = signal(false);
  fechaEscalar = signal('');
  errorFecha = signal<string | null>(null);
  incidentesActivos = signal<IncidenteResumido[]>([]);
  incidenteElegido = signal('');
  cargandoIncidentes = signal(false);

  private selectorTecnico = viewChild<ElementRef<HTMLSelectElement>>('selectorTecnico');

  /** Incluye al técnico asignado aunque ya no aparezca en la lista (p. ej. si se desactivó). */
  opcionesTecnico = computed(() => {
    const actual = this.ticket()?.tecnico;
    const lista = this.tecnicos();
    return actual && !lista.some((u) => u.id === actual.id) ? [actual, ...lista] : lista;
  });

  puedeEditar = computed(() => this.auth.puede('tickets', 'editar'));
  cerrado = computed(() => this.ticket()?.estado === 'cerrado');
  bloqueado = computed(() => this.cerrado() || !this.puedeEditar() || this.ocupado());
  usuarioId = computed(() => this.auth.usuario()?.id ?? null);

  ngOnInit() {
    this.servicio.tecnicos().subscribe({
      next: (t) => this.tecnicos.set(t),
      error: () => this.tecnicos.set([]),
    });
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener(this.id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error');
      },
    });
  }

  nombreCategoria(t: Ticket) {
    return texto(CATEGORIAS, t.categoria);
  }

  nombreAlcance(t: Ticket) {
    return texto(ALCANCES, t.alcance);
  }

  autor(e: EventoTicket) {
    return e.autor?.nombre ?? 'Sistema';
  }

  /** Quién puede leer un comentario; los demás eventos no llevan marca. */
  marcaComentario(e: EventoTicket): { texto: string; tono: string } | null {
    if (e.tipo !== 'comentario') return null;
    if (e.autor_es_cliente) return { texto: 'Cliente', tono: 'primario' };
    return e.visible_cliente ? { texto: 'Visible al cliente', tono: 'info' } : { texto: 'Nota interna', tono: 'neutro' };
  }

  /** Frase de la línea de tiempo (el comentario o motivo se muestra aparte). */
  descripcionEvento(e: EventoTicket): string {
    switch (e.tipo) {
      case 'creacion':
        return 'creó el ticket';
      case 'comentario':
        return 'comentó';
      case 'estado':
        return `cambió el estado de ${texto(ESTADOS_TICKET, e.valor_anterior)} a ${texto(ESTADOS_TICKET, e.valor_nuevo)}`;
      case 'tecnico':
        return e.valor_nuevo ? `asignó a ${e.valor_nuevo}` : `quitó la asignación de ${e.valor_anterior}`;
      case 'prioridad':
        return `cambió la prioridad de ${texto(PRIORIDADES, e.valor_anterior)} a ${texto(PRIORIDADES, e.valor_nuevo)}`;
      case 'incidente':
        return e.valor_nuevo ? `asoció al incidente ${e.valor_nuevo}` : `quitó del incidente ${e.valor_anterior}`;
    }
  }

  cambiarEstado(nuevo: EstadoTicket) {
    this.ejecutar(this.servicio.cambiarEstado(this.id, nuevo));
  }

  abrirResolver() {
    this.solucion.set('');
    this.solucionInvalida.set(false);
    this.resolviendo.set(true);
  }

  confirmarResolver() {
    const s = this.solucion().trim();
    if (!s) {
      this.solucionInvalida.set(true);
      return;
    }
    this.ejecutar(this.servicio.cambiarEstado(this.id, 'resuelto', s), () => this.resolviendo.set(false));
  }

  tomar() {
    const id = this.usuarioId();
    if (id) this.ejecutar(this.servicio.actualizar(this.id, { tecnico: id }));
  }

  asignar(valor: string) {
    this.ejecutar(this.servicio.actualizar(this.id, { tecnico: valor ? Number(valor) : null }));
  }

  abrirCorregir() {
    const t = this.ticket();
    if (t) this.prioridadNueva.set(t.prioridad);
    this.motivo.set('');
    this.motivoInvalido.set(false);
    this.corrigiendo.set(true);
  }

  confirmarCorregir() {
    const m = this.motivo().trim();
    if (!m) {
      this.motivoInvalido.set(true);
      return;
    }
    this.ejecutar(this.servicio.corregirPrioridad(this.id, this.prioridadNueva(), m), () =>
      this.corrigiendo.set(false),
    );
  }

  comentar() {
    const c = this.comentario().trim();
    if (!c || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.comentar(this.id, c, this.visibleCliente()).subscribe({
      next: (evento) => {
        this.ticket.update((t) => (t ? { ...t, eventos: [...t.eventos, evento] } : t));
        this.comentario.set('');
        this.visibleCliente.set(false);
        this.ocupado.set(false);
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  editar() {
    this.router.navigate(['/admin/tickets', this.id, 'editar']);
  }

  abrirEscalar() {
    this.impactoEscalar.set('');
    this.fechaEscalar.set('');
    this.impactoInvalido.set(false);
    this.errorFecha.set(null);
    this.errorAccion.set(null);
    this.panelIncidente.set('escalar');
  }

  escalar() {
    const impacto = this.impactoEscalar();
    const fecha = this.fechaEscalar();
    this.impactoInvalido.set(!impacto);
    if (!fecha) this.errorFecha.set('Indica cuándo empezó el incidente.');
    else if (new Date(fecha).getTime() > Date.now()) this.errorFecha.set('La fecha de origen no puede ser futura.');
    else this.errorFecha.set(null);
    if (!impacto || this.errorFecha() || this.ocupado()) return;

    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio
      .escalar(this.id, { impacto: impacto as ImpactoIncidente, fecha_origen: new Date(fecha).toISOString() })
      .subscribe({
        next: (i) => this.router.navigate(['/admin/incidentes', i.id]),
        error: (e: HttpErrorResponse) => this.fallo(e),
      });
  }

  abrirAsociar() {
    const t = this.ticket();
    if (!t) return;
    this.incidenteElegido.set('');
    this.incidentesActivos.set([]);
    this.errorAccion.set(null);
    this.cargandoIncidentes.set(true);
    this.panelIncidente.set('asociar');
    this.incidentes.listar({ organizacion: t.organizacion.id, abiertos: true, pageSize: 100 }).subscribe({
      next: (p) => {
        this.incidentesActivos.set(p.results);
        this.cargandoIncidentes.set(false);
      },
      error: () => {
        this.cargandoIncidentes.set(false);
        this.panelIncidente.set(null);
        this.errorAccion.set('No se pudo cargar la lista de incidentes.');
      },
    });
  }

  asociarIncidente() {
    const incidente = Number(this.incidenteElegido());
    if (!incidente || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.incidentes
      .asociarTicket(incidente, this.id)
      .pipe(switchMap(() => this.servicio.obtener(this.id)))
      .subscribe({
        next: (t) => {
          this.ticket.set(t);
          this.ocupado.set(false);
          this.panelIncidente.set(null);
        },
        error: (e: HttpErrorResponse) => this.fallo(e),
      });
  }

  private ejecutar(peticion: Observable<Ticket>, alTerminar?: () => void) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.guardado.set(false);
    peticion.subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.ocupado.set(false);
        alTerminar?.();
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  private fallo(e: HttpErrorResponse) {
    this.ocupado.set(false);
    // Si falló una asignación, el selector vuelve a mostrar al técnico real.
    const selector = this.selectorTecnico()?.nativeElement;
    if (selector) selector.value = String(this.ticket()?.tecnico?.id ?? '');
    const detalle = e.status === 400 && e.error ? Object.values(e.error).flat()[0] : null;
    this.errorAccion.set(typeof detalle === 'string' ? detalle : MSG_ERROR);
  }
}
