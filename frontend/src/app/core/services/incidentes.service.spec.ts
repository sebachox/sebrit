import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api';
import { IncidentesService } from './incidentes.service';
import { TicketsService } from './tickets.service';

const BASE = `${API_URL}/incidentes/`;

describe('IncidentesService', () => {
  let service: IncidentesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(IncidentesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar envía todos los filtros', () => {
    service
      .listar({
        q: ' caída ',
        organizacion: 4,
        activo: 7,
        estado: 'resuelto',
        abiertos: true,
        severidad: 'alta',
        impacto: 'total',
        tecnico: 'sin_asignar',
        desde: '2026-11-01',
        hasta: '2026-11-08',
        ordering: '-fecha_deteccion',
        page: 2,
        pageSize: 100,
      })
      .subscribe();
    const p = http.expectOne((r) => r.url === BASE).request.params;
    const claves = ['q', 'organizacion', 'activo', 'estado', 'abiertos', 'severidad', 'impacto', 'tecnico', 'desde', 'hasta', 'ordering', 'page', 'page_size'];
    expect(claves.map((c) => p.get(c))).toEqual([
      'caída', '4', '7', 'resuelto', 'true', 'alta', 'total', 'sin_asignar', '2026-11-01', '2026-11-08', '-fecha_deteccion', '2', '100',
    ]);
  });

  it('listar omite los vacíos', () => {
    service
      .listar({ q: '', abiertos: false, tecnico: null, estado: null, severidad: null, impacto: null, desde: '', hasta: '', ordering: null })
      .subscribe();
    expect(http.expectOne((r) => r.url === BASE).request.params.keys()).toEqual([]);
  });

  it('obtener, crear y actualizar usan sus rutas', () => {
    service.obtener(3).subscribe();
    expect(http.expectOne(`${BASE}3/`).request.method).toBe('GET');

    service.crear({ titulo: 'A' }).subscribe();
    const c = http.expectOne(BASE);
    expect([c.request.method, c.request.body]).toEqual(['POST', { titulo: 'A' }]);

    service.actualizar(3, { tecnico: null }).subscribe();
    const u = http.expectOne(`${BASE}3/`);
    expect([u.request.method, u.request.body]).toEqual(['PATCH', { tecnico: null }]);
  });

  it('cambiarEstado envía solo lo que aplica', () => {
    service.cambiarEstado(3, 'en_progreso').subscribe();
    expect(http.expectOne(`${BASE}3/estado/`).request.body).toEqual({ estado: 'en_progreso' });

    service.cambiarEstado(3, 'resuelto', { solucion: 'Listo' }).subscribe();
    expect(http.expectOne(`${BASE}3/estado/`).request.body).toEqual({ estado: 'resuelto', solucion: 'Listo' });

    service.cambiarEstado(3, 'cerrado', { causa_raiz: 'Disco' }).subscribe();
    expect(http.expectOne(`${BASE}3/estado/`).request.body).toEqual({ estado: 'cerrado', causa_raiz: 'Disco' });
  });

  it('las acciones usan sus rutas', () => {
    service.corregirSeveridad(3, 'alta', 'Motivo').subscribe();
    expect(http.expectOne(`${BASE}3/severidad/`).request.body).toEqual({ severidad: 'alta', motivo: 'Motivo' });

    service.agregarAccion(3, 'Se revisó').subscribe();
    expect(http.expectOne(`${BASE}3/acciones/`).request.body).toEqual({ descripcion: 'Se revisó' });

    service.asociarTicket(3, 12).subscribe();
    expect(http.expectOne(`${BASE}3/tickets/`).request.body).toEqual({ ticket: 12 });

    service.quitarTicket(3, 12).subscribe();
    expect(http.expectOne(`${BASE}3/tickets/12/`).request.method).toBe('DELETE');
  });

  it('TicketsService.escalar y pageSize', () => {
    const tickets = TestBed.inject(TicketsService);
    tickets.escalar(8, { impacto: 'total', fecha_origen: '2026-11-08T10:00:00.000Z' }).subscribe();
    const e = http.expectOne(`${API_URL}/tickets/8/escalar/`);
    expect([e.request.method, e.request.body]).toEqual(['POST', { impacto: 'total', fecha_origen: '2026-11-08T10:00:00.000Z' }]);

    tickets.listar({ pageSize: 100 }).subscribe();
    expect(http.expectOne((r) => r.url === `${API_URL}/tickets/`).request.params.get('page_size')).toBe('100');
  });
});
