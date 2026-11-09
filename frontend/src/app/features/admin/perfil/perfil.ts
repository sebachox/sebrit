import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ETIQUETA_ROL } from '../../../core/models/auth';
import { Perfil } from '../../../core/models/perfil';
import { AuthService } from '../../../core/services/auth.service';
import { PerfilService } from '../../../core/services/perfil.service';

const LARGO_NOMBRE = { maxlength: 'Usa máximo 150 caracteres.' };

const TEXTOS: Record<string, Record<string, string>> = {
  nombres: LARGO_NOMBRE,
  apellidos: LARGO_NOMBRE,
  correo: { email: 'Escribe un correo válido.', maxlength: 'Usa máximo 254 caracteres.' },
  clave_actual: { required: 'Escribe tu contraseña actual.' },
  clave_nueva: { required: 'Escribe la nueva contraseña.', maxlength: 'Usa máximo 128 caracteres.' },
  repetir: { required: 'Repite la nueva contraseña.', noCoinciden: 'Las contraseñas no coinciden.' },
};

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule],
  templateUrl: './perfil.html',
})
export class PerfilPagina implements OnInit {
  private servicio = inject(PerfilService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);

  readonly etiquetaRol = ETIQUETA_ROL;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  perfil = signal<Perfil | null>(null);

  formDatos = this.fb.group({
    nombres: ['', Validators.maxLength(150)],
    apellidos: ['', Validators.maxLength(150)],
    correo: ['', [Validators.email, Validators.maxLength(254)]],
  });
  enviandoDatos = signal(false);
  datosGuardados = signal(false);
  errorDatos = signal<string | null>(null);

  formClave = this.fb.group({
    clave_actual: ['', Validators.required],
    clave_nueva: ['', [Validators.required, Validators.maxLength(128)]],
    repetir: ['', Validators.required],
  });
  enviandoClave = signal(false);
  claveCambiada = signal(false);
  errorClave = signal<string | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener().subscribe({
      next: (p) => {
        this.aplicar(p);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }

  invalido(c: AbstractControl): boolean {
    return c.invalid && (c.touched || c.dirty);
  }

  mensaje(c: AbstractControl, campo: string): string | null {
    const errores = c.errors;
    if (!errores) return null;
    if (errores['servidor']) return errores['servidor'];
    const clave = Object.keys(errores).find((k) => TEXTOS[campo][k]);
    return clave ? TEXTOS[campo][clave] : null;
  }

  guardarDatos() {
    if (this.enviandoDatos()) return;
    if (this.formDatos.invalid) {
      this.formDatos.markAllAsTouched();
      return;
    }
    this.enviandoDatos.set(true);
    this.errorDatos.set(null);
    this.datosGuardados.set(false);

    const v = this.formDatos.getRawValue();
    this.servicio
      .actualizar({
        nombres: v.nombres.trim() || null,
        apellidos: v.apellidos.trim() || null,
        correo: v.correo.trim() || null,
      })
      .subscribe({
        next: (p) => {
          this.aplicar(p);
          this.auth.actualizarNombre(p.nombre_completo);
          this.enviandoDatos.set(false);
          this.datosGuardados.set(true);
        },
        error: (e: HttpErrorResponse) => {
          this.enviandoDatos.set(false);
          this.errorDatos.set(
            this.erroresServidor(e, this.formDatos, 'No se pudieron guardar tus datos. Intenta de nuevo.'),
          );
        },
      });
  }

  cambiarClave() {
    if (this.enviandoClave()) return;
    const { clave_nueva, repetir } = this.formClave.controls;
    // Un "no coinciden" anterior no debe bloquear si se corrigió la otra casilla.
    repetir.updateValueAndValidity();
    if (repetir.value && repetir.value !== clave_nueva.value) {
      repetir.setErrors({ noCoinciden: true });
    }
    if (this.formClave.invalid) {
      this.formClave.markAllAsTouched();
      return;
    }
    this.enviandoClave.set(true);
    this.errorClave.set(null);
    this.claveCambiada.set(false);

    const v = this.formClave.getRawValue();
    this.servicio.cambiarClave({ clave_actual: v.clave_actual, clave_nueva: v.clave_nueva }).subscribe({
      next: () => {
        this.formClave.reset();
        this.enviandoClave.set(false);
        this.claveCambiada.set(true);
      },
      error: (e: HttpErrorResponse) => {
        this.enviandoClave.set(false);
        this.errorClave.set(
          this.erroresServidor(e, this.formClave, 'No se pudo cambiar la contraseña. Intenta de nuevo.'),
        );
      },
    });
  }

  private aplicar(p: Perfil) {
    this.perfil.set(p);
    this.formDatos.reset({
      nombres: p.nombres ?? '',
      apellidos: p.apellidos ?? '',
      correo: p.correo ?? '',
    });
  }

  /** Marca cada error 400 en su campo y devuelve el mensaje general, si lo hay. */
  private erroresServidor(e: HttpErrorResponse, form: FormGroup, porDefecto: string): string | null {
    if (e.status !== 400 || !e.error || typeof e.error !== 'object') return porDefecto;
    let general: string | null = null;
    for (const [campo, msgs] of Object.entries(e.error as Record<string, string[] | string>)) {
      const texto = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      const control = form.get(campo);
      if (control) {
        control.setErrors({ servidor: texto });
        control.markAsTouched();
      } else {
        general = texto;
      }
    }
    return general;
  }
}
