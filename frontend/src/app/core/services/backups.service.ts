import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { Backup, BackupEntrada, FiltrosBackups } from '../models/backup';
import { Paginado } from '../models/organizacion';

const BASE = `${API_URL}/backups/`;

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private http = inject(HttpClient);

  listar(f: FiltrosBackups): Observable<Paginado<Backup>> {
    let params = new HttpParams();
    if (f.organizacion) params = params.set('organizacion', f.organizacion);
    if (f.activo) params = params.set('activo', f.activo);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.page && f.page > 1) params = params.set('page', f.page);
    return this.http.get<Paginado<Backup>>(BASE, { params });
  }

  obtener(id: number): Observable<Backup> {
    return this.http.get<Backup>(`${BASE}${id}/`);
  }

  registrar(datos: BackupEntrada): Observable<Backup> {
    return this.http.post<Backup>(BASE, datos);
  }

  actualizar(id: number, datos: BackupEntrada): Observable<Backup> {
    return this.http.patch<Backup>(`${BASE}${id}/`, datos);
  }

  borrar(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}${id}/`);
  }
}
