import { Component, computed, input } from '@angular/core';

const TONO: Record<string, string> = {
  primary: 'primario',
  info: 'info',
  warning: 'medio',
  danger: 'critico',
  secondary: 'neutro',
  success: 'ok',
};

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  titulo = input.required<string>();
  valor = input.required<number | string>();
  icono = input<string>('bi-bar-chart');
  color = input<string>('primary'); // primary, success, warning, danger, info, secondary
  tono = computed(() => TONO[this.color()] ?? 'neutro');
}