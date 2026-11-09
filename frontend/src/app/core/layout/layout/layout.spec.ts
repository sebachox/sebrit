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

  describe('barra plegable', () => {
    const el = (f: ComponentFixture<Layout>) => f.nativeElement as HTMLElement;
    const boton = (f: ComponentFixture<Layout>) =>
      el(f).querySelector<HTMLButtonElement>('[data-prueba="plegar"]')!;

    it('empieza expandida y el botón lo anuncia', () => {
      const f = crear('admin');
      expect(el(f).querySelector('.sidebar')!.classList).not.toContain('plegada');
      expect(boton(f).getAttribute('aria-expanded')).toBe('true');
      expect(boton(f).getAttribute('aria-label')).toBe('Contraer menú');
    });

    it('al pulsar se pliega y recuerda la elección', () => {
      const f = crear('admin');
      boton(f).click();
      f.detectChanges();
      expect(el(f).querySelector('.sidebar')!.classList).toContain('plegada');
      expect(boton(f).getAttribute('aria-expanded')).toBe('false');
      expect(boton(f).getAttribute('aria-label')).toBe('Expandir menú');
      expect(localStorage.getItem('sebrit.sidebar')).toBe('plegado');
    });

    it('al pulsar otra vez se expande', () => {
      const f = crear('admin');
      boton(f).click();
      boton(f).click();
      f.detectChanges();
      expect(el(f).querySelector('.sidebar')!.classList).not.toContain('plegada');
      expect(localStorage.getItem('sebrit.sidebar')).toBe('expandido');
    });

    it('arranca plegada si así quedó', () => {
      localStorage.setItem('sebrit.sidebar', 'plegado');
      const f = crear('admin');
      expect(el(f).querySelector('.sidebar')!.classList).toContain('plegada');
    });

    it('plegada, cada enlace muestra su nombre al pasar el mouse', () => {
      localStorage.setItem('sebrit.sidebar', 'plegado');
      const f = crear('admin');
      expect(enlace(f, 'Tickets').getAttribute('title')).toBe('Tickets');
    });

    it('expandida, los enlaces no llevan título', () => {
      const f = crear('admin');
      expect(enlace(f, 'Tickets').hasAttribute('title')).toBeFalse();
    });

    it('plegada, un módulo bloqueado conserva el aviso', () => {
      localStorage.setItem('sebrit.sidebar', 'plegado');
      const f = crear('cliente');
      expect(enlace(f, 'Dashboard').getAttribute('title')).toBe('Dashboard: solo administradores');
    });
  });

  it('el nombre del navbar abre Mi perfil', () => {
    const fixture = crear('tecnico');
    const perfil = (fixture.nativeElement as HTMLElement).querySelector('.navbar a[href="/admin/perfil"]');
    expect(perfil?.textContent).toContain('Laura Gómez');
    expect(perfil?.getAttribute('aria-label')).toBe('Mi perfil');
  });

  it('el navbar muestra el nombre y el rol', () => {
    const fixture = crear('tecnico');
    const navbar = (fixture.nativeElement as HTMLElement).querySelector('.navbar')?.textContent;
    expect(navbar).toContain('Laura Gómez');
    expect(navbar).toContain('Técnico');
  });
});
