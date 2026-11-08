import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api';
import { ActivosService } from './activos.service';

const BASE = `${API_URL}/activos/`;

describe('ActivosService', () => {
  let service: ActivosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActivosService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar envía filtros y omite los vacíos', () => {
    service
      .listar({ q: ' srv ', organizacion: 4, tipo: 'red', estado: 'critico', de_baja: true, page: 2 })
      .subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    const p = req.request.params;
    expect([p.get('q'), p.get('organizacion'), p.get('tipo'), p.get('estado'), p.get('de_baja'), p.get('page')]).toEqual(
      ['srv', '4', 'red', 'critico', 'true', '2'],
    );
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('listar sin filtros no envía parámetros (ni de_baja=false)', () => {
    service.listar({ q: '', organizacion: null, de_baja: false }).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('cambiarEstado y darDeBaja hacen PATCH', () => {
    service.cambiarEstado(3, 'critico').subscribe();
    const r1 = http.expectOne(`${BASE}3/`);
    expect([r1.request.method, r1.request.body]).toEqual(['PATCH', { estado: 'critico' }]);
    r1.flush({});
    service.darDeBaja(3, true).subscribe();
    expect(http.expectOne(`${BASE}3/`).request.body).toEqual({ de_baja: true });
  });

  it('crear hace POST', () => {
    service.crear({ organizacion: 1, nombre: 'S', tipo: 'servidor', estado: 'operativo' }).subscribe();
    expect(http.expectOne(BASE).request.method).toBe('POST');
  });
});
