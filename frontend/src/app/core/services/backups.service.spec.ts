import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api';
import { BackupsService } from './backups.service';

const BASE = `${API_URL}/backups/`;

describe('BackupsService', () => {
  let service: BackupsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BackupsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar envía desde, hasta y filtros', () => {
    service
      .listar({ activo: 7, desde: '2026-11-01', hasta: '2026-11-06', estado: 'fallido', tipo: null })
      .subscribe();
    const p = http.expectOne((r) => r.url === BASE).request.params;
    expect([p.get('activo'), p.get('desde'), p.get('hasta'), p.get('estado'), p.has('tipo')]).toEqual([
      '7',
      '2026-11-01',
      '2026-11-06',
      'fallido',
      false,
    ]);
  });

  it('registrar hace POST, actualizar PATCH y borrar DELETE', () => {
    service.registrar({ activo: 7, estado: 'exitoso', tipo: 'completo' }).subscribe();
    expect(http.expectOne(BASE).request.method).toBe('POST');
    service.actualizar(5, { estado: 'fallido' }).subscribe();
    expect(http.expectOne(`${BASE}5/`).request.method).toBe('PATCH');
    service.borrar(5).subscribe();
    expect(http.expectOne(`${BASE}5/`).request.method).toBe('DELETE');
  });
});
