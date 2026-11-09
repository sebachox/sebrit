import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../../../core/config/api';
import { EventoTicket, Ticket } from '../../../../core/models/ticket';
import { TicketFicha } from './ticket-ficha';

const URL = `${API_URL}/tickets/7/`;
const TECNICOS = `${API_URL}/tecnicos/`;

const evento = (e: Partial<EventoTicket> = {}): EventoTicket => ({
  id: 1,
  tipo: 'creacion',
  autor: { id: 2, nombre: 'Ana Ruiz' },
  texto: null,
  valor_anterior: null,
  valor_nuevo: null,
  visible_cliente: false,
  autor_es_cliente: false,
  fecha: '2026-11-08T10:00:00-05:00',
  ...e,
});

const ticket = (t: Partial<Ticket> = {}): Ticket => ({
  id: 7,
  codigo: 'TCK-0007',
  titulo: 'Caída del servidor',
  organizacion: { id: 4, nombre: 'Metropolis 21' },
  categoria: 'red',
  prioridad: 'alta',
  prioridad_manual: false,
  estado: 'abierto',
  tecnico: { id: 5, nombre: 'Laura Gómez' },
  activo: { id: 3, nombre: 'SRV-01' },
  incidente: null,
  creado_en: '2026-11-08T10:00:00-05:00',
  descripcion: 'No responde',
  alcance: 'toda_empresa',
  reportado_por: null,
  solucion: null,
  actualizado_en: '2026-11-08T10:00:00-05:00',
  resuelto_en: null,
  cerrado_en: null,
  eventos: [evento()],
  ...t,
});

describe('TicketFicha', () => {
  let fixture: ComponentFixture<TicketFicha>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto));
  const escribir = (selector: string, valor: string) => {
    const c = el().querySelector(selector) as HTMLTextAreaElement;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  function crear(t: Ticket | null = ticket(), query: Record<string, string> = {}) {
    localStorage.setItem('sebrit.access', 'a1');
    localStorage.setItem('sebrit.usuario', JSON.stringify({ id: 9, username: 't', nombre: 'Yo', rol: 'tecnico' }));
    TestBed.configureTestingModule({
      imports: [TicketFicha],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: '7' }), queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(TicketFicha);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(TECNICOS).flush([{ id: 5, nombre: 'Laura Gómez' }, { id: 9, nombre: 'Yo' }]);
    const req = http.expectOne(URL);
    if (t) req.flush(t);
    else req.flush({ detail: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los botones según el estado', () => {
    const casos: [Ticket['estado'], string[], string[]][] = [
      ['abierto', ['Empezar'], ['Resolver', 'Cerrar ticket', 'Reabrir']],
      ['en_progreso', ['Resolver', 'Devolver a abierto'], ['Empezar', 'Reabrir']],
      ['resuelto', ['Cerrar ticket', 'Reabrir'], ['Empezar', 'Resolver']],
      ['cerrado', ['Reabrir'], ['Empezar', 'Resolver', 'Cerrar ticket']],
    ];
    for (const [estado, si, no] of casos) {
      TestBed.resetTestingModule();
      crear(ticket({ estado }));
      si.forEach((b) => expect(boton(b)).withContext(`${estado}: ${b}`).toBeDefined());
      no.forEach((b) => expect(boton(b)).withContext(`${estado}: ${b}`).toBeUndefined());
    }
  });

  it('sin técnico, Empezar está deshabilitado con el motivo', () => {
    crear(ticket({ tecnico: null }));
    expect(boton('Empezar')!.disabled).toBeTrue();
    expect(el().textContent).toContain('Asigna un técnico primero');
  });

  it('Empezar cambia el estado y actualiza el badge', () => {
    crear();
    boton('Empezar')!.click();
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'en_progreso' });
    req.flush(ticket({ estado: 'en_progreso' }));
    fixture.detectChanges();
    expect(el().querySelector('.encabezado')?.textContent).toContain('En progreso');
  });

  it('Resolver exige la solución', () => {
    crear(ticket({ estado: 'en_progreso' }));
    boton('Resolver')!.click();
    fixture.detectChanges();
    boton('Confirmar solución')!.click();
    http.expectNone(`${URL}estado/`);

    escribir('#solucion', 'Se reinició el servicio');
    boton('Confirmar solución')!.click();
    const req = http.expectOne(`${URL}estado/`);
    expect(req.request.body).toEqual({ estado: 'resuelto', solucion: 'Se reinició el servicio' });
    req.flush(ticket({ estado: 'resuelto', solucion: 'Se reinició el servicio' }));
  });

  it('Tomarlo yo asigna al usuario de la sesión', () => {
    crear(ticket({ tecnico: null }));
    boton('Tomarlo yo')!.click();
    const req = http.expectOne(URL);
    expect([req.request.method, req.request.body]).toEqual(['PATCH', { tecnico: 9 }]);
    req.flush(ticket({ tecnico: { id: 9, nombre: 'Yo' } }));
  });

  it('el selector de técnico envía el id elegido', () => {
    crear(ticket({ tecnico: null }));
    const s = el().querySelector('#tecnico') as HTMLSelectElement;
    s.value = '5';
    s.dispatchEvent(new Event('change'));
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ tecnico: 5 });
    req.flush(ticket());
  });

  it('si falla la asignación, el selector vuelve al técnico real', () => {
    crear(ticket({ estado: 'en_progreso' }));
    const s = el().querySelector('#tecnico') as HTMLSelectElement;
    s.value = '';
    s.dispatchEvent(new Event('change'));
    http
      .expectOne(URL)
      .flush({ tecnico: ['Un ticket en progreso debe tener un técnico asignado.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(s.value).toBe('5');
  });

  it('un técnico que ya no está en la lista se sigue mostrando', () => {
    crear(ticket({ tecnico: { id: 77, nombre: 'Técnico Retirado' } }));
    const s = el().querySelector('#tecnico') as HTMLSelectElement;
    expect(s.value).toBe('77');
    expect(s.selectedOptions[0].textContent).toContain('Técnico Retirado');
  });

  it('Corregir exige motivo y muestra Corregida a mano', () => {
    crear();
    expect(el().textContent).toContain('Automática');
    boton('Corregir')!.click();
    fixture.detectChanges();
    boton('Guardar prioridad')!.click();
    http.expectNone(`${URL}prioridad/`);

    const s = el().querySelector('#prioridad-nueva') as HTMLSelectElement;
    s.value = 'critica';
    s.dispatchEvent(new Event('change'));
    escribir('#motivo', 'Cliente sin servicio');
    boton('Guardar prioridad')!.click();
    const req = http.expectOne(`${URL}prioridad/`);
    expect(req.request.body).toEqual({ prioridad: 'critica', motivo: 'Cliente sin servicio' });
    req.flush(ticket({ prioridad: 'critica', prioridad_manual: true }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Corregida a mano');
  });

  describe('comentarios visibles al cliente', () => {
    const casilla = () => el().querySelector('#visible-cliente') as HTMLInputElement;
    const marcar = () => {
      casilla().checked = true;
      casilla().dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const marcaDe = (fila: number) =>
      el().querySelectorAll('.linea-tiempo li')[fila].querySelector('[data-prueba="marca"]')?.textContent?.trim();

    it('la casilla empieza desmarcada', () => {
      crear();
      expect(casilla().checked).toBeFalse();
      expect(el().textContent).toContain('Visible para el cliente');
    });

    it('marcada envía visible_cliente verdadero y vuelve a desmarcarse', () => {
      crear();
      escribir('#comentario', 'Ya revisamos');
      marcar();
      boton('Comentar')!.click();
      const req = http.expectOne(`${URL}comentarios/`);
      expect(req.request.body).toEqual({ texto: 'Ya revisamos', visible_cliente: true });
      req.flush(evento({ id: 2, tipo: 'comentario', texto: 'Ya revisamos', visible_cliente: true }));
      fixture.detectChanges();
      expect(casilla().checked).toBeFalse();
    });

    it('si falla el envío conserva la casilla', () => {
      crear();
      escribir('#comentario', 'Ya revisamos');
      marcar();
      boton('Comentar')!.click();
      http.expectOne(`${URL}comentarios/`).flush({}, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(casilla().checked).toBeTrue();
    });

    it('cada comentario muestra su marca y los demás eventos no', () => {
      crear(
        ticket({
          eventos: [
            evento(),
            evento({ id: 2, tipo: 'comentario', texto: 'a' }),
            evento({ id: 3, tipo: 'comentario', texto: 'b', visible_cliente: true }),
            evento({ id: 4, tipo: 'comentario', texto: 'c', visible_cliente: true, autor_es_cliente: true }),
          ],
        }),
      );
      expect(marcaDe(0)).toBeUndefined();
      expect(marcaDe(1)).toBe('Nota interna');
      expect(marcaDe(2)).toBe('Visible al cliente');
      expect(marcaDe(3)).toBe('Cliente');
    });

    it('en un ticket cerrado la casilla queda deshabilitada', () => {
      crear(ticket({ estado: 'cerrado' }));
      expect(casilla().disabled).toBeTrue();
    });
  });

  it('al resolver avisa que el cliente verá la solución', () => {
    crear(ticket({ estado: 'en_progreso' }));
    boton('Resolver')!.click();
    fixture.detectChanges();
    expect(el().textContent).toContain('El cliente verá este texto.');
  });

  it('comentar agrega el evento a la línea de tiempo', () => {
    crear();
    escribir('#comentario', 'Llamé al cliente');
    boton('Comentar')!.click();
    const req = http.expectOne(`${URL}comentarios/`);
    expect(req.request.body).toEqual({ texto: 'Llamé al cliente', visible_cliente: false });
    req.flush(evento({ id: 2, tipo: 'comentario', texto: 'Llamé al cliente', autor: { id: 9, nombre: 'Yo' } }));
    fixture.detectChanges();
    expect(el().querySelector('.linea-tiempo')?.textContent).toContain('Llamé al cliente');
    expect((el().querySelector('#comentario') as HTMLTextAreaElement).value).toBe('');
  });

  it('un 400 de una acción muestra el mensaje del servidor', () => {
    crear();
    boton('Empezar')!.click();
    http
      .expectOne(`${URL}estado/`)
      .flush({ tecnico: ['Asigna un técnico antes de pasar a En progreso.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')?.textContent).toContain('Asigna un técnico antes');
  });

  it('cerrado: aviso visible y todo deshabilitado salvo Reabrir', () => {
    crear(ticket({ estado: 'cerrado', cerrado_en: '2026-11-08T12:00:00-05:00' }));
    expect(el().textContent).toContain('Este ticket está cerrado');
    expect(boton('Reabrir')!.disabled).toBeFalse();
    expect(boton('Tomarlo yo')!.disabled).toBeTrue();
    expect(boton('Corregir')!.disabled).toBeTrue();
    expect(boton('Comentar')!.disabled).toBeTrue();
    expect(boton('Editar')!.disabled).toBeTrue();
    expect((el().querySelector('#tecnico') as HTMLSelectElement).disabled).toBeTrue();
    expect((el().querySelector('#comentario') as HTMLTextAreaElement).disabled).toBeTrue();
  });

  it('la línea de tiempo muestra el autor y Sistema si no hay', () => {
    crear(ticket({ eventos: [evento(), evento({ id: 2, tipo: 'prioridad', autor: null, valor_anterior: 'baja', valor_nuevo: 'alta' })] }));
    const texto = el().querySelector('.linea-tiempo')?.textContent ?? '';
    expect(texto).toContain('Ana Ruiz');
    expect(texto).toContain('Sistema');
  });

  it('sin eventos (tickets antiguos) lo indica en la línea de tiempo', () => {
    crear(ticket({ eventos: [] }));
    expect(el().textContent).toContain('Aún no hay actividad');
  });

  it('muestra "—" para los datos vacíos', () => {
    crear();
    expect(el().querySelector('[data-campo="reportado_por"]')?.textContent?.trim()).toBe('—');
  });

  it('un 404 muestra que el ticket no existe', () => {
    crear(null);
    expect(el().textContent).toContain('Ticket no encontrado');
  });

  it('con ?guardado=1 muestra el mensaje de éxito', () => {
    crear(ticket(), { guardado: '1' });
    expect(el().querySelector('.alert-success')?.textContent).toContain('Ticket guardado correctamente.');
  });

  describe('incidente', () => {
    const INCIDENTES = `${API_URL}/incidentes/`;
    const pulsar = (texto: string) => {
      boton(texto)!.click();
      fixture.detectChanges();
    };
    const elegir = (selector: string, valor: string) => {
      const c = el().querySelector(selector) as HTMLSelectElement;
      c.value = valor;
      c.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };

    it('con incidente muestra el aviso con enlace y sin opciones', () => {
      crear(ticket({ incidente: { id: 3, codigo: 'INC-0003' } }));
      const enlace = el().querySelector('a[href="/admin/incidentes/3"]');
      expect(enlace?.closest('[data-incidente]')?.textContent).toContain('Parte del incidente INC-0003');
      expect(boton('Escalar a incidente')).toBeUndefined();
      expect(boton('Asociar a incidente')).toBeUndefined();
    });

    it('sin incidente ofrece escalar y asociar', () => {
      crear();
      expect(boton('Escalar a incidente')).toBeDefined();
      expect(boton('Asociar a incidente')).toBeDefined();
    });

    it('un ticket cerrado no ofrece ninguna', () => {
      crear(ticket({ estado: 'cerrado' }));
      expect(boton('Escalar a incidente')).toBeUndefined();
      expect(boton('Asociar a incidente')).toBeUndefined();
    });

    it('escalar exige impacto y fecha', () => {
      crear();
      pulsar('Escalar a incidente');
      pulsar('Crear incidente');
      expect(el().textContent).toContain('Indica el impacto.');
      expect(el().textContent).toContain('Indica cuándo empezó el incidente.');
    });

    it('escalar rechaza una fecha futura', () => {
      crear();
      pulsar('Escalar a incidente');
      elegir('#escalar-impacto', 'total');
      escribir('#escalar-fecha', '2999-01-01T00:00');
      pulsar('Crear incidente');
      expect(el().textContent).toContain('La fecha de origen no puede ser futura.');
    });

    it('escalar envía la fecha en ISO y lleva a la ficha nueva', () => {
      crear();
      const navegar = spyOn(TestBed.inject(Router), 'navigate');
      pulsar('Escalar a incidente');
      elegir('#escalar-impacto', 'total');
      escribir('#escalar-fecha', '2026-01-15T08:30');
      pulsar('Crear incidente');
      const req = http.expectOne(`${URL}escalar/`);
      expect(req.request.body).toEqual({ impacto: 'total', fecha_origen: new Date('2026-01-15T08:30').toISOString() });
      req.flush({ id: 21 });
      expect(navegar).toHaveBeenCalledWith(['/admin/incidentes', 21]);
    });

    it('un error al escalar se muestra', () => {
      crear();
      pulsar('Escalar a incidente');
      elegir('#escalar-impacto', 'total');
      escribir('#escalar-fecha', '2026-01-15T08:30');
      pulsar('Crear incidente');
      http
        .expectOne(`${URL}escalar/`)
        .flush({ ticket: ['El ticket ya está asociado a un incidente.'] }, { status: 400, statusText: 'Bad' });
      fixture.detectChanges();
      expect(el().querySelector('.alert-danger')?.textContent).toContain('El ticket ya está asociado a un incidente.');
    });

    it('asociar pide los incidentes activos del cliente y muestra el aviso sin spinner', () => {
      crear();
      pulsar('Asociar a incidente');
      const lista = http.expectOne((r) => r.url === INCIDENTES);
      expect(lista.request.params.get('organizacion')).toBe('4');
      expect(lista.request.params.get('abiertos')).toBe('true');
      lista.flush({ count: 1, next: null, previous: null, results: [{ id: 3, codigo: 'INC-0003', titulo: 'Caída' }] });
      fixture.detectChanges();

      elegir('#asociar-incidente', '3');
      pulsar('Asociar');
      const post = http.expectOne(`${INCIDENTES}3/tickets/`);
      expect(post.request.body).toEqual({ ticket: 7 });
      post.flush({ id: 3 });
      fixture.detectChanges();

      const recarga = http.expectOne(URL);
      expect(el().querySelector('[role="status"].text-center')).toBeNull();
      recarga.flush(ticket({ incidente: { id: 3, codigo: 'INC-0003' } }));
      fixture.detectChanges();
      expect(el().textContent).toContain('Parte del incidente INC-0003');
    });

    it('el selector de incidentes indica la carga y la lista vacía', () => {
      crear();
      pulsar('Asociar a incidente');
      expect(el().textContent).toContain('Cargando incidentes...');
      expect(el().querySelector('#asociar-incidente')).toBeNull();
      http.expectOne((r) => r.url === INCIDENTES).flush({ count: 0, next: null, previous: null, results: [] });
      fixture.detectChanges();
      expect(el().textContent).toContain('Este cliente no tiene incidentes activos.');
      expect(el().querySelector('#asociar-incidente')).toBeNull();
    });

    it('describe los eventos de incidente', () => {
      crear();
      const c = fixture.componentInstance;
      expect(c.descripcionEvento(evento({ tipo: 'incidente', valor_nuevo: 'INC-1' }))).toBe('asoció al incidente INC-1');
      expect(c.descripcionEvento(evento({ tipo: 'incidente', valor_anterior: 'INC-1' }))).toBe('quitó del incidente INC-1');
    });
  });
});
