import { Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'sebrit.tema';
const POR_DEFECTO: Tema = 'oscuro';

function leer(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'claro' || t === 'oscuro' ? t : POR_DEFECTO;
  } catch {
    return POR_DEFECTO;
  }
}

/**
 * Tema claro/oscuro de toda la app. Se aplica con `data-bs-theme` en <html>
 * (modo de color nativo de Bootstrap 5.3). index.html aplica el guardado antes
 * de que arranque Angular para evitar un destello del tema equivocado.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly _tema = signal<Tema>(leer());
  readonly tema = this._tema.asReadonly();

  constructor() {
    this.aplicar(this._tema());
  }

  alternar() {
    this.establecer(this._tema() === 'oscuro' ? 'claro' : 'oscuro');
  }

  establecer(tema: Tema) {
    this._tema.set(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin almacenamiento disponible el tema dura solo esta sesión.
    }
    this.aplicar(tema);
  }

  private aplicar(tema: Tema) {
    document.documentElement.setAttribute('data-bs-theme', tema === 'oscuro' ? 'dark' : 'light');
  }
}
