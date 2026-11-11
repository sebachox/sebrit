import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { IncidentePortalResumido } from '../../../core/models/portal';
import { PortalIncidentesLista } from './incidentes-lista';

const URL = `${API_URL}/portal/incidentes/`;

const incidente = (i: Partial<IncidentePortalResumido> = {}): IncidentePortalResumido => ({
  id: 5,
  codigo: 'INC-0005',
  titulo: 'Caída del correo',
  estado: 'en_progreso',
  impacto: 'total',
  fecha_origen: '2026-11-10T08:00:00-05:00',
  fecha_fin: null,
  ...i,
});

const pagina = (results: object[], count = results.length) => ({ count, next: null, previous: null, results });

describe('PortalIncidentesLista', () => {
  let fixture: ComponentFixture<PortalIncidentesLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalIncidentesLista],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalIncidentesLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const peticion = () => http.expectOne((r) => r.url === URL);
  const responder = (results: object[] = [incidente()], count?: number) => {
    peticion().flush(pagina(results, count));
    fixture.detectChanges();
  };
  const elegirEstado = (valor: string) => {
    const s = el().querySelector('#estado') as HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('por defecto pide los activos', () => {
    const req = peticion();
    expect(req.request.params.get('abiertos')).toBe('true');
    req.flush(pagina([]));
  });

  it('muestra cada incidente con su estado, impacto y fechas', () => {
    responder();
    expect(el().querySelector('a[href="/portal/incidentes/5"]')?.textContent).toContain('INC-0005');
    const fila = el().querySelector('tbody tr')?.textContent ?? '';
    for (const dato of ['Caída del correo', 'En progreso', 'Total', '10/11/2026', 'En curso']) {
      expect(fila).toContain(dato);
    }
  });

  it('un incidente terminado muestra su fecha de fin', () => {
    responder([incidente({ estado: 'resuelto', fecha_fin: '2026-11-11T09:30:00-05:00' })]);
    expect(el().querySelector('tbody tr')?.textContent).toContain('11/11/2026');
  });

  it('tocar cualquier parte de la fila abre el incidente', () => {
    responder();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    (el().querySelector('tbody tr td:nth-child(2)') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith(['/portal/incidentes', 5]);
  });

  it('Todos deja de filtrar y un estado filtra', () => {
    responder();
    elegirEstado('todos');
    let req = peticion();
    expect(req.request.params.has('abiertos')).toBeFalse();
    req.flush(pagina([]));
    fixture.detectChanges();
    elegirEstado('cerrado');
    req = peticion();
    expect(req.request.params.get('estado')).toBe('cerrado');
    req.flush(pagina([]));
  });

  it('pagina', () => {
    responder([incidente()], 45);
    (el().querySelector('[data-prueba="siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const req = peticion();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([incidente()], 45));
  });

  it('sin incidentes activos lo dice', () => {
    responder([]);
    expect(el().textContent).toContain('No hay incidentes activos.');
  });

  it('sin resultados con filtros lo dice', () => {
    responder();
    elegirEstado('cerrado');
    peticion().flush(pagina([]));
    fixture.detectChanges();
    expect(el().textContent).toContain('Sin resultados');
  });

  it('un error permite reintentar', () => {
    peticion().flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudieron cargar los incidentes.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    responder();
    expect(el().textContent).toContain('INC-0005');
  });

  it('no muestra severidad', () => {
    responder();
    expect(el().textContent).not.toContain('Severidad');
  });
});
