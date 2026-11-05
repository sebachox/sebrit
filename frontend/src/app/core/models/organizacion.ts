export type Plan = 'basico' | 'estandar' | 'premium';

export const PLANES: { valor: Plan; texto: string }[] = [
  { valor: 'basico', texto: 'Básico' },
  { valor: 'estandar', texto: 'Estándar' },
  { valor: 'premium', texto: 'Premium' },
];

export interface Paginado<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface OrganizacionResumida {
  id: number;
  nombre: string;
  nit: string | null;
  ciudad: string | null;
  plan: Plan | null;
  contacto_nombre: string | null;
  fecha_fin_contrato: string | null;
  activa: boolean;
}

export interface ResumenOrganizacion {
  activos: number;
  tickets_abiertos: number;
  incidentes_activos: number;
  usuarios: number;
}

export interface Organizacion extends OrganizacionResumida {
  sector: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  contacto_cargo: string | null;
  contacto_correo: string | null;
  contacto_telefono: string | null;
  fecha_inicio_contrato: string | null;
  creado_en: string;
  actualizado_en: string;
  resumen: ResumenOrganizacion;
}

export type OrganizacionEntrada = Partial<
  Omit<Organizacion, 'id' | 'resumen' | 'creado_en' | 'actualizado_en'>
>;

export interface FiltrosOrganizaciones {
  q?: string;
  activa?: boolean | null;
  plan?: Plan | null;
  page?: number;
}
