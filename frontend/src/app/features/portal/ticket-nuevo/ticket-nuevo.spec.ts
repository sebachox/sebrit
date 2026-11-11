import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { PortalTicketNuevo } from './ticket-nuevo';

const TICKETS = `${API_URL}/portal/tickets/`;
const ACTIVOS = `${API_URL}/portal/activos/`;

const activo = { id: 7, nombre: 'SRV-01', tipo: 'servidor', estado: 'operativo', ubicacion: null, ultimo_backup: null };
const paginaActivos = { count: 1, next: null, previous: null, results: [activo] };

describe('PortalTicketNuevo', () => {
  let fixture: ComponentFixture<PortalTicketNuevo>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalTicketNuevo],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalTicketNuevo);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const conActivos = () => {
    http.expectOne((r) => r.url === ACTIVOS).flush(paginaActivos);
    fixture.detectChanges();
  };
  function escribir(id: string, valor: string) {
    const i = el().querySelector(`#${id}`) as HTMLInputElement;
    i.value = valor;
    i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }
  function llenar() {
    escribir('titulo', ' Sin correo ');
    escribir('descripcion', ' No llegan mensajes ');
    escribir('categoria', 'software');
    escribir('alcance', 'toda_empresa');
  }
  function enviar() {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('exige los campos con mensajes claros', () => {
    conActivos();
    enviar();
    http.expectNone(TICKETS);
    const texto = el().textContent ?? '';
    expect(texto).toContain('Escribe el título.');
    expect(texto).toContain('Describe lo que ocurre.');
    expect(texto).toContain('Elige una categoría.');
    expect(texto).toContain('Indica a quién afecta.');
  });

  it('ofrece el alcance en lenguaje del cliente', () => {
    conActivos();
    const texto = el().querySelector('#alcance')?.textContent ?? '';
    expect(texto).toContain('Solo a mí');
    expect(texto).toContain('A varias personas');
    expect(texto).toContain('A toda la empresa');
  });

  it('envía sin activo ni empresa y abre la ficha', () => {
    conActivos();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    llenar();
    enviar();
    const req = http.expectOne(TICKETS);
    expect(req.request.body).toEqual({
      titulo: 'Sin correo',
      descripcion: 'No llegan mensajes',
      categoria: 'software',
      alcance: 'toda_empresa',
      activo: null,
    });
    req.flush({ id: 42 });
    expect(navegar).toHaveBeenCalledWith(['/portal/tickets', 42]);
  });

  it('envía el activo elegido como número', () => {
    conActivos();
    llenar();
    escribir('activo', '7');
    enviar();
    const req = http.expectOne(TICKETS);
    expect(req.request.body.activo).toBe(7);
    req.flush({ id: 42 });
  });

  it('un error 400 aparece en su campo', () => {
    conActivos();
    llenar();
    enviar();
    http.expectOne(TICKETS).flush({ activo: ['Elige un activo de tu empresa.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().querySelector('#activo')!.classList).toContain('is-invalid');
    expect(el().textContent).toContain('Elige un activo de tu empresa.');
  });

  it('si falla el envío avisa y conserva lo escrito', () => {
    conActivos();
    llenar();
    enviar();
    http.expectOne(TICKETS).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('No se pudo abrir el ticket. Intenta de nuevo.');
    expect((el().querySelector('#titulo') as HTMLInputElement).value).toBe(' Sin correo ');
  });

  it('ignora un segundo envío mientras guarda', () => {
    conActivos();
    llenar();
    enviar();
    enviar();
    http.expectOne(TICKETS).flush({ id: 42 });
  });

  it('si fallan los activos el formulario sigue funcionando', () => {
    http.expectOne((r) => r.url === ACTIVOS).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().querySelector('#activo')).toBeNull();
    llenar();
    enviar();
    const req = http.expectOne(TICKETS);
    expect(req.request.body.activo).toBeNull();
    req.flush({ id: 42 });
  });

  it('sin activos no muestra el selector', () => {
    http.expectOne((r) => r.url === ACTIVOS).flush({ count: 0, next: null, previous: null, results: [] });
    fixture.detectChanges();
    expect(el().querySelector('#activo')).toBeNull();
  });

  it('pide hasta 100 activos para el selector', () => {
    const req = http.expectOne((r) => r.url === ACTIVOS);
    expect(req.request.params.get('page_size')).toBe('100');
    req.flush(paginaActivos);
  });

  it('no pide prioridad ni técnico', () => {
    conActivos();
    expect(el().querySelector('#prioridad')).toBeNull();
    expect(el().querySelector('#tecnico')).toBeNull();
  });
});


describe('PortalTicketNuevo con ?activo=', () => {
  function crearCon(activo: string) {
    TestBed.configureTestingModule({
      imports: [PortalTicketNuevo],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ activo }) } } },
      ],
    });
    const fixture = TestBed.createComponent(PortalTicketNuevo);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === ACTIVOS).flush(paginaActivos);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('#activo') as HTMLSelectElement;
  }

  it('deja elegido el activo si está en la lista', () => {
    expect(crearCon('7').value).toBe('7');
  });

  it('un activo que no está en la lista deja el campo vacío', () => {
    expect(crearCon('99').value).toBe('');
  });
});
