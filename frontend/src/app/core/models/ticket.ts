import { Referencia } from './activo';

export type CategoriaTicket = 'hardware' | 'software' | 'red' | 'seguridad' | 'accesos' | 'otro';
export type AlcanceTicket = 'un_usuario' | 'varios_usuarios' | 'toda_empresa';
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';
export type EstadoTicket = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
export type TipoEvento = 'creacion' | 'comentario' | 'estado' | 'tecnico' | 'prioridad';

export const CATEGORIAS: { valor: CategoriaTicket; texto: string }[] = [
  { valor: 'hardware', texto: 'Hardware' },
  { valor: 'software', texto: 'Software' },
  { valor: 'red', texto: 'Red' },
  { valor: 'seguridad', texto: 'Seguridad' },
  { valor: 'accesos', texto: 'Accesos' },
  { valor: 'otro', texto: 'Otro' },
];

export const ALCANCES: { valor: AlcanceTicket; texto: string }[] = [
  { valor: 'un_usuario', texto: 'Un usuario' },
  { valor: 'varios_usuarios', texto: 'Varios usuarios' },
  { valor: 'toda_empresa', texto: 'Toda la empresa' },
];

export const PRIORIDADES: { valor: PrioridadTicket; texto: string }[] = [
  { valor: 'critica', texto: 'Crítica' },
  { valor: 'alta', texto: 'Alta' },
  { valor: 'media', texto: 'Media' },
  { valor: 'baja', texto: 'Baja' },
];

export const ESTADOS_TICKET: { valor: EstadoTicket; texto: string }[] = [
  { valor: 'abierto', texto: 'Abierto' },
  { valor: 'en_progreso', texto: 'En progreso' },
  { valor: 'resuelto', texto: 'Resuelto' },
  { valor: 'cerrado', texto: 'Cerrado' },
];

export interface TicketResumido {
  id: number;
  codigo: string;
  titulo: string;
  organizacion: Referencia;
  categoria: CategoriaTicket;
  prioridad: PrioridadTicket;
  prioridad_manual: boolean;
  estado: EstadoTicket;
  tecnico: Referencia | null;
  activo: Referencia | null;
  creado_en: string;
}

export interface EventoTicket {
  id: number;
  tipo: TipoEvento;
  autor: Referencia | null;
  texto: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: string;
}

export interface Ticket extends TicketResumido {
  descripcion: string;
  alcance: AlcanceTicket;
  reportado_por: Referencia | null;
  solucion: string | null;
  actualizado_en: string;
  resuelto_en: string | null;
  cerrado_en: string | null;
  eventos: EventoTicket[];
}

export interface TicketEntrada {
  organizacion?: number;
  titulo?: string;
  descripcion?: string;
  categoria?: CategoriaTicket;
  alcance?: AlcanceTicket;
  activo?: number | null;
  tecnico?: number | null;
}

export interface FiltrosTickets {
  q?: string;
  organizacion?: number | null;
  activo?: number | null;
  estado?: EstadoTicket | null;
  abiertos?: boolean;
  prioridad?: PrioridadTicket | null;
  categoria?: CategoriaTicket | null;
  tecnico?: number | 'sin_asignar' | null;
  ordering?: string | null;
  page?: number;
}
