import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { Paginado } from '../models/organizacion';
import {
  ActivoPortal,
  EventoPortal,
  FiltrosPortal,
  ResumenPortal,
  TicketPortal,
  TicketPortalEntrada,
  TicketPortalResumido,
} from '../models/portal';

const BASE = `${API_URL}/portal`;

@Injectable({ providedIn: 'root' })
export class PortalService {
  private http = inject(HttpClient);

  resumen(): Observable<ResumenPortal> {
    return this.http.get<ResumenPortal>(`${BASE}/resumen/`);
  }

  activos(): Observable<ActivoPortal[]> {
    return this.http.get<ActivoPortal[]>(`${BASE}/activos/`);
  }

  listarTickets(f: FiltrosPortal): Observable<Paginado<TicketPortalResumido>> {
    let params = new HttpParams();
    if (f.q) params = params.set('q', f.q);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.abiertos) params = params.set('abiertos', 'true');
    if (f.page && f.page > 1) params = params.set('page', f.page);
    if (f.pageSize) params = params.set('page_size', f.pageSize);
    return this.http.get<Paginado<TicketPortalResumido>>(`${BASE}/tickets/`, { params });
  }

  obtenerTicket(id: number): Observable<TicketPortal> {
    return this.http.get<TicketPortal>(`${BASE}/tickets/${id}/`);
  }

  crearTicket(datos: TicketPortalEntrada): Observable<TicketPortal> {
    return this.http.post<TicketPortal>(`${BASE}/tickets/`, datos);
  }

  comentar(id: number, texto: string): Observable<EventoPortal> {
    return this.http.post<EventoPortal>(`${BASE}/tickets/${id}/comentarios/`, { texto });
  }
}
