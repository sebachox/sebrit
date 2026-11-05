import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { ClienteForm } from './cliente-form';

const BASE = `${API_URL}/organizaciones/`;

describe('ClienteForm', () => {
  let fixture: ComponentFixture<ClienteForm>;
  let component: ClienteForm;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(id?: string) {
    TestBed.configureTestingModule({
      imports: [ClienteForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    fixture = TestBed.createComponent(ClienteForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  }

  const enviar = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('no envía el formulario vacío y marca nombre y NIT', () => {
    crear();
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.nombre.invalid).toBeTrue();
    expect(component.form.controls.nit.invalid).toBeTrue();
  });

  it('rechaza un NIT con puntos', () => {
    crear();
    component.form.patchValue({ nombre: 'A', nit: '900.123' });
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.nit.hasError('pattern')).toBeTrue();
  });

  it('marca la fecha de fin anterior a la de inicio', () => {
    crear();
    component.form.patchValue({
      nombre: 'A',
      nit: '900000001',
      fecha_inicio_contrato: '2026-06-01',
      fecha_fin_contrato: '2026-01-01',
    });
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.fecha_fin_contrato.hasError('finAnterior')).toBeTrue();
  });

  it('muestra bajo el campo el error del servidor', () => {
    crear();
    component.form.patchValue({ nombre: 'A', nit: '900000001' });
    enviar();
    http
      .expectOne(BASE)
      .flush(
        { nit: ['Ya existe una organización con este NIT.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(el().querySelector('#nit')?.parentElement?.textContent).toContain(
      'Ya existe una organización con este NIT.',
    );
  });

  it('un doble clic en Guardar envía una sola vez', () => {
    crear();
    component.form.patchValue({ nombre: 'A', nit: '900000001' });
    enviar();
    enviar();
    const boton = el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBeTrue();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 9 });
  });

  it('en edición carga los datos y envía PATCH', () => {
    crear('4');
    http.expectOne(`${BASE}4/`).flush({
      id: 4, nombre: 'Uno', nit: '900000001', sector: null, telefono: null, correo: null,
      direccion: null, ciudad: 'Cali', contacto_nombre: null, contacto_cargo: null,
      contacto_correo: null, contacto_telefono: null, plan: null, fecha_inicio_contrato: null,
      fecha_fin_contrato: null, activa: true, creado_en: '', actualizado_en: '',
      resumen: { activos: 0, tickets_abiertos: 0, incidentes_activos: 0, usuarios: 0 },
    });
    fixture.detectChanges();
    expect(component.form.controls.ciudad.value).toBe('Cali');

    enviar();
    const req = http.expectOne(`${BASE}4/`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 4 });
  });
});
