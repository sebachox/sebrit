import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { BackupPortal } from '../../../core/models/portal';
import { PortalBackupsLista } from './backups-lista';

const BACKUPS = `${API_URL}/portal/backups/`;
const ACTIVOS = `${API_URL}/portal/activos/`;

const backup = (b: Partial<BackupPortal> = {}): BackupPortal => ({
  id: 3,
  activo: { id: 7, nombre: 'SRV-01' },
  tipo: 'completo',
  estado: 'fallido',
  fecha: '2026-11-10T23:00:00-05:00',
  tamano_gb: '12.50',
  ...b,
});

const pagina = (results: object[], count = results.length) => ({ count, next: null, previous: null, results });
const activos = pagina([{ id: 7, nombre: 'SRV-01', tipo: 'servidor', estado: 'operativo', ubicacion: null, ultimo_backup: null }]);

describe('PortalBackupsLista', () => {
  let fixture: ComponentFixture<PortalBackupsLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortalBackupsLista],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalBackupsLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const peticion = () => http.expectOne((r) => r.url === BACKUPS);
  const conActivos = (respuesta: object = activos, error = false) => {
    const req = http.expectOne((r) => r.url === ACTIVOS);
    expect(req.request.params.get('page_size')).toBe('100');
    if (error) req.flush({}, { status: 500, statusText: 'Error' });
    else req.flush(respuesta);
  };
  function cargar(results: object[] = [backup()], count?: number) {
    conActivos();
    peticion().flush(pagina(results, count));
    fixture.detectChanges();
  }
  const cambiar = (id: string, valor: string) => {
    const c = el().querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
    c.value = valor;
    c.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('muestra cada backup con su activo, tipo, estado y tamaño', () => {
    cargar();
    expect(el().querySelector('a[href="/portal/activos/7"]')?.textContent).toContain('SRV-01');
    const fila = el().querySelector('tbody tr')?.textContent ?? '';
    for (const dato of ['10/11/2026', 'Completo', 'Fallido', '12.5']) {
      expect(fila).toContain(dato);
    }
  });

  it('tocar cualquier parte de la fila abre el backup', () => {
    cargar();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    (el().querySelector('tbody tr td:nth-child(4)') as HTMLElement).click();
    expect(navegar).toHaveBeenCalledWith(['/portal/backups', 3]);
  });

  it('el enlace al activo no abre el backup', () => {
    cargar();
    const navegar = spyOn(TestBed.inject(Router), 'navigate');
    (el().querySelector('tbody tr a') as HTMLElement).click();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('tipo y tamaño vacíos se muestran con una raya', () => {
    cargar([backup({ tipo: null, tamano_gb: null })]);
    expect(el().querySelectorAll('tbody [data-vacio]').length).toBe(2);
  });

  it('un backup antiguo sin activo se muestra sin enlace y no corta la tabla', () => {
    cargar([backup({ id: 1, activo: null }), backup({ id: 2 })]);
    const filas = el().querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Sin activo');
    expect(filas[0].querySelector('a[href^="/portal/activos/"]')).toBeNull();
    expect(filas[1].querySelector('a[href="/portal/activos/7"]')).not.toBeNull();
  });

  it('filtra por estado, tipo, activo y fechas', () => {
    cargar();
    const casos: [string, string, string][] = [
      ['estado', 'fallido', 'estado'],
      ['tipo', 'incremental', 'tipo'],
      ['activo', '7', 'activo'],
      ['desde', '2026-11-01', 'desde'],
      ['hasta', '2026-11-30', 'hasta'],
    ];
    for (const [id, valor, param] of casos) {
      cambiar(id, valor);
      const req = peticion();
      expect(req.request.params.get(param)).withContext(id).toBe(valor);
      req.flush(pagina([backup()]));
      fixture.detectChanges();
    }
  });

  it('si fallan los activos no muestra ese filtro', () => {
    conActivos(activos, true);
    peticion().flush(pagina([backup()]));
    fixture.detectChanges();
    expect(el().querySelector('#activo')).toBeNull();
    expect(el().querySelector('#estado')).not.toBeNull();
  });

  it('pagina', () => {
    cargar([backup()], 45);
    expect(el().textContent).toContain('1–1 de 45');
    (el().querySelector('[data-prueba="siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const req = peticion();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([backup()], 45));
  });

  it('sin backups lo dice', () => {
    cargar([]);
    expect(el().textContent).toContain('Aún no hay backups registrados.');
  });

  it('sin resultados con filtros lo dice', () => {
    cargar();
    cambiar('estado', 'pendiente');
    peticion().flush(pagina([]));
    fixture.detectChanges();
    expect(el().textContent).toContain('Sin resultados');
  });

  it('un error permite reintentar', () => {
    conActivos();
    peticion().flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudieron cargar los backups.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    peticion().flush(pagina([backup()]));
    fixture.detectChanges();
    expect(el().textContent).toContain('SRV-01');
  });

  it('no muestra notas ni quién lo registró', () => {
    cargar();
    expect(el().textContent).not.toContain('Notas');
    expect(el().textContent).not.toContain('Registrado por');
  });
});
