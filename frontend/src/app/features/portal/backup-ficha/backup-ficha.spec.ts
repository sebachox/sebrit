import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { BackupPortal } from '../../../core/models/portal';
import { PortalBackupFicha } from './backup-ficha';

const URL = `${API_URL}/portal/backups/3/`;

const backup = (b: Partial<BackupPortal> = {}): BackupPortal => ({
  id: 3,
  activo: { id: 7, nombre: 'SRV-01' },
  tipo: 'completo',
  estado: 'exitoso',
  fecha: '2026-11-10T23:00:00-05:00',
  tamano_gb: '12.50',
  ...b,
});

describe('PortalBackupFicha', () => {
  let fixture: ComponentFixture<PortalBackupFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalBackupFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3' }) } } },
      ],
    });
    fixture = TestBed.createComponent(PortalBackupFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function cargar(b: BackupPortal = backup()) {
    http.expectOne(URL).flush(b);
    fixture.detectChanges();
  }

  it('mientras carga muestra un indicador', () => {
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    cargar();
  });

  it('muestra los datos del backup', () => {
    cargar();
    for (const dato of ['10/11/2026 23:00', 'Completo', 'Exitoso', '12.5 GB']) {
      expect(texto()).toContain(dato);
    }
    expect(el().querySelector('a[href="/portal/activos/7"]')?.textContent).toContain('SRV-01');
  });

  it('sin activo, tipo ni tamaño lo muestra sin enlace', () => {
    cargar(backup({ activo: null, tipo: null, tamano_gb: null }));
    expect(texto()).toContain('Sin activo');
    expect(el().querySelector('a[href^="/portal/activos/"]')).toBeNull();
    expect(el().querySelectorAll('[data-vacio]').length).toBe(2);
  });

  it('404 muestra no encontrado con enlace a la lista', () => {
    http.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Backup no encontrado');
    expect(el().querySelector('a[href="/portal/backups"]')).not.toBeNull();
  });

  it('un error permite reintentar', () => {
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudo cargar el backup.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    cargar();
    expect(texto()).toContain('SRV-01');
  });

  it('no muestra notas ni quién lo registró', () => {
    cargar();
    expect(texto()).not.toContain('Notas');
    expect(texto()).not.toContain('Registrado por');
  });
});
