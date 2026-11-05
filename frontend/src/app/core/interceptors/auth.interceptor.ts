import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { API_URL } from '../config/api';
import { AuthService } from '../services/auth.service';

const RUTAS_PUBLICAS = [`${API_URL}/auth/login/`, `${API_URL}/auth/refresh/`];

// Refresco en curso, compartido por todas las peticiones que reciban 401 a la vez.
let refrescoEnCurso: Observable<string> | null = null;

function conToken(req: HttpRequest<unknown>, token: string | null) {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/** Agrega el JWT a las peticiones del API y lo renueva una vez si expiró. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL) || RUTAS_PUBLICAS.includes(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return next(conToken(req, auth.accessToken)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        router.navigate(['/sin-permiso']);
        return throwError(() => error);
      }
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      if (!auth.refreshToken) {
        auth.logout();
        return throwError(() => error);
      }

      refrescoEnCurso ??= auth.refrescar().pipe(
        finalize(() => (refrescoEnCurso = null)),
        shareReplay(1),
      );

      return refrescoEnCurso.pipe(
        catchError((errorRefresco: unknown) => {
          auth.logout();
          return throwError(() => errorRefresco);
        }),
        switchMap((nuevo) => next(conToken(req, nuevo))),
      );
    }),
  );
};
