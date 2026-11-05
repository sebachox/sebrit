import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Organizacion } from '../../../../core/models/organizacion';
import { AuthService } from '../../../../core/services/auth.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

type Clave = keyof Organizacion;
interface Campo {
  clave: Clave;
  etiqueta: string;
  tipo?: 'texto' | 'correo' | 'fecha' | 'plan';
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
  selector: 'app-cliente-ficha',
  imports: [DatePipe, RouterLink, StatCard, StatusBadge],
  templateUrl: './cliente-ficha.html',
  styleUrl: './cliente-ficha.scss',
})
export class ClienteFicha implements OnInit {
  private servicio = inject(OrganizacionesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected auth = inject(AuthService);

  readonly bloques = BLOQUES;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  org = signal<Organizacion | null>(null);
  guardado = signal(this.route.snapshot.queryParamMap.get('guardado') === '1');
  confirmando = signal(false);
  cambiando = signal(false);
  errorEstado = signal(false);

  puedeEditar = computed(() => this.auth.puede('clientes', 'editar'));

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener(this.id).subscribe({
      next: (o) => {
        this.org.set(o);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error');
      },
    });
  }

  valor(o: Organizacion, clave: Clave): string | null {
    const v = o[clave];
    return v === null || v === undefined || v === '' ? null : String(v);
  }

  editar() {
    this.router.navigate(['/admin/clientes', this.id, 'editar']);
  }

  pedirDesactivar() {
    this.guardado.set(false);
    this.confirmando.set(true);
  }

  cambiarEstado(activa: boolean) {
    this.cambiando.set(true);
    this.errorEstado.set(false);
    this.servicio.cambiarEstado(this.id, activa).subscribe({
      next: (o) => {
        this.org.set(o);
        this.confirmando.set(false);
        this.cambiando.set(false);
      },
      error: () => {
        this.cambiando.set(false);
        this.errorEstado.set(true);
      },
    });
  }
}
