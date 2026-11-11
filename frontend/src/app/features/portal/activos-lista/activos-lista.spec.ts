import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { API_URL } from '../../../core/config/api';
import { ActivoPortalResumido } from '../../../core/models/portal';
import { PortalActivosLista } from './activos-lista';

const ACTIVOS = `${API_URL}/portal/activos/`;

const activo = (a: Partial<ActivoPortalResumido> = {}): ActivoPortalResumido => ({
  id: 7,
  nombre: 'SRV-01',
  tipo: 'servidor',
  estado: 'critico',
  ubicacion: 'Rack 2',
  ultimo_backup: { fecha: '2026-11-10T23:00:00-05:00', estado: 'fallido' },
  ...a,
});

const pagina = (results: object[], count = results.length) => ({ count, next: null, previous: null, results });

describe('PortalActivosLista', () => {
  let fixture: ComponentFixture<PortalActivosLista>;
  let http: HttpTestingController;
  let parametros: BehaviorSubject<ParamMap>;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(query: Record<string, string> = {}) {
    parametros = new BehaviorSubject(convertToParamMap(query));
    TestBed.configureTestingModule({
      imports: [PortalActivosLista],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: parametros } },
      ],
    });
    fixture = TestBed.createComponent(PortalActivosLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  const peticion = () => http.expectOne((r) => r.url === ACTIVOS);
  const responder = (results: object[] = [activo()], count?: number) => {
    peticion().flush(pagina(results, count));
    fixture.detectChanges();
  };
  const elegir = (id: string, valor: string) => {
    const s = el().querySelector(`#${id}`) as HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('sin filtros no envía tipo ni estado', () => {
    crear();
    const req = peticion();
    expect(req.request.params.has('tipo')).toBeFalse();
    expect(req.request.params.has('estado')).toBeFalse();
    req.flush(pagina([]));
  });

  it('lee tipo y estado de la URL y los deja elegidos', () => {
    crear({ tipo: 'servidor', estado: 'critico' });
    const req = peticion();
    expect(req.request.params.get('tipo')).toBe('servidor');
    expect(req.request.params.get('estado')).toBe('critico');
    req.flush(pagina([activo()]));
    fixture.detectChanges();
    expect((el().querySelector('#tipo') as HTMLSelectElement).value).toBe('servidor');
    expect((el().querySelector('#estado') as HTMLSelectElement).value).toBe('critico');
  });

  it('ignora valores desconocidos en la URL', () => {
    crear({ tipo: 'x', estado: 'y' });
    const req = peticion();
    expect(req.request.params.has('tipo')).toBeFalse();
    expect(req.request.params.has('estado')).toBeFalse();
    req.flush(pagina([]));
  });

  it('muestra cada activo con su estado, ubicación y último backup', () => {
    crear();
    responder();
    expect(el().querySelector('a[href="/portal/activos/7"]')?.textContent).toContain('SRV-01');
    const fila = el().querySelector('tbody tr')?.textContent ?? '';
    for (const dato of ['Servidor', 'Crítico', 'Rack 2', '10/11/2026', 'Fallido']) {
      expect(fila).toContain(dato);
    }
  });

  it('sin backups ni ubicación lo dice', () => {
    crear();
    responder([activo({ ultimo_backup: null, ubicacion: null })]);
    const fila = el().querySelector('tbody tr')?.textContent ?? '';
    expect(fila).toContain('Sin backups');
    expect(fila).toContain('—');
  });

  it('si la URL cambia sin filtros, vuelve a la lista completa', () => {
    crear({ tipo: 'servidor' });
    expect(peticion().request.params.get('tipo')).toBe('servidor');
    parametros.next(convertToParamMap({}));
    fixture.detectChanges();
    const req = peticion();
    expect(req.request.params.has('tipo')).toBeFalse();
    req.flush(pagina([activo()]));
    fixture.detectChanges();
    expect((el().querySelector('#tipo') as HTMLSelectElement).value).toBe('');
  });

  it('cambiar un filtro vuelve a pedir la primera página', () => {
    crear();
    responder();
    elegir('tipo', 'red');
    const req = peticion();
    expect(req.request.params.get('tipo')).toBe('red');
    expect(req.request.params.has('page')).toBeFalse();
    req.flush(pagina([]));
  });

  it('busca tras una pausa y cancela la petición anterior', fakeAsync(() => {
    crear();
    responder();
    const buscar = el().querySelector('#buscar') as HTMLInputElement;
    buscar.value = 'sr';
    buscar.dispatchEvent(new Event('input'));
    tick(400);
    const vieja = http.expectOne((r) => r.params.get('q') === 'sr');
    buscar.value = 'srv';
    buscar.dispatchEvent(new Event('input'));
    tick(400);
    expect(vieja.cancelled).toBeTrue();
    http.expectOne((r) => r.params.get('q') === 'srv').flush(pagina([]));
  }));

  it('pagina', () => {
    crear();
    responder([activo()], 45);
    expect(el().textContent).toContain('1–1 de 45');
    (el().querySelector('[data-prueba="siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const req = peticion();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([activo()], 45));
  });

  it('sin activos y sin filtros lo dice', () => {
    crear();
    responder([]);
    expect(el().textContent).toContain('Tu empresa aún no tiene activos registrados.');
  });

  it('sin resultados con filtros lo dice', () => {
    crear({ estado: 'critico' });
    responder([]);
    expect(el().textContent).toContain('Sin resultados');
  });

  it('un error permite reintentar', () => {
    crear();
    peticion().flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudieron cargar tus activos.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    responder();
    expect(el().textContent).toContain('SRV-01');
  });

  it('no muestra IP ni hostname', () => {
    crear();
    responder();
    expect(el().textContent).not.toContain('IP');
    expect(el().textContent).not.toContain('Hostname');
  });
});
