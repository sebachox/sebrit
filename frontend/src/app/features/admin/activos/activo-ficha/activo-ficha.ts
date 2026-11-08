import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Activo, ESTADOS_ACTIVO, EstadoActivo } from '../../../../core/models/activo';
import { Backup } from '../../../../core/models/backup';
import { Paginado } from '../../../../core/models/organizacion';
import { ActivosService } from '../../../../core/services/activos.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BackupsService } from '../../../../core/services/backups.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { BackupForm } from '../../backups/backup-form/backup-form';

type Clave = keyof Activo;

const IDENTIFICACION: { clave: Clave; etiqueta: string; numerico?: boolean }[] = [
  { clave: 'hostname', etiqueta: 'Hostname' },
  { clave: 'ip', etiqueta: 'IP', numerico: true },
  { clave: 'sistema_operativo', etiqueta: 'Sistema operativo / firmware' },
  { clave: 'fabricante', etiqueta: 'Fabricante' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'numero_serie', etiqueta: 'Número de serie', numerico: true },
];

const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-activo-ficha',
  imports: [DatePipe, RouterLink, StatusBadge, BackupForm],
  templateUrl: './activo-ficha.html',
  styleUrl: './activo-ficha.scss',
})
export class ActivoFicha implements OnInit {
  private servicio = inject(ActivosService);
  private backups = inject(BackupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected auth = inject(AuthService);

  readonly identificacion = IDENTIFICACION;
  readonly estados = ESTADOS_ACTIVO;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  activo = signal<Activo | null>(null);
  historial = signal<Paginado<Backup> | null>(null);
  paginaHistorial = signal(1);

  guardado = signal(this.route.snapshot.queryParamMap.get('guardado') === '1');
  confirmandoBaja = signal(false);
  registrando = signal(false);
  cambiando = signal(false);
  errorAccion = signal<string | null>(null);

  puedeEditar = computed(() => this.auth.puede('activos', 'editar'));
  totalPaginasHistorial = computed(() =>
    Math.max(1, Math.ceil((this.historial()?.count ?? 0) / TAMANO_PAGINA)),
  );

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener(this.id).subscribe({
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
    this.backups.listar({ activo: this.id, page: this.paginaHistorial() }).subscribe({
      next: (p) => this.historial.set(p),
      error: () => this.historial.set(null),
    });
  }

  irAPaginaHistorial(n: number) {
    this.paginaHistorial.set(n);
    this.cargarHistorial();
  }

  valor(a: Activo, clave: Clave): string | null {
    const v = a[clave];
    return v === null || v === undefined || v === '' ? null : String(v);
  }

  cambiarEstado(nuevo: EstadoActivo) {
    const a = this.activo();
    if (!a || a.estado === nuevo || this.cambiando()) return;
    this.ejecutar(this.servicio.cambiarEstado(this.id, nuevo));
  }

  pedirBaja() {
    this.guardado.set(false);
    this.confirmandoBaja.set(true);
  }

  confirmarBaja() {
    this.ejecutar(this.servicio.darDeBaja(this.id, true), () => this.confirmandoBaja.set(false));
  }

  reactivar() {
    this.ejecutar(this.servicio.darDeBaja(this.id, false));
  }

  editar() {
    this.router.navigate(['/admin/activos', this.id, 'editar']);
  }

  abrirRegistro() {
    this.guardado.set(false);
    this.registrando.set(true);
  }

  backupRegistrado() {
    this.registrando.set(false);
    this.paginaHistorial.set(1);
    this.cargar();
  }

  private ejecutar(peticion: ReturnType<ActivosService['obtener']>, alTerminar?: () => void) {
    this.cambiando.set(true);
    this.errorAccion.set(null);
    peticion.subscribe({
      next: (a) => {
        this.activo.set(a);
        this.cambiando.set(false);
        alTerminar?.();
      },
      error: (e: HttpErrorResponse) => {
        this.cambiando.set(false);
        const detalle = e.status === 400 && e.error ? Object.values(e.error).flat()[0] : null;
        this.errorAccion.set(
          typeof detalle === 'string' ? detalle : 'No se pudo guardar el cambio. Intenta de nuevo.',
        );
      },
    });
  }
}
