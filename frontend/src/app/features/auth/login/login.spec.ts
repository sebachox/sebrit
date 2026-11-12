import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('no envía el formulario vacío', () => {
    component.ingresar();
    http.expectNone(`${API_URL}/auth/login/`);
    expect(component.invalido('username')).toBeTrue();
  });

  it('muestra error con credenciales incorrectas', () => {
    component.form.setValue({ username: 'admin', password: 'mala' });
    component.ingresar();
    http
      .expectOne(`${API_URL}/auth/login/`)
      .flush({ detail: 'No active account' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.error()).toContain('Credenciales incorrectas');
    expect(component.enviando()).toBeFalse();
  });

  it('ante demasiados intentos muestra el aviso del servidor', () => {
    component.form.setValue({ username: 'admin', password: 'mala' });
    component.ingresar();
    http
      .expectOne(`${API_URL}/auth/login/`)
      .flush(
        { detail: 'Demasiados intentos. Espera 42 segundos e intenta de nuevo.' },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(component.error()).toBe('Demasiados intentos. Espera 42 segundos e intenta de nuevo.');
    expect(component.enviando()).toBeFalse();
  });

  it('un 429 sin detalle usa un aviso propio', () => {
    component.form.setValue({ username: 'admin', password: 'mala' });
    component.ingresar();
    http.expectOne(`${API_URL}/auth/login/`).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(component.error()).toBe('Demasiados intentos. Espera un minuto e intenta de nuevo.');
  });
});
