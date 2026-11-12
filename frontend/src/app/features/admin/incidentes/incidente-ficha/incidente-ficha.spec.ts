import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { AccionIncidente, Incidente } from '../../../../core/models/incidente';
import { IncidenteFicha } from './incidente-ficha';

const URL = `${API_URL}/incidentes/7/`;
const TECNICOS = `${API_URL}/tecnicos/`;
const TICKETS = `${API_URL}/tickets/`;

const accion = (a: Partial<AccionIncidente> = {}): AccionIncidente => ({
  id: 1,
  tipo: 'creacion',
  autor: { id: 2, nombre: 'Ana Ruiz' },
  descripcion: null,
  valor_anterior: null,
  valor_nuevo: null,
  fecha: '2026-11-08T10:00:00-05:00',
  ...a,
});

const incidente = (i: Partial<Incidente> = {}): Incidente => ({
  id: 7,
  codigo: 'INC-0007',
  titulo: 'Caída del ERP',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  severidad: 'alta',
  severidad_manual: false,
  impacto: 'total',
  estado: 'abierto',
  tecnico: { id: 5, nombre: 'Laura Gómez' },
  fecha_origen: '2026-11-08T09:00:00-05:00',
  fecha_deteccion: '2026-11-08T10:00:00-05:00',
  fecha_fin: null,
  duracion_minutos: null,
  total_activos: 0,
  total_tickets: 0,
  descripcion: 'No responde',
  reportado_por: null,
  solucion: null,
  causa_raiz: null,
  cerrado_en: null,
  actualizado_en: '2026-11-08T10:00:00-05:00',
  activos: [],
  tickets: [],
  acciones: [accion()],
  ...i,
});

describe('IncidenteFicha', () => {
  let fixture: ComponentFixture<IncidenteFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto));
  const pulsar = (texto: string) => {
    boton(texto)!.click();
    fixture.detectChanges();
  };
  const escribir = (selector: string, valor: string) => {
    const c = el().querySelector(selector) as HTMLTextAreaElement;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const textoTiempo = (clave: string) => el().querySelector(`[data-tiempo="${clave}"]`)?.textContent?.trim();

  function crear(i: Incidente | null = incidente(), query: Record<string, string> = {}) {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 9, username: 't', nombre: 'Yo', rol: 'tecnico' }));
    TestBed.configureTestingModule({
      imports: [IncidenteFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }), queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    fixture = TestBed.createComponent(IncidenteFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }, { id: 9, nombre: 'Yo' }]);
    const req = http.expectOne(URL);
    if (i) req.flush(i);
    else req.flush({ detail: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los botones de cada estado', () => {
    const casos: [Incidente['estado'], string[], string[]][] = [
      ['abierto', ['Iniciar'], ['Resolver', 'Cerrar incidente', 'Reabrir']],
      ['en_progreso', ['Resolver', 'Devolver a abierto'], ['Iniciar', 'Cerrar incidente', 'Reabrir']],
      ['resuelto', ['Cerrar incidente', 'Reabrir'], ['Iniciar', 'Resolver']],
      ['cerrado', ['Reabrir'], ['Iniciar', 'Resolver', 'Cerrar incidente']],
    ];
    for (const [estado, si, no] of casos) {
      TestBed.resetTestingModule();
      crear(incidente({ estado }));
      for (const t of si) expect(boton(t)).withContext(`${estado}: ${t}`).toBeDefined();
      for (const t of no) expect(boton(t)).withContext(`${estado}: ${t}`).toBeUndefined();
    }
  });

  it('Tomar aparece sin técnico y asigna al usuario', () => {
    crear(incidente({ tecnico: null }));
    expect(boton('Iniciar')!.disabled).toBeTrue();
    pulsar('Tomar');
    const req = http.expectOne(URL);
    expect([req.request.method, req.request.body]).toEqual(['PATCH', { tecnico: 9 }]);
    req.flush(incidente({ tecnico: { id: 9, nombre: 'Yo' } }));
    fixture.detectChanges();
    expect(boton('Iniciar')!.disabled).toBeFalse();
  });

  it('Iniciar cambia el estado', () => {
    crear();
    pulsar('Iniciar');
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'en_progreso' });
    req.flush(incidente({ estado: 'en_progreso' }));
    fixture.detectChanges();
    expect(boton('Resolver')).toBeDefined();
  });

  it('Resolver exige la solución', () => {
    crear(incidente({ estado: 'en_progreso' }));
    pulsar('Resolver');
    pulsar('Confirmar solución');
    expect(el().textContent).toContain('Describe cómo se restableció el servicio.');
    escribir('#solucion', ' Se reinició ');
    pulsar('Confirmar solución');
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'resuelto', solucion: 'Se reinició' });
    req.flush(incidente({ estado: 'resuelto', solucion: 'Se reinició' }));
    fixture.detectChanges();
    expect(el().querySelector('#solucion')).toBeNull();
  });

  it('avisa cuántos tickets activos se resolverán', () => {
    crear(
      incidente({
        estado: 'en_progreso',
        tickets: [
          { id: 1, codigo: 'TCK-1', titulo: 'A', estado: 'abierto' },
          { id: 2, codigo: 'TCK-2', titulo: 'B', estado: 'en_progreso' },
          { id: 3, codigo: 'TCK-3', titulo: 'C', estado: 'cerrado' },
        ],
      }),
    );
    pulsar('Resolver');
    expect(el().textContent).toContain('2 tickets asociados pasarán a resuelto');
  });

  it('no avisa si no hay tickets activos', () => {
    crear(incidente({ estado: 'en_progreso' }));
    pulsar('Resolver');
    expect(el().textContent).not.toContain('pasará');
  });

  it('Cerrar exige la causa raíz', () => {
    crear(incidente({ estado: 'resuelto' }));
    pulsar('Cerrar incidente');
    pulsar('Confirmar cierre');
    expect(el().textContent).toContain('Indica la causa raíz para cerrar el incidente.');
    escribir('#causa_raiz', 'Disco lleno');
    pulsar('Confirmar cierre');
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'cerrado', causa_raiz: 'Disco lleno' });
    req.flush(incidente({ estado: 'cerrado', causa_raiz: 'Disco lleno' }));
  });

  it('Reabrir pide confirmación antes de enviar', () => {
    crear(incidente({ estado: 'resuelto' }));
    pulsar('Reabrir');
    http.expectNone(`${URL}estado/`);
    expect(el().textContent).toContain('se borrarán');
    pulsar('Sí, reabrir');
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'abierto' });
    req.flush(incidente());
  });

  it('Corregir severidad exige motivo', () => {
    crear();
    pulsar('Corregir');
    pulsar('Guardar severidad');
    expect(el().textContent).toContain('Explica por qué cambias la severidad.');
    escribir('#motivo', 'Afecta facturación');
    pulsar('Guardar severidad');
    const req = http.expectOne(`${URL}severidad/`);
    expect(req.request.body).toEqual({ severidad: 'alta', motivo: 'Afecta facturación' });
    req.flush(incidente({ severidad_manual: true }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Corregida a mano');
  });

  it('muestra los tiempos con duración o En curso', () => {
    crear();
    expect(textoTiempo('duracion')).toBe('En curso');
    expect(textoTiempo('fin')).toBe('—');
    TestBed.resetTestingModule();
    crear(incidente({ estado: 'resuelto', fecha_fin: '2026-11-08T10:30:00-05:00', duracion_minutos: 90 }));
    expect(textoTiempo('duracion')).toBe('1 h 30 min');
    expect(textoTiempo('fin')).toContain('08/11/2026');
  });

  it('agrega una acción sin recargar y limpia el campo', () => {
    crear();
    escribir('#nueva-accion', ' Se revisó el disco ');
    pulsar('Registrar acción');
    const req = http.expectOne(`${URL}acciones/`);
    expect(req.request.body).toEqual({ descripcion: 'Se revisó el disco' });
    req.flush(accion({ id: 2, tipo: 'accion', descripcion: 'Se revisó el disco' }));
    fixture.detectChanges();
    expect(el().querySelectorAll('.linea-tiempo li').length).toBe(2);
    expect((el().querySelector('#nueva-accion') as HTMLTextAreaElement).value).toBe('');
  });

  it('da una frase para cada tipo de acción', () => {
    crear();
    const c = fixture.componentInstance;
    expect(c.descripcionAccion(accion())).toBe('abrió el incidente');
    expect(c.descripcionAccion(accion({ tipo: 'accion' }))).toBe('registró una acción');
    expect(c.descripcionAccion(accion({ tipo: 'estado', valor_anterior: 'abierto', valor_nuevo: 'en_progreso' }))).toBe(
      'cambió el estado de Abierto a En progreso',
    );
    expect(c.descripcionAccion(accion({ tipo: 'tecnico', valor_nuevo: 'Laura' }))).toBe('asignó a Laura');
    expect(c.descripcionAccion(accion({ tipo: 'tecnico', valor_anterior: 'Laura' }))).toBe('quitó la asignación de Laura');
    expect(c.descripcionAccion(accion({ tipo: 'severidad', valor_anterior: 'media', valor_nuevo: 'alta' }))).toBe(
      'cambió la severidad de Media a Alta',
    );
    expect(c.descripcionAccion(accion({ tipo: 'ticket', valor_nuevo: 'TCK-1' }))).toBe('asoció el ticket TCK-1');
    expect(c.descripcionAccion(accion({ tipo: 'ticket', valor_anterior: 'TCK-1' }))).toBe('quitó el ticket TCK-1');
  });

  it('el selector ofrece solo tickets sin incidente y los asocia', () => {
    crear(incidente({ tickets: [{ id: 3, codigo: 'TCK-3', titulo: 'Ya', estado: 'abierto' }] }));
    pulsar('Asociar ticket');
    const req = http.expectOne((r) => r.url === TICKETS);
    expect(req.request.params.get('organizacion')).toBe('4');
    expect(req.request.params.get('abiertos')).toBe('true');
    expect(req.request.params.get('page_size')).toBe('100');
    req.flush({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 8, codigo: 'TCK-8', titulo: 'Libre', incidente: null },
        { id: 9, codigo: 'TCK-9', titulo: 'Ocupado', incidente: { id: 1, codigo: 'INC-1' } },
      ],
    });
    fixture.detectChanges();
    const select = el().querySelector('#ticket-nuevo') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', '8']);
    select.value = '8';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    pulsar('Asociar');
    const post = http.expectOne(`${URL}tickets/`);
    expect(post.request.body).toEqual({ ticket: 8 });
    post.flush(incidente());
  });

  it('quitar un ticket llama al servicio', () => {
    crear(incidente({ tickets: [{ id: 3, codigo: 'TCK-3', titulo: 'Ya', estado: 'abierto' }] }));
    (el().querySelector('[aria-label="Quitar TCK-3"]') as HTMLButtonElement).click();
    const req = http.expectOne(`${URL}tickets/3/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(incidente());
  });

  it('un incidente cerrado queda bloqueado menos Reabrir', () => {
    crear(
      incidente({
        estado: 'cerrado',
        tickets: [{ id: 3, codigo: 'TCK-3', titulo: 'Ya', estado: 'cerrado' }],
      }),
    );
    expect(el().textContent).toContain('Este incidente está cerrado.');
    expect(boton('Editar')!.disabled).toBeTrue();
    expect(boton('Corregir')!.disabled).toBeTrue();
    expect(boton('Asociar ticket')!.disabled).toBeTrue();
    expect((el().querySelector('#tecnico') as HTMLSelectElement).disabled).toBeTrue();
    expect((el().querySelector('#nueva-accion') as HTMLTextAreaElement).disabled).toBeTrue();
    expect((el().querySelector('[aria-label="Quitar TCK-3"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(boton('Reabrir')!.disabled).toBeFalse();
  });

  it('muestra el mensaje de un 400', () => {
    crear();
    pulsar('Iniciar');
    http.expectOne(`${URL}estado/`).flush({ tecnico: ['Asigna un técnico.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('Asigna un técnico.');
  });

  it('si falla la asignación el selector vuelve al técnico real', () => {
    crear();
    const select = el().querySelector('#tecnico') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    http.expectOne(URL).flush({ tecnico: ['No.'] }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(select.value).toBe('5');
  });

  it('no encontrado y error con Reintentar', () => {
    crear(null);
    expect(el().textContent).toContain('Incidente no encontrado');
    TestBed.resetTestingModule();
    crear();
    fixture.componentInstance.cargar();
    fixture.detectChanges();
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('No se pudo cargar el incidente.');
    expect(boton('Reintentar')).toBeDefined();
  });

  it('cambiar el técnico no cierra el panel ni borra lo escrito', () => {
    crear(incidente({ estado: 'en_progreso' }));
    pulsar('Resolver');
    escribir('#solucion', 'Se reinició');
    const select = el().querySelector('#tecnico') as HTMLSelectElement;
    select.value = '9';
    select.dispatchEvent(new Event('change'));
    http.expectOne(URL).flush(incidente({ estado: 'en_progreso', tecnico: { id: 9, nombre: 'Yo' } }));
    fixture.detectChanges();
    expect((el().querySelector('#solucion') as HTMLTextAreaElement).value).toBe('Se reinició');
  });

  it('quitar un ticket no cierra la corrección de severidad', () => {
    crear(incidente({ tickets: [{ id: 3, codigo: 'TCK-3', titulo: 'Ya', estado: 'abierto' }] }));
    pulsar('Corregir');
    escribir('#motivo', 'Afecta facturación');
    (el().querySelector('[aria-label="Quitar TCK-3"]') as HTMLButtonElement).click();
    http.expectOne(`${URL}tickets/3/`).flush(incidente());
    fixture.detectChanges();
    expect((el().querySelector('#motivo') as HTMLTextAreaElement).value).toBe('Afecta facturación');
  });

  it('al resolver avisa que el cliente verá la solución en sus tickets', () => {
    crear(incidente({ estado: 'en_progreso' }));
    pulsar('Resolver');
    expect(el().textContent).toContain('El cliente verá este texto en el portal y en sus tickets asociados.');
  });

  it('cambiar de estado cierra el panel abierto', () => {
    crear(incidente({ estado: 'en_progreso' }));
    pulsar('Resolver');
    pulsar('Devolver a abierto');
    http.expectOne(`${URL}estado/`).flush(incidente());
    fixture.detectChanges();
    expect(el().querySelector('#solucion')).toBeNull();
  });

  it('el selector de tickets indica la carga y la lista vacía', () => {
    crear();
    pulsar('Asociar ticket');
    expect(el().textContent).toContain('Cargando tickets...');
    expect(el().querySelector('#ticket-nuevo')).toBeNull();
    http.expectOne((r) => r.url === TICKETS).flush({ count: 0, next: null, previous: null, results: [] });
    fixture.detectChanges();
    expect(el().textContent).toContain('Este cliente no tiene tickets abiertos sin incidente.');
    expect(el().querySelector('#ticket-nuevo')).toBeNull();
  });

  it('el encabezado muestra el impacto y la marca de severidad manual', () => {
    crear(incidente({ impacto: 'total', severidad_manual: true }));
    const encabezado = el().querySelector('.encabezado') as HTMLElement;
    expect(encabezado.textContent).toContain('Impacto');
    expect(encabezado.textContent).toContain('Total');
    expect(encabezado.querySelector('[data-manual]')).not.toBeNull();
  });

  it('muestra el aviso de guardado', () => {
    crear(incidente(), { guardado: '1' });
    expect(el().textContent).toContain('Incidente guardado correctamente.');
  });
});
