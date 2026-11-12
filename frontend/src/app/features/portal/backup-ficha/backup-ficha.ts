import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TIPOS_BACKUP } from '../../../core/models/backup';
import { BackupPortal } from '../../../core/models/portal';
import { PortalService } from '../../../core/services/portal.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(TIPOS_BACKUP.map((t) => [t.valor, t.texto]));

@Component({
  selector: 'app-portal-backup-ficha',
  imports: [DatePipe, DecimalPipe, RouterLink, StatusBadge],
  templateUrl: './backup-ficha.html',
})
export class PortalBackupFicha implements OnInit {
  private portal = inject(PortalService);
  private route = inject(ActivatedRoute);
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly nombreTipo = NOMBRE_TIPO;

  estado = signal<'cargando' | 'error' | 'no_encontrado' | 'listo'>('cargando');
  backup = signal<BackupPortal | null>(null);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.estado.set('cargando');
    this.portal.obtenerBackup(this.id).subscribe({
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
}
