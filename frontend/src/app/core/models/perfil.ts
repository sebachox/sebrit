import { Rol } from './auth';

export interface Perfil {
  id: number;
  username: string;
  nombres: string | null;
  apellidos: string | null;
  nombre_completo: string;
  correo: string | null;
  rol: Rol;
  organizacion: { id: number; nombre: string } | null;
}

export interface PerfilEntrada {
  nombres: string | null;
  apellidos: string | null;
  correo: string | null;
}

export interface CambioClave {
  clave_actual: string;
  clave_nueva: string;
}
