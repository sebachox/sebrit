import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Referencia } from '../../../../core/models/activo';
import { ALCANCES, CATEGORIAS, Ticket, TicketEntrada } from '../../../../core/models/ticket';
import { ActivosService } from '../../../../core/services/activos.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { TicketsService } from '../../../../core/services/tickets.service';

const OBLIGATORIO: Record<string, string> = {
  organizacion: 'Elige el cliente.',
  titulo: 'Escribe un título corto.',
  descripcion: 'Describe qué está pasando.',
  categoria: 'Elige la categoría.',
  alcance: 'Indica a quién afecta.',
};

type Campo = keyof TicketForm['form']['controls'];

@Component({
  selector: 'app-ticket-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './ticket-form.html',
  styleUrl: './ticket-form.scss',
})
export class TicketForm implements OnInit, OnDestroy {
  private servicio = inject(TicketsService);
  private activosServicio = inject(ActivosService);
  private organizaciones = inject(OrganizacionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly categorias = CATEGORIAS;
  readonly alcances = ALCANCES;
  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;

  form = inject(NonNullableFormBuilder).group({
    organizacion: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', Validators.required],
    categoria: ['', Validators.required],
    alcance: ['', Validators.required],
    activo: [''],
    tecnico: [''],
  });

  clientes = signal<Referencia[]>([]);
  cliente = signal<Referencia | null>(null);
  activos = signal<Referencia[]>([]);
  tecnicos = signal<Referencia[]>([]);
  estado = signal<'cargando' | 'no_encontrado' | 'error_carga' | 'listo'>(this.id ? 'cargando' : 'listo');
  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  private peticionActivos?: Subscription;

  ngOnInit() {
    this.servicio.tecnicos().subscribe({
      next: (t) => this.tecnicos.set(t),
      error: () => this.tecnicos.set([]),
    });
    if (this.id) {
      this.cargar(this.id);
      return;
    }
    this.organizaciones.listar({ activa: true, pageSize: 100 }).subscribe({
      next: (p) => this.clientes.set(p.results.map((o) => ({ id: o.id, nombre: o.nombre }))),
      error: () => this.errorGeneral.set('No se pudo cargar la lista de clientes.'),
    });
    const org = this.route.snapshot.queryParamMap.get('organizacion');
    if (org) {
      this.form.controls.organizacion.setValue(org);
      this.cargarActivos(Number(org));
    }
  }

  ngOnDestroy() {
    this.peticionActivos?.unsubscribe();
  }

  cargar(id: number) {
    this.estado.set('cargando');
    this.servicio.obtener(id).subscribe({
      next: (t) => {
        this.cliente.set(t.organizacion);
        this.form.patchValue(this.aFormulario(t));
        this.form.controls.organizacion.disable();
        this.cargarActivos(t.organizacion.id, t.activo);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error_carga');
      },
    });
  }

  cambiarCliente() {
    this.form.controls.activo.setValue('');
    const org = this.form.controls.organizacion.value;
    if (org) this.cargarActivos(Number(org));
    else this.activos.set([]);
  }

  invalido(campo: Campo): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  mensaje(campo: Campo): string | null {
    const errores = this.form.controls[campo].errors;
    if (!errores) return null;
    if (errores['servidor']) return errores['servidor'];
    if (errores['required']) return OBLIGATORIO[campo] ?? 'Este campo es obligatorio.';
    if (errores['maxlength']) return `Máximo ${errores['maxlength'].requiredLength} caracteres.`;
    return null;
  }

  guardar() {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorGeneral.set(null);
    const datos = this.aEntrada();
    const peticion = this.id ? this.servicio.actualizar(this.id, datos) : this.servicio.crear(datos);

    peticion.subscribe({
      next: (t) => this.router.navigate(['/admin/tickets', t.id], { queryParams: { guardado: 1 } }),
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        if (e.status === 400 && e.error && typeof e.error === 'object') {
          this.aplicarErroresServidor(e.error);
        } else if (e.status !== 403) {
          this.errorGeneral.set('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
        }
      },
    });
  }

  /** `actual` conserva en la lista un activo ya vinculado aunque se haya dado de baja. */
  private cargarActivos(organizacion: number, actual?: Referencia | null) {
    this.peticionActivos?.unsubscribe();
    this.peticionActivos = this.activosServicio.listar({ organizacion, pageSize: 100 }).subscribe({
      next: (p) => {
        const lista: Referencia[] = p.results.map((a) => ({ id: a.id, nombre: a.nombre }));
        if (actual && !lista.some((a) => a.id === actual.id)) lista.unshift(actual);
        this.activos.set(lista);
      },
      error: () => this.activos.set(actual ? [actual] : []),
    });
  }

  private aplicarErroresServidor(errores: Record<string, string[] | string>) {
    let general: string | null = 'Revisa los campos marcados.';
    for (const [campo, msgs] of Object.entries(errores)) {
      const texto = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      const control = this.form.get(campo);
      if (control && control.enabled) {
        control.setErrors({ servidor: texto });
        control.markAsTouched();
      } else {
        general = texto;
      }
    }
    this.errorGeneral.set(general);
  }

  private aFormulario(t: Ticket) {
    return {
      organizacion: String(t.organizacion.id),
      titulo: t.titulo,
      descripcion: t.descripcion,
      categoria: t.categoria,
      alcance: t.alcance,
      activo: t.activo ? String(t.activo.id) : '',
      tecnico: t.tecnico ? String(t.tecnico.id) : '',
    };
  }

  private aEntrada(): TicketEntrada {
    const v = this.form.getRawValue();
    const datos: TicketEntrada = {
      titulo: v.titulo.trim(),
      descripcion: v.descripcion.trim(),
      categoria: v.categoria as TicketEntrada['categoria'],
      alcance: v.alcance as TicketEntrada['alcance'],
      activo: v.activo ? Number(v.activo) : null,
      tecnico: v.tecnico ? Number(v.tecnico) : null,
    };
    if (!this.id) datos.organizacion = Number(v.organizacion);
    return datos;
  }
}
