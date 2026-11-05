import { puede } from './permisos';

describe('puede', () => {
  it('el admin puede editar clientes', () => {
    expect(puede('admin', 'clientes', 'editar')).toBeTrue();
  });

  it('el técnico ve clientes pero no los edita', () => {
    expect(puede('tecnico', 'clientes', 'ver')).toBeTrue();
    expect(puede('tecnico', 'clientes', 'editar')).toBeFalse();
  });

  it('el técnico ve el dashboard', () => {
    expect(puede('tecnico', 'dashboard', 'ver')).toBeTrue();
  });

  it('el cliente no ve el dashboard', () => {
    expect(puede('cliente', 'dashboard', 'ver')).toBeFalse();
  });

  it('el cliente no ve clientes', () => {
    expect(puede('cliente', 'clientes', 'ver')).toBeFalse();
  });

  it('sin rol no puede nada', () => {
    expect(puede(null, 'dashboard', 'ver')).toBeFalse();
    expect(puede(undefined, 'clientes', 'ver')).toBeFalse();
  });
});
