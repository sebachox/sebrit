import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { UsuarioPortal, UsuarioPortalCambios, UsuarioPortalNuevo } from '../models/usuario-portal';

const base = (org: number) => `${API_URL}/organizaciones/${org}/usuarios/`;

@Injectable({ providedIn: 'root' })
export class UsuariosPortalService {
  private http = inject(HttpClient);

  listar(org: number): Observable<UsuarioPortal[]> {
    return this.http.get<UsuarioPortal[]>(base(org));
  }

  crear(org: number, datos: UsuarioPortalNuevo): Observable<UsuarioPortal> {
    return this.http.post<UsuarioPortal>(base(org), datos);
  }

  actualizar(org: number, uid: number, datos: UsuarioPortalCambios): Observable<UsuarioPortal> {
    return this.http.patch<UsuarioPortal>(`${base(org)}${uid}/`, datos);
  }

  definirClave(org: number, uid: number, clave: string): Observable<void> {
    return this.http.post<void>(`${base(org)}${uid}/clave/`, { clave_nueva: clave });
  }
}
