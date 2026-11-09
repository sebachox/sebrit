import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SinPermiso } from './sin-permiso';

describe('SinPermiso', () => {
  let fixture: ComponentFixture<SinPermiso>;
  let auth: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem(
      'sebrit.usuario',
      JSON.stringify({ id: 2, username: 'tec', nombre: 'Laura Gómez', rol: 'tecnico' }),
    );

    await TestBed.configureTestingModule({
      imports: [SinPermiso],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(SinPermiso);
    auth = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('muestra con qué usuario se inició sesión', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Laura Gómez');
  });

  it('"Ingresar con otra cuenta" cierra la sesión', () => {
    const salir = spyOn(auth, 'logout');
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Ingresar con otra cuenta'));
    boton!.click();
    expect(salir).toHaveBeenCalled();
  });

  it('el técnico puede volver a su panel', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const volver = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Volver a mi panel'));
    expect(volver).toBeDefined();
    volver!.click();
    expect(navegar).toHaveBeenCalledWith('/admin/dashboard');
  });
});

describe('SinPermiso para un cliente', () => {
  it('le explica que el portal no está disponible', () => {
    const fixture = TestBed.createComponent(SinPermiso);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Tu acceso al portal no está disponible.');
    expect(texto).not.toContain('solo está disponible para administradores');
  });

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem(
      'sebrit.usuario',
      JSON.stringify({ id: 3, username: 'cli', nombre: 'Cliente', rol: 'cliente' }),
    );
    await TestBed.configureTestingModule({
      imports: [SinPermiso],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('no ofrece volver a un panel que no tiene', () => {
    const fixture = TestBed.createComponent(SinPermiso);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Volver a mi panel');
  });
});
