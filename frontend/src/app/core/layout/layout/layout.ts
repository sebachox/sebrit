import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Modulo } from '../../auth/permisos';
import { ETIQUETA_ROL } from '../../models/auth';
import { AuthService } from '../../services/auth.service';
import { SelectorTema } from '../../../shared/components/selector-tema/selector-tema';

const CLAVE_BARRA = 'sebrit.sidebar';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectorTema],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  protected auth = inject(AuthService);
  menuAbierto = signal(false);
  plegado = signal(localStorage.getItem(CLAVE_BARRA) === 'plegado');

  alternarMenu() {
    this.menuAbierto.update((v) => !v);
  }

  alternarPlegado() {
    const plegado = !this.plegado();
    this.plegado.set(plegado);
    localStorage.setItem(CLAVE_BARRA, plegado ? 'plegado' : 'expandido');
  }

  cerrarMenu() {
    this.menuAbierto.set(false);
  }

  rol = computed(() => {
    const r = this.auth.usuario()?.rol;
    return r ? ETIQUETA_ROL[r] : null;
  });

  tituloPanel = computed(() =>
    this.auth.usuario()?.rol === 'tecnico' ? 'Panel técnico' : 'Panel de administración',
  );

  readonly enlaces: { ruta: string; icono: string; texto: string; modulo: Modulo }[] = [
    { ruta: '/admin/dashboard', icono: 'bi-speedometer2', texto: 'Dashboard', modulo: 'dashboard' },
    { ruta: '/admin/clientes', icono: 'bi-building', texto: 'Clientes', modulo: 'clientes' },
    { ruta: '/admin/activos', icono: 'bi-hdd-rack', texto: 'Activos', modulo: 'activos' },
    { ruta: '/admin/backups', icono: 'bi-cloud-arrow-up', texto: 'Backups', modulo: 'backups' },
    { ruta: '/admin/tickets', icono: 'bi-ticket-perforated', texto: 'Tickets', modulo: 'tickets' },
    { ruta: '/admin/incidentes', icono: 'bi-exclamation-octagon', texto: 'Incidentes', modulo: 'incidentes' },
  ];
}
