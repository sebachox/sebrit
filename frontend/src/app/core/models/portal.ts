import { EstadoIncidente, ImpactoIncidente } from './incidente';
import { ConteoActivos, ConteoBackups } from './dashboard-admin';
import { AlcanceTicket, CategoriaTicket, EstadoTicket } from './ticket';
import { EstadoActivo, EstadoBackup, Referencia, TipoActivo } from './activo';
import { TipoBackup } from './backup';
import { Plan } from './organizacion';

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

export interface EmpresaPortal {
  id: number;
  nombre: string;
  nit: string | null;
  sector: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  ciudad: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_correo: string | null;
  contacto_telefono: string | null;
  plan: Plan | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
}

export interface ActivoPortalResumido {
  id: number;
  nombre: string;
  tipo: TipoActivo;
  estado: EstadoActivo;
  ubicacion: string | null;
  ultimo_backup: { fecha: string; estado: EstadoBackup } | null;
}

export interface ActivoPortalDetalle extends ActivoPortalResumido {
  fabricante: string | null;
  modelo: string | null;
  sistema_operativo: string | null;
  numero_serie: string | null;
  de_baja: boolean;
  fecha_baja: string | null;
}

export interface BackupPortal {
  id: number;
  activo: Referencia | null;
  tipo: TipoBackup | null;
  estado: EstadoBackup;
  fecha: string;
  tamano_gb: string | number | null;
}

export interface FiltrosActivosPortal {
  q?: string;
  tipo?: TipoActivo | null;
  estado?: EstadoActivo | null;
  ordering?: 'nombre' | 'estado' | null;
  page?: number;
  pageSize?: number;
}

export interface FiltrosBackupsPortal {
  activo?: number | null;
  estado?: EstadoBackup | null;
  tipo?: TipoBackup | null;
  desde?: string | null;
  hasta?: string | null;
  page?: number;
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

export interface IncidentePortalResumido {
  id: number;
  codigo: string;
  titulo: string;
  estado: EstadoIncidente;
  impacto: ImpactoIncidente;
  fecha_origen: string;
  fecha_fin: string | null;
}

export interface IncidentePortalDetalle extends IncidentePortalResumido {
  descripcion: string | null;
  fecha_deteccion: string;
  duracion_minutos: number | null;
  tecnico: string | null;
  solucion: string | null;
  activos: Referencia[];
  tickets: { id: number; codigo: string; titulo: string; estado: EstadoTicket }[];
}

export interface FiltrosIncidentesPortal {
  q?: string;
  estado?: EstadoIncidente | null;
  abiertos?: boolean;
  page?: number;
}
