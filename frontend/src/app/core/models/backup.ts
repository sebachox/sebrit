import { EstadoBackup, Referencia } from './activo';

export type TipoBackup = 'completo' | 'incremental' | 'diferencial';

export const TIPOS_BACKUP: { valor: TipoBackup; texto: string }[] = [
  { valor: 'completo', texto: 'Completo' },
  { valor: 'incremental', texto: 'Incremental' },
  { valor: 'diferencial', texto: 'Diferencial' },
];

export const ESTADOS_BACKUP: { valor: EstadoBackup; texto: string }[] = [
  { valor: 'exitoso', texto: 'Exitoso' },
  { valor: 'fallido', texto: 'Fallido' },
  { valor: 'pendiente', texto: 'Pendiente' },
];

export interface Backup {
  id: number;
  activo: Referencia | null;
  organizacion: Referencia;
  fecha: string;
  estado: EstadoBackup;
  tipo: TipoBackup | null;
  tamano_gb: number | null;
  notas: string | null;
  registrado_por: Referencia | null;
  creado_en: string;
}

export interface BackupEntrada {
  activo?: number;
  estado?: EstadoBackup;
  tipo?: TipoBackup;
  fecha?: string;
  tamano_gb?: number | null;
  notas?: string | null;
}

export interface FiltrosBackups {
  organizacion?: number | null;
  activo?: number | null;
  estado?: EstadoBackup | null;
  tipo?: TipoBackup | null;
  desde?: string | null;
  hasta?: string | null;
  page?: number;
}
