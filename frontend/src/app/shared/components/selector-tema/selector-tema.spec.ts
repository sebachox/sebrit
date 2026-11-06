import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectorTema } from './selector-tema';

describe('SelectorTema', () => {
  let fixture: ComponentFixture<SelectorTema>;
  const boton = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [SelectorTema] });
    fixture = TestBed.createComponent(SelectorTema);
    fixture.detectChanges();
  });
  afterEach(() => localStorage.clear());

  it('en oscuro ofrece cambiar a claro y al hacer clic cambia', () => {
    expect(boton().getAttribute('aria-label')).toBe('Cambiar a tema claro');
    boton().click();
    fixture.detectChanges();
    expect(boton().getAttribute('aria-label')).toBe('Cambiar a tema oscuro');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
  });
});
