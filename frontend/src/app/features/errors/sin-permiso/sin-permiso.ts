import { Component, computed, inject } from '@angular/core';
import { Rol } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';

const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'administrador',
  tecnico: 'técnico',
  cliente: 'cliente',
};

@Component({
  selector: 'app-sin-permiso',
  templateUrl: './sin-permiso.html',
  styleUrl: './sin-permiso.scss',
})
export class SinPermiso {
  protected auth = inject(AuthService);

  rol = computed(() => {
    const r = this.auth.usuario()?.rol;
    return r ? NOMBRE_ROL[r] : null;
  });
}
