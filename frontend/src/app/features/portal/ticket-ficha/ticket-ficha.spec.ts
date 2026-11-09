import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { EventoPortal, TicketPortal } from '../../../core/models/portal';
import { PortalTicketFicha } from './ticket-ficha';

const URL = `${API_URL}/portal/tickets/42/`;

const evento = (cambios: Partial<EventoPortal>): EventoPortal => ({
  id: 1,
  tipo: 'comentario',
  autor: 'Ana Ríos',
  autor_es_cliente: true,
  texto: null,
  valor_anterior: null,
  valor_nuevo: null,
  fecha: '2026-11-08T09:00:00-05:00',
  ...cambios,
});

const ticket = (cambios: Partial<TicketPortal> = {}): TicketPortal => ({
  id: 42,
  codigo: 'TCK-0042',
  titulo: 'No llegan los correos',
  categoria: 'software',
  estado: 'en_progreso',
  activo: { id: 7, nombre: 'SRV-01' },
  tecnico: 'Laura Gómez',
  creado_en: '2026-11-08T09:00:00-05:00',
  actualizado_en: '2026-11-08T09:40:00-05:00',
  descripcion: 'Desde esta mañana no entran mensajes.',
  alcance: 'toda_empresa',
  solucion: null,
  reportado_por: 'Ana Ríos',
  resuelto_en: null,
  cerrado_en: null,
  eventos: [],
  ...cambios,
});

describe('PortalTicketFicha', () => {
  let fixture: ComponentFixture<PortalTicketFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear() {
    TestBed.configureTestingModule({
      imports: [PortalTicketFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } } },
      ],
    });
    fixture = TestBed.createComponent(PortalTicketFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  function cargar(t: TicketPortal = ticket()) {
    crear();
    http.expectOne(URL).flush(t);
    fixture.detectChanges();
  }

  const caja = () => el().querySelector('#comentario') as HTMLTextAreaElement;
  const boton = () => el().querySelector('[data-prueba="comentar"]') as HTMLButtonElement;
  function escribir(texto: string) {
    caja().value = texto;
    caja().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('mientras carga muestra un indicador', () => {
    crear();
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    http.expectOne(URL).flush(ticket());
  });

  it('muestra los datos del ticket', () => {
    cargar();
    const texto = el().textContent ?? '';
    for (const dato of ['TCK-0042', 'No llegan los correos', 'Desde esta mañana', 'Software', 'A toda la empresa', 'SRV-01', 'Laura Gómez', 'Ana Ríos', 'En progreso']) {
      expect(texto).toContain(dato);
    }
  });

  it('solo muestra la solución si existe', () => {
    cargar();
    expect(el().querySelector('[data-prueba="solucion"]')).toBeNull();
  });

  it('muestra la solución cuando existe', () => {
    cargar(ticket({ estado: 'resuelto', solucion: 'Se reinició el servicio.' }));
    expect(el().querySelector('[data-prueba="solucion"]')?.textContent).toContain('Se reinició el servicio.');
  });

  it('la conversación explica cada evento en orden', () => {
    cargar(
      ticket({
        eventos: [
          evento({ id: 1, tipo: 'creacion' }),
          evento({ id: 2, tipo: 'estado', autor: 'Laura Gómez', autor_es_cliente: false, valor_nuevo: 'en_progreso' }),
          evento({ id: 3, autor: 'Laura Gómez', autor_es_cliente: false, texto: 'Estamos revisando.' }),
        ],
      }),
    );
    const filas = Array.from(el().querySelectorAll('[data-prueba="evento"]')).map((f) => f.textContent ?? '');
    expect(filas.length).toBe(3);
    expect(filas[0]).toContain('abrió el ticket');
    expect(filas[1]).toContain('cambió el estado a En progreso');
    expect(filas[2]).toContain('comentó');
    expect(filas[2]).toContain('Estamos revisando.');
  });

  it('distingue al equipo del cliente', () => {
    cargar(
      ticket({
        eventos: [
          evento({ id: 1, texto: 'a' }),
          evento({ id: 2, autor: 'Laura Gómez', autor_es_cliente: false, texto: 'b' }),
        ],
      }),
    );
    const filas = el().querySelectorAll('[data-prueba="evento"]');
    expect(filas[0].textContent).not.toContain('Equipo SEBRIT');
    expect(filas[1].textContent).toContain('Equipo SEBRIT');
  });

  it('sin autor muestra Sistema', () => {
    cargar(ticket({ eventos: [evento({ autor: null, autor_es_cliente: false, texto: 'a' })] }));
    const fila = el().querySelector('[data-prueba="evento"]')?.textContent ?? '';
    expect(fila).toContain('Sistema');
    expect(fila).not.toContain('Equipo SEBRIT');
  });

  it('sin eventos lo dice', () => {
    cargar();
    expect(el().textContent).toContain('Todavía no hay mensajes.');
  });

  it('el botón exige texto', () => {
    cargar();
    expect(boton().disabled).toBeTrue();
    escribir('   ');
    expect(boton().disabled).toBeTrue();
    escribir('Hola');
    expect(boton().disabled).toBeFalse();
  });

  it('comentar agrega el mensaje y limpia la caja', () => {
    cargar();
    escribir('  Sigue fallando  ');
    boton().click();
    const req = http.expectOne(`${URL}comentarios/`);
    expect(req.request.body).toEqual({ texto: 'Sigue fallando' });
    req.flush(evento({ id: 9, texto: 'Sigue fallando' }));
    fixture.detectChanges();
    expect(el().querySelector('[data-prueba="evento"]')?.textContent).toContain('Sigue fallando');
    expect(caja().value).toBe('');
  });

  it('si falla el comentario conserva lo escrito y avisa', () => {
    cargar();
    escribir('Sigue fallando');
    boton().click();
    http.expectOne(`${URL}comentarios/`).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('No se pudo enviar el comentario. Intenta de nuevo.');
    expect(caja().value).toBe('Sigue fallando');
  });

  it('muestra el mensaje de un 400', () => {
    cargar();
    escribir('x');
    boton().click();
    http
      .expectOne(`${URL}comentarios/`)
      .flush({ non_field_errors: ['Este ticket está cerrado.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('Este ticket está cerrado.');
  });

  it('un ticket cerrado no admite comentarios', () => {
    cargar(ticket({ estado: 'cerrado' }));
    expect(caja()).toBeNull();
    expect(el().textContent).toContain('Este ticket está cerrado. Si el problema volvió, abre uno nuevo.');
    expect(el().querySelector('a[href="/portal/tickets/nuevo"]')).not.toBeNull();
  });

  it('un ticket resuelto indica cómo pedir que se reabra', () => {
    cargar(ticket({ estado: 'resuelto', solucion: 'Listo' }));
    expect(caja()).not.toBeNull();
    expect(el().textContent).toContain('Si el problema continúa, escríbenos aquí.');
  });

  it('404 muestra no encontrado con enlace a la lista', () => {
    crear();
    http.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Ticket no encontrado');
    expect(el().querySelector('a[href="/portal/tickets"]')).not.toBeNull();
  });

  it('un error permite reintentar', () => {
    crear();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cargar el ticket.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    http.expectOne(URL).flush(ticket());
    fixture.detectChanges();
    expect(el().textContent).toContain('TCK-0042');
  });

  it('no muestra prioridad', () => {
    cargar();
    expect(el().textContent).not.toContain('Prioridad');
  });
});
