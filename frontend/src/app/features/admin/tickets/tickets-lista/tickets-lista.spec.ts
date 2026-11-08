import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { TicketResumido } from '../../../../core/models/ticket';
import { TicketsLista } from './tickets-lista';

const TICKETS = `${API_URL}/tickets/`;
const ORGS = `${API_URL}/organizaciones/`;
const TECNICOS = `${API_URL}/tecnicos/`;

const ticket = (t: Partial<TicketResumido> = {}): TicketResumido => ({
  id: 1,
  codigo: 'TCK-0001',
  titulo: 'Caída del servidor',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  categoria: 'red',
  prioridad: 'critica',
  prioridad_manual: false,
  estado: 'abierto',
  tecnico: null,
  activo: null,
  creado_en: '2026-11-08T10:00:00-05:00',
  ...t,
});

const pagina = (results: TicketResumido[]) => ({ count: results.length, next: null, previous: null, results });

describe('TicketsLista', () => {
  let fixture: ComponentFixture<TicketsLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [TicketsLista],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    fixture = TestBed.createComponent(TicketsLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === ORGS).flush({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 4, nombre: 'Metropolis 21', activa: true },
        { id: 9, nombre: 'Inactiva Ltda.', activa: false },
      ],
    });
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }]);
  }

  const peticion = () => http.expectOne((r) => r.url === TICKETS);

  const responder = (cuerpo: object, opciones?: { status: number; statusText: string }) => {
    peticion().flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  const elegir = (id: string, valor: string) => {
    const s = el().querySelector(`#${id}`) as HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('por defecto pide los abiertos, en orden de urgencia', () => {
    crear();
    const req = peticion();
    expect(req.request.params.get('abiertos')).toBe('true');
    expect(req.request.params.has('ordering')).toBeFalse();
    req.flush(pagina([ticket()]));
    fixture.detectChanges();
    const texto = el().querySelector('tbody')?.textContent ?? '';
    expect(texto).toContain('TCK-0001');
    expect(texto).toContain('Crítica');
    expect(texto).toContain('Abierto');
    expect(texto).toContain('Sin asignar');
  });

  it('el filtro de estado cambia los parámetros', () => {
    crear();
    responder(pagina([ticket()]));
    elegir('estado', 'todos');
    let req = peticion();
    expect(req.request.params.has('abiertos')).toBeFalse();
    expect(req.request.params.has('estado')).toBeFalse();
    req.flush(pagina([]));
    fixture.detectChanges();

    elegir('estado', 'resuelto');
    req = peticion();
    expect(req.request.params.get('estado')).toBe('resuelto');
    expect(req.request.params.has('abiertos')).toBeFalse();
    req.flush(pagina([]));
  });

  it('con ?organizacion filtra y lo selecciona, marcando los inactivos', () => {
    crear({ organizacion: '9' });
    const req = peticion();
    expect(req.request.params.get('organizacion')).toBe('9');
    req.flush(pagina([]));
    fixture.detectChanges();
    const select = el().querySelector('#cliente') as HTMLSelectElement;
    expect(select.value).toBe('9');
    expect(select.selectedOptions[0].textContent).toContain('(inactivo)');
  });

  it('el filtro Sin asignar envía tecnico=sin_asignar', () => {
    crear();
    responder(pagina([ticket()]));
    elegir('tecnico', 'sin_asignar');
    const req = peticion();
    expect(req.request.params.get('tecnico')).toBe('sin_asignar');
    req.flush(pagina([]));
  });

  it('el orden Más recientes envía ordering', () => {
    crear();
    responder(pagina([ticket()]));
    elegir('orden', '-creado_en');
    const req = peticion();
    expect(req.request.params.get('ordering')).toBe('-creado_en');
    req.flush(pagina([]));
  });

  it('marca la prioridad corregida a mano', () => {
    crear();
    responder(pagina([ticket({ prioridad_manual: true })]));
    expect(el().querySelector('tbody [data-manual]')).not.toBeNull();
  });

  it('vacío sin filtros vs. búsqueda sin resultados', () => {
    crear();
    responder(pagina([]));
    expect(el().textContent).toContain('Aún no hay tickets abiertos');
    fixture.componentInstance.aplicarBusqueda('zzz');
    responder(pagina([]));
    expect(el().textContent).toContain('No hay tickets que coincidan con «zzz»');
  });

  it('un error muestra Reintentar', () => {
    crear();
    responder({}, { status: 500, statusText: 'Error' });
    const boton = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!;
    boton.click();
    responder(pagina([ticket()]));
    expect(el().querySelector('tbody')?.textContent).toContain('TCK-0001');
  });

  it('una búsqueda nueva cancela la anterior', () => {
    crear();
    responder(pagina([ticket()]));
    fixture.componentInstance.aplicarBusqueda('a');
    const vieja = http.expectOne((r) => r.url === TICKETS && r.params.get('q') === 'a');
    fixture.componentInstance.aplicarBusqueda('ab');
    expect(vieja.cancelled).toBeTrue();
    http.expectOne((r) => r.params.get('q') === 'ab').flush(pagina([]));
  });
});
