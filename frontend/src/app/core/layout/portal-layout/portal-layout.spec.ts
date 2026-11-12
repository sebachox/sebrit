import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../config/api';
import { AuthService } from '../../services/auth.service';
import { PortalLayout } from './portal-layout';

const RESUMEN = `${API_URL}/portal/resumen/`;

describe('PortalLayout', () => {
  let fixture: ComponentFixture<PortalLayout>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem(
      'sebrit.usuario',
      JSON.stringify({ id: 1, username: 'ana', nombre: 'Ana Ríos', rol: 'cliente' }),
    );
    TestBed.configureTestingModule({
      imports: [PortalLayout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PortalLayout);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  const conEmpresa = () => {
    http.expectOne(RESUMEN).flush({ empresa: { id: 1, nombre: 'Metropolis 21' } });
    fixture.detectChanges();
  };

  it('muestra la navegación del portal', () => {
    conEmpresa();
    expect(el().querySelector('.nav-link[href="/portal/inicio"]')?.textContent).toContain('Inicio');
    expect(el().querySelector('a[href="/portal/tickets"]')?.textContent).toContain('Mis tickets');
  });

  it('enlaza a activos, backups y mi empresa', () => {
    conEmpresa();
    expect(el().querySelector('.nav-link[href="/portal/activos"]')?.textContent).toContain('Mis activos');
    expect(el().querySelector('.nav-link[href="/portal/backups"]')?.textContent).toContain('Backups');
    expect(el().querySelector('.nav-link[href="/portal/empresa"]')?.textContent).toContain('Mi empresa');
    expect(el().querySelector('.nav-link[href="/portal/incidentes"]')?.textContent).toContain('Incidentes');
  });

  it('muestra el nombre de la empresa', () => {
    conEmpresa();
    expect(el().querySelector('.navbar')?.textContent).toContain('Metropolis 21');
  });

  it('el nombre del usuario abre Mi perfil del portal', () => {
    conEmpresa();
    const perfil = el().querySelector('a[href="/portal/perfil"]');
    expect(perfil?.textContent).toContain('Ana Ríos');
    expect(perfil?.getAttribute('aria-label')).toBe('Mi perfil');
  });

  it('tiene selector de tema', () => {
    conEmpresa();
    expect(el().querySelector('app-selector-tema')).not.toBeNull();
  });

  it('Salir cierra la sesión', () => {
    conEmpresa();
    const logout = spyOn(TestBed.inject(AuthService), 'logout');
    (el().querySelector('[data-prueba="salir"]') as HTMLButtonElement).click();
    expect(logout).toHaveBeenCalled();
  });

  it('si falla el resumen sigue mostrando la navegación', () => {
    http.expectOne(RESUMEN).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().querySelector('a[href="/portal/tickets"]')).not.toBeNull();
  });

  it('en móvil el botón abre y cierra el menú', () => {
    conEmpresa();
    const boton = el().querySelector('[data-prueba="menu"]') as HTMLButtonElement;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('.navbar-collapse')!.classList).toContain('show');
  });

  it('elegir una sección cierra el menú móvil', () => {
    conEmpresa();
    (el().querySelector('[data-prueba="menu"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el().querySelector('a[href="/portal/tickets"]') as HTMLAnchorElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.navbar-collapse')!.classList).not.toContain('show');
  });
});
