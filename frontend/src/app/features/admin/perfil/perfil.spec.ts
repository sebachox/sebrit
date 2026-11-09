import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../core/config/api';
import { Perfil } from '../../../core/models/perfil';
import { AuthService } from '../../../core/services/auth.service';
import { PerfilPagina } from './perfil';

const URL = `${API_URL}/auth/perfil/`;
const CLAVE = `${URL}clave/`;

const perfil = (cambios: Partial<Perfil> = {}): Perfil => ({
  id: 1,
  username: 'laura',
  nombres: 'Laura',
  apellidos: 'Gómez',
  nombre_completo: 'Laura Gómez',
  correo: 'laura@ejemplo.com',
  rol: 'tecnico',
  organizacion: null,
  ...cambios,
});

describe('PerfilPagina', () => {
  let fixture: ComponentFixture<PerfilPagina>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function crear() {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem(
      'sebrit.usuario',
      JSON.stringify({ id: 1, username: 'laura', nombre: 'Laura Gómez', rol: 'tecnico' }),
    );
    TestBed.configureTestingModule({
      imports: [PerfilPagina],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PerfilPagina);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  function cargar(p: Perfil = perfil()) {
    crear();
    http.expectOne(URL).flush(p);
    fixture.detectChanges();
  }

  const valor = (id: string) => (el().querySelector(`#${id}`) as HTMLInputElement).value;

  function escribir(id: string, texto: string) {
    const i = el().querySelector(`#${id}`) as HTMLInputElement;
    i.value = texto;
    i.dispatchEvent(new Event('input'));
    i.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function enviar(id: string) {
    (el().querySelector(`#${id}`) as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('mientras carga muestra un indicador', () => {
    crear();
    expect(el().querySelector('.spinner-border')).not.toBeNull();
    http.expectOne(URL).flush(perfil());
  });

  it('un error de carga permite reintentar', () => {
    crear();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cargar tu perfil.');
    (el().querySelector('.alert button') as HTMLButtonElement).click();
    http.expectOne(URL).flush(perfil());
    fixture.detectChanges();
    expect(valor('nombres')).toBe('Laura');
  });

  it('muestra usuario, rol y organización como solo lectura', () => {
    cargar(perfil({ organizacion: { id: 4, nombre: 'Metropolis 21' } }));
    const lectura = el().querySelector('[data-prueba="solo-lectura"]')!;
    expect(lectura.textContent).toContain('laura');
    expect(lectura.textContent).toContain('Técnico');
    expect(lectura.textContent).toContain('Metropolis 21');
    expect(el().querySelector('input#username')).toBeNull();
  });

  it('sin organización muestra una raya y los nulos quedan vacíos', () => {
    cargar(perfil({ nombres: null, apellidos: null, correo: null, nombre_completo: 'laura' }));
    expect(el().querySelector('[data-prueba="solo-lectura"]')!.textContent).toContain('—');
    expect(valor('nombres')).toBe('');
    expect(valor('correo')).toBe('');
  });

  it('guardar envía los datos y actualiza el nombre del navbar', () => {
    cargar();
    escribir('nombres', ' Ana ');
    escribir('apellidos', 'Ruiz');
    escribir('correo', '');
    enviar('form-datos');
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ nombres: 'Ana', apellidos: 'Ruiz', correo: null });
    req.flush(perfil({ nombres: 'Ana', apellidos: 'Ruiz', correo: null, nombre_completo: 'Ana Ruiz' }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Datos guardados.');
    expect(TestBed.inject(AuthService).usuario()?.nombre).toBe('Ana Ruiz');
    expect(JSON.parse(localStorage.getItem('sebrit.usuario')!).nombre).toBe('Ana Ruiz');
  });

  it('un correo inválido no se envía', () => {
    cargar();
    escribir('correo', 'no-es-correo');
    enviar('form-datos');
    http.expectNone(URL);
    expect(el().textContent).toContain('Escribe un correo válido.');
  });

  it('un error 400 del servidor aparece en su campo', () => {
    cargar();
    enviar('form-datos');
    http.expectOne(URL).flush({ correo: ['Correo rechazado.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().querySelector('#correo')!.classList).toContain('is-invalid');
    expect(el().textContent).toContain('Correo rechazado.');
  });

  it('si falla el guardado avisa y no toca el nombre', () => {
    cargar();
    enviar('form-datos');
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudieron guardar tus datos. Intenta de nuevo.');
    expect(TestBed.inject(AuthService).usuario()?.nombre).toBe('Laura Gómez');
  });

  function llenarClave(actual = 'vieja-clave-1', nueva = 'nueva-clave-2', repetir = nueva) {
    escribir('clave_actual', actual);
    escribir('clave_nueva', nueva);
    escribir('repetir', repetir);
  }

  it('los campos de contraseña ayudan al gestor de claves', () => {
    cargar();
    expect(el().querySelector('#clave_actual')!.getAttribute('autocomplete')).toBe('current-password');
    expect(el().querySelector('#clave_nueva')!.getAttribute('type')).toBe('password');
    expect(el().querySelector('#clave_nueva')!.getAttribute('autocomplete')).toBe('new-password');
  });

  it('cambiar la contraseña la envía, limpia el formulario y confirma', () => {
    cargar();
    llenarClave();
    enviar('form-clave');
    const req = http.expectOne(CLAVE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ clave_actual: 'vieja-clave-1', clave_nueva: 'nueva-clave-2' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Contraseña actualizada.');
    expect(valor('clave_actual')).toBe('');
    expect(valor('clave_nueva')).toBe('');
    expect(valor('repetir')).toBe('');
  });

  it('exige los tres campos', () => {
    cargar();
    enviar('form-clave');
    http.expectNone(CLAVE);
    expect(el().textContent).toContain('Escribe tu contraseña actual.');
    expect(el().textContent).toContain('Escribe la nueva contraseña.');
    expect(el().textContent).toContain('Repite la nueva contraseña.');
  });

  it('si las contraseñas no coinciden no se envía', () => {
    cargar();
    llenarClave('vieja-clave-1', 'nueva-clave-2', 'otra-cosa');
    enviar('form-clave');
    http.expectNone(CLAVE);
    expect(el().textContent).toContain('Las contraseñas no coinciden.');
  });

  it('corregir la repetición permite enviar', () => {
    cargar();
    llenarClave('vieja-clave-1', 'nueva-clave-2', 'otra-cosa');
    enviar('form-clave');
    escribir('repetir', 'nueva-clave-2');
    enviar('form-clave');
    http.expectOne(CLAVE).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('una contraseña actual incorrecta se marca en su campo y conserva lo escrito', () => {
    cargar();
    llenarClave();
    enviar('form-clave');
    http
      .expectOne(CLAVE)
      .flush({ clave_actual: ['La contraseña actual no es correcta.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().querySelector('#clave_actual')!.classList).toContain('is-invalid');
    expect(el().textContent).toContain('La contraseña actual no es correcta.');
    expect(valor('clave_nueva')).toBe('nueva-clave-2');
    expect(el().textContent).not.toContain('Contraseña actualizada.');
  });

  it('un fallo de red al cambiar la contraseña avisa', () => {
    cargar();
    llenarClave();
    enviar('form-clave');
    http.expectOne(CLAVE).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cambiar la contraseña. Intenta de nuevo.');
  });
});
