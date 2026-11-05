import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  it('el botón principal cierra la sesión', () => {
    const salir = spyOn(auth, 'logout');
    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button.btn-primary',
    );
    boton!.click();
    expect(salir).toHaveBeenCalled();
  });
});
