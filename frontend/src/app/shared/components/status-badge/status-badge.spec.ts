import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  let component: StatusBadge;
  let fixture: ComponentFixture<StatusBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatusBadge);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('valor', 'abierto');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el impacto de un incidente con su tono', () => {
    for (const [valor, texto, clase] of [
      ['degradado', 'Degradado', 'medio'],
      ['parcial', 'Parcial', 'alto'],
      ['total', 'Total', 'critico'],
    ]) {
      fixture.componentRef.setInput('valor', valor);
      fixture.detectChanges();
      expect(component.estilo()).toEqual({ texto, clase });
    }
  });
});
