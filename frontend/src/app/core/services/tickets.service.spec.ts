import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api';
import { TicketsService } from './tickets.service';

const BASE = `${API_URL}/tickets/`;

describe('TicketsService', () => {
  let service: TicketsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TicketsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar envía filtros', () => {
    service
      .listar({ q: ' caída ', abiertos: true, tecnico: 'sin_asignar', ordering: '-creado_en', organizacion: 4, page: 2 })
      .subscribe();
    const p = http.expectOne((r) => r.url === BASE).request.params;
    expect([p.get('q'), p.get('abiertos'), p.get('tecnico'), p.get('ordering'), p.get('organizacion'), p.get('page')]).toEqual(
      ['caída', 'true', 'sin_asignar', '-creado_en', '4', '2'],
    );
  });

  it('listar omite los vacíos', () => {
    service.listar({ q: '', abiertos: false, tecnico: null, estado: null, ordering: null }).subscribe();
    expect(http.expectOne((r) => r.url === BASE).request.params.keys()).toEqual([]);
  });

  it('las acciones usan sus rutas', () => {
    service.cambiarEstado(3, 'resuelto', 'Listo').subscribe();
    const e = http.expectOne(`${BASE}3/estado/`);
    expect([e.request.method, e.request.body]).toEqual(['POST', { estado: 'resuelto', solucion: 'Listo' }]);

    service.corregirPrioridad(3, 'alta', 'Motivo').subscribe();
    expect(http.expectOne(`${BASE}3/prioridad/`).request.body).toEqual({ prioridad: 'alta', motivo: 'Motivo' });

    service.comentar(3, 'Hola').subscribe();
    expect(http.expectOne(`${BASE}3/comentarios/`).request.body).toEqual({ texto: 'Hola', visible_cliente: false });
  });

  it('tecnicos consulta /tecnicos/', () => {
    service.tecnicos().subscribe();
    expect(http.expectOne(`${API_URL}/tecnicos/`).request.method).toBe('GET');
  });

  it('crear hace POST y actualizar PATCH', () => {
    service.crear({ titulo: 'A' }).subscribe();
    expect(http.expectOne(BASE).request.method).toBe('POST');
    service.actualizar(3, { tecnico: 5 }).subscribe();
    expect(http.expectOne(`${BASE}3/`).request.method).toBe('PATCH');
  });
});
