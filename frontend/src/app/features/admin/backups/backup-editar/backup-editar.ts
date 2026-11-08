import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Backup } from '../../../../core/models/backup';
import { BackupsService } from '../../../../core/services/backups.service';
import { BackupForm } from '../backup-form/backup-form';

@Component({
  selector: 'app-backup-editar',
  imports: [BackupForm, RouterLink, DatePipe],
  template: `
    <a routerLink="/admin/backups" class="volver d-inline-flex align-items-center gap-1 small text-decoration-none mb-3">
      <i class="bi bi-arrow-left"></i>Backups
    </a>
    <h4 class="mb-3">Editar backup</h4>

    @if (estado() === 'cargando') {
      <div class="text-center py-5" role="status"><div class="spinner-border text-primary"></div></div>
    } @else if (estado() === 'no_encontrado') {
      <div class="alert alert-warning">
        Backup no encontrado. <a routerLink="/admin/backups" class="alert-link">Volver a backups</a>
      </div>
    } @else if (estado() === 'error') {
      <div class="alert alert-danger d-flex align-items-center justify-content-between">
        <span>No se pudo cargar el backup.</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="cargar()">Reintentar</button>
      </div>
    } @else if (backup(); as b) {
      <div class="card shadow-sm border-0 contenido">
        <div class="card-header">
          <span class="fw-semibold">{{ b.activo?.nombre ?? 'Sin activo' }}</span>
          <span class="text-muted small ms-2">{{ b.organizacion.nombre }} · registrado el {{ b.creado_en | date: 'dd/MM/yyyy HH:mm' }}</span>
        </div>
        <div class="card-body p-4">
          <app-backup-form [backup]="b" (guardado)="volver()" (cancelado)="volver()" />
        </div>
      </div>
    }
  `,
  styles: `
    .contenido { max-width: 960px; }
    .volver { color: var(--bs-secondary-color); }
    .volver:hover, .volver:focus-visible { color: var(--bs-primary); }
  `,
})
export class BackupEditar implements OnInit {
  private servicio = inject(BackupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  backup = signal<Backup | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.servicio.obtener(this.id).subscribe({
      next: (b) => {
        this.backup.set(b);
        this.estado.set('listo');
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) this.estado.set('no_encontrado');
        else if (e.status !== 403) this.estado.set('error');
      },
    });
  }

  volver() {
    this.router.navigate(['/admin/backups']);
  }
}
