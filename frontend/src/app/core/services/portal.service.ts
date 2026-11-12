import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { Paginado } from '../models/organizacion';
import {
  ActivoPortalDetalle,
  ActivoPortalResumido,
  BackupPortal,
  EmpresaPortal,
  EventoPortal,
  FiltrosActivosPortal,
  FiltrosBackupsPortal,
  FiltrosIncidentesPortal,
  IncidentePortalDetalle,
  IncidentePortalResumido,
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

  empresa(): Observable<EmpresaPortal> {
    return this.http.get<EmpresaPortal>(`${BASE}/empresa/`);
  }

  listarActivos(f: FiltrosActivosPortal): Observable<Paginado<ActivoPortalResumido>> {
    let params = new HttpParams();
    if (f.q) params = params.set('q', f.q);
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.ordering) params = params.set('ordering', f.ordering);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    if (f.pageSize) params = params.set('page_size', f.pageSize);
    return this.http.get<Paginado<ActivoPortalResumido>>(`${BASE}/activos/`, { params });
  }

  obtenerActivo(id: number): Observable<ActivoPortalDetalle> {
    return this.http.get<ActivoPortalDetalle>(`${BASE}/activos/${id}/`);
  }

  obtenerBackup(id: number): Observable<BackupPortal> {
    return this.http.get<BackupPortal>(`${BASE}/backups/${id}/`);
  }

  listarIncidentes(f: FiltrosIncidentesPortal): Observable<Paginado<IncidentePortalResumido>> {
    let params = new HttpParams();
    if (f.q) params = params.set('q', f.q);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.abiertos) params = params.set('abiertos', 'true');
    if (f.page && f.page > 1) params = params.set('page', f.page);
    return this.http.get<Paginado<IncidentePortalResumido>>(`${BASE}/incidentes/`, { params });
  }

  obtenerIncidente(id: number): Observable<IncidentePortalDetalle> {
    return this.http.get<IncidentePortalDetalle>(`${BASE}/incidentes/${id}/`);
  }

  listarBackups(f: FiltrosBackupsPortal): Observable<Paginado<BackupPortal>> {
    let params = new HttpParams();
    if (f.activo) params = params.set('activo', f.activo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    return this.http.get<Paginado<BackupPortal>>(`${BASE}/backups/`, { params });
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
