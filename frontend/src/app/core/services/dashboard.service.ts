import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { DashboardAdmin } from '../models/dashboard-admin';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  getAdmin(): Observable<DashboardAdmin> {
    return this.http.get<DashboardAdmin>(`${API_URL}/dashboard/admin/`);
  }
}
