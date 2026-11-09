import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ALCANCES_PORTAL, EventoPortal, TicketPortal } from '../../../core/models/portal';
import { CATEGORIAS, ESTADOS_TICKET } from '../../../core/models/ticket';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const NOMBRE_ESTADO: Record<string, string> = Object.fromEntries(ESTADOS_TICKET.map((e) => [e.valor, e.texto]));
const NOMBRE_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.texto]));
const NOMBRE_ALCANCE: Record<string, string> = Object.fromEntries(ALCANCES_PORTAL.map((a) => [a.valor, a.texto]));

@Component({
  selector: 'app-portal-ticket-ficha',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './ticket-ficha.html',
  styleUrl: './ticket-ficha.scss',
})
export class PortalTicketFicha implements OnInit {
  private portal = inject(PortalService);
  private route = inject(ActivatedRoute);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly nombreCategoria = NOMBRE_CATEGORIA;
  readonly nombreAlcance = NOMBRE_ALCANCE;

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  ticket = signal<TicketPortal | null>(null);
  comentario = signal('');
  enviando = signal(false);
  errorComentario = signal<string | null>(null);

  cerrado = computed(() => this.ticket()?.estado === 'cerrado');
  puedeEnviar = computed(() => !this.enviando() && !!this.comentario().trim());

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.portal.obtenerTicket(this.id).subscribe({
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

  /** Frase de la conversación; el texto del comentario se muestra aparte. */
  descripcion(e: EventoPortal): string {
    switch (e.tipo) {
      case 'creacion':
        return 'abrió el ticket';
      case 'estado':
        return `cambió el estado a ${NOMBRE_ESTADO[e.valor_nuevo ?? ''] ?? e.valor_nuevo}`;
      case 'comentario':
        return 'comentó';
    }
  }

  esEquipo(e: EventoPortal): boolean {
    return e.autor !== null && !e.autor_es_cliente;
  }

  comentar() {
    const texto = this.comentario().trim();
    if (!texto || this.enviando()) return;
    this.enviando.set(true);
    this.errorComentario.set(null);
    this.portal.comentar(this.id, texto).subscribe({
      next: (evento) => {
        this.ticket.update((t) => (t ? { ...t, eventos: [...t.eventos, evento] } : t));
        this.comentario.set('');
        this.enviando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        const detalle = e.status === 400 && e.error ? Object.values(e.error).flat()[0] : null;
        this.errorComentario.set(
          typeof detalle === 'string' ? detalle : 'No se pudo enviar el comentario. Intenta de nuevo.',
        );
      },
    });
  }
}
