import { Component, computed, input } from '@angular/core';

// Tonos definidos en styles.scss (.estado-*): critico, alto, medio, ok, info, neutro, primario.
const ESTILOS: Record<string, { texto: string; clase: string }> = {
  // severidad
  baja: { texto: 'Baja', clase: 'info' },
  media: { texto: 'Media', clase: 'medio' },
  alta: { texto: 'Alta', clase: 'alto' },
  critica: { texto: 'Crítica', clase: 'critico' },
  // estado de incidente / ticket
  abierto: { texto: 'Abierto', clase: 'primario' },
  en_progreso: { texto: 'En progreso', clase: 'medio' },
  resuelto: { texto: 'Resuelto', clase: 'ok' },
  cerrado: { texto: 'Cerrado', clase: 'neutro' },
  // estado de activo
  operativo: { texto: 'Operativo', clase: 'ok' },
  advertencia: { texto: 'Advertencia', clase: 'alto' },
  critico: { texto: 'Crítico', clase: 'critico' },
  // estado de backup
  exitoso: { texto: 'Exitoso', clase: 'ok' },
  fallido: { texto: 'Fallido', clase: 'critico' },
  pendiente: { texto: 'Pendiente', clase: 'neutro' },
  // estado de organización
  activa: { texto: 'Activo', clase: 'ok' },
  inactiva: { texto: 'Inactivo', clase: 'neutro' },
  // plan de servicio
  basico: { texto: 'Básico', clase: 'neutro' },
  estandar: { texto: 'Estándar', clase: 'info' },
  premium: { texto: 'Premium', clase: 'primario' },
};

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  valor = input.required<string>();

  estilo = computed(
    () => ESTILOS[this.valor()] ?? { texto: this.valor(), clase: 'neutro' },
  );
}