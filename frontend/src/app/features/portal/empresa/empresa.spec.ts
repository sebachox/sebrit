import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { EmpresaPortal } from '../../../core/models/portal';
import { PortalEmpresa } from './empresa';

const URL = `${API_URL}/portal/empresa/`;

const empresa = (e: Partial<EmpresaPortal> = {}): EmpresaPortal => ({
  id: 1,
  nombre: 'Metropolis 21',
  nit: '800458575-2',
  sector: 'Comercio',
  telefono: '3254565151',
  correo: 'info@metropolis.co',
  direccion: 'Calle 18',
  ciudad: 'Pasto',
  contacto_nombre: 'Alisson Benavides',
  contacto_cargo: 'Gerente',
  contacto_correo: 'alisson@metropolis.co',
  contacto_telefono: '3154568485',
  plan: 'premium',
  fecha_inicio_contrato: '2026-01-15',
  fecha_fin_contrato: '2027-01-14',
  ...e,
});

describe('PortalEmpresa', () => {
  let fixture: ComponentFixture<PortalEmpresa>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalEmpresa],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalEmpresa);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function cargar(e: EmpresaPortal = empresa()) {
    http.expectOne(URL).flush(e);
    fixture.detectChanges();
  }

  it('mientras carga muestra un indicador', () => {
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    cargar();
  });

  it('muestra los datos en tres bloques', () => {
    cargar();
    expect(el().querySelector('h4')?.textContent).toContain('Metropolis 21');
    for (const t of ['Empresa', 'Contacto principal', 'Contrato']) {
      expect(texto()).toContain(t);
    }
    for (const dato of ['800458575-2', 'Comercio', 'Pasto', 'Alisson Benavides', 'Gerente', 'Premium']) {
      expect(texto()).toContain(dato);
    }
  });

  it('las fechas del contrato no se corren un día', () => {
    cargar();
    expect(texto()).toContain('15/01/2026');
    expect(texto()).toContain('14/01/2027');
  });

  it('los correos son enlaces', () => {
    cargar();
    expect(el().querySelector('a[href="mailto:info@metropolis.co"]')).not.toBeNull();
    expect(el().querySelector('a[href="mailto:alisson@metropolis.co"]')).not.toBeNull();
  });

  it('los datos vacíos se muestran con una raya', () => {
    cargar(empresa({ sector: null, contacto_cargo: null, plan: null, fecha_fin_contrato: null }));
    expect(el().querySelectorAll('[data-vacio]').length).toBe(4);
  });

  it('ofrece abrir un ticket si algún dato está mal', () => {
    cargar();
    const enlace = el().querySelector('a[href="/portal/tickets/nuevo"]');
    expect(enlace?.textContent).toContain('Abre un ticket');
  });

  it('no ofrece editar', () => {
    cargar();
    expect(texto()).not.toContain('Editar');
    expect(el().querySelector('form')).toBeNull();
  });

  it('un error permite reintentar', () => {
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudieron cargar los datos de tu empresa.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    cargar();
    expect(texto()).toContain('Metropolis 21');
  });
});
