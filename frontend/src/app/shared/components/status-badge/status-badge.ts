import { Component, computed, input } from '@angular/core';

const ESTILOS: Record<string, { texto: string; clase: string }> = {
  // severidad
  baja: { texto: 'Baja', clase: 'success' },
  media: { texto: 'Media', clase: 'info' },
  alta: { texto: 'Alta', clase: 'warning' },
  critica: { texto: 'Crítica', clase: 'danger' },
  // estado de incidente
  abierto: { texto: 'Abierto', clase: 'danger' },
  en_progreso: { texto: 'En progreso', clase: 'warning' },
  resuelto: { texto: 'Resuelto', clase: 'success' },
  cerrado: { texto: 'Cerrado', clase: 'secondary' },
  // estado de activo
  operativo: { texto: 'Operativo', clase: 'success' },
  advertencia: { texto: 'Advertencia', clase: 'warning' },
  critico: { texto: 'Crítico', clase: 'danger' },
  // estado de backup
  exitoso: { texto: 'Exitoso', clase: 'success' },
  fallido: { texto: 'Fallido', clase: 'danger' },
  pendiente: { texto: 'Pendiente', clase: 'secondary' },
};

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  valor = input.required<string>();

  estilo = computed(
    () => ESTILOS[this.valor()] ?? { texto: this.valor(), clase: 'secondary' },
  );
}