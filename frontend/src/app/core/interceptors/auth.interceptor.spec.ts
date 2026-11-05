import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../config/api';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sebrit.access', 'token-1');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('agrega el token Bearer a las peticiones del API', () => {
    http.get(`${API_URL}/dashboard/admin/`).subscribe();
    const req = backend.expectOne(`${API_URL}/dashboard/admin/`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
    req.flush({});
  });

  it('ante un 403 redirige a /sin-permiso', () => {
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);

    http.get(`${API_URL}/dashboard/admin/`).subscribe({ error: () => {} });
    backend
      .expectOne(`${API_URL}/dashboard/admin/`)
      .flush({ detail: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });

    expect(navegar).toHaveBeenCalledWith(['/sin-permiso']);
  });
});
