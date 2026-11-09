import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { Organizacion } from '../../../../core/models/organizacion';
import { UsuariosPortal } from '../usuarios-portal/usuarios-portal';
import { ClienteFicha } from './cliente-ficha';

@Component({ selector: 'app-usuarios-portal', template: '' })
class UsuariosPortalVacio {
  organizacionId = input.required<number>();
}

const URL = `${API_URL}/organizaciones/7/`;

const org = (o: Partial<Organizacion> = {}): Organizacion => ({
  id: 7,
  nombre: 'Empresa Ejemplo',
  nit: '900123456-7',
  sector: null,
  telefono: null,
  correo: null,
  direccion: null,
  ciudad: 'Bogotá',
  contacto_nombre: 'Ana Ruiz',
  contacto_cargo: null,
  contacto_correo: null,
  contacto_telefono: null,
  plan: 'premium',
  fecha_inicio_contrato: null,
  fecha_fin_contrato: null,
  activa: true,
  creado_en: '2026-11-05T10:00:00-05:00',
  actualizado_en: '2026-11-05T10:00:00-05:00',
  resumen: { activos: 12, tickets_abiertos: 5, incidentes_activos: 2, usuarios: 3 },
  ...o,
});

describe('ClienteFicha', () => {
  let fixture: ComponentFixture<ClienteFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(texto))!;

  function crear(rol = 'admin', query: Record<string, string> = {}) {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 1, username: 'u', nombre: 'U', rol }));
    TestBed.configureTestingModule({
      imports: [ClienteFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '7' }),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(ClienteFicha, {
      remove: { imports: [UsuariosPortal] },
      add: { imports: [UsuariosPortalVacio] },
    });
    fixture = TestBed.createComponent(ClienteFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  function cargar(o = org()) {
    http.expectOne(URL).flush(o);
    fixture.detectChanges();
  }

  it('incluye los usuarios del portal de ese cliente', () => {
    crear();
    cargar();
    const hijo = fixture.debugElement.query(By.directive(UsuariosPortalVacio));
    expect(hijo.componentInstance.organizacionId()).toBe(7);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los datos, el resumen y "—" para lo vacío', () => {
    crear();
    cargar();
    const texto = el().textContent ?? '';
    expect(texto).toContain('Empresa Ejemplo');
    expect(texto).toContain('900123456-7');
    const valores = Array.from(el().querySelectorAll('app-stat-card')).map((c) => c.textContent);
    expect(valores.join(' ')).toContain('12');
    expect(valores.join(' ')).toContain('5');
    expect(el().querySelector('[data-campo="sector"]')?.textContent?.trim()).toBe('—');
  });

  it('desactivar pide confirmación y luego actualiza el estado', () => {
    crear();
    cargar();
    boton('Desactivar').click();
    fixture.detectChanges();
    boton('Sí, desactivar').click();

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activa: false });
    req.flush(org({ activa: false }));
    fixture.detectChanges();

    expect(el().querySelector('h4')?.parentElement?.textContent).toContain('Inactivo');
  });

  it('un 404 muestra que el cliente no existe con enlace a la lista', () => {
    crear();
    http.expectOne(URL).flush({ detail: 'No encontrado' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Cliente no encontrado');
    expect(el().querySelector('a[href="/admin/clientes"]')).not.toBeNull();
  });

  it('para el técnico, Editar y Desactivar están bloqueados', () => {
    crear('tecnico');
    cargar();
    for (const t of ['Editar', 'Desactivar']) {
      expect(boton(t).disabled).toBeTrue();
      expect(boton(t).title).toBe('Solo administradores');
    }
  });

  it('con ?guardado=1 muestra el mensaje de éxito', () => {
    crear('admin', { guardado: '1' });
    cargar();
    expect(el().querySelector('.alert-success')?.textContent).toContain(
      'Cliente guardado correctamente.',
    );
  });

  it('la tarjeta Activos enlaza a la lista de activos del cliente', () => {
    crear();
    cargar();
    const enlace = el().querySelector<HTMLAnchorElement>('a[href="/admin/activos?organizacion=7"]');
    expect(enlace).not.toBeNull();
    expect(enlace?.textContent).toContain('Activos');
  });

  it('la tarjeta Tickets abiertos enlaza a los tickets del cliente', () => {
    crear();
    cargar();
    const enlace = el().querySelector<HTMLAnchorElement>('a[href="/admin/tickets?organizacion=7"]');
    expect(enlace?.textContent).toContain('Tickets abiertos');
  });

  it('la tarjeta Incidentes activos enlaza a los incidentes del cliente', () => {
    crear();
    cargar();
    const enlace = el().querySelector<HTMLAnchorElement>('a[href="/admin/incidentes?organizacion=7"]');
    expect(enlace?.textContent).toContain('Incidentes activos');
  });
});
