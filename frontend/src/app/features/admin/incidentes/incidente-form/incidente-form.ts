import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Referencia } from '../../../../core/models/activo';
import { IMPACTOS, ImpactoIncidente, Incidente, IncidenteEntrada } from '../../../../core/models/incidente';
import { ActivosService } from '../../../../core/services/activos.service';
import { IncidentesService } from '../../../../core/services/incidentes.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { TicketsService } from '../../../../core/services/tickets.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

function noFutura(c: AbstractControl): ValidationErrors | null {
  if (!c.value) return null;
  return new Date(c.value).getTime() > Date.now() ? { futura: true } : null;
}

/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function aLocal(iso: string): string {
  const d = new Date(iso);
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` +
    `T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
  );
}

const OBLIGATORIO: Record<string, string> = {
  organizacion: 'Elige el cliente.',
  titulo: 'Escribe un título corto.',
  descripcion: 'Describe qué está pasando.',
  impacto: 'Indica el impacto.',
  fecha_origen: 'Indica cuándo empezó el incidente.',
};

interface OpcionActivo {
  id: number;
  nombre: string;
  tipo: string;
}

type Campo = keyof IncidenteForm['form']['controls'];

@Component({
  selector: 'app-incidente-form',
  imports: [ReactiveFormsModule, RouterLink, StatusBadge],
  templateUrl: './incidente-form.html',
  styleUrl: './incidente-form.scss',
})
export class IncidenteForm implements OnInit, OnDestroy {
  private servicio = inject(IncidentesService);
  private ticketsServicio = inject(TicketsService);
  private activosServicio = inject(ActivosService);
  private organizaciones = inject(OrganizacionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly impactos = IMPACTOS;
  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;

  form = inject(NonNullableFormBuilder).group({
    organizacion: ['', Validators.required],
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', Validators.required],
    impacto: ['', Validators.required],
    fecha_origen: ['', [Validators.required, noFutura]],
    tecnico: [''],
  });

  clientes = signal<Referencia[]>([]);
  cliente = signal<Referencia | null>(null);
  activos = signal<OpcionActivo[]>([]);
  activosMarcados = signal<ReadonlySet<number>>(new Set());
  cargandoActivos = signal(false);
  tecnicos = signal<Referencia[]>([]);
  private tecnicoActual = signal<Referencia | null>(null);

  /** Incluye al técnico asignado aunque ya no aparezca en la lista (p. ej. si se desactivó). */
  opcionesTecnico = computed(() => {
    const actual = this.tecnicoActual();
    const lista = this.tecnicos();
    return actual && !lista.some((u) => u.id === actual.id) ? [actual, ...lista] : lista;
  });

  estado = signal<'cargando' | 'no_encontrado' | 'error_carga' | 'listo'>(this.id ? 'cargando' : 'listo');
  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  private peticionActivos?: Subscription;

  ngOnInit() {
    this.ticketsServicio.tecnicos().subscribe({
      next: (t) => this.tecnicos.set(t),
      error: () => this.tecnicos.set([]),
    });
    if (this.id) {
      this.cargar(this.id);
      return;
    }
    this.organizaciones.listar({ activa: true, pageSize: 100 }).subscribe({
      next: (p) => {
        this.clientes.set(p.results.map((o) => ({ id: o.id, nombre: o.nombre })));
        this.preseleccionarCliente();
      },
      error: () => this.errorGeneral.set('No se pudo cargar la lista de clientes.'),
    });
  }

  ngOnDestroy() {
    this.peticionActivos?.unsubscribe();
  }

  /** Solo se preselecciona un cliente que el formulario realmente muestra. */
  private preseleccionarCliente() {
    const org = Number(this.route.snapshot.queryParamMap.get('organizacion'));
    if (!this.clientes().some((c) => c.id === org)) return;
    this.form.controls.organizacion.setValue(String(org));
    this.cargarActivos(org);
  }

  cargar(id: number) {
    this.estado.set('cargando');
    this.servicio.obtener(id).subscribe({
      next: (i) => {
        this.cliente.set(i.organizacion);
        this.tecnicoActual.set(i.tecnico);
        this.form.patchValue(this.aFormulario(i));
        this.form.controls.organizacion.disable();
        this.activosMarcados.set(new Set(i.activos.map((a) => a.id)));
        this.cargarActivos(i.organizacion.id, i.activos);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error_carga');
      },
    });
  }

  cambiarCliente() {
    this.activosMarcados.set(new Set());
    const org = this.form.controls.organizacion.value;
    if (org) {
      this.cargarActivos(Number(org));
    } else {
      this.peticionActivos?.unsubscribe();
      this.activos.set([]);
    }
  }

  alternarActivo(id: number) {
    const marcados = new Set(this.activosMarcados());
    if (!marcados.delete(id)) marcados.add(id);
    this.activosMarcados.set(marcados);
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
    if (errores['futura']) return 'La fecha de origen no puede ser futura.';
    return null;
  }

  guardar() {
    if (this.enviando()) return;
    this.form.controls.fecha_origen.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorGeneral.set(null);
    const datos = this.aEntrada();
    const peticion = this.id ? this.servicio.actualizar(this.id, datos) : this.servicio.crear(datos);

    peticion.subscribe({
      next: (i) => this.router.navigate(['/admin/incidentes', i.id], { queryParams: { guardado: 1 } }),
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

  /** `vinculados` conserva en la lista activos ya afectados aunque se hayan dado de baja. */
  private cargarActivos(organizacion: number, vinculados: OpcionActivo[] = []) {
    this.peticionActivos?.unsubscribe();
    this.cargandoActivos.set(true);
    this.peticionActivos = this.activosServicio.listar({ organizacion, pageSize: 100 }).subscribe({
      next: (p) => {
        const lista: OpcionActivo[] = p.results.map((a) => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }));
        for (const v of vinculados) {
          if (!lista.some((a) => a.id === v.id)) lista.unshift(v);
        }
        this.activos.set(lista);
        this.cargandoActivos.set(false);
      },
      error: () => {
        this.activos.set(vinculados);
        this.cargandoActivos.set(false);
      },
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

  private aFormulario(i: Incidente) {
    return {
      organizacion: String(i.organizacion.id),
      titulo: i.titulo,
      descripcion: i.descripcion,
      impacto: i.impacto,
      fecha_origen: aLocal(i.fecha_origen),
      tecnico: i.tecnico ? String(i.tecnico.id) : '',
    };
  }

  private aEntrada(): IncidenteEntrada {
    const v = this.form.getRawValue();
    const datos: IncidenteEntrada = {
      titulo: v.titulo.trim(),
      descripcion: v.descripcion.trim(),
      impacto: v.impacto as ImpactoIncidente,
      activos: [...this.activosMarcados()],
      tecnico: v.tecnico ? Number(v.tecnico) : null,
    };
    if (!this.id) datos.organizacion = Number(v.organizacion);
    // El input solo tiene minutos: si no se tocó, se conservan los segundos guardados.
    if (!this.id || this.form.controls.fecha_origen.dirty) {
      datos.fecha_origen = new Date(v.fecha_origen).toISOString();
    }
    return datos;
  }
}
