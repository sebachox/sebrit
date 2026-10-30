export type Severidad = 'baja' | 'media' | 'alta' | 'critica';
export type EstadoIncidente = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';

export interface ResumenOperativo {
  clientes_activos: number;
  tickets_abiertos: number;
  mantenimientos_hoy: number;
  incidentes_criticos: number;
}

export interface Empresa {
  id: number;
  nombre: string;
}

export interface Tecnico {
  id: number;
  nombre: string;
}

export interface UltimaAccion {
  descripcion: string;
  fecha: string;
}

export interface Incidente {
  id: number;
  codigo: string;
  titulo: string;
  empresa: Empresa;
  severidad: Severidad;
  estado: EstadoIncidente;
  tecnico_asignado: Tecnico | null;
  ultima_accion: UltimaAccion | null;
}

export interface ConteoActivos {
  total: number;
  operativos: number;
  advertencia: number;
  criticos: number;
}

export interface ConteoBackups {
  total: number;
  exitosos: number;
  fallidos: number;
  pendientes: number;
}

export interface IncidentesCriticos {
  total: number;
  abiertos: number;
  en_progreso: number;
  sin_tecnico: number;
}

export interface Infraestructura {
  servidores: ConteoActivos;
  redes: ConteoActivos;
  backups: ConteoBackups;
  incidentes_criticos: IncidentesCriticos;
}

export interface DashboardAdmin {
  generado_en: string;
  resumen_operativo: ResumenOperativo;
  incidentes: Incidente[];
  infraestructura: Infraestructura;
}