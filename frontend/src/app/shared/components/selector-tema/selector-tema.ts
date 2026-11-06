import { Component, computed, inject } from '@angular/core';
import { TemaService } from '../../../core/services/tema.service';

@Component({
  selector: 'app-selector-tema',
  template: `
    <button
      type="button"
      class="btn btn-sm selector-tema"
      [attr.aria-label]="etiqueta()"
      [title]="etiqueta()"
      (click)="tema.alternar()"
    >
      <i class="bi" [class.bi-sun]="oscuro()" [class.bi-moon-stars]="!oscuro()" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    .selector-tema {
      border: 1px solid var(--bs-border-color);
      color: var(--bs-body-color);
    }
    .selector-tema:hover {
      background: var(--bs-tertiary-bg);
    }
  `,
})
export class SelectorTema {
  protected tema = inject(TemaService);
  protected oscuro = computed(() => this.tema.tema() === 'oscuro');
  protected etiqueta = computed(() =>
    this.oscuro() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
  );
}
