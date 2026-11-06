import { TestBed } from '@angular/core/testing';
import { TemaService } from './tema.service';

const atributo = () => document.documentElement.getAttribute('data-bs-theme');

describe('TemaService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-bs-theme');
  });
  afterEach(() => localStorage.clear());

  const crear = () => {
    TestBed.configureTestingModule({});
    return TestBed.inject(TemaService);
  };

  it('arranca en oscuro y lo aplica en <html>', () => {
    const s = crear();
    expect(s.tema()).toBe('oscuro');
    expect(atributo()).toBe('dark');
  });

  it('alternar pasa a claro, lo aplica y lo recuerda', () => {
    const s = crear();
    s.alternar();
    expect(s.tema()).toBe('claro');
    expect(atributo()).toBe('light');
    expect(localStorage.getItem('sebrit.tema')).toBe('claro');
  });

  it('respeta el tema guardado', () => {
    localStorage.setItem('sebrit.tema', 'claro');
    expect(crear().tema()).toBe('claro');
  });

  it('un valor guardado inválido vuelve a oscuro', () => {
    localStorage.setItem('sebrit.tema', 'morado');
    expect(crear().tema()).toBe('oscuro');
  });
});
