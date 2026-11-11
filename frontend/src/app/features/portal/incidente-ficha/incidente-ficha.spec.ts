import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { IncidentePortalDetalle } from '../../../core/models/portal';
import { PortalIncidenteFicha } from './incidente-ficha';

const URL = `${API_URL}/portal/incidentes/5/`;

const incidente = (i: Partial<IncidentePortalDetalle> = {}): IncidentePortalDetalle => ({
  id: 5,
  codigo: 'INC-0005',
  titulo: 'Caída del correo',
  estado: 'resuelto',
  impacto: 'total',
  fecha_origen: '2026-11-10T08:00:00-05:00',
  fecha_fin: '2026-11-10T09:30:00-05:00',
  descripcion: 'No entran ni salen mensajes.',
  fecha_deteccion: '2026-11-10T08:10:00-05:00',
  duracion_minutos: 90,
  tecnico: 'Laura Gómez',
  solucion: 'Se reinició el servidor de correo.',
  activos: [{ id: 7, nombre: 'SRV-01' }],
  tickets: [{ id: 9, codigo: 'TCK-0009', titulo: 'No llega correo', estado: 'resuelto' }],
  ...i,
});

describe('PortalIncidenteFicha', () => {
  let fixture: ComponentFixture<PortalIncidenteFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalIncidenteFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    fixture = TestBed.createComponent(PortalIncidenteFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function cargar(i: IncidentePortalDetalle = incidente()) {
    http.expectOne(URL).flush(i);
    fixture.detectChanges();
  }

  it('mientras carga muestra un indicador', () => {
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    cargar();
  });

  it('muestra los datos del incidente', () => {
    cargar();
    for (const dato of ['INC-0005', 'Caída del correo', 'Resuelto', 'Total', 'No entran ni salen', '10/11/2026 08:00', '10/11/2026 09:30', '1 h 30 min', 'Laura Gómez']) {
      expect(texto()).toContain(dato);
    }
  });

  it('muestra la solución cuando existe', () => {
    cargar();
    expect(el().querySelector('[data-prueba="solucion"]')?.textContent).toContain('Se reinició el servidor de correo.');
  });

  it('en curso no muestra solución ni fin, y lo dice', () => {
    cargar(incidente({ estado: 'en_progreso', fecha_fin: null, duracion_minutos: null, solucion: null, tecnico: null }));
    expect(el().querySelector('[data-prueba="solucion"]')).toBeNull();
    expect(texto()).toContain('En curso');
    expect(texto()).toContain('Sin asignar');
  });

  it('los equipos y tickets enlazan a su ficha', () => {
    cargar();
    expect(el().querySelector('a[href="/portal/activos/7"]')?.textContent).toContain('SRV-01');
    const ticket = el().querySelector('a[href="/portal/tickets/9"]');
    expect(ticket?.textContent).toContain('TCK-0009');
    expect(texto()).toContain('No llega correo');
  });

  it('sin equipos ni tickets lo dice', () => {
    cargar(incidente({ activos: [], tickets: [] }));
    expect(texto()).toContain('Sin equipos asociados.');
    expect(texto()).toContain('Sin tickets asociados.');
  });

  it('404 muestra no encontrado con enlace a la lista', () => {
    http.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Incidente no encontrado');
    expect(el().querySelector('a[href="/portal/incidentes"]')).not.toBeNull();
  });

  it('un error permite reintentar', () => {
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudo cargar el incidente.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    cargar();
    expect(texto()).toContain('INC-0005');
  });

  it('no muestra severidad, causa raíz ni bitácora', () => {
    cargar();
    for (const t of ['Severidad', 'Causa raíz', 'Bitácora']) {
      expect(texto()).not.toContain(t);
    }
  });
});
