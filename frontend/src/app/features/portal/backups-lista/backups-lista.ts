import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EstadoBackup } from '../../../core/models/activo';
import { ESTADOS_BACKUP, TIPOS_BACKUP, TipoBackup } from '../../../core/models/backup';
import { Paginado } from '../../../core/models/organizacion';
import { ActivoPortalResumido, BackupPortal } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;
const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_BACKUP.map((t) => [t.valor, t.texto]));

@Component({
  selector: 'app-portal-backups-lista',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge],
  templateUrl: './backups-lista.html',
})
export class PortalBackupsLista implements OnInit, OnDestroy {
  private portal = inject(PortalService);

  readonly estados = ESTADOS_BACKUP;
  readonly tipos = TIPOS_BACKUP;
  readonly nombreTipo = NOMBRE_TIPO;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<BackupPortal> | null>(null);
  activos = signal<ActivoPortalResumido[]>([]);

  filtroEstado = signal<EstadoBackup | null>(null);
  tipo = signal<TipoBackup | null>(null);
  activo = signal<number | null>(null);
  fechaDesde = signal('');
  fechaHasta = signal('');
  pagina = signal(1);

  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  desde = computed(() => (this.pagina() - 1) * TAMANO_PAGINA + 1);
  hasta = computed(() => this.desde() + (this.datos()?.results.length ?? 0) - 1);
  hayFiltros = computed(
    () => !!(this.filtroEstado() || this.tipo() || this.activo() || this.fechaDesde() || this.fechaHasta()),
  );

  private peticion?: Subscription;

  ngOnInit() {
    // El filtro por activo es opcional: si la lista falla, se ofrece el resto.
    this.portal.listarActivos({ pageSize: 100 }).subscribe({
      next: (p) => this.activos.set(p.results),
      error: () => this.activos.set([]),
    });
    this.cargar();
  }

  ngOnDestroy() {
    this.peticion?.unsubscribe();
  }

  cargar() {
    this.estado.set('cargando');
    this.peticion?.unsubscribe();
    this.peticion = this.portal
      .listarBackups({
        estado: this.filtroEstado(),
        tipo: this.tipo(),
        activo: this.activo(),
        desde: this.fechaDesde() || null,
        hasta: this.fechaHasta() || null,
        page: this.pagina(),
      })
      .subscribe({
        next: (d) => {
          this.datos.set(d);
          this.estado.set('listo');
        },
        error: (e: HttpErrorResponse) => {
          if (e.status === 404 && this.pagina() > 1) {
            this.pagina.set(1);
            this.cargar();
          } else if (e.status !== 403) {
            this.estado.set('error');
          }
        },
      });
  }

  cambiarEstado(v: string) {
    this.filtroEstado.set((v || null) as EstadoBackup | null);
    this.reiniciar();
  }

  cambiarTipo(v: string) {
    this.tipo.set((v || null) as TipoBackup | null);
    this.reiniciar();
  }

  cambiarActivo(v: string) {
    this.activo.set(v ? Number(v) : null);
    this.reiniciar();
  }

  cambiarDesde(v: string) {
    this.fechaDesde.set(v);
    this.reiniciar();
  }

  cambiarHasta(v: string) {
    this.fechaHasta.set(v);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }
}
