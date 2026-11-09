import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ALCANCES_PORTAL, ActivoPortal } from '../../../core/models/portal';
import { AlcanceTicket, CATEGORIAS, CategoriaTicket } from '../../../core/models/ticket';
import { PortalService } from '../../../core/services/portal.service';

const OBLIGATORIO: Record<Campo, string> = {
  titulo: 'Escribe el título.',
  descripcion: 'Describe lo que ocurre.',
  categoria: 'Elige una categoría.',
  alcance: 'Indica a quién afecta.',
  activo: '',
};

type Campo = 'titulo' | 'descripcion' | 'categoria' | 'alcance' | 'activo';

/** Un texto de solo espacios cuenta como vacío. */
const conTexto = Validators.pattern(/\S/);

@Component({
  selector: 'app-portal-ticket-nuevo',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './ticket-nuevo.html',
})
export class PortalTicketNuevo implements OnInit {
  private portal = inject(PortalService);
  private router = inject(Router);

  readonly categorias = CATEGORIAS;
  readonly alcances = ALCANCES_PORTAL;

  activos = signal<ActivoPortal[]>([]);
  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  form = inject(NonNullableFormBuilder).group({
    titulo: ['', [Validators.required, conTexto, Validators.maxLength(200)]],
    descripcion: ['', [Validators.required, conTexto]],
    categoria: ['', Validators.required],
    alcance: ['', Validators.required],
    activo: [''],
  });

  ngOnInit() {
    // El activo es opcional: si la lista falla, el ticket se puede abrir igual.
    this.portal.activos().subscribe({
      next: (a) => this.activos.set(a),
      error: () => this.activos.set([]),
    });
  }

  invalido(campo: Campo): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  mensaje(campo: Campo): string | null {
    const errores = this.form.controls[campo].errors;
    if (!errores) return null;
    if (errores['servidor']) return errores['servidor'];
    if (errores['maxlength']) return 'Usa máximo 200 caracteres.';
    return OBLIGATORIO[campo];
  }

  enviar() {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorGeneral.set(null);

    const v = this.form.getRawValue();
    this.portal
      .crearTicket({
        titulo: v.titulo.trim(),
        descripcion: v.descripcion.trim(),
        categoria: v.categoria as CategoriaTicket,
        alcance: v.alcance as AlcanceTicket,
        activo: v.activo ? Number(v.activo) : null,
      })
      .subscribe({
        next: (t) => this.router.navigate(['/portal/tickets', t.id]),
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          this.aplicarError(e);
        },
      });
  }

  private aplicarError(e: HttpErrorResponse) {
    if (e.status === 400 && e.error && typeof e.error === 'object') {
      let general: string | null = null;
      for (const [campo, msgs] of Object.entries(e.error as Record<string, string[] | string>)) {
        const texto = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
        const control = this.form.get(campo);
        if (control) {
          control.setErrors({ servidor: texto });
          control.markAsTouched();
        } else {
          general = texto;
        }
      }
      this.errorGeneral.set(general);
    } else if (e.status !== 403) {
      this.errorGeneral.set('No se pudo abrir el ticket. Intenta de nuevo.');
    }
  }
}
