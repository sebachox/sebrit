import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../config/api';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const usuario = { id: 1, username: 'admin', nombre: 'Admin', rol: 'admin' as const };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('empieza sin sesión', () => {
    expect(service.autenticado()).toBeFalse();
  });

  it('login guarda los tokens y el usuario', () => {
    service.login({ username: 'admin', password: 'x' }).subscribe();
    http
      .expectOne(`${API_URL}/auth/login/`)
      .flush({ access: 'a1', refresh: 'r1', usuario });

    expect(service.autenticado()).toBeTrue();
    expect(service.usuario()?.nombre).toBe('Admin');
    expect(service.accessToken).toBe('a1');
    expect(service.refreshToken).toBe('r1');
  });

  it('logout borra la sesión', () => {
    service.login({ username: 'admin', password: 'x' }).subscribe();
    http.expectOne(`${API_URL}/auth/login/`).flush({ access: 'a1', refresh: 'r1', usuario });

    service.logout();

    expect(service.autenticado()).toBeFalse();
    expect(service.accessToken).toBeNull();
  });

  it('rutaInicio lleva al admin a su dashboard', () => {
    service.login({ username: 'admin', password: 'x' }).subscribe();
    http.expectOne(`${API_URL}/auth/login/`).flush({ access: 'a1', refresh: 'r1', usuario });

    expect(service.rutaInicio()).toBe('/admin/dashboard');
  });

  it('rutaInicio lleva a un técnico al dashboard', () => {
    service.login({ username: 'tec', password: 'x' }).subscribe();
    http
      .expectOne(`${API_URL}/auth/login/`)
      .flush({ access: 'a1', refresh: 'r1', usuario: { ...usuario, rol: 'tecnico' } });

    expect(service.rutaInicio()).toBe('/admin/dashboard');
  });

  it('rutaInicio lleva a un cliente a /sin-permiso', () => {
    service.login({ username: 'cli', password: 'x' }).subscribe();
    http
      .expectOne(`${API_URL}/auth/login/`)
      .flush({ access: 'a1', refresh: 'r1', usuario: { ...usuario, rol: 'cliente' } });

    expect(service.rutaInicio()).toBe('/sin-permiso');
  });
});
