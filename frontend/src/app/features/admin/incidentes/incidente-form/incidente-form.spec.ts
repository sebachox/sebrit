import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { Incidente } from '../../../../core/models/incidente';
import { IncidenteForm } from './incidente-form';

const BASE = `${API_URL}/incidentes/`;
const ORGS = `${API_URL}/organizaciones/`;
const ACTIVOS = `${API_URL}/activos/`;
const TECNICOS = `${API_URL}/tecnicos/`;

const incidente = (i: Partial<Incidente> = {}): Incidente => ({
  id: 11,
  codigo: 'INC-0011',
  titulo: 'Caída del ERP',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  severidad: 'alta',
  severidad_manual: false,
  impacto: 'total',
  estado: 'abierto',
  tecnico: null,
  fecha_origen: '2026-11-08T10:00:30-05:00',
  fecha_deteccion: '2026-11-08T10:10:00-05:00',
  fecha_fin: null,
  duracion_minutos: null,
  total_activos: 0,
  total_tickets: 0,
  descripcion: 'No responde',
  reportado_por: null,
  solucion: null,
  causa_raiz: null,
  cerrado_en: null,
  actualizado_en: '2026-11-08T10:10:00-05:00',
  activos: [],
  tickets: [],
  acciones: [],
  ...i,
});

const pagina = (results: object[]) => ({ count: results.length, next: null, previous: null, results });
const ACTIVO_1 = { id: 3, nombre: 'SRV-01', tipo: 'servidor', estado: 'operativo' };
const ACTIVO_2 = { id: 4, nombre: 'RT-01', tipo: 'red', estado: 'operativo' };

describe('IncidenteForm', () => {
  let fixture: ComponentFixture<IncidenteForm>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar(params: Record<string, string>, query: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [IncidenteForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params), queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    fixture = TestBed.createComponent(IncidenteForm);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }]);
  }

  function crearNuevo(query: Record<string, string> = {}) {
    montar({}, query);
    http.expectOne((r) => r.url === ORGS).flush(pagina([{ id: 4, nombre: 'Metropolis 21' }, { id: 6, nombre: 'Otra' }]));
    fixture.detectChanges();
  }

  function crearEdicion(i: Incidente = incidente(), lista: object[] = [ACTIVO_1, ACTIVO_2]) {
    montar({ id: '11' }, {});
    http.expectOne(`${BASE}11/`).flush(i);
    http.expectOne((r) => r.url === ACTIVOS).flush(pagina(lista));
    fixture.detectChanges();
  }

  const escribir = (id: string, valor: string) => {
    const c = el().querySelector(`#${id}`) as HTMLInputElement;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    c.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const responderActivos = (lista: object[] = [ACTIVO_1, ACTIVO_2]) => {
    http.expectOne((r) => r.url === ACTIVOS).flush(pagina(lista));
    fixture.detectChanges();
  };

  const casilla = (id: number) => el().querySelector(`#activo-${id}`) as HTMLInputElement;
  const enviar = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  function llenar() {
    escribir('organizacion', '4');
    responderActivos();
    escribir('titulo', ' Caída ');
    escribir('descripcion', ' No abre ');
    escribir('impacto', 'total');
    escribir('fecha_origen', '2026-01-15T08:30');
  }

  afterEach(() => http.verify());

  it('crear envía los campos y navega a la ficha', () => {
    crearNuevo();
    llenar();
    casilla(3).click();
    fixture.detectChanges();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    enviar();
    const req = http.expectOne(BASE);
    expect(req.request.body).toEqual({
      organizacion: 4,
      titulo: 'Caída',
      descripcion: 'No abre',
      impacto: 'total',
      fecha_origen: new Date('2026-01-15T08:30').toISOString(),
      activos: [3],
      tecnico: null,
    });
    req.flush(incidente());
    expect(navegar).toHaveBeenCalledWith(['/admin/incidentes', 11], { queryParams: { guardado: 1 } });
  });

  it('marca los obligatorios con sus mensajes', () => {
    crearNuevo();
    enviar();
    const texto = el().textContent;
    for (const m of [
      'Elige el cliente.',
      'Escribe un título corto.',
      'Describe qué está pasando.',
      'Indica el impacto.',
      'Indica cuándo empezó el incidente.',
    ]) {
      expect(texto).toContain(m);
    }
  });

  it('rechaza una fecha de origen futura', () => {
    crearNuevo();
    escribir('fecha_origen', '2999-01-01T00:00');
    (el().querySelector('#fecha_origen') as HTMLInputElement).dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el().textContent).toContain('La fecha de origen no puede ser futura.');
  });

  it('cambiar de cliente vacía los activos y recarga la lista', () => {
    crearNuevo();
    escribir('organizacion', '4');
    responderActivos();
    casilla(3).click();
    escribir('organizacion', '6');
    const req = http.expectOne((r) => r.url === ACTIVOS);
    expect(req.request.params.get('organizacion')).toBe('6');
    req.flush(pagina([ACTIVO_1]));
    fixture.detectChanges();
    expect(casilla(3).checked).toBeFalse();
    expect(fixture.componentInstance.activosMarcados().size).toBe(0);
  });

  it('solo preselecciona un cliente listado', () => {
    crearNuevo({ organizacion: '4' });
    expect(fixture.componentInstance.form.controls.organizacion.value).toBe('4');
    responderActivos();
  });

  it('ignora un cliente que no está en la lista', () => {
    crearNuevo({ organizacion: '99' });
    expect(fixture.componentInstance.form.controls.organizacion.value).toBe('');
  });

  it('indica cuando el cliente no tiene activos', () => {
    crearNuevo();
    expect(el().textContent).toContain('Elige un cliente para ver sus activos.');
    escribir('organizacion', '4');
    responderActivos([]);
    expect(el().textContent).toContain('Este cliente no tiene activos registrados.');
  });

  it('al editar, el cliente es fijo y no se envía', () => {
    crearEdicion(incidente({ activos: [ACTIVO_1] }));
    expect(el().querySelector('select#organizacion')).toBeNull();
    expect(el().textContent).toContain('Metropolis 21');
    expect(casilla(3).checked).toBeTrue();
    expect(casilla(4).checked).toBeFalse();
    enviar();
    const req = http.expectOne(`${BASE}11/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.organizacion).toBeUndefined();
    expect(req.request.body.activos).toEqual([3]);
    req.flush(incidente());
  });

  it('incluye un activo vinculado que ya no aparece en la lista', () => {
    const deBaja = { id: 8, nombre: 'SRV-VIEJO', tipo: 'servidor', estado: 'critico' };
    crearEdicion(incidente({ activos: [deBaja] }), [ACTIVO_1]);
    expect(casilla(8).checked).toBeTrue();
  });

  it('al editar sin tocar la fecha no la envía', () => {
    crearEdicion();
    enviar();
    const req = http.expectOne(`${BASE}11/`);
    expect('fecha_origen' in req.request.body).toBeFalse();
    req.flush(incidente());
  });

  it('al editar cambiando la fecha la envía', () => {
    crearEdicion();
    escribir('fecha_origen', '2026-01-15T08:30');
    enviar();
    const req = http.expectOne(`${BASE}11/`);
    expect(req.request.body.fecha_origen).toBe(new Date('2026-01-15T08:30').toISOString());
    req.flush(incidente());
  });

  it('los errores 400 van al campo', () => {
    crearNuevo();
    llenar();
    enviar();
    http
      .expectOne(BASE)
      .flush(
        { fecha_origen: ['La fecha de origen no puede ser futura.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(el().querySelector('#fecha_origen')?.classList).toContain('is-invalid');
    expect(el().textContent).toContain('La fecha de origen no puede ser futura.');
  });

  it('un error de activos se muestra arriba', () => {
    crearNuevo();
    llenar();
    enviar();
    http.expectOne(BASE).flush({ activos: ['Hay activos dados de baja.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.alert')?.textContent).toContain('Hay activos dados de baja.');
  });

  it('muestra no encontrado y error de carga', () => {
    montar({ id: '11' }, {});
    http.expectOne(`${BASE}11/`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Incidente no encontrado.');

    fixture.componentInstance.cargar(11);
    http.expectOne(`${BASE}11/`).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cargar el incidente.');
  });
});
