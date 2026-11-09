import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { equipoGuard, portalGuard } from './portal.guard';

describe('guards del portal', () => {
  function evaluar(guard: typeof portalGuard, rol: string): string | true {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 1, username: 'u', nombre: 'U', rol }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    const r = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return r === true ? true : TestBed.inject(Router).serializeUrl(r as UrlTree);
  }

  afterEach(() => localStorage.clear());

  it('portalGuard deja pasar al cliente', () => {
    expect(evaluar(portalGuard, 'cliente')).toBeTrue();
  });

  it('portalGuard manda al admin a su panel', () => {
    expect(evaluar(portalGuard, 'admin')).toBe('/admin/dashboard');
  });

  it('portalGuard manda al técnico a su panel', () => {
    expect(evaluar(portalGuard, 'tecnico')).toBe('/admin/dashboard');
  });

  it('equipoGuard deja pasar al técnico', () => {
    expect(evaluar(equipoGuard, 'tecnico')).toBeTrue();
  });

  it('equipoGuard manda al cliente a su perfil del portal', () => {
    expect(evaluar(equipoGuard, 'cliente')).toBe('/portal/perfil');
  });
});
