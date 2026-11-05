export type Rol = 'admin' | 'tecnico' | 'cliente';

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  cliente: 'Cliente',
};

export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
}

export interface Credenciales {
  username: string;
  password: string;
}

export interface RespuestaLogin {
  access: string;
  refresh: string;
  usuario: Usuario;
}

export interface RespuestaRefresh {
  access: string;
}
