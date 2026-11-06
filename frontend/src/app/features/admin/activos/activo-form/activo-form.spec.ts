import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { ActivoForm } from './activo-form';

const BASE = `${API_URL}/activos/`;
const ORGS = `${API_URL}/organizaciones/`;

describe('ActivoForm', () => {
  let fixture: ComponentFixture<ActivoForm>;
  let component: ActivoForm;
  let http: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(id?: string, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ActivoForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(id ? { id } : {}),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ActivoForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    if (!id) {
      http
        .expectOne((r) => r.url === ORGS)
        .flush({ count: 1, next: null, previous: null, results: [{ id: 4, nombre: 'Metropolis 21' }] });
      fixture.detectChanges();
    }
  }

  const enviar = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('no envía sin cliente, tipo ni nombre', () => {
    crear();
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.organizacion.invalid).toBeTrue();
    expect(component.form.controls.tipo.invalid).toBeTrue();
    expect(component.form.controls.nombre.invalid).toBeTrue();
  });

  it('con ?organizacion=4 preselecciona el cliente', () => {
    crear(undefined, { organizacion: '4' });
    expect(component.form.controls.organizacion.value).toBe('4');
  });

  it('rechaza una IP inválida', () => {
    crear();
    component.form.patchValue({ organizacion: '4', tipo: 'servidor', nombre: 'S1', ip: '999.1.1.1' });
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.ip.hasError('ip')).toBeTrue();
  });

  it('crea, muestra el error del servidor bajo Nombre y navega al guardar', () => {
    crear();
    component.form.patchValue({ organizacion: '4', tipo: 'servidor', nombre: 'S1', ip: '10.0.0.1' });
    enviar();
    const req = http.expectOne(BASE);
    expect(req.request.body.organizacion).toBe(4);
    req.flush(
      { nombre: ['Ya existe un activo con este nombre en este cliente.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(el().querySelector('#nombre')?.parentElement?.textContent).toContain(
      'Ya existe un activo con este nombre en este cliente.',
    );

    component.form.patchValue({ nombre: 'S2' });
    enviar();
    http.expectOne(BASE).flush({ id: 11 });
    expect(navegar).toHaveBeenCalledWith(['/admin/activos', 11], { queryParams: { guardado: 1 } });
  });

  it('en edición el cliente no se envía y se hace PATCH', () => {
    crear('7');
    http.expectOne(`${BASE}7/`).flush({
      id: 7, nombre: 'S1', tipo: 'servidor', estado: 'operativo', organizacion: { id: 4, nombre: 'Metropolis 21' },
      ip: null, hostname: null, ubicacion: null, de_baja: false, ultimo_backup: null, sistema_operativo: null,
      fabricante: null, modelo: null, numero_serie: null, notas: null, fecha_baja: null, creado_en: '',
      actualizado_en: '', resumen_backups: { total: 0, exitosos: 0, fallidos: 0, pendientes: 0 },
    });
    fixture.detectChanges();
    expect(el().textContent).toContain('Metropolis 21');
    enviar();
    const req = http.expectOne(`${BASE}7/`);
    expect(req.request.method).toBe('PATCH');
    expect('organizacion' in req.request.body).toBeFalse();
    req.flush({ id: 7 });
  });

  it('un doble envío produce una sola petición', () => {
    crear();
    component.form.patchValue({ organizacion: '4', tipo: 'red', nombre: 'SW1' });
    enviar();
    enviar();
    http.expectOne(BASE).flush({ id: 12 });
  });
});
