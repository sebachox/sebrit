import { Referencia } from './activo';

export type ImpactoIncidente = 'degradado' | 'parcial' | 'total';
export type SeveridadIncidente = 'baja' | 'media' | 'alta' | 'critica';
export type EstadoIncidente = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
export type TipoAccion = 'creacion' | 'accion' | 'estado' | 'tecnico' | 'severidad' | 'ticket';

export const IMPACTOS: { valor: ImpactoIncidente; texto: string }[] = [
  { valor: 'degradado', texto: 'Degradado: funciona con fallas' },
  { valor: 'parcial', texto: 'Parcial: una parte sin servicio' },
  { valor: 'total', texto: 'Total: sin servicio' },
];

export const SEVERIDADES: { valor: SeveridadIncidente; texto: string }[] = [
  { valor: 'critica', texto: 'Crítica' },
  { valor: 'alta', texto: 'Alta' },
  { valor: 'media', texto: 'Media' },
  { valor: 'baja', texto: 'Baja' },
];

export const ESTADOS_INCIDENTE: { valor: EstadoIncidente; texto: string }[] = [
  { valor: 'abierto', texto: 'Abierto' },
  { valor: 'en_progreso', texto: 'En progreso' },
  { valor: 'resuelto', texto: 'Resuelto' },
  { valor: 'cerrado', texto: 'Cerrado' },
];

export interface IncidenteResumido {
  id: number;
  codigo: string;
  titulo: string;
  organizacion: Referencia;
  severidad: SeveridadIncidente;
  severidad_manual: boolean;
  impacto: ImpactoIncidente;
  estado: EstadoIncidente;
  tecnico: Referencia | null;
  fecha_origen: string;
  fecha_deteccion: string;
  fecha_fin: string | null;
  duracion_minutos: number | null;
  total_activos: number;
  total_tickets: number;
}

export interface AccionIncidente {
  id: number;
  tipo: TipoAccion;
  autor: Referencia | null;
  descripcion: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: string;
}

export interface ActivoAfectado {
  id: number;
  nombre: string;
  tipo: string;
  estado: string;
}

export interface TicketAsociado {
  id: number;
  codigo: string;
  titulo: string;
  estado: string;
}

export interface Incidente extends IncidenteResumido {
  descripcion: string;
  reportado_por: Referencia | null;
  solucion: string | null;
  causa_raiz: string | null;
  cerrado_en: string | null;
  actualizado_en: string;
  activos: ActivoAfectado[];
  tickets: TicketAsociado[];
  acciones: AccionIncidente[];
}

export interface IncidenteEntrada {
  organizacion?: number;
  titulo?: string;
  descripcion?: string;
  impacto?: ImpactoIncidente;
  fecha_origen?: string;
  activos?: number[];
  tecnico?: number | null;
}

export interface FiltrosIncidentes {
  q?: string;
  organizacion?: number | null;
  activo?: number | null;
  estado?: EstadoIncidente | null;
  abiertos?: boolean;
  severidad?: SeveridadIncidente | null;
  impacto?: ImpactoIncidente | null;
  tecnico?: number | 'sin_asignar' | null;
  desde?: string | null;
  hasta?: string | null;
  ordering?: string | null;
  page?: number;
  pageSize?: number;
}

export interface DatosEscalar {
  impacto: ImpactoIncidente;
  fecha_origen: string;
}

/** Duración legible: "45 min", "1 h 30 min", "2 h". */
export function textoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
