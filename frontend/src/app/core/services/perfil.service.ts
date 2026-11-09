import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { CambioClave, Perfil, PerfilEntrada } from '../models/perfil';

const BASE = `${API_URL}/auth/perfil/`;

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private http = inject(HttpClient);

  obtener(): Observable<Perfil> {
    return this.http.get<Perfil>(BASE);
  }

  actualizar(datos: PerfilEntrada): Observable<Perfil> {
    return this.http.patch<Perfil>(BASE, datos);
  }

  cambiarClave(datos: CambioClave): Observable<void> {
    return this.http.post<void>(`${BASE}clave/`, datos);
  }
}
