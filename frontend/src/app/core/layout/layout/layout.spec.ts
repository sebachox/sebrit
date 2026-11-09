import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Layout } from './layout';

function crear(rol: string): ComponentFixture<Layout> {
  localStorage.setItem('sebrit.access', 'a1');
  localStorage.setItem(
    'sebrit.usuario',
    JSON.stringify({ id: 1, username: 'u', nombre: 'Laura Gómez', rol }),
  );
  TestBed.configureTestingModule({
    imports: [Layout],
    providers: [provideRouter([]), provideHttpClient()],
  });
  const fixture = TestBed.createComponent(Layout);
  fixture.detectChanges();
  return fixture;
}

function enlace(fixture: ComponentFixture<Layout>, texto: string): HTMLElement {
  const items = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.sidebar .nav-link'),
  );
  return items.find((e) => e.textContent?.includes(texto))!;
}

describe('Layout', () => {
  afterEach(() => localStorage.clear());

  it('para el técnico, Dashboard y Clientes están habilitados', () => {
    const fixture = crear('tecnico');
    expect(enlace(fixture, 'Dashboard').getAttribute('href')).toBe('/admin/dashboard');
    expect(enlace(fixture, 'Clientes').getAttribute('href')).toBe('/admin/clientes');
  });

  it('Incidentes aparece después de Tickets', () => {
    const fixture = crear('tecnico');
    const textos = fixture.componentInstance.enlaces.map((e) => e.texto);
    expect(textos.indexOf('Incidentes')).toBe(textos.indexOf('Tickets') + 1);
    expect(enlace(fixture, 'Incidentes').getAttribute('href')).toBe('/admin/incidentes');
  });

  it('un módulo sin permiso aparece bloqueado y sin enlace', () => {
    const fixture = crear('cliente');
    const dashboard = enlace(fixture, 'Dashboard');
    expect(dashboard.getAttribute('aria-disabled')).toBe('true');
    expect(dashboard.hasAttribute('href')).toBeFalse();
  });

  it('para el admin, todo está habilitado', () => {
    const fixture = crear('admin');
    expect(enlace(fixture, 'Dashboard').getAttribute('href')).toBe('/admin/dashboard');
    expect(enlace(fixture, 'Dashboard').getAttribute('aria-disabled')).toBeNull();
  });

  it('el navbar dice Panel técnico para el técnico', () => {
    const fixture = crear('tecnico');
    expect((fixture.nativeElement as HTMLElement).querySelector('.navbar')?.textContent).toContain(
      'Panel técnico',
    );
  });

  it('el navbar muestra el nombre y el rol', () => {
    const fixture = crear('tecnico');
    const navbar = (fixture.nativeElement as HTMLElement).querySelector('.navbar')?.textContent;
    expect(navbar).toContain('Laura Gómez');
    expect(navbar).toContain('Técnico');
  });
});
