import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api';
import { OrganizacionesService } from './organizaciones.service';

const BASE = `${API_URL}/organizaciones/`;

describe('OrganizacionesService', () => {
  let service: OrganizacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrganizacionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar envía búsqueda, filtros y página', () => {
    service.listar({ q: 'ana', activa: true, plan: 'premium', page: 2 }).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('q')).toBe('ana');
    expect(req.request.params.get('activa')).toBe('true');
    expect(req.request.params.get('plan')).toBe('premium');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('listar omite la búsqueda vacía y los filtros nulos', () => {
    service.listar({ q: '  ', activa: null, plan: null }).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('cambiarEstado hace PATCH con activa', () => {
    service.cambiarEstado(5, false).subscribe();
    const req = http.expectOne(`${BASE}5/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activa: false });
    req.flush({});
  });

  it('crear hace POST y actualizar hace PATCH', () => {
    service.crear({ nombre: 'A', nit: '900000001' }).subscribe();
    expect(http.expectOne(BASE).request.method).toBe('POST');

    service.actualizar(3, { ciudad: 'Cali' }).subscribe();
    expect(http.expectOne(`${BASE}3/`).request.method).toBe('PATCH');
  });
});
