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
import {
  Activo,
  ActivoEntrada,
  ESTADOS_ACTIVO,
  Referencia,
  TIPOS_ACTIVO,
} from '../../../../core/models/activo';
import { ActivosService } from '../../../../core/services/activos.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:.]+$/;

/** Validación rápida en el navegador; el backend valida la IP de forma definitiva. */
function ipValida(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  const ok = IPV4.test(v) || (v.includes(':') && IPV6.test(v));
  return ok ? null : { ip: true };
}

const MENSAJES: Record<string, string> = {
  ip: 'Escribe una dirección IP válida, por ejemplo 192.168.1.10.',
};

const OBLIGATORIO: Record<string, string> = {
  organizacion: 'Elige el cliente.',
  tipo: 'Elige el tipo de activo.',
  nombre: 'Escribe el nombre del activo.',
};

const OPCIONALES = [
  'hostname', 'ip', 'sistema_operativo', 'fabricante', 'modelo', 'numero_serie', 'ubicacion', 'notas',
] as const;

type Campo = keyof ActivoForm['form']['controls'];

@Component({
  selector: 'app-activo-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './activo-form.html',
  styleUrl: './activo-form.scss',
})
export class ActivoForm implements OnInit {
  private servicio = inject(ActivosService);
  private organizaciones = inject(OrganizacionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tipos = TIPOS_ACTIVO;
  readonly estados = ESTADOS_ACTIVO;
  readonly id = Number(this.route.snapshot.paramMap.get('id')) || null;

  form = inject(NonNullableFormBuilder).group({
    organizacion: ['', Validators.required],
    tipo: ['', Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    estado: ['operativo', Validators.required],
    hostname: ['', Validators.maxLength(150)],
    ip: ['', ipValida],
    sistema_operativo: ['', Validators.maxLength(100)],
    fabricante: ['', Validators.maxLength(100)],
    modelo: ['', Validators.maxLength(100)],
    numero_serie: ['', Validators.maxLength(100)],
    ubicacion: ['', Validators.maxLength(150)],
    notas: [''],
  });

  clientes = signal<Referencia[]>([]);
  cliente = signal<Referencia | null>(null);
  estado = signal<'cargando' | 'no_encontrado' | 'error_carga' | 'listo'>(this.id ? 'cargando' : 'listo');
  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  ngOnInit() {
    if (this.id) {
      this.cargar(this.id);
      return;
    }
    this.organizaciones.listar({ activa: true, pageSize: 100 }).subscribe({
      next: (p) => {
        this.clientes.set(p.results.map((o) => ({ id: o.id, nombre: o.nombre })));
        // Solo se preselecciona un cliente que el formulario realmente muestra.
        const org = Number(this.route.snapshot.queryParamMap.get('organizacion'));
        if (this.clientes().some((c) => c.id === org)) {
          this.form.controls.organizacion.setValue(String(org));
        }
      },
      error: () => this.errorGeneral.set('No se pudo cargar la lista de clientes.'),
    });
  }

  cargar(id: number) {
    this.estado.set('cargando');
    this.servicio.obtener(id).subscribe({
      next: (a) => {
        this.cliente.set(a.organizacion);
        this.form.patchValue(this.aFormulario(a));
        this.form.controls.organizacion.disable();
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorGeneral.set(null);
    const datos = this.aEntrada();
    const peticion = this.id ? this.servicio.actualizar(this.id, datos) : this.servicio.crear(datos);

    peticion.subscribe({
      next: (a) => this.router.navigate(['/admin/activos', a.id], { queryParams: { guardado: 1 } }),
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

  private aFormulario(a: Activo) {
    const valores: Record<string, string> = {
      organizacion: String(a.organizacion.id),
      tipo: a.tipo,
      nombre: a.nombre,
      estado: a.estado,
    };
    for (const campo of OPCIONALES) valores[campo] = a[campo] ?? '';
    return valores;
  }

  /** Recorta espacios, opcionales vacíos como null y, al editar, sin `organizacion`. */
  private aEntrada(): ActivoEntrada {
    const v = this.form.getRawValue();
    const datos: Record<string, unknown> = {
      tipo: v.tipo,
      nombre: v.nombre.trim(),
      estado: v.estado,
    };
    for (const campo of OPCIONALES) datos[campo] = v[campo].trim() || null;
    if (!this.id) datos['organizacion'] = Number(v.organizacion);
    return datos as ActivoEntrada;
  }
}
