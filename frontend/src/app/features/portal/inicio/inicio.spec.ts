import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { PortalInicio } from './inicio';

const RESUMEN = `${API_URL}/portal/resumen/`;
const TICKETS = `${API_URL}/portal/tickets/`;

const resumen = {
  generado_en: '2026-11-08T10:00:00-05:00',
  empresa: { id: 1, nombre: 'Metropolis 21' },
  tickets: { abiertos: 3, en_progreso: 7, resueltos: 2 },
  incidentes_activos: 5,
  infraestructura: {
    servidores: { total: 12, operativos: 10, advertencia: 1, criticos: 1 },
    redes: { total: 6, operativos: 4, advertencia: 2, criticos: 0 },
    backups: { total: 20, exitosos: 18, fallidos: 1, pendientes: 1 },
  },
};

const ticket = {
  id: 42,
  codigo: 'TCK-0042',
  titulo: 'No llegan los correos',
  categoria: 'software',
  estado: 'abierto',
  activo: null,
  tecnico: null,
  creado_en: '2026-11-08T09:00:00-05:00',
  actualizado_en: '2026-11-08T09:00:00-05:00',
};

const pagina = (results: object[]) => ({ count: results.length, next: null, previous: null, results });

describe('PortalInicio', () => {
  let fixture: ComponentFixture<PortalInicio>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalInicio],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalInicio);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responder(tickets: object[] = [ticket]) {
    http.expectOne(RESUMEN).flush(resumen);
    http.expectOne((r) => r.url === TICKETS).flush(pagina(tickets));
    fixture.detectChanges();
  }

  it('mientras carga muestra un indicador', () => {
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    responder();
  });

  it('pide los 5 tickets abiertos más recientes', () => {
    http.expectOne(RESUMEN).flush(resumen);
    const req = http.expectOne((r) => r.url === TICKETS);
    expect(req.request.params.get('abiertos')).toBe('true');
    expect(req.request.params.get('page_size')).toBe('5');
    req.flush(pagina([]));
  });

  it('muestra la empresa y los números', () => {
    responder();
    expect(el().querySelector('h4')?.textContent).toContain('Metropolis 21');
    const texto = el().textContent ?? '';
    expect(texto).toContain('Tickets abiertos');
    expect(texto).toContain('En progreso');
    expect(texto).toContain('Incidentes activos');
    expect(el().querySelector('[data-prueba="tickets-abiertos"]')?.textContent).toContain('3');
    expect(el().querySelector('[data-prueba="tickets-progreso"]')?.textContent).toContain('7');
    expect(el().querySelector('[data-prueba="incidentes"]')?.textContent).toContain('5');
  });

  it('muestra servidores, redes y backups por estado', () => {
    responder();
    const texto = (sel: string) => el().querySelector(`[data-prueba="${sel}"]`)?.textContent ?? '';
    expect(texto('servidores')).toContain('12');
    expect(texto('servidores')).toContain('10 operativos');
    expect(texto('redes')).toContain('2 advertencia');
    expect(texto('backups')).toContain('1 fallidos');
  });

  it('servidores, redes y backups enlazan a sus listas filtradas', () => {
    responder();
    expect(el().querySelector('[data-prueba="servidores"] a[href="/portal/activos?tipo=servidor"]')).not.toBeNull();
    expect(el().querySelector('[data-prueba="redes"] a[href="/portal/activos?tipo=red"]')).not.toBeNull();
    expect(el().querySelector('[data-prueba="backups"] a[href="/portal/backups"]')).not.toBeNull();
  });

  it('los tickets enlazan a su ficha', () => {
    responder();
    expect(el().querySelector('a[href="/portal/tickets/42"]')?.textContent).toContain('TCK-0042');
  });

  it('tocar cualquier parte de un ticket lo abre', () => {
    responder();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    (el().querySelector('[data-prueba="ticket"] .titulo-ticket') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith(['/portal/tickets', 42]);
  });

  it('la tarjeta de incidentes enlaza a la lista', () => {
    responder();
    expect(el().querySelector('a[href="/portal/incidentes"]')?.textContent).toContain('Incidentes activos');
  });

  it('sin tickets abiertos lo dice', () => {
    responder([]);
    expect(el().textContent).toContain('No tienes tickets abiertos.');
  });

  it('el botón abre el formulario', () => {
    responder();
    expect(el().querySelector('a[href="/portal/tickets/nuevo"]')?.textContent).toContain('Abrir ticket');
  });

  it('un error permite reintentar', () => {
    http.expectOne(RESUMEN).flush({}, { status: 500, statusText: 'Error' });
    http.expectOne((r) => r.url === TICKETS);
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cargar el resumen.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    responder();
    expect(el().querySelector('h4')?.textContent).toContain('Metropolis 21');
  });

  it('nunca menciona la prioridad', () => {
    responder();
    expect(el().textContent).not.toContain('Prioridad');
  });
});
