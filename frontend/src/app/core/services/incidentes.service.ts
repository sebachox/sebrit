import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import {
  AccionIncidente,
  EstadoIncidente,
  FiltrosIncidentes,
  Incidente,
  IncidenteEntrada,
  IncidenteResumido,
  SeveridadIncidente,
} from '../models/incidente';
import { Paginado } from '../models/organizacion';

const BASE = `${API_URL}/incidentes/`;

@Injectable({ providedIn: 'root' })
export class IncidentesService {
  private http = inject(HttpClient);

  listar(f: FiltrosIncidentes): Observable<Paginado<IncidenteResumido>> {
    let params = new HttpParams();
    const q = f.q?.trim();
    if (q) params = params.set('q', q);
    if (f.organizacion) params = params.set('organizacion', f.organizacion);
    if (f.activo) params = params.set('activo', f.activo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.abiertos) params = params.set('abiertos', 'true');
    if (f.severidad) params = params.set('severidad', f.severidad);
    if (f.impacto) params = params.set('impacto', f.impacto);
    if (f.tecnico) params = params.set('tecnico', f.tecnico);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.ordering) params = params.set('ordering', f.ordering);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    if (f.pageSize) params = params.set('page_size', f.pageSize);
    return this.http.get<Paginado<IncidenteResumido>>(BASE, { params });
  }

  obtener(id: number): Observable<Incidente> {
    return this.http.get<Incidente>(`${BASE}${id}/`);
  }

  crear(datos: IncidenteEntrada): Observable<Incidente> {
    return this.http.post<Incidente>(BASE, datos);
  }

  actualizar(id: number, datos: IncidenteEntrada): Observable<Incidente> {
    return this.http.patch<Incidente>(`${BASE}${id}/`, datos);
  }

  cambiarEstado(
    id: number,
    estado: EstadoIncidente,
    extra: { solucion?: string; causa_raiz?: string } = {},
  ): Observable<Incidente> {
    return this.http.post<Incidente>(`${BASE}${id}/estado/`, { estado, ...extra });
  }

  corregirSeveridad(id: number, severidad: SeveridadIncidente, motivo: string): Observable<Incidente> {
    return this.http.post<Incidente>(`${BASE}${id}/severidad/`, { severidad, motivo });
  }

  agregarAccion(id: number, descripcion: string): Observable<AccionIncidente> {
    return this.http.post<AccionIncidente>(`${BASE}${id}/acciones/`, { descripcion });
  }

  asociarTicket(id: number, ticket: number): Observable<Incidente> {
    return this.http.post<Incidente>(`${BASE}${id}/tickets/`, { ticket });
  }

  quitarTicket(id: number, ticket: number): Observable<Incidente> {
    return this.http.delete<Incidente>(`${BASE}${id}/tickets/${ticket}/`);
  }
}
