import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { IncidenteResumido } from '../../../../core/models/incidente';
import { IncidentesLista } from './incidentes-lista';

const INCIDENTES = `${API_URL}/incidentes/`;
const ORGS = `${API_URL}/organizaciones/`;
const TECNICOS = `${API_URL}/tecnicos/`;

const incidente = (i: Partial<IncidenteResumido> = {}): IncidenteResumido => ({
  id: 1,
  codigo: 'INC-0001',
  titulo: 'Caída del ERP',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  severidad: 'critica',
  severidad_manual: false,
  impacto: 'total',
  estado: 'abierto',
  tecnico: null,
  fecha_origen: '2026-11-08T10:00:00-05:00',
  fecha_deteccion: '2026-11-08T10:10:00-05:00',
  fecha_fin: null,
  duracion_minutos: null,
  total_activos: 1,
  total_tickets: 0,
  ...i,
});

const pagina = (results: IncidenteResumido[], count = results.length) => ({ count, next: null, previous: null, results });

describe('IncidentesLista', () => {
  let fixture: ComponentFixture<IncidentesLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(query: Record<string, string> = {}) {
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 9, username: 't', nombre: 'Yo', rol: 'tecnico' }));
    TestBed.configureTestingModule({
      imports: [IncidentesLista],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    fixture = TestBed.createComponent(IncidentesLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === ORGS).flush({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 4, nombre: 'Metropolis 21', activa: true }],
    });
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }]);
  }

  const peticion = () => http.expectOne((r) => r.url === INCIDENTES);

  describe('severidad en la URL', () => {
    it('?severidad=critica filtra y deja el selector en Crítica', () => {
      crear({ severidad: 'critica' });
      const req = peticion();
      expect(req.request.params.get('severidad')).toBe('critica');
      expect(req.request.params.get('abiertos')).toBe('true');
      req.flush({ count: 0, next: null, previous: null, results: [] });
      fixture.detectChanges();
      expect((el().querySelector('#severidad') as HTMLSelectElement).value).toBe('critica');
    });

    it('un valor desconocido se ignora', () => {
      crear({ severidad: 'x' });
      const req = peticion();
      expect(req.request.params.has('severidad')).toBeFalse();
      req.flush({ count: 0, next: null, previous: null, results: [] });
    });
  });

  const responder = (cuerpo: object, opciones?: { status: number; statusText: string }) => {
    peticion().flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  const elegir = (id: string, valor: string) => {
    const s = el().querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('por defecto pide los activos, en orden de severidad', () => {
    crear();
    const req = peticion();
    expect(req.request.params.get('abiertos')).toBe('true');
    expect(req.request.params.has('ordering')).toBeFalse();
    req.flush(pagina([]));
  });

  it('preselecciona el cliente de la URL', () => {
    crear({ organizacion: '4' });
    const req = peticion();
    expect(req.request.params.get('organizacion')).toBe('4');
    req.flush(pagina([]));
  });

  it('cada filtro recarga en la página 1', () => {
    crear();
    responder(pagina([incidente()], 45));
    fixture.componentInstance.irAPagina(2);
    responder(pagina([incidente()], 45));

    for (const [id, valor, clave] of [
      ['severidad', 'alta', 'severidad'],
      ['impacto', 'total', 'impacto'],
      ['tecnico', 'sin_asignar', 'tecnico'],
      ['cliente', '4', 'organizacion'],
      ['desde', '2026-11-01', 'desde'],
      ['hasta', '2026-11-08', 'hasta'],
      ['orden', '-fecha_deteccion', 'ordering'],
    ]) {
      elegir(id, valor);
      const req = peticion();
      expect(req.request.params.get(clave)).toBe(valor);
      expect(req.request.params.has('page')).toBeFalse();
      req.flush(pagina([incidente()], 45));
      fixture.detectChanges();
    }
  });

  it('el filtro de estado reemplaza a los activos', () => {
    crear();
    responder(pagina([]));
    elegir('estado', 'resuelto');
    const req = peticion();
    expect(req.request.params.get('estado')).toBe('resuelto');
    expect(req.request.params.has('abiertos')).toBeFalse();
    req.flush(pagina([]));
  });

  it('una respuesta vieja no pisa a la nueva', () => {
    crear();
    const vieja = peticion();
    elegir('severidad', 'alta');
    expect(vieja.cancelled).toBeTrue();
    peticion().flush(pagina([]));
  });

  it('muestra la duración o En curso', () => {
    crear();
    responder(
      pagina([
        incidente({ id: 1 }),
        incidente({ id: 2, estado: 'resuelto', duracion_minutos: 90 }),
        incidente({ id: 3, estado: 'resuelto', duracion_minutos: 45 }),
      ]),
    );
    const celdas = Array.from(el().querySelectorAll('[data-duracion]')).map((c) => c.textContent?.trim());
    expect(celdas).toEqual(['En curso', '1 h 30 min', '45 min']);
  });

  it('muestra Sin asignar y la marca de severidad manual', () => {
    crear();
    responder(pagina([incidente({ severidad_manual: true })]));
    expect(el().textContent).toContain('Sin asignar');
    expect(el().querySelector('[data-manual]')).not.toBeNull();
  });

  it('muestra el spinner mientras carga', () => {
    crear();
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    peticion().flush(pagina([]));
  });

  it('error con Reintentar', () => {
    crear();
    responder({ detail: 'x' }, { status: 500, statusText: 'Error' });
    expect(el().textContent).toContain('No se pudo cargar la lista de incidentes.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    responder(pagina([incidente()]));
    expect(el().querySelector('.alert')).toBeNull();
  });

  it('lista vacía sin filtros', () => {
    crear();
    responder(pagina([]));
    expect(el().textContent).toContain('No hay incidentes activos.');
  });

  it('lista vacía con filtros', () => {
    crear();
    responder(pagina([]));
    elegir('severidad', 'alta');
    responder(pagina([]));
    expect(el().textContent).toContain('No hay incidentes con estos filtros.');
  });

  it('el código enlaza a la ficha', () => {
    crear();
    responder(pagina([incidente({ id: 8 })]));
    expect(el().querySelector('a[href="/admin/incidentes/8"]')?.textContent).toContain('INC-0001');
  });

  it('Nuevo incidente conserva el cliente filtrado', () => {
    crear({ organizacion: '4' });
    responder(pagina([incidente()]));
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.nuevo();
    expect(navegar).toHaveBeenCalledWith(['/admin/incidentes/nuevo'], { queryParams: { organizacion: 4 } });
  });
});
