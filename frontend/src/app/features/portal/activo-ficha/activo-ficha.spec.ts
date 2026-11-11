import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { ActivoPortalDetalle, BackupPortal } from '../../../core/models/portal';
import { PortalActivoFicha } from './activo-ficha';

const URL = `${API_URL}/portal/activos/7/`;
const BACKUPS = `${API_URL}/portal/backups/`;

const activo = (a: Partial<ActivoPortalDetalle> = {}): ActivoPortalDetalle => ({
  id: 7,
  nombre: 'SRV-01',
  tipo: 'servidor',
  estado: 'operativo',
  ubicacion: 'Rack 2',
  ultimo_backup: { fecha: '2026-11-10T23:00:00-05:00', estado: 'exitoso' },
  fabricante: 'Dell',
  modelo: 'R740',
  sistema_operativo: 'Ubuntu 24.04',
  numero_serie: 'CN0ABC123',
  de_baja: false,
  fecha_baja: null,
  ...a,
});

const backup = (b: Partial<BackupPortal> = {}): BackupPortal => ({
  id: 3,
  activo: { id: 7, nombre: 'SRV-01' },
  tipo: 'completo',
  estado: 'exitoso',
  fecha: '2026-11-10T23:00:00-05:00',
  tamano_gb: '12.50',
  ...b,
});

const pagina = (results: object[], count = results.length) => ({ count, next: null, previous: null, results });

describe('PortalActivoFicha', () => {
  let fixture: ComponentFixture<PortalActivoFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalActivoFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
      ],
    });
    fixture = TestBed.createComponent(PortalActivoFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const historial = () => http.expectOne((r) => r.url === BACKUPS);
  function cargar(a: ActivoPortalDetalle = activo(), backups: object[] = [backup()], count?: number) {
    http.expectOne(URL).flush(a);
    fixture.detectChanges();
    const req = historial();
    expect(req.request.params.get('activo')).toBe('7');
    req.flush(pagina(backups, count));
    fixture.detectChanges();
  }

  it('mientras carga muestra un indicador', () => {
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    cargar();
  });

  it('muestra los datos del activo', () => {
    cargar();
    for (const dato of ['SRV-01', 'Servidor', 'Operativo', 'Rack 2', 'Dell', 'R740', 'Ubuntu 24.04', 'CN0ABC123']) {
      expect(texto()).toContain(dato);
    }
  });

  it('los datos vacíos se muestran con una raya', () => {
    cargar(activo({ fabricante: null, numero_serie: null }));
    expect(el().querySelectorAll('[data-vacio]').length).toBe(2);
  });

  it('muestra el historial de backups', () => {
    cargar();
    const fila = el().querySelector('[data-prueba="historial"] tbody tr')?.textContent ?? '';
    for (const dato of ['10/11/2026', 'Completo', 'Exitoso', '12.5']) {
      expect(fila).toContain(dato);
    }
  });

  it('sin backups lo dice', () => {
    cargar(activo(), []);
    expect(texto()).toContain('Este equipo aún no tiene backups registrados.');
  });

  it('pagina el historial', () => {
    cargar(activo(), [backup()], 45);
    (el().querySelector('[data-prueba="siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const req = historial();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([backup()], 45));
  });

  it('si falla el historial la ficha sigue visible y permite reintentar', () => {
    http.expectOne(URL).flush(activo());
    fixture.detectChanges();
    historial().flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('SRV-01');
    expect(texto()).toContain('No se pudo cargar el historial.');
    (el().querySelector('[data-prueba="historial"] .alert button') as HTMLButtonElement).click();
    historial().flush(pagina([backup()]));
    fixture.detectChanges();
    expect(texto()).toContain('Completo');
  });

  it('permite abrir un ticket sobre el equipo', () => {
    cargar();
    const enlace = el().querySelector('a[href="/portal/tickets/nuevo?activo=7"]');
    expect(enlace?.textContent).toContain('Abrir ticket sobre este equipo');
  });

  it('un activo dado de baja lo avisa y no ofrece abrir ticket', () => {
    cargar(activo({ de_baja: true, fecha_baja: '2026-10-01T10:00:00-05:00' }));
    expect(texto()).toContain('Este equipo está dado de baja');
    expect(el().querySelector('a[href="/portal/tickets/nuevo?activo=7"]')).toBeNull();
  });

  it('404 muestra no encontrado sin pedir el historial', () => {
    http.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Activo no encontrado');
    expect(el().querySelector('a[href="/portal/activos"]')).not.toBeNull();
    http.expectNone((r) => r.url === BACKUPS);
  });

  it('un error permite reintentar', () => {
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudo cargar el activo.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    cargar();
    expect(texto()).toContain('SRV-01');
  });

  it('no muestra IP, hostname ni notas', () => {
    cargar();
    for (const t of ['IP', 'Hostname', 'Notas']) {
      expect(texto()).not.toContain(t);
    }
  });
});
