export type TipoActivo = 'servidor' | 'red';
export type EstadoActivo = 'operativo' | 'advertencia' | 'critico';
export type EstadoBackup = 'exitoso' | 'fallido' | 'pendiente';

export const TIPOS_ACTIVO: { valor: TipoActivo; texto: string }[] = [
  { valor: 'servidor', texto: 'Servidor' },
  { valor: 'red', texto: 'Red' },
];

export const ESTADOS_ACTIVO: { valor: EstadoActivo; texto: string }[] = [
  { valor: 'operativo', texto: 'Operativo' },
  { valor: 'advertencia', texto: 'Advertencia' },
  { valor: 'critico', texto: 'Crítico' },
];

export interface Referencia {
  id: number;
  nombre: string;
}

export interface UltimoBackup {
  id: number;
  fecha: string;
  estado: EstadoBackup;
}

export interface ActivoResumido {
  id: number;
  nombre: string;
  tipo: TipoActivo;
  estado: EstadoActivo;
  organizacion: Referencia;
  ip: string | null;
  hostname: string | null;
  ubicacion: string | null;
  de_baja: boolean;
  ultimo_backup: UltimoBackup | null;
}

export interface ResumenBackups {
  total: number;
  exitosos: number;
  fallidos: number;
  pendientes: number;
}

export interface Activo extends ActivoResumido {
  sistema_operativo: string | null;
  fabricante: string | null;
  modelo: string | null;
  numero_serie: string | null;
  notas: string | null;
  fecha_baja: string | null;
  creado_en: string;
  actualizado_en: string;
  resumen_backups: ResumenBackups;
}

/** En la entrada, `organizacion` es el id del cliente. */
export type ActivoEntrada = Partial<
  Omit<
    Activo,
    | 'id'
    | 'organizacion'
    | 'ultimo_backup'
    | 'resumen_backups'
    | 'fecha_baja'
    | 'creado_en'
    | 'actualizado_en'
  >
> & { organizacion?: number };

export interface FiltrosActivos {
  q?: string;
  organizacion?: number | null;
  tipo?: TipoActivo | null;
  estado?: EstadoActivo | null;
  de_baja?: boolean;
  page?: number;
}
