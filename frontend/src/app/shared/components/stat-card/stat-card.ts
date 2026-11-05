import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  titulo = input.required<string>();
  valor = input.required<number | string>();
  icono = input<string>('bi-bar-chart');
  color = input<string>('primary'); // primary, success, warning, danger, info...
}