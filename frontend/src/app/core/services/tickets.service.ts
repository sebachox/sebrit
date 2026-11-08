import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { Referencia } from '../models/activo';
import { DatosEscalar, Incidente } from '../models/incidente';
import { Paginado } from '../models/organizacion';
import {
  EstadoTicket,
  EventoTicket,
  FiltrosTickets,
  PrioridadTicket,
  Ticket,
  TicketEntrada,
  TicketResumido,
} from '../models/ticket';

const BASE = `${API_URL}/tickets/`;

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private http = inject(HttpClient);

  listar(f: FiltrosTickets): Observable<Paginado<TicketResumido>> {
    let params = new HttpParams();
    const q = f.q?.trim();
    if (q) params = params.set('q', q);
    if (f.organizacion) params = params.set('organizacion', f.organizacion);
    if (f.activo) params = params.set('activo', f.activo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.abiertos) params = params.set('abiertos', 'true');
    if (f.prioridad) params = params.set('prioridad', f.prioridad);
    if (f.categoria) params = params.set('categoria', f.categoria);
    if (f.tecnico) params = params.set('tecnico', f.tecnico);
    if (f.ordering) params = params.set('ordering', f.ordering);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    if (f.pageSize) params = params.set('page_size', f.pageSize);
    return this.http.get<Paginado<TicketResumido>>(BASE, { params });
  }

  obtener(id: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${BASE}${id}/`);
  }

  crear(datos: TicketEntrada): Observable<Ticket> {
    return this.http.post<Ticket>(BASE, datos);
  }

  actualizar(id: number, datos: TicketEntrada): Observable<Ticket> {
    return this.http.patch<Ticket>(`${BASE}${id}/`, datos);
  }

  cambiarEstado(id: number, estado: EstadoTicket, solucion?: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${BASE}${id}/estado/`, solucion ? { estado, solucion } : { estado });
  }

  corregirPrioridad(id: number, prioridad: PrioridadTicket, motivo: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${BASE}${id}/prioridad/`, { prioridad, motivo });
  }

  comentar(id: number, texto: string): Observable<EventoTicket> {
    return this.http.post<EventoTicket>(`${BASE}${id}/comentarios/`, { texto });
  }

  escalar(id: number, datos: DatosEscalar): Observable<Incidente> {
    return this.http.post<Incidente>(`${BASE}${id}/escalar/`, datos);
  }

  tecnicos(): Observable<Referencia[]> {
    return this.http.get<Referencia[]>(`${API_URL}/tecnicos/`);
  }
}
