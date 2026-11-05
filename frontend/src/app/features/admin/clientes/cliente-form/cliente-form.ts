import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Organizacion, OrganizacionEntrada, PLANES } from '../../../../core/models/organizacion';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';

const NIT_VALIDO = /^\d{6,10}(-\d)?$/;

function nitValido(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  return v && !NIT_VALIDO.test(v) ? { pattern: true } : null;
}

function finNoAnteriorAInicio(c: AbstractControl): ValidationErrors | null {
  const inicio = c.parent?.get('fecha_inicio_contrato')?.value;
  return inicio && c.value && c.value < inicio ? { finAnterior: true } : null;
}

const MENSAJES: Record<string, string> = {
  pattern: 'Escribe el NIT sin puntos ni espacios, por ejemplo 900123456-7.',
  email: 'Escribe un correo válido, por ejemplo nombre@empresa.com.',
  finAnterior: 'La fecha de fin no puede ser anterior a la de inicio.',
};

const OBLIGATORIO: Record<string, string> = {
  nombre: 'Escribe el nombre de la empresa.',
  nit: 'Escribe el NIT de la empresa.',
};

type Campo = keyof ClienteForm['form']['controls'];

@Component({
  selector: 'app-cliente-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cliente-form.html',
  styleUrl: './cliente-form.scss',
})
export class ClienteForm implements OnInit {
  private servicio = inject(OrganizacionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly planes = PLANES;
  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;

  form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    nit: ['', [Validators.required, nitValido]],
    sector: ['', Validators.maxLength(100)],
    telefono: ['', Validators.maxLength(30)],
    correo: ['', Validators.email],
    direccion: ['', Validators.maxLength(200)],
    ciudad: ['', Validators.maxLength(100)],
    contacto_nombre: ['', Validators.maxLength(150)],
    contacto_cargo: ['', Validators.maxLength(100)],
    contacto_correo: ['', Validators.email],
    contacto_telefono: ['', Validators.maxLength(30)],
    plan: [''],
    fecha_inicio_contrato: [''],
    fecha_fin_contrato: ['', finNoAnteriorAInicio],
  });

  estado = signal<'cargando' | 'no_encontrado' | 'error_carga' | 'listo'>(
    this.id ? 'cargando' : 'listo',
  );
  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  constructor() {
    this.form.controls.fecha_inicio_contrato.valueChanges.subscribe(() =>
      this.form.controls.fecha_fin_contrato.updateValueAndValidity({ emitEvent: false }),
    );
  }

  ngOnInit() {
    if (this.id) this.cargar(this.id);
  }

  cargar(id: number) {
    this.estado.set('cargando');
    this.servicio.obtener(id).subscribe({
      next: (o) => {
        this.form.patchValue(this.aFormulario(o));
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) =>
        this.estado.set(e.status === 404 ? 'no_encontrado' : 'error_carga'),
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
    if (errores['required']) return OBLIGATORIO[campo] ?? 'Este campo es obligatorio.';
    if (errores['maxlength']) return `Máximo ${errores['maxlength'].requiredLength} caracteres.`;
    const clave = Object.keys(errores).find((k) => MENSAJES[k]);
    return clave ? MENSAJES[clave] : null;
  }

  guardar() {
    if (this.enviando()) return;
    this.form.controls.fecha_fin_contrato.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorGeneral.set(null);
      return;
    }

    this.enviando.set(true);
    this.errorGeneral.set(null);
    const datos = this.aEntrada();
    const peticion = this.id ? this.servicio.actualizar(this.id, datos) : this.servicio.crear(datos);

    peticion.subscribe({
      next: (o) =>
        this.router.navigate(['/admin/clientes', o.id], { queryParams: { guardado: 1 } }),
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

  aplicarErroresServidor(errores: Record<string, string[] | string>) {
    let general: string | null = 'Revisa los campos marcados.';
    for (const [campo, msgs] of Object.entries(errores)) {
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
  }

  private aFormulario(o: Organizacion) {
    const valores: Record<string, string> = {};
    for (const campo of Object.keys(this.form.controls)) {
      valores[campo] = (o[campo as keyof Organizacion] as string | null) ?? '';
    }
    return valores;
  }

  /** Recorta espacios y convierte los opcionales vacíos en null, como espera el contrato. */
  private aEntrada(): OrganizacionEntrada {
    const datos: Record<string, string | null> = {};
    for (const [campo, valor] of Object.entries(this.form.getRawValue())) {
      const limpio = valor.trim();
      datos[campo] = limpio === '' && campo !== 'nombre' && campo !== 'nit' ? null : limpio;
    }
    return datos as OrganizacionEntrada;
  }
}
