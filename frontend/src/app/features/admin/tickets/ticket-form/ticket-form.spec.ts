import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { TicketForm } from './ticket-form';

const BASE = `${API_URL}/tickets/`;
const ORGS = `${API_URL}/organizaciones/`;
const ACTIVOS = `${API_URL}/activos/`;
const TECNICOS = `${API_URL}/tecnicos/`;

const pag = (results: object[]) => ({ count: results.length, next: null, previous: null, results });

describe('TicketForm', () => {
  let fixture: ComponentFixture<TicketForm>;
  let component: TicketForm;
  let http: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(id?: string, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [TicketForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(id ? { id } : {}), queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(TicketForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }]);
    if (!id) {
      http.expectOne((r) => r.url === ORGS).flush(pag([{ id: 4, nombre: 'Metropolis 21' }, { id: 8, nombre: 'Otra' }]));
      fixture.detectChanges();
    }
  }

  const elegir = (id: string, valor: string) => {
    const s = el().querySelector(`#${id}`) as HTMLSelectElement;
    s.value = valor;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const escribir = (id: string, valor: string) => {
    const c = el().querySelector(`#${id}`) as HTMLInputElement;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const activosDe = (org: string) => {
    const req = http.expectOne((r) => r.url === ACTIVOS && r.params.get('organizacion') === org);
    expect(req.request.params.get('page_size')).toBe('100');
    req.flush(pag([{ id: 3, nombre: 'SRV-01' }]));
    fixture.detectChanges();
  };

  const llenar = () => {
    elegir('organizacion', '4');
    activosDe('4');
    escribir('titulo', 'Caída');
    escribir('descripcion', 'No responde');
    elegir('categoria', 'red');
    elegir('alcance', 'toda_empresa');
  };

  const enviar = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('no envía si faltan los campos requeridos', () => {
    crear();
    enviar();
    http.expectNone(BASE);
    for (const c of ['organizacion', 'titulo', 'descripcion', 'categoria', 'alcance'] as const) {
      expect(component.form.controls[c].invalid).withContext(c).toBeTrue();
    }
  });

  it('muestra la nota de prioridad automática', () => {
    crear();
    expect(el().textContent).toContain('La prioridad se calcula');
  });

  it('crea con ids numéricos y null en lo opcional, y navega a la ficha', () => {
    crear();
    llenar();
    enviar();
    const req = http.expectOne(BASE);
    expect(req.request.body).toEqual({
      organizacion: 4,
      titulo: 'Caída',
      descripcion: 'No responde',
      categoria: 'red',
      alcance: 'toda_empresa',
      activo: null,
      tecnico: null,
    });
    req.flush({ id: 11 });
    expect(navegar).toHaveBeenCalledWith(['/admin/tickets', 11], { queryParams: { guardado: 1 } });
  });

  it('elige activo y técnico como números', () => {
    crear();
    llenar();
    elegir('activo', '3');
    elegir('tecnico', '5');
    enviar();
    const req = http.expectOne(BASE);
    expect([req.request.body.activo, req.request.body.tecnico]).toEqual([3, 5]);
    req.flush({ id: 11 });
  });

  it('cambiar de cliente recarga los activos y limpia el elegido', () => {
    crear();
    llenar();
    elegir('activo', '3');
    expect(component.form.controls.activo.value).toBe('3');
    elegir('organizacion', '8');
    activosDe('8');
    expect(component.form.controls.activo.value).toBe('');
  });

  it('con ?organizacion preselecciona y carga sus activos', () => {
    crear(undefined, { organizacion: '4' });
    activosDe('4');
    expect(component.form.controls.organizacion.value).toBe('4');
  });

  it('un ?organizacion que no está entre los clientes activos no se preselecciona', () => {
    crear(undefined, { organizacion: '99' });
    expect(component.form.controls.organizacion.value).toBe('');
    http.expectNone((r) => r.url === ACTIVOS);
    enviar();
    expect(component.form.controls.organizacion.invalid).toBeTrue();
  });

  it('un ?organizacion que no es número se ignora', () => {
    crear(undefined, { organizacion: 'abc' });
    expect(component.form.controls.organizacion.value).toBe('');
    http.expectNone((r) => r.url === ACTIVOS);
  });

  it('en edición, un técnico que ya no está en la lista se conserva', () => {
    crear('7');
    http.expectOne(`${BASE}7/`).flush({
      id: 7, codigo: 'TCK-0007', titulo: 'A', descripcion: 'B', categoria: 'red', alcance: 'un_usuario',
      organizacion: { id: 4, nombre: 'Metropolis 21' }, activo: null, tecnico: { id: 77, nombre: 'Técnico Retirado' },
    });
    activosDe('4');
    fixture.detectChanges();
    const s = el().querySelector('#tecnico') as HTMLSelectElement;
    expect(s.value).toBe('77');
    expect(s.selectedOptions[0].textContent).toContain('Técnico Retirado');
  });

  it('muestra bajo su campo el error del servidor', () => {
    crear();
    llenar();
    enviar();
    http
      .expectOne(BASE)
      .flush({ activo: ['El activo está dado de baja.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('#activo')?.parentElement?.textContent).toContain('El activo está dado de baja.');
  });

  it('en edición no envía organizacion y hace PATCH', () => {
    crear('7');
    http.expectOne(`${BASE}7/`).flush({
      id: 7, codigo: 'TCK-0007', titulo: 'A', descripcion: 'B', categoria: 'red', alcance: 'un_usuario',
      organizacion: { id: 4, nombre: 'Metropolis 21' }, activo: { id: 3, nombre: 'SRV-01' }, tecnico: null,
    });
    activosDe('4');
    expect(el().textContent).toContain('Metropolis 21');
    expect(component.form.controls.activo.value).toBe('3');
    enviar();
    const req = http.expectOne(`${BASE}7/`);
    expect(req.request.method).toBe('PATCH');
    expect('organizacion' in req.request.body).toBeFalse();
    expect(req.request.body.activo).toBe(3);
    req.flush({ id: 7 });
  });

  it('un doble envío produce una sola petición', () => {
    crear();
    llenar();
    enviar();
    enviar();
    http.expectOne(BASE).flush({ id: 12 });
  });
});
