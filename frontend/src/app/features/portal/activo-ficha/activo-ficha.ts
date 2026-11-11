import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TIPOS_ACTIVO } from '../../../core/models/activo';
import { TIPOS_BACKUP } from '../../../core/models/backup';
import { Paginado } from '../../../core/models/organizacion';
import { ActivoPortalDetalle, BackupPortal } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_ACTIVO.map((t) => [t.valor, t.texto]));
const NOMBRE_TIPO_BACKUP: Record<string, string> = Object.fromEntries(TIPOS_BACKUP.map((t) => [t.valor, t.texto]));

type ClaveDato = 'ubicacion' | 'fabricante' | 'modelo' | 'sistema_operativo' | 'numero_serie';

@Component({
  selector: 'app-portal-activo-ficha',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge],
  templateUrl: './activo-ficha.html',
})
export class PortalActivoFicha implements OnInit {
  private portal = inject(PortalService);
  private route = inject(ActivatedRoute);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly nombreTipo = NOMBRE_TIPO;
  readonly nombreTipoBackup = NOMBRE_TIPO_BACKUP;
  readonly datosEquipo: { clave: ClaveDato; etiqueta: string }[] = [
    { clave: 'ubicacion', etiqueta: 'Ubicación' },
    { clave: 'fabricante', etiqueta: 'Fabricante' },
    { clave: 'modelo', etiqueta: 'Modelo' },
    { clave: 'sistema_operativo', etiqueta: 'Sistema operativo' },
    { clave: 'numero_serie', etiqueta: 'Número de serie' },
  ];

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  activo = signal<ActivoPortalDetalle | null>(null);

  estadoHistorial = signal<'cargando' | 'error' | 'listo'>('cargando');
  historial = signal<Paginado<BackupPortal> | null>(null);
  pagina = signal(1);
  totalPaginas = computed(() => Math.max(1, Math.ceil((this.historial()?.count ?? 0) / TAMANO_PAGINA)));

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.portal.obtenerActivo(this.id).subscribe({
      next: (a) => {
        this.activo.set(a);
        this.estado.set('listo');
        this.cargarHistorial();
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error');
      },
    });
  }

  cargarHistorial() {
    this.estadoHistorial.set('cargando');
    this.portal.listarBackups({ activo: this.id, page: this.pagina() }).subscribe({
      next: (h) => {
        this.historial.set(h);
        this.estadoHistorial.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status !== 403) this.estadoHistorial.set('error');
      },
    });
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargarHistorial();
  }
}
