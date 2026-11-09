import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { Accion, Modulo, puede } from '../auth/permisos';
import { API_URL } from '../config/api';
import { Credenciales, RespuestaLogin, RespuestaRefresh, Usuario } from '../models/auth';

const CLAVE_ACCESS = 'sebrit.access';
const CLAVE_REFRESH = 'sebrit.refresh';
const CLAVE_USUARIO = 'sebrit.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly _usuario = signal<Usuario | null>(this.leerUsuario());
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  get accessToken(): string | null {
    return localStorage.getItem(CLAVE_ACCESS);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(CLAVE_REFRESH);
  }

  login(credenciales: Credenciales): Observable<Usuario> {
    return this.http.post<RespuestaLogin>(`${API_URL}/auth/login/`, credenciales).pipe(
      tap((r) => {
        localStorage.setItem(CLAVE_ACCESS, r.access);
        localStorage.setItem(CLAVE_REFRESH, r.refresh);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(r.usuario));
        this._usuario.set(r.usuario);
      }),
      map((r) => r.usuario),
    );
  }

  /** Pide un access token nuevo usando el refresh token guardado. */
  refrescar(): Observable<string> {
    return this.http
      .post<RespuestaRefresh>(`${API_URL}/auth/refresh/`, { refresh: this.refreshToken })
      .pipe(
        map((r) => r.access),
        tap((access) => localStorage.setItem(CLAVE_ACCESS, access)),
      );
  }

  logout(): void {
    localStorage.removeItem(CLAVE_ACCESS);
    localStorage.removeItem(CLAVE_REFRESH);
    localStorage.removeItem(CLAVE_USUARIO);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  /** Refleja en la sesión un nombre recién editado en Mi perfil. */
  actualizarNombre(nombre: string): void {
    const usuario = this._usuario();
    if (!usuario) return;
    const actualizado = { ...usuario, nombre };
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(actualizado));
    this._usuario.set(actualizado);
  }

  /** Ruta de inicio según el rol del usuario. */
  rutaInicio(): string {
    switch (this._usuario()?.rol) {
      case 'admin':
      case 'tecnico':
        return '/admin/dashboard';
      default:
        return '/sin-permiso';
    }
  }

  puede(modulo: Modulo, accion: Accion): boolean {
    return puede(this._usuario()?.rol, modulo, accion);
  }

  private leerUsuario(): Usuario | null {
    try {
      const crudo = localStorage.getItem(CLAVE_USUARIO);
      return crudo && localStorage.getItem(CLAVE_ACCESS) ? (JSON.parse(crudo) as Usuario) : null;
    } catch {
      return null;
    }
  }
}
