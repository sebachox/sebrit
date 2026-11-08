import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { Backup } from '../../../../core/models/backup';
import { BackupsLista } from './backups-lista';

const BACKUPS = `${API_URL}/backups/`;
const ORGS = `${API_URL}/organizaciones/`;

const backup = (b: Partial<Backup> = {}): Backup => ({
  id: 5,
  activo: { id: 7, nombre: 'SRV-01' },
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  fecha: '2026-11-05T10:30:00-05:00',
  estado: 'fallido',
  tipo: 'completo',
  tamano_gb: 12.5,
  notas: null,
  registrado_por: { id: 2, nombre: 'Laura Gómez' },
  creado_en: '2026-11-05T10:30:00-05:00',
  ...b,
});

const pagina = (results: Backup[]) => ({ count: results.length, next: null, previous: null, results });

describe('BackupsLista', () => {
  let fixture: ComponentFixture<BackupsLista>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto))!;

  function crear() {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 2, username: 't', nombre: 'T', rol: 'tecnico' }));
    TestBed.configureTestingModule({
      imports: [BackupsLista],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(BackupsLista);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === ORGS).flush(pagina([]));
  }

  const responder = (cuerpo: object, opciones?: { status: number; statusText: string }) => {
    http.expectOne((r) => r.url === BACKUPS).flush(cuerpo, opciones);
    fixture.detectChanges();
  };

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los backups con enlace al activo, sin parámetros por defecto', () => {
    crear();
    const req = http.expectOne((r) => r.url === BACKUPS);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(pagina([backup()]));
    fixture.detectChanges();
    expect(el().querySelector('a[href="/admin/activos/7"]')?.textContent).toContain('SRV-01');
    expect(el().querySelector('tbody')?.textContent).toContain('Fallido');
  });

  it('el filtro de fechas envía desde y hasta', () => {
    crear();
    responder(pagina([backup()]));
    fixture.componentInstance.cambiarDesde('2026-11-01');
    responder(pagina([]));
    fixture.componentInstance.cambiarHasta('2026-11-06');
    const req = http.expectOne((r) => r.url === BACKUPS);
    expect([req.request.params.get('desde'), req.request.params.get('hasta')]).toEqual(['2026-11-01', '2026-11-06']);
    req.flush(pagina([]));
  });

  it('borrar pide confirmación en la fila, borra y recarga', () => {
    crear();
    responder(pagina([backup()]));
    boton('Borrar').click();
    fixture.detectChanges();
    http.expectNone((r) => r.method === 'DELETE');
    boton('Sí, borrar').click();
    const req = http.expectOne(`${BACKUPS}5/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    responder(pagina([]));
    expect(el().textContent).toContain('Aún no hay backups registrados');
  });

  it('un error muestra Reintentar', () => {
    crear();
    responder({}, { status: 500, statusText: 'Error' });
    expect(boton('Reintentar')).toBeDefined();
  });
});
