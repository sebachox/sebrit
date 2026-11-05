import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { permisoGuard } from './permiso.guard';

function sesion(rol: string) {
  localStorage.setItem('sebrit.access', 'a1');
  localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 1, username: 'u', nombre: 'U', rol }));
}

describe('permisoGuard', () => {
  const ejecutar = () =>
    TestBed.runInInjectionContext(() =>
      permisoGuard('dashboard', 'ver')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  afterEach(() => localStorage.clear());

  function configurar() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  }

  it('manda al técnico a /sin-permiso', () => {
    sesion('tecnico');
    configurar();
    const r = ejecutar();
    expect(r instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/sin-permiso');
  });

  it('deja pasar al admin', () => {
    sesion('admin');
    configurar();
    expect(ejecutar()).toBeTrue();
  });
});
