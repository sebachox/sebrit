export interface UsuarioPortal {
  id: number;
  username: string;
  nombres: string | null;
  apellidos: string | null;
  correo: string | null;
  activo: boolean;
}

export interface UsuarioPortalCambios {
  nombres?: string | null;
  apellidos?: string | null;
  correo?: string | null;
  activo?: boolean;
}

export interface UsuarioPortalNuevo extends UsuarioPortalCambios {
  username: string;
  clave_inicial: string;
}
