import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Referencia } from '../../../../core/models/activo';
import {
  AccionIncidente,
  ESTADOS_INCIDENTE,
  EstadoIncidente,
  Incidente,
  SEVERIDADES,
  SeveridadIncidente,
  textoDuracion,
} from '../../../../core/models/incidente';
import { TicketResumido } from '../../../../core/models/ticket';
import { AuthService } from '../../../../core/services/auth.service';
import { IncidentesService } from '../../../../core/services/incidentes.service';
import { TicketsService } from '../../../../core/services/tickets.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

const texto = (lista: { valor: string; texto: string }[], valor: string | null) =>
  lista.find((x) => x.valor === valor)?.texto ?? valor ?? '';

const MSG_ERROR = 'No se pudo guardar el cambio. Intenta de nuevo.';

type Panel = 'resolver' | 'cerrar' | 'reabrir';

@Component({
  selector: 'app-incidente-ficha',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './incidente-ficha.html',
  styleUrl: './incidente-ficha.scss',
})
export class IncidenteFicha implements OnInit {
  private servicio = inject(IncidentesService);
  private ticketsServicio = inject(TicketsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected auth = inject(AuthService);

  readonly severidades = SEVERIDADES;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  incidente = signal<Incidente | null>(null);
  tecnicos = signal<Referencia[]>([]);
  guardado = signal(this.route.snapshot.queryParamMap.get('guardado') === '1');

  ocupado = signal(false);
  errorAccion = signal<string | null>(null);

  panel = signal<Panel | null>(null);
  solucion = signal('');
  solucionInvalida = signal(false);
  causaRaiz = signal('');
  causaInvalida = signal(false);

  corrigiendo = signal(false);
  severidadNueva = signal<SeveridadIncidente>('alta');
  motivo = signal('');
  motivoInvalido = signal(false);

  nuevaAccion = signal('');

  asociando = signal(false);
  ticketsLibres = signal<TicketResumido[]>([]);
  ticketElegido = signal('');
  cargandoTickets = signal(false);

  private selectorTecnico = viewChild<ElementRef<HTMLSelectElement>>('selectorTecnico');

  /** Incluye al técnico asignado aunque ya no aparezca en la lista (p. ej. si se desactivó). */
  opcionesTecnico = computed(() => {
    const actual = this.incidente()?.tecnico;
    const lista = this.tecnicos();
    return actual && !lista.some((u) => u.id === actual.id) ? [actual, ...lista] : lista;
  });

  puedeEditar = computed(() => this.auth.puede('incidentes', 'editar'));
  cerrado = computed(() => this.incidente()?.estado === 'cerrado');
  bloqueado = computed(() => this.cerrado() || !this.puedeEditar() || this.ocupado());

  ticketsActivos = computed(
    () => this.incidente()?.tickets.filter((t) => t.estado === 'abierto' || t.estado === 'en_progreso').length ?? 0,
  );
  avisoTickets = computed(() => {
    const n = this.ticketsActivos();
    if (n === 0) return null;
    return n === 1 ? '1 ticket asociado pasará a resuelto.' : `${n} tickets asociados pasarán a resuelto.`;
  });
  duracion = computed(() => {
    const minutos = this.incidente()?.duracion_minutos ?? null;
    return minutos === null ? 'En curso' : textoDuracion(minutos);
  });

  ngOnInit() {
    this.ticketsServicio.tecnicos().subscribe({
      next: (t) => this.tecnicos.set(t),
      error: () => this.tecnicos.set([]),
    });
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener(this.id).subscribe({
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

  autor(a: AccionIncidente) {
    return a.autor?.nombre ?? 'Sistema';
  }

  /** Frase de la línea de tiempo (el texto de la acción se muestra aparte). */
  descripcionAccion(a: AccionIncidente): string {
    switch (a.tipo) {
      case 'creacion':
        return 'abrió el incidente';
      case 'accion':
        return 'registró una acción';
      case 'estado':
        return `cambió el estado de ${texto(ESTADOS_INCIDENTE, a.valor_anterior)} a ${texto(ESTADOS_INCIDENTE, a.valor_nuevo)}`;
      case 'tecnico':
        return a.valor_nuevo ? `asignó a ${a.valor_nuevo}` : `quitó la asignación de ${a.valor_anterior}`;
      case 'severidad':
        return `cambió la severidad de ${texto(SEVERIDADES, a.valor_anterior)} a ${texto(SEVERIDADES, a.valor_nuevo)}`;
      case 'ticket':
        return a.valor_nuevo ? `asoció el ticket ${a.valor_nuevo}` : `quitó el ticket ${a.valor_anterior}`;
    }
  }

  cambiarEstado(nuevo: EstadoIncidente) {
    this.ejecutar(this.servicio.cambiarEstado(this.id, nuevo), this.cerrarPanel);
  }

  abrirPanel(panel: Panel) {
    this.solucion.set('');
    this.solucionInvalida.set(false);
    this.causaRaiz.set('');
    this.causaInvalida.set(false);
    this.panel.set(panel);
  }

  confirmarResolver() {
    const s = this.solucion().trim();
    if (!s) {
      this.solucionInvalida.set(true);
      return;
    }
    this.ejecutar(this.servicio.cambiarEstado(this.id, 'resuelto', { solucion: s }), this.cerrarPanel);
  }

  confirmarCerrar() {
    const c = this.causaRaiz().trim();
    if (!c) {
      this.causaInvalida.set(true);
      return;
    }
    this.ejecutar(this.servicio.cambiarEstado(this.id, 'cerrado', { causa_raiz: c }), this.cerrarPanel);
  }

  confirmarReabrir() {
    this.ejecutar(this.servicio.cambiarEstado(this.id, 'abierto'), this.cerrarPanel);
  }

  tomar() {
    const id = this.auth.usuario()?.id;
    if (id) this.ejecutar(this.servicio.actualizar(this.id, { tecnico: id }));
  }

  asignar(valor: string) {
    this.ejecutar(this.servicio.actualizar(this.id, { tecnico: valor ? Number(valor) : null }));
  }

  abrirCorregir() {
    const i = this.incidente();
    if (i) this.severidadNueva.set(i.severidad);
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
    this.ejecutar(this.servicio.corregirSeveridad(this.id, this.severidadNueva(), m), () =>
      this.corrigiendo.set(false),
    );
  }

  registrarAccion() {
    const d = this.nuevaAccion().trim();
    if (!d || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.agregarAccion(this.id, d).subscribe({
      next: (accion) => {
        this.incidente.update((i) => (i ? { ...i, acciones: [...i.acciones, accion] } : i));
        this.nuevaAccion.set('');
        this.ocupado.set(false);
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  abrirAsociar() {
    const i = this.incidente();
    if (!i) return;
    this.ticketElegido.set('');
    this.ticketsLibres.set([]);
    this.errorAccion.set(null);
    this.cargandoTickets.set(true);
    this.asociando.set(true);
    this.ticketsServicio.listar({ organizacion: i.organizacion.id, abiertos: true, pageSize: 100 }).subscribe({
      next: (p) => {
        this.ticketsLibres.set(p.results.filter((t) => !t.incidente));
        this.cargandoTickets.set(false);
      },
      error: () => {
        this.cargandoTickets.set(false);
        this.asociando.set(false);
        this.errorAccion.set('No se pudo cargar la lista de tickets.');
      },
    });
  }

  asociar() {
    const ticket = Number(this.ticketElegido());
    if (ticket) this.ejecutar(this.servicio.asociarTicket(this.id, ticket), () => this.asociando.set(false));
  }

  quitar(ticket: number) {
    this.ejecutar(this.servicio.quitarTicket(this.id, ticket));
  }

  editar() {
    this.router.navigate(['/admin/incidentes', this.id, 'editar']);
  }

  private cerrarPanel = () => this.panel.set(null);

  /** `alTerminar` cierra solo lo que corresponde: otra acción no debe borrar lo que se está escribiendo. */
  private ejecutar(peticion: Observable<Incidente>, alTerminar?: () => void) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.guardado.set(false);
    peticion.subscribe({
      next: (i) => {
        this.incidente.set(i);
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
    if (selector) selector.value = String(this.incidente()?.tecnico?.id ?? '');
    const detalle = e.status === 400 && e.error ? Object.values(e.error).flat()[0] : null;
    this.errorAccion.set(typeof detalle === 'string' ? detalle : MSG_ERROR);
  }
}
