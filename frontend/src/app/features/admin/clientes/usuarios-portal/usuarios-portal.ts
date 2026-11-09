import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { UsuarioPortal } from '../../../../core/models/usuario-portal';
import { AuthService } from '../../../../core/services/auth.service';
import { UsuariosPortalService } from '../../../../core/services/usuarios-portal.service';

type Panel = { tipo: 'crear' } | { tipo: 'editar' | 'clave'; usuario: UsuarioPortal } | null;

const MSG_GUARDAR = 'No se pudo guardar el usuario. Intenta de nuevo.';
const NO_COINCIDEN = 'Las contraseñas no coinciden.';

const TEXTOS: Record<string, Record<string, string>> = {
  username: { required: 'Escribe el usuario.' },
  clave_inicial: { required: 'Escribe la contraseña inicial.' },
  repetir: { required: 'Repite la contraseña.', noCoinciden: NO_COINCIDEN },
  correo: { email: 'Escribe un correo válido.' },
  clave_nueva: { required: 'Escribe la nueva contraseña.' },
};

@Component({
  selector: 'app-usuarios-portal',
  imports: [ReactiveFormsModule],
  templateUrl: './usuarios-portal.html',
})
export class UsuariosPortal implements OnInit {
  private servicio = inject(UsuariosPortalService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);

  organizacionId = input.required<number>();

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  usuarios = signal<UsuarioPortal[]>([]);
  panel = signal<Panel>(null);
  ocupado = signal(false);
  error = signal<string | null>(null);
  aviso = signal<string | null>(null);

  puedeEditar = computed(() => this.auth.puede('clientes', 'editar'));

  formUsuario = this.fb.group({
    username: ['', Validators.required],
    clave_inicial: ['', Validators.required],
    repetir: ['', Validators.required],
    nombres: [''],
    apellidos: [''],
    correo: ['', Validators.email],
  });

  formClave = this.fb.group({
    clave_nueva: ['', Validators.required],
    repetir: ['', Validators.required],
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.listar(this.organizacionId()).subscribe({
      next: (u) => {
        this.usuarios.set(u);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status !== 403) this.estado.set('error');
      },
    });
  }

  nombreCompleto(u: UsuarioPortal): string {
    return [u.nombres, u.apellidos].filter(Boolean).join(' ') || '—';
  }

  invalido(c: AbstractControl): boolean {
    return c.invalid && (c.touched || c.dirty);
  }

  mensaje(c: AbstractControl, campo: string): string | null {
    const errores = c.errors;
    if (!errores) return null;
    if (errores['servidor']) return errores['servidor'];
    const clave = Object.keys(errores).find((k) => TEXTOS[campo]?.[k]);
    return clave ? TEXTOS[campo][clave] : null;
  }

  abrirCrear() {
    this.limpiarMensajes();
    this.formUsuario.reset();
    this.formUsuario.enable();
    this.panel.set({ tipo: 'crear' });
  }

  abrirEditar(usuario: UsuarioPortal) {
    this.limpiarMensajes();
    this.formUsuario.reset({
      nombres: usuario.nombres ?? '',
      apellidos: usuario.apellidos ?? '',
      correo: usuario.correo ?? '',
    });
    // El usuario no se cambia y la contraseña tiene su propio panel.
    for (const c of ['username', 'clave_inicial', 'repetir'] as const) this.formUsuario.controls[c].disable();
    this.panel.set({ tipo: 'editar', usuario });
  }

  abrirClave(usuario: UsuarioPortal) {
    this.limpiarMensajes();
    this.formClave.reset();
    this.panel.set({ tipo: 'clave', usuario });
  }

  cancelar() {
    this.panel.set(null);
  }

  guardarUsuario() {
    if (this.ocupado()) return;
    const p = this.panel();
    if (!p || p.tipo === 'clave') return;
    const c = this.formUsuario.controls;
    if (p.tipo === 'crear') this.comprobarRepeticion(c.clave_inicial, c.repetir);
    if (this.formUsuario.invalid) {
      this.formUsuario.markAllAsTouched();
      return;
    }

    const v = this.formUsuario.getRawValue();
    const datos = {
      nombres: v.nombres.trim() || null,
      apellidos: v.apellidos.trim() || null,
      correo: v.correo.trim() || null,
    };
    const peticion =
      p.tipo === 'crear'
        ? this.servicio.crear(this.organizacionId(), {
            ...datos,
            username: v.username.trim(),
            clave_inicial: v.clave_inicial,
          })
        : this.servicio.actualizar(this.organizacionId(), p.usuario.id, datos);

    this.iniciar();
    peticion.subscribe({
      next: (u) => {
        this.ocupado.set(false);
        this.usuarios.update((l) => (p.tipo === 'crear' ? [...l, u] : l.map((x) => (x.id === u.id ? u : x))));
        this.formUsuario.reset();
        this.panel.set(null);
      },
      error: (e: HttpErrorResponse) => this.fallo(e, this.formUsuario),
    });
  }

  guardarClave() {
    if (this.ocupado()) return;
    const p = this.panel();
    if (p?.tipo !== 'clave') return;
    const c = this.formClave.controls;
    this.comprobarRepeticion(c.clave_nueva, c.repetir);
    if (this.formClave.invalid) {
      this.formClave.markAllAsTouched();
      return;
    }

    this.iniciar();
    this.servicio.definirClave(this.organizacionId(), p.usuario.id, c.clave_nueva.value).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.formClave.reset();
        this.panel.set(null);
        this.aviso.set('Contraseña actualizada.');
      },
      error: (e: HttpErrorResponse) => this.fallo(e, this.formClave),
    });
  }

  alternarActivo(usuario: UsuarioPortal) {
    if (this.ocupado()) return;
    this.iniciar();
    this.servicio.actualizar(this.organizacionId(), usuario.id, { activo: !usuario.activo }).subscribe({
      next: (u) => {
        this.ocupado.set(false);
        this.usuarios.update((l) => l.map((x) => (x.id === u.id ? u : x)));
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  private iniciar() {
    this.ocupado.set(true);
    this.limpiarMensajes();
  }

  private limpiarMensajes() {
    this.error.set(null);
    this.aviso.set(null);
  }

  private comprobarRepeticion(clave: AbstractControl, repetir: AbstractControl) {
    // Un "no coinciden" anterior no debe bloquear si se corrigió la otra casilla.
    repetir.updateValueAndValidity();
    if (repetir.value && repetir.value !== clave.value) repetir.setErrors({ noCoinciden: true });
  }

  private fallo(e: HttpErrorResponse, form?: FormGroup) {
    this.ocupado.set(false);
    if (e.status === 403) return;
    if (e.status !== 400 || !e.error || typeof e.error !== 'object') {
      this.error.set(MSG_GUARDAR);
      return;
    }
    for (const [campo, msgs] of Object.entries(e.error as Record<string, string[] | string>)) {
      const texto = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
      const control = form?.get(campo);
      if (control) {
        control.setErrors({ servidor: texto });
        control.markAsTouched();
      } else {
        this.error.set(texto);
      }
    }
  }
}
