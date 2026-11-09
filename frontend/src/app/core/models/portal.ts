import { ConteoActivos, ConteoBackups } from './dashboard-admin';
import { AlcanceTicket, CategoriaTicket, EstadoTicket } from './ticket';
import { Referencia, TipoActivo } from './activo';

export const ALCANCES_PORTAL: { valor: AlcanceTicket; texto: string }[] = [
  { valor: 'un_usuario', texto: 'Solo a mí' },
  { valor: 'varios_usuarios', texto: 'A varias personas' },
  { valor: 'toda_empresa', texto: 'A toda la empresa' },
];

export interface ResumenPortal {
  generado_en: string;
  empresa: Referencia;
  tickets: { abiertos: number; en_progreso: number; resueltos: number };
  incidentes_activos: number;
  infraestructura: {
    servidores: ConteoActivos;
    redes: ConteoActivos;
    backups: ConteoBackups;
  };
}

export interface ActivoPortal {
  id: number;
  nombre: string;
  tipo: TipoActivo;
}

export interface TicketPortalResumido {
  id: number;
  codigo: string;
  titulo: string;
  categoria: CategoriaTicket;
  estado: EstadoTicket;
  activo: Referencia | null;
  tecnico: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface EventoPortal {
  id: number;
  tipo: 'creacion' | 'estado' | 'comentario';
  autor: string | null;
  autor_es_cliente: boolean;
  texto: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha: string;
}

export interface TicketPortal extends TicketPortalResumido {
  descripcion: string | null;
  alcance: AlcanceTicket;
  solucion: string | null;
  reportado_por: string | null;
  resuelto_en: string | null;
  cerrado_en: string | null;
  eventos: EventoPortal[];
}

export interface TicketPortalEntrada {
  titulo: string;
  descripcion: string;
  categoria: CategoriaTicket;
  alcance: AlcanceTicket;
  activo: number | null;
}

export interface FiltrosPortal {
  q?: string;
  estado?: EstadoTicket | null;
  abiertos?: boolean;
  page?: number;
  pageSize?: number;
}
