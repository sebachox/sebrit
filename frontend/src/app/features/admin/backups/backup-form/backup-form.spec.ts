import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_URL } from '../../../../core/config/api';
import { Backup } from '../../../../core/models/backup';
import { BackupForm } from './backup-form';

const BASE = `${API_URL}/backups/`;

const backup: Backup = {
  id: 5,
  activo: { id: 7, nombre: 'SRV-01' },
  organizacion: { id: 1, nombre: 'Org' },
  fecha: '2026-11-05T10:30:00-05:00',
  estado: 'exitoso',
  tipo: 'completo',
  tamano_gb: 12.5,
  notas: null,
  registrado_por: null,
  creado_en: '2026-11-05T10:30:00-05:00',
};

describe('BackupForm', () => {
  let fixture: ComponentFixture<BackupForm>;
  let component: BackupForm;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear(entradas: { activoId?: number; backup?: Backup } = {}) {
    TestBed.configureTestingModule({
      imports: [BackupForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(BackupForm);
    component = fixture.componentInstance;
    if (entradas.activoId) fixture.componentRef.setInput('activoId', entradas.activoId);
    if (entradas.backup) fixture.componentRef.setInput('backup', entradas.backup);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  const enviar = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  afterEach(() => http.verify());

  it('registra con el activo fijo y emite guardado', () => {
    crear({ activoId: 7 });
    const emitidos: Backup[] = [];
    component.guardado.subscribe((b) => emitidos.push(b));
    component.form.patchValue({ estado: 'exitoso', tipo: 'incremental', tamano_gb: '20' });
    enviar();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.activo).toBe(7);
    expect(req.request.body.tamano_gb).toBe(20);
    expect(req.request.body.fecha).toMatch(/Z$/);
    req.flush(backup);
    expect(emitidos.length).toBe(1);
  });

  it('el tamaño escrito en el campo (número del navegador) se envía como número', () => {
    crear({ activoId: 7 });
    component.form.patchValue({ tipo: 'completo' });
    const input = el().querySelector<HTMLInputElement>('#bk-tamano')!;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    enviar();
    const req = http.expectOne(BASE);
    expect(req.request.body.tamano_gb).toBe(20);
    req.flush(backup);
  });

  it('si se borra el tamaño se envía null', () => {
    crear({ backup });
    const input = el().querySelector<HTMLInputElement>('#bk-tamano')!;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    enviar();
    const req = http.expectOne(`${BASE}5/`);
    expect(req.request.body.tamano_gb).toBeNull();
    req.flush(backup);
  });

  it('no envía una fecha futura', () => {
    crear({ activoId: 7 });
    const futuro = new Date(Date.now() + 2 * 60 * 60 * 1000);
    component.form.patchValue({ tipo: 'completo', fecha: component.aLocal(futuro.toISOString()) });
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.fecha.hasError('futura')).toBeTrue();
  });

  it('no envía un tamaño negativo', () => {
    crear({ activoId: 7 });
    component.form.patchValue({ tipo: 'completo', tamano_gb: '-1' });
    enviar();
    http.expectNone(BASE);
    expect(component.form.controls.tamano_gb.invalid).toBeTrue();
  });

  it('muestra bajo el campo el error del servidor', () => {
    crear({ activoId: 7 });
    component.form.patchValue({ tipo: 'completo' });
    enviar();
    http
      .expectOne(BASE)
      .flush({ fecha: ['La fecha del backup no puede ser futura.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('#bk-fecha')?.parentElement?.textContent).toContain(
      'La fecha del backup no puede ser futura.',
    );
  });

  it('en edición carga los datos y envía PATCH', () => {
    crear({ backup });
    expect(component.form.controls.tipo.value).toBe('completo');
    enviar();
    const req = http.expectOne(`${BASE}5/`);
    expect(req.request.method).toBe('PATCH');
    req.flush(backup);
  });

  it('un doble envío produce una sola petición', () => {
    crear({ activoId: 7 });
    component.form.patchValue({ tipo: 'completo' });
    enviar();
    enviar();
    http.expectOne(BASE).flush(backup);
  });
});
