import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { PortalTicketsLista } from './tickets-lista';

const TICKETS = `${API_URL}/portal/tickets/`;

const ticket = {
  id: 42,
  codigo: 'TCK-0042',
  titulo: 'No llegan los correos',
  categoria: 'software',
  estado: 'en_progreso',
  activo: { id: 7, nombre: 'SRV-01' },
  tecnico: 'Laura Gómez',
  creado_en: '2026-11-08T09:00:00-05:00',
  actualizado_en: '2026-11-08T09:40:00-05:00',
};

const pagina = (results: object[], count = results.length) => ({ count, next: null, previous: null, results });

describe('PortalTicketsLista', () => {
  let fixture: ComponentFixture<PortalTicketsLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalTicketsLista],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalTicketsLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const peticion = () => http.expectOne((r) => r.url === TICKETS);
  const responder = (results: object[] = [ticket], count?: number) => {
    peticion().flush(pagina(results, count));
    fixture.detectChanges();
  };
  const elegirEstado = (valor: string) => {
    const s = el().querySelector('#estado') as HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('por defecto pide los abiertos', () => {
    const req = peticion();
    expect(req.request.params.get('abiertos')).toBe('true');
    req.flush(pagina([]));
  });

  it('muestra los datos del ticket y enlaza a su ficha', () => {
    responder();
    expect(el().querySelector('a[href="/portal/tickets/42"]')?.textContent).toContain('TCK-0042');
    const texto = el().textContent ?? '';
    expect(texto).toContain('No llegan los correos');
    expect(texto).toContain('Software');
    expect(texto).toContain('En progreso');
    expect(texto).toContain('Laura Gómez');
  });

  it('sin técnico muestra Sin asignar', () => {
    responder([{ ...ticket, tecnico: null }]);
    expect(el().textContent).toContain('Sin asignar');
  });

  it('Todos deja de filtrar por abiertos', () => {
    responder();
    elegirEstado('todos');
    const req = peticion();
    expect(req.request.params.has('abiertos')).toBeFalse();
    expect(req.request.params.has('estado')).toBeFalse();
    req.flush(pagina([]));
  });

  it('filtra por un estado', () => {
    responder();
    elegirEstado('resuelto');
    const req = peticion();
    expect(req.request.params.get('estado')).toBe('resuelto');
    expect(req.request.params.has('abiertos')).toBeFalse();
    req.flush(pagina([]));
  });

  it('busca tras una pausa y cancela la petición anterior', fakeAsync(() => {
    const primera = peticion();
    primera.flush(pagina([ticket]));
    fixture.detectChanges();
    const buscar = el().querySelector('#buscar') as HTMLInputElement;
    buscar.value = 'co';
    buscar.dispatchEvent(new Event('input'));
    tick(400);
    const vieja = http.expectOne((r) => r.params.get('q') === 'co');
    buscar.value = 'correo';
    buscar.dispatchEvent(new Event('input'));
    tick(400);
    expect(vieja.cancelled).toBeTrue();
    http.expectOne((r) => r.params.get('q') === 'correo').flush(pagina([]));
  }));

  it('pagina', () => {
    responder([ticket], 45);
    expect(el().textContent).toContain('1–1 de 45');
    (el().querySelector('[data-prueba="siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const req = peticion();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([ticket], 45));
  });

  it('sin tickets y sin filtros ofrece abrir uno', () => {
    responder([]);
    expect(el().textContent).toContain('No tienes tickets abiertos.');
    expect(el().querySelector('a[href="/portal/tickets/nuevo"]')).not.toBeNull();
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
    expect(el().textContent).toContain('No se pudieron cargar tus tickets.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    responder();
    expect(el().textContent).toContain('TCK-0042');
  });

  it('no muestra prioridad', () => {
    responder();
    expect(el().textContent).not.toContain('Prioridad');
  });
});
