import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { OrganizacionResumida } from '../../../../core/models/organizacion';
import { ClientesLista } from './clientes-lista';

const BASE = `${API_URL}/organizaciones/`;

const org = (o: Partial<OrganizacionResumida> = {}): OrganizacionResumida => ({
  id: 1,
  nombre: 'Empresa Ejemplo',
  nit: '900123456-7',
  ciudad: 'Bogotá',
  plan: 'premium',
  contacto_nombre: 'Ana Ruiz',
  fecha_fin_contrato: '2099-01-31',
  activa: true,
  ...o,
});

const pagina = (results: OrganizacionResumida[], count = results.length) => ({
  count,
  next: null,
  previous: null,
  results,
});

describe('ClientesLista', () => {
  let fixture: ComponentFixture<ClientesLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(rol = 'admin') {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 1, username: 'u', nombre: 'U', rol }));
    TestBed.configureTestingModule({
      imports: [ClientesLista],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(ClientesLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  const responder = (cuerpo: object, opciones?: { status: number; statusText: string }) => {
    http.expectOne((r) => r.url === BASE).flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('pide por defecto solo los activos y muestra la tabla con plan y estado', () => {
    crear();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('activa')).toBe('true');
    req.flush(pagina([org()]));
    fixture.detectChanges();

    expect(el().querySelector('tbody')?.textContent).toContain('Empresa Ejemplo');
    expect(el().querySelector('tbody')?.textContent).toContain('Premium');
    expect(el().querySelector('tbody')?.textContent).toContain('Activo');
  });

  it('sin clientes ni búsqueda muestra que aún no hay clientes', () => {
    crear();
    responder(pagina([]));
    expect(el().textContent).toContain('Aún no hay clientes');
  });

  it('una búsqueda sin resultados lo dice con el texto buscado', () => {
    crear();
    responder(pagina([org()]));
    fixture.componentInstance.aplicarBusqueda('zzz');
    responder(pagina([]));
    expect(el().textContent).toContain('No hay clientes que coincidan con «zzz»');
  });

  it('un error muestra Reintentar y vuelve a pedir la lista', () => {
    crear();
    responder({}, { status: 500, statusText: 'Error' });
    const boton = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    boton.click();
    responder(pagina([org()]));
    expect(el().querySelector('tbody')?.textContent).toContain('Empresa Ejemplo');
  });

  it('una página fuera de rango vuelve a la página 1', () => {
    crear();
    responder(pagina([org()], 25));
    fixture.componentInstance.irAPagina(2);
    const req2 = http.expectOne((r) => r.url === BASE);
    expect(req2.request.params.get('page')).toBe('2');
    req2.flush({ detail: 'Página inválida.' }, { status: 404, statusText: 'Not Found' });

    const req1 = http.expectOne((r) => r.url === BASE);
    expect(req1.request.params.has('page')).toBeFalse();
    req1.flush(pagina([org()]));
  });

  it('para el técnico, Nuevo cliente está bloqueado', () => {
    crear('tecnico');
    responder(pagina([org()]));
    const nuevo = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Nuevo cliente'),
    )!;
    expect(nuevo.disabled).toBeTrue();
    expect(nuevo.title).toBe('Solo administradores');
  });

  it('una fecha de fin vencida se marca en rojo', () => {
    crear();
    responder(pagina([org({ fecha_fin_contrato: '2020-01-01' })]));
    expect(el().querySelector('td.text-danger')?.textContent).toContain('2020');
  });
});
