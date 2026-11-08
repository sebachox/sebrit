import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { Activo } from '../../../../core/models/activo';
import { Backup } from '../../../../core/models/backup';
import { BackupForm } from '../../backups/backup-form/backup-form';
import { ActivoFicha } from './activo-ficha';

const URL = `${API_URL}/activos/7/`;
const BACKUPS = `${API_URL}/backups/`;

const activo = (a: Partial<Activo> = {}): Activo => ({
  id: 7,
  nombre: 'SRV-DB-01',
  tipo: 'servidor',
  estado: 'operativo',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  ip: '10.0.0.5',
  hostname: null,
  ubicacion: null,
  de_baja: false,
  ultimo_backup: null,
  sistema_operativo: null,
  fabricante: 'Dell',
  modelo: null,
  numero_serie: null,
  notas: null,
  fecha_baja: null,
  creado_en: '2026-11-05T10:00:00-05:00',
  actualizado_en: '2026-11-05T10:00:00-05:00',
  resumen_backups: { total: 0, exitosos: 0, fallidos: 0, pendientes: 0 },
  ...a,
});

const sinBackups = { count: 0, next: null, previous: null, results: [] as Backup[] };

describe('ActivoFicha', () => {
  let fixture: ComponentFixture<ActivoFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto))!;

  function crear(a: Activo | null = activo(), query: Record<string, string> = {}) {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 2, username: 't', nombre: 'T', rol: 'tecnico' }));
    TestBed.configureTestingModule({
      imports: [ActivoFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: '7' }), queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ActivoFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    if (a) {
      http.expectOne(URL).flush(a);
      http.expectOne((r) => r.url === BACKUPS && r.params.get('activo') === '7').flush(sinBackups);
    } else {
      http.expectOne(URL).flush({ detail: 'No encontrado' }, { status: 404, statusText: 'Not Found' });
    }
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra datos, enlace al cliente y "—" para lo vacío', () => {
    crear();
    expect(el().textContent).toContain('SRV-DB-01');
    expect(el().querySelector('a[href="/admin/clientes/4"]')).not.toBeNull();
    expect(el().querySelector('[data-campo="hostname"]')?.textContent?.trim()).toBe('—');
    expect(el().querySelector('[data-campo="fabricante"]')?.textContent?.trim()).toBe('Dell');
  });

  it('cambiar a Crítico envía el estado y actualiza el badge', () => {
    crear();
    boton('Crítico').click();
    const req = http.expectOne(URL);
    expect([req.request.method, req.request.body]).toEqual(['PATCH', { estado: 'critico' }]);
    req.flush(activo({ estado: 'critico' }));
    fixture.detectChanges();
    expect(el().querySelector('.encabezado')?.textContent).toContain('Crítico');
  });

  it('dar de baja pide confirmación', () => {
    crear();
    boton('Dar de baja').click();
    fixture.detectChanges();
    http.expectNone(URL);
    boton('Sí, dar de baja').click();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ de_baja: true });
    req.flush(activo({ de_baja: true, fecha_baja: '2026-11-06T10:00:00-05:00' }));
  });

  it('dado de baja: aviso visible, acciones deshabilitadas y Reactivar habilitado', () => {
    crear(activo({ de_baja: true, fecha_baja: '2026-11-06T10:00:00-05:00' }));
    expect(el().textContent).toContain('Este activo está dado de baja');
    expect(boton('Crítico').disabled).toBeTrue();
    expect(boton('Registrar backup').disabled).toBeTrue();
    expect(boton('Reactivar').disabled).toBeFalse();
  });

  it('registrar backup abre el formulario y al guardar recarga activo e historial', () => {
    crear();
    boton('Registrar backup').click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(BackupForm));
    expect(form).not.toBeNull();
    (form.componentInstance as BackupForm).guardado.emit({} as Backup);
    fixture.detectChanges();
    http.expectOne(URL).flush(activo({ resumen_backups: { total: 1, exitosos: 1, fallidos: 0, pendientes: 0 } }));
    http.expectOne((r) => r.url === BACKUPS).flush(sinBackups);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(BackupForm))).toBeNull();
  });

  it('un 404 muestra que el activo no existe', () => {
    crear(null);
    expect(el().textContent).toContain('Activo no encontrado');
  });

  it('con ?guardado=1 muestra el mensaje de éxito', () => {
    crear(activo(), { guardado: '1' });
    expect(el().querySelector('.alert-success')?.textContent).toContain('Activo guardado correctamente.');
  });
});
