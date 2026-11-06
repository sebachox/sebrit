import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ESTADOS_BACKUP, TIPOS_BACKUP, Backup, BackupEntrada } from '../../../../core/models/backup';
import { BackupsService } from '../../../../core/services/backups.service';

/** Tolerancia para diferencias de reloj (igual que el backend). */
const TOLERANCIA_MS = 5 * 60 * 1000;

function noFutura(c: AbstractControl): ValidationErrors | null {
  if (!c.value) return null;
  return new Date(c.value).getTime() > Date.now() + TOLERANCIA_MS ? { futura: true } : null;
}

function noNegativo(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  return v !== '' && Number(v) < 0 ? { negativo: true } : null;
}

const MENSAJES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  futura: 'La fecha del backup no puede ser futura.',
  negativo: 'El tamaño no puede ser negativo.',
};

type Campo = 'estado' | 'tipo' | 'fecha' | 'tamano_gb' | 'notas';

@Component({
  selector: 'app-backup-form',
  imports: [ReactiveFormsModule],
  templateUrl: './backup-form.html',
  styleUrl: './backup-form.scss',
})
export class BackupForm implements OnInit {
  private servicio = inject(BackupsService);

  /** Activo al que se registra el backup (desde la ficha del activo). */
  activoId = input<number | null>(null);
  /** Si viene, el formulario edita ese backup. */
  backup = input<Backup | null>(null);
  guardado = output<Backup>();
  cancelado = output<void>();

  readonly estados = ESTADOS_BACKUP;
  readonly tipos = TIPOS_BACKUP;

  form = inject(NonNullableFormBuilder).group({
    estado: ['exitoso', Validators.required],
    tipo: ['', Validators.required],
    fecha: ['', [Validators.required, noFutura]],
    tamano_gb: ['', noNegativo],
    notas: [''],
  });

  enviando = signal(false);
  errorGeneral = signal<string | null>(null);

  ngOnInit() {
    const b = this.backup();
    if (b) {
      this.form.patchValue({
        estado: b.estado,
        tipo: b.tipo ?? '',
        fecha: this.aLocal(b.fecha),
        tamano_gb: b.tamano_gb != null ? String(b.tamano_gb) : '',
        notas: b.notas ?? '',
      });
    } else {
      this.form.controls.fecha.setValue(this.aLocal(new Date().toISOString()));
    }
  }

  /** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
  aLocal(iso: string): string {
    const d = new Date(iso);
    const dosDigitos = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` +
      `T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
    );
  }

  invalido(campo: Campo): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  mensaje(campo: Campo): string | null {
    const errores = this.form.controls[campo].errors;
    if (!errores) return null;
    if (errores['servidor']) return errores['servidor'];
    const clave = Object.keys(errores).find((k) => MENSAJES[k]);
    return clave ? MENSAJES[clave] : null;
  }

  guardar() {
    if (this.enviando()) return;
    this.form.controls.fecha.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorGeneral.set(null);

    const b = this.backup();
    const peticion = b
      ? this.servicio.actualizar(b.id, this.aEntrada())
      : this.servicio.registrar({ ...this.aEntrada(), activo: this.activoId() ?? undefined });

    peticion.subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.guardado.emit(r);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        if (e.status === 400 && e.error && typeof e.error === 'object') {
          this.aplicarErroresServidor(e.error);
        } else if (e.status !== 403) {
          this.errorGeneral.set('No se pudo guardar el backup. Intenta de nuevo.');
        }
      },
    });
  }

  private aplicarErroresServidor(errores: Record<string, string[] | string>) {
    let general: string | null = null;
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

  private aEntrada(): BackupEntrada {
    const v = this.form.getRawValue();
    const tamano = v.tamano_gb.trim();
    return {
      estado: v.estado as BackupEntrada['estado'],
      tipo: v.tipo as BackupEntrada['tipo'],
      // Se envía con zona horaria (UTC) para no depender de la zona del servidor.
      fecha: new Date(v.fecha).toISOString(),
      tamano_gb: tamano === '' ? null : Number(tamano),
      notas: v.notas.trim() || null,
    };
  }
}
