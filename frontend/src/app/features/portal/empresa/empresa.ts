import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmpresaPortal } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type Clave = keyof EmpresaPortal;
interface Campo {
  clave: Clave;
  etiqueta: string;
  tipo?: 'correo' | 'fecha' | 'plan';
}

const BLOQUES: { titulo: string; icono: string; campos: Campo[] }[] = [
  {
    titulo: 'Empresa',
    icono: 'bi-building',
    campos: [
      { clave: 'nit', etiqueta: 'NIT' },
      { clave: 'sector', etiqueta: 'Sector' },
      { clave: 'telefono', etiqueta: 'Teléfono' },
      { clave: 'correo', etiqueta: 'Correo', tipo: 'correo' },
      { clave: 'direccion', etiqueta: 'Dirección' },
      { clave: 'ciudad', etiqueta: 'Ciudad' },
    ],
  },
  {
    titulo: 'Contacto principal',
    icono: 'bi-person-vcard',
    campos: [
      { clave: 'contacto_nombre', etiqueta: 'Nombre' },
      { clave: 'contacto_cargo', etiqueta: 'Cargo' },
      { clave: 'contacto_correo', etiqueta: 'Correo', tipo: 'correo' },
      { clave: 'contacto_telefono', etiqueta: 'Teléfono' },
    ],
  },
  {
    titulo: 'Contrato',
    icono: 'bi-file-earmark-text',
    campos: [
      { clave: 'plan', etiqueta: 'Plan', tipo: 'plan' },
      { clave: 'fecha_inicio_contrato', etiqueta: 'Inicio', tipo: 'fecha' },
      { clave: 'fecha_fin_contrato', etiqueta: 'Fin', tipo: 'fecha' },
    ],
  },
];

@Component({
  selector: 'app-portal-empresa',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './empresa.html',
})
export class PortalEmpresa implements OnInit {
  private portal = inject(PortalService);

  readonly bloques = BLOQUES;
  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  empresa = signal<EmpresaPortal | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.portal.empresa().subscribe({
      next: (e) => {
        this.empresa.set(e);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }

  valor(e: EmpresaPortal, clave: Clave): string | null {
    const v = e[clave];
    return v === null || v === '' ? null : String(v);
  }
}
