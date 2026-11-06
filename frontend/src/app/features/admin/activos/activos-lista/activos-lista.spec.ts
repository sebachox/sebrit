import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { ActivoResumido } from '../../../../core/models/activo';
import { ActivosLista } from './activos-lista';

const ACTIVOS = `${API_URL}/activos/`;
const ORGS = `${API_URL}/organizaciones/`;

const activo = (a: Partial<ActivoResumido> = {}): ActivoResumido => ({
  id: 1,
  nombre: 'SRV-DB-01',
  tipo: 'servidor',
  estado: 'critico',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  ip: '10.0.0.5',
  hostname: null,
  ubicacion: null,
  de_baja: false,
  ultimo_backup: { id: 9, fecha: '2026-11-05T10:00:00-05:00', estado: 'fallido' },
  ...a,
});

const pagina = (results: ActivoResumido[]) => ({ count: results.length, next: null, previous: null, results });

describe('ActivosLista', () => {
  let fixture: ComponentFixture<ActivosLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ActivosLista],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    fixture = TestBed.createComponent(ActivosLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    // Todos los clientes (también inactivos): la ficha de un cliente inactivo enlaza aquí.
    const orgs = http.expectOne((r) => r.url === ORGS);
    expect(orgs.request.params.has('activa')).toBeFalse();
    expect(orgs.request.params.get('page_size')).toBe('100');
    orgs.flush({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 4, nombre: 'Metropolis 21', activa: true },
        { id: 9, nombre: 'Inactiva Ltda.', activa: false },
      ],
    });
  }

  const responder = (cuerpo: object, opciones?: { status: number; statusText: string }) => {
    http.expectOne((r) => r.url === ACTIVOS).flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('por defecto no pide los dados de baja y muestra tipo, estado y último backup', () => {
    crear();
    const req = http.expectOne((r) => r.url === ACTIVOS);
    expect(req.request.params.has('de_baja')).toBeFalse();
    req.flush(pagina([activo(), activo({ id: 2, nombre: 'SW-01', tipo: 'red', ultimo_backup: null })]));
    fixture.detectChanges();
    const texto = el().querySelector('tbody')?.textContent ?? '';
    expect(texto).toContain('Servidor');
    expect(texto).toContain('Crítico');
    expect(texto).toContain('Fallido');
    expect(texto).toContain('Sin backups');
  });

  it('con ?organizacion=4 filtra por ese cliente y lo selecciona', () => {
    crear({ organizacion: '4' });
    const req = http.expectOne((r) => r.url === ACTIVOS);
    expect(req.request.params.get('organizacion')).toBe('4');
    req.flush(pagina([activo()]));
    fixture.detectChanges();
    expect((el().querySelector('#cliente') as HTMLSelectElement).value).toBe('4');
  });

  it('con ?organizacion de un cliente inactivo, el selector lo muestra', () => {
    crear({ organizacion: '9' });
    http.expectOne((r) => r.url === ACTIVOS).flush(pagina([]));
    fixture.detectChanges();
    const select = el().querySelector('#cliente') as HTMLSelectElement;
    expect(select.value).toBe('9');
    expect(select.selectedOptions[0].textContent).toContain('(inactivo)');
  });

  it('vacío sin filtros vs. búsqueda sin resultados', () => {
    crear();
    responder(pagina([]));
    expect(el().textContent).toContain('Aún no hay activos registrados');
    fixture.componentInstance.aplicarBusqueda('zzz');
    responder(pagina([]));
    expect(el().textContent).toContain('No hay activos que coincidan con «zzz»');
  });

  it('un error muestra Reintentar', () => {
    crear();
    responder({}, { status: 500, statusText: 'Error' });
    const boton = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!;
    boton.click();
    responder(pagina([activo()]));
    expect(el().querySelector('tbody')?.textContent).toContain('SRV-DB-01');
  });

  it('una búsqueda nueva cancela la anterior', () => {
    crear();
    responder(pagina([activo()]));
    fixture.componentInstance.aplicarBusqueda('a');
    const vieja = http.expectOne((r) => r.url === ACTIVOS && r.params.get('q') === 'a');
    fixture.componentInstance.aplicarBusqueda('ab');
    expect(vieja.cancelled).toBeTrue();
    http.expectOne((r) => r.params.get('q') === 'ab').flush(pagina([]));
  });
});
