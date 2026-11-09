import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { UsuarioPortal } from '../../../../core/models/usuario-portal';
import { UsuariosPortal } from './usuarios-portal';

const URL = `${API_URL}/organizaciones/7/usuarios/`;

const usuario = (u: Partial<UsuarioPortal> = {}): UsuarioPortal => ({
  id: 3,
  username: 'ana',
  nombres: 'Ana',
  apellidos: 'Ríos',
  correo: 'ana@ejemplo.com',
  activo: true,
  ...u,
});

describe('UsuariosPortal', () => {
  let fixture: ComponentFixture<UsuariosPortal>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(texto))!;

  function crear(rol = 'admin') {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 1, username: 'u', nombre: 'U', rol }));
    TestBed.configureTestingModule({
      imports: [UsuariosPortal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(UsuariosPortal);
    fixture.componentRef.setInput('organizacionId', 7);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }
  function cargar(rol = 'admin', lista: UsuarioPortal[] = [usuario()]) {
    crear(rol);
    http.expectOne(URL).flush(lista);
    fixture.detectChanges();
  }
  function escribir(id: string, valor: string) {
    const i = el().querySelector(`#${id}`) as HTMLInputElement;
    i.value = valor;
    i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function enviar(id: string) {
    (el().querySelector(`#${id}`) as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }
  function pulsar(texto: string) {
    boton(texto).click();
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los usuarios de la empresa', () => {
    cargar();
    const texto = el().textContent ?? '';
    expect(texto).toContain('ana');
    expect(texto).toContain('Ana Ríos');
    expect(texto).toContain('ana@ejemplo.com');
    expect(texto).toContain('Activo');
  });

  it('sin nombre ni correo muestra una raya', () => {
    cargar('admin', [usuario({ nombres: null, apellidos: null, correo: null })]);
    expect(el().querySelector('tbody')?.textContent).toContain('—');
  });

  it('sin usuarios lo dice', () => {
    cargar('admin', []);
    expect(el().textContent).toContain('Esta empresa aún no tiene usuarios del portal.');
  });

  it('un error permite reintentar', () => {
    crear();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudieron cargar los usuarios.');
    pulsar('Reintentar');
    http.expectOne(URL).flush([usuario()]);
    fixture.detectChanges();
    expect(el().textContent).toContain('ana@ejemplo.com');
  });

  describe('crear', () => {
    function llenar() {
      escribir('u-username', ' luis ');
      escribir('u-clave', 'clave-larga-segura-1');
      escribir('u-repetir', 'clave-larga-segura-1');
    }

    it('exige usuario y contraseña', () => {
      cargar();
      pulsar('Nuevo usuario');
      enviar('form-usuario');
      http.expectNone({ method: 'POST', url: URL });
      expect(el().textContent).toContain('Escribe el usuario.');
      expect(el().textContent).toContain('Escribe la contraseña inicial.');
    });

    it('si las contraseñas no coinciden no envía', () => {
      cargar();
      pulsar('Nuevo usuario');
      llenar();
      escribir('u-repetir', 'otra');
      enviar('form-usuario');
      http.expectNone({ method: 'POST', url: URL });
      expect(el().textContent).toContain('Las contraseñas no coinciden.');
    });

    it('envía los datos, agrega la fila y limpia la contraseña', () => {
      cargar();
      pulsar('Nuevo usuario');
      llenar();
      escribir('u-nombres', 'Luis');
      enviar('form-usuario');
      const req = http.expectOne({ method: 'POST', url: URL });
      expect(req.request.body).toEqual({
        username: 'luis',
        clave_inicial: 'clave-larga-segura-1',
        nombres: 'Luis',
        apellidos: null,
        correo: null,
      });
      req.flush(usuario({ id: 4, username: 'luis', nombres: 'Luis', apellidos: null, correo: null }));
      fixture.detectChanges();
      expect(el().querySelector('tbody')?.textContent).toContain('luis');
      expect(el().querySelector('#form-usuario')).toBeNull();
      pulsar('Nuevo usuario');
      expect((el().querySelector('#u-clave') as HTMLInputElement).value).toBe('');
    });

    it('un 400 aparece en su campo', () => {
      cargar();
      pulsar('Nuevo usuario');
      llenar();
      enviar('form-usuario');
      http.expectOne({ method: 'POST', url: URL }).flush({ username: ['Ese usuario ya existe.'] }, { status: 400, statusText: 'Bad' });
      fixture.detectChanges();
      expect(el().querySelector('#u-username')!.classList).toContain('is-invalid');
      expect(el().textContent).toContain('Ese usuario ya existe.');
    });

    it('un fallo de red avisa', () => {
      cargar();
      pulsar('Nuevo usuario');
      llenar();
      enviar('form-usuario');
      http.expectOne({ method: 'POST', url: URL }).flush({}, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(el().querySelector('.alert-danger')?.textContent).toContain('No se pudo guardar el usuario. Intenta de nuevo.');
    });

    it('Cancelar cierra el panel', () => {
      cargar();
      pulsar('Nuevo usuario');
      pulsar('Cancelar');
      expect(el().querySelector('#form-usuario')).toBeNull();
    });
  });

  describe('editar', () => {
    it('precarga los datos, no pide usuario ni contraseña y actualiza la fila', () => {
      cargar();
      pulsar('Editar');
      expect((el().querySelector('#u-nombres') as HTMLInputElement).value).toBe('Ana');
      expect(el().querySelector('#u-username')).toBeNull();
      expect(el().querySelector('#u-clave')).toBeNull();
      escribir('u-nombres', 'Luisa');
      enviar('form-usuario');
      const req = http.expectOne({ method: 'PATCH', url: `${URL}3/` });
      expect(req.request.body).toEqual({ nombres: 'Luisa', apellidos: 'Ríos', correo: 'ana@ejemplo.com' });
      req.flush(usuario({ nombres: 'Luisa' }));
      fixture.detectChanges();
      expect(el().querySelector('tbody')?.textContent).toContain('Luisa Ríos');
      expect(el().querySelector('#form-usuario')).toBeNull();
    });
  });

  describe('desactivar y reactivar', () => {
    it('desactiva y la fila lo refleja', () => {
      cargar();
      pulsar('Desactivar');
      const req = http.expectOne({ method: 'PATCH', url: `${URL}3/` });
      expect(req.request.body).toEqual({ activo: false });
      req.flush(usuario({ activo: false }));
      fixture.detectChanges();
      expect(el().querySelector('tbody')?.textContent).toContain('Inactivo');
      expect(boton('Reactivar')).toBeDefined();
    });

    it('reactiva', () => {
      cargar('admin', [usuario({ activo: false })]);
      pulsar('Reactivar');
      const req = http.expectOne({ method: 'PATCH', url: `${URL}3/` });
      expect(req.request.body).toEqual({ activo: true });
      req.flush(usuario());
      fixture.detectChanges();
      expect(boton('Desactivar')).toBeDefined();
    });

    it('si falla avisa y la fila no cambia', () => {
      cargar();
      pulsar('Desactivar');
      http.expectOne({ method: 'PATCH', url: `${URL}3/` }).flush({}, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(el().querySelector('.alert-danger')?.textContent).toContain('No se pudo guardar el usuario.');
      expect(boton('Desactivar')).toBeDefined();
    });
  });

  describe('definir contraseña', () => {
    const CLAVE = `${URL}3/clave/`;

    it('exige repetirla', () => {
      cargar();
      pulsar('Contraseña');
      escribir('c-nueva', 'otra-clave-larga-2');
      escribir('c-repetir', 'distinta');
      enviar('form-clave-usuario');
      http.expectNone(CLAVE);
      expect(el().textContent).toContain('Las contraseñas no coinciden.');
    });

    it('la envía, confirma y limpia el formulario', () => {
      cargar();
      pulsar('Contraseña');
      escribir('c-nueva', 'otra-clave-larga-2');
      escribir('c-repetir', 'otra-clave-larga-2');
      enviar('form-clave-usuario');
      const req = http.expectOne(CLAVE);
      expect(req.request.body).toEqual({ clave_nueva: 'otra-clave-larga-2' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Contraseña actualizada.');
      expect(el().querySelector('#form-clave-usuario')).toBeNull();
    });

    it('una contraseña débil se marca en su campo', () => {
      cargar();
      pulsar('Contraseña');
      escribir('c-nueva', 'a');
      escribir('c-repetir', 'a');
      enviar('form-clave-usuario');
      http.expectOne(CLAVE).flush({ clave_nueva: ['Es demasiado corta.'] }, { status: 400, statusText: 'Bad' });
      fixture.detectChanges();
      expect(el().querySelector('#c-nueva')!.classList).toContain('is-invalid');
      expect(el().textContent).toContain('Es demasiado corta.');
    });
  });

  describe('técnico', () => {
    it('ve la lista con las acciones bloqueadas', () => {
      cargar('tecnico');
      expect(el().textContent).toContain('ana@ejemplo.com');
      for (const texto of ['Nuevo usuario', 'Editar', 'Contraseña', 'Desactivar']) {
        expect(boton(texto).disabled).withContext(texto).toBeTrue();
        expect(boton(texto).title).withContext(texto).toBe('Solo administradores');
        expect(boton(texto).querySelector('.bi-lock-fill')).withContext(texto).not.toBeNull();
      }
    });
  });

  it('el admin tiene las acciones habilitadas y sin candado', () => {
    cargar();
    expect(boton('Editar').disabled).toBeFalse();
    expect(boton('Editar').querySelector('.bi-lock-fill')).toBeNull();
  });
});
