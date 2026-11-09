import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const conteo = { total: 0, operativos: 0, advertencia: 0, criticos: 0 };
  const respuesta = (incidentes: object[]) => ({
    generado_en: '2026-11-08T10:00:00-05:00',
    resumen_operativo: { clientes_activos: 1, tickets_abiertos: 0, activos_criticos: 7, incidentes_criticos: 1 },
    incidentes,
    infraestructura: {
      servidores: conteo,
      redes: conteo,
      backups: { total: 0, exitosos: 0, fallidos: 0, pendientes: 0 },
      incidentes_criticos: { total: 1, abiertos: 1, en_progreso: 0, sin_tecnico: 1 },
    },
  });

  it('muestra activos críticos y ya no muestra mantenimientos', () => {
    http.expectOne(`${API_URL}/dashboard/admin/`).flush(respuesta([]));
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Activos críticos');
    expect(texto).not.toContain('Mantenimientos');
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector('a[href="/admin/activos?estado=critico"]');
    expect(tarjeta?.textContent).toContain('7');
  });

  it('cada tarjeta enlaza a su módulo', () => {
    http.expectOne(`${API_URL}/dashboard/admin/`).flush(respuesta([]));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="/admin/clientes"]')?.textContent).toContain('Clientes activos');
    expect(el.querySelector('a[href="/admin/tickets"]')?.textContent).toContain('Tickets abiertos');
    expect(el.querySelector('a[href="/admin/incidentes?severidad=critica"]')?.textContent).toContain('Incidentes críticos');
  });

  it('el código de un incidente abre su ficha', () => {
    http.expectOne(`${API_URL}/dashboard/admin/`).flush(respuesta([
        {
          id: 12,
          codigo: 'INC-0012',
          titulo: 'Caída',
          empresa: { id: 1, nombre: 'Org' },
          severidad: 'critica',
          estado: 'abierto',
          tecnico_asignado: null,
          ultima_accion: null,
        },
    ]));
    fixture.detectChanges();
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('a[href="/admin/incidentes/12"]');
    expect(enlace?.textContent).toContain('INC-0012');
  });
});
