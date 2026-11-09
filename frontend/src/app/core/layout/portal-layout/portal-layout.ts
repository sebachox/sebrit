import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SelectorTema } from '../../../shared/components/selector-tema/selector-tema';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-portal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SelectorTema],
  templateUrl: './portal-layout.html',
  styleUrl: './portal-layout.scss',
})
export class PortalLayout implements OnInit {
  protected auth = inject(AuthService);
  private portal = inject(PortalService);

  empresa = signal<string | null>(null);
  menuAbierto = signal(false);

  ngOnInit() {
    // Sin el nombre de la empresa el portal sigue siendo navegable.
    this.portal.resumen().subscribe({
      next: (r) => this.empresa.set(r.empresa.nombre),
      error: () => {},
    });
  }

  alternarMenu() {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu() {
    this.menuAbierto.set(false);
  }
}
