import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SelectorTema } from '../../../shared/components/selector-tema/selector-tema';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, SelectorTema],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** Nodos del diagrama decorativo (posición en % del contenedor). */
  readonly nodos = [
    { icono: 'bi-diagram-3', estado: 'ok', x: 14, y: 20 },
    { icono: 'bi-cloud-arrow-up', estado: 'ok', x: 86, y: 18 },
    { icono: 'bi-router', estado: 'alto', x: 90, y: 74 },
    { icono: 'bi-pc-display', estado: 'ok', x: 50, y: 92 },
    { icono: 'bi-shield-check', estado: 'ok', x: 10, y: 78 },
  ];

  enviando = signal(false);
  error = signal<string | null>(null);
  verClave = signal(false);

  invalido(campo: 'username' | 'password') {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  ingresar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const volver = this.route.snapshot.queryParamMap.get('volver');
        this.router.navigateByUrl(volver?.startsWith('/') && !volver.startsWith('//') ? volver : this.auth.rutaInicio());
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(
          e.status === 401
            ? 'Credenciales incorrectas. Revisa tu usuario y contraseña.'
            : e.status === 0
              ? 'No se pudo conectar con el servidor. Intenta de nuevo.'
              : 'Ocurrió un error al iniciar sesión.',
        );
      },
    });
  }
}
