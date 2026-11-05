import { Rol } from '../models/auth';

export type Modulo = 'dashboard' | 'clientes';
export type Accion = 'ver' | 'editar';

/**
 * Qué roles pueden ver y editar cada módulo. Refleja los permisos del backend
 * (que es quien realmente los aplica); aquí solo decide qué se muestra bloqueado.
 */
const PERMISOS: Record<Modulo, Record<Accion, readonly Rol[]>> = {
  dashboard: { ver: ['admin'], editar: [] },
  clientes: { ver: ['admin', 'tecnico'], editar: ['admin'] },
};

export function puede(rol: Rol | null | undefined, modulo: Modulo, accion: Accion): boolean {
  return !!rol && PERMISOS[modulo][accion].includes(rol);
}
