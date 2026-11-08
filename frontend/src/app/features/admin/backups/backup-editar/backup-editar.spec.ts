import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { Backup } from '../../../../core/models/backup';
import { BackupForm } from '../backup-form/backup-form';
import { BackupEditar } from './backup-editar';

const backup: Backup = {
  id: 5,
  activo: { id: 7, nombre: 'SRV-01' },
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  fecha: '2026-11-05T10:30:00-05:00',
  estado: 'fallido',
  tipo: 'completo',
  tamano_gb: null,
  notas: null,
  registrado_por: null,
  creado_en: '2026-11-05T10:30:00-05:00',
};

describe('BackupEditar', () => {
  let fixture: ComponentFixture<BackupEditar>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BackupEditar],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    fixture = TestBed.createComponent(BackupEditar);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('carga el backup y al guardar vuelve a la lista', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    http.expectOne(`${API_URL}/backups/5/`).flush(backup);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('SRV-01');
    const form = fixture.debugElement.query(By.directive(BackupForm));
    (form.componentInstance as BackupForm).guardado.emit(backup);
    expect(navegar).toHaveBeenCalledWith(['/admin/backups']);
  });

  it('un 404 muestra que el backup no existe', () => {
    http.expectOne(`${API_URL}/backups/5/`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backup no encontrado');
  });
});
