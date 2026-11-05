import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Accion, Modulo } from '../auth/permisos';
import { AuthService } from '../services/auth.service';

/** Bloquea la ruta si el rol no tiene el permiso; la entrada por URL termina en /sin-permiso. */
export function permisoGuard(modulo: Modulo, accion: Accion): CanActivateFn {
  return () =>
    inject(AuthService).puede(modulo, accion) || inject(Router).parseUrl('/sin-permiso');
}

/** Redirige la raíz del panel a la ruta de inicio del rol. */
export const inicioGuard: CanActivateFn = () =>
  inject(Router).parseUrl(inject(AuthService).rutaInicio());
