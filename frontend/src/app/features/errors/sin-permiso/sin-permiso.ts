import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ETIQUETA_ROL } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sin-permiso',
  templateUrl: './sin-permiso.html',
  styleUrl: './sin-permiso.scss',
})
export class SinPermiso {
  protected auth = inject(AuthService);
  private router = inject(Router);

  rol = computed(() => {
    const r = this.auth.usuario()?.rol;
    return r ? ETIQUETA_ROL[r].toLowerCase() : null;
  });

  /** El rol tiene un panel propio al que volver (admin y técnico). */
  tienePanel = computed(() => this.auth.rutaInicio() !== '/sin-permiso');

  volver() {
    this.router.navigateByUrl(this.auth.rutaInicio());
  }
}
