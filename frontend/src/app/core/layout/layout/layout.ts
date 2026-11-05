import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Modulo } from '../../auth/permisos';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  protected auth = inject(AuthService);
  menuAbierto = signal(false);

  alternarMenu() {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu() {
    this.menuAbierto.set(false);
  }

  tituloPanel = computed(() =>
    this.auth.usuario()?.rol === 'tecnico' ? 'Panel técnico' : 'Panel de administración',
  );

  readonly enlaces: { ruta: string; icono: string; texto: string; modulo: Modulo }[] = [
    { ruta: '/admin/dashboard', icono: 'bi-speedometer2', texto: 'Dashboard', modulo: 'dashboard' },
    { ruta: '/admin/clientes', icono: 'bi-building', texto: 'Clientes', modulo: 'clientes' },
  ];
}
