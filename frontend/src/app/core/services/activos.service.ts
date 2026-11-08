import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import {
  Activo,
  ActivoEntrada,
  ActivoResumido,
  EstadoActivo,
  FiltrosActivos,
} from '../models/activo';
import { Paginado } from '../models/organizacion';

const BASE = `${API_URL}/activos/`;

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private http = inject(HttpClient);

  listar(f: FiltrosActivos): Observable<Paginado<ActivoResumido>> {
    let params = new HttpParams();
    const q = f.q?.trim();
    if (q) params = params.set('q', q);
    if (f.organizacion) params = params.set('organizacion', f.organizacion);
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.de_baja) params = params.set('de_baja', 'true');
    if (f.page && f.page > 1) params = params.set('page', f.page);
    return this.http.get<Paginado<ActivoResumido>>(BASE, { params });
  }

  obtener(id: number): Observable<Activo> {
    return this.http.get<Activo>(`${BASE}${id}/`);
  }

  crear(datos: ActivoEntrada): Observable<Activo> {
    return this.http.post<Activo>(BASE, datos);
  }

  actualizar(id: number, datos: ActivoEntrada): Observable<Activo> {
    return this.http.patch<Activo>(`${BASE}${id}/`, datos);
  }

  cambiarEstado(id: number, estado: EstadoActivo): Observable<Activo> {
    return this.actualizar(id, { estado });
  }

  darDeBaja(id: number, deBaja: boolean): Observable<Activo> {
    return this.actualizar(id, { de_baja: deBaja });
  }
}
