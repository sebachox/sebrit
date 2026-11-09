import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** El portal es solo para clientes; el resto vuelve a su panel. */
export const portalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.usuario()?.rol === 'cliente' || inject(Router).parseUrl(auth.rutaInicio());
};

/** Pantallas del panel interno abiertas a toda sesión: el cliente tiene las suyas en el portal. */
export const equipoGuard: CanActivateFn = () =>
  inject(AuthService).usuario()?.rol !== 'cliente' || inject(Router).parseUrl('/portal/perfil');
