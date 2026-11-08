import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EstadoBackup, Referencia } from '../../../../core/models/activo';
import {
  Backup,
  ESTADOS_BACKUP,
  FiltrosBackups,
  TIPOS_BACKUP,
  TipoBackup,
} from '../../../../core/models/backup';
import { Paginado } from '../../../../core/models/organizacion';
import { AuthService } from '../../../../core/services/auth.service';
import { BackupsService } from '../../../../core/services/backups.service';
import { OrganizacionesService } from '../../../../core/services/organizaciones.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-backups-lista',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './backups-lista.html',
  styleUrl: './backups-lista.scss',
})
export class BackupsLista implements OnInit, OnDestroy {
  private servicio = inject(BackupsService);
  private organizaciones = inject(OrganizacionesService);
  protected auth = inject(AuthService);

  readonly estados = ESTADOS_BACKUP;
  readonly tipos = TIPOS_BACKUP;

  estado = signal<'cargando' | 'error' | 'listo'>('cargando');
  datos = signal<Paginado<Backup> | null>(null);
  clientes = signal<Referencia[]>([]);

  organizacion = signal<number | null>(null);
  filtroEstado = signal<EstadoBackup | null>(null);
  tipo = signal<TipoBackup | null>(null);
  desde = signal<string | null>(null);
  hasta = signal<string | null>(null);
  pagina = signal(1);

  confirmandoBorrar = signal<number | null>(null);
  borrando = signal(false);
  errorAccion = signal<string | null>(null);

  puedeEditar = computed(() => this.auth.puede('backups', 'editar'));
  totalPaginas = computed(() => Math.max(1, Math.ceil((this.datos()?.count ?? 0) / TAMANO_PAGINA)));
  hayFiltros = computed(
    () =>
      !!(this.organizacion() || this.filtroEstado() || this.tipo() || this.desde() || this.hasta()),
  );

  private peticion?: Subscription;

  ngOnInit() {
    this.organizaciones.listar({ pageSize: 100 }).subscribe({
      next: (p) => this.clientes.set(p.results.map((o) => ({ id: o.id, nombre: o.nombre }))),
      error: () => this.clientes.set([]),
    });
    this.cargar();
  }

  ngOnDestroy() {
    this.peticion?.unsubscribe();
  }

  cargar() {
    this.estado.set('cargando');
    this.peticion?.unsubscribe();
    this.peticion = this.servicio.listar(this.filtros()).subscribe({
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

  cambiarCliente(v: string) {
    this.organizacion.set(v ? Number(v) : null);
    this.reiniciar();
  }

  cambiarEstado(v: string) {
    this.filtroEstado.set((v || null) as EstadoBackup | null);
    this.reiniciar();
  }

  cambiarTipo(v: string) {
    this.tipo.set((v || null) as TipoBackup | null);
    this.reiniciar();
  }

  cambiarDesde(v: string) {
    this.desde.set(v || null);
    this.reiniciar();
  }

  cambiarHasta(v: string) {
    this.hasta.set(v || null);
    this.reiniciar();
  }

  irAPagina(n: number) {
    this.pagina.set(n);
    this.cargar();
  }

  borrar(id: number) {
    this.borrando.set(true);
    this.errorAccion.set(null);
    this.servicio.borrar(id).subscribe({
      next: () => {
        this.borrando.set(false);
        this.confirmandoBorrar.set(null);
        this.cargar();
      },
      error: () => {
        this.borrando.set(false);
        this.errorAccion.set('No se pudo borrar el backup. Intenta de nuevo.');
      },
    });
  }

  private reiniciar() {
    this.pagina.set(1);
    this.cargar();
  }

  private filtros(): FiltrosBackups {
    return {
      organizacion: this.organizacion(),
      estado: this.filtroEstado(),
      tipo: this.tipo(),
      desde: this.desde(),
      hasta: this.hasta(),
      page: this.pagina(),
    };
  }
}
