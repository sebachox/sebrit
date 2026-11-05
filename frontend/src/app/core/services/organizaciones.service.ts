import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import {
  FiltrosOrganizaciones,
  Organizacion,
  OrganizacionEntrada,
  OrganizacionResumida,
  Paginado,
} from '../models/organizacion';

const BASE = `${API_URL}/organizaciones/`;

@Injectable({ providedIn: 'root' })
export class OrganizacionesService {
  private http = inject(HttpClient);

  listar(f: FiltrosOrganizaciones): Observable<Paginado<OrganizacionResumida>> {
    let params = new HttpParams();
    const q = f.q?.trim();
    if (q) params = params.set('q', q);
    if (f.activa != null) params = params.set('activa', String(f.activa));
    if (f.plan) params = params.set('plan', f.plan);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    return this.http.get<Paginado<OrganizacionResumida>>(BASE, { params });
  }

  obtener(id: number): Observable<Organizacion> {
    return this.http.get<Organizacion>(`${BASE}${id}/`);
  }

  crear(datos: OrganizacionEntrada): Observable<Organizacion> {
    return this.http.post<Organizacion>(BASE, datos);
  }

  actualizar(id: number, datos: OrganizacionEntrada): Observable<Organizacion> {
    return this.http.patch<Organizacion>(`${BASE}${id}/`, datos);
  }

  cambiarEstado(id: number, activa: boolean): Observable<Organizacion> {
    return this.actualizar(id, { activa });
  }
}
