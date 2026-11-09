import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

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
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  titulo = input.required<string>();
  valor = input.required<number | string>();
  icono = input<string>('bi-bar-chart');
  color = input<string>('primary'); // primary, success, warning, danger, info, secondary
  /** Si viene, toda la tarjeta enlaza a esa ruta. */
  ruta = input<string | null>(null);
  parametros = input<Params | null>(null);
  tono = computed(() => TONO[this.color()] ?? 'neutro');
}
