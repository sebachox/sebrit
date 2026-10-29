import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardAdmin } from '../models/dashboard-admin';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private readonly usarMock = true; // pasar a false al integrar

  getAdmin(): Observable<DashboardAdmin> {
    const url = this.usarMock
      ? '/mock/dashboard-admin.json'
      : 'http://localhost:8000/api/dashboard/admin/';
    return this.http.get<DashboardAdmin>(url);
  }
}