// JSON admission helpers. This module has no runtime campaign dependencies.
export function validateCampaignData(value: unknown): string[] {
  const seen = new Set<object>();
  let count = 0;
  function visit(value: unknown, depth: number, path: string): void {
    function fail(message: string): never {
      throw Error(`${path}: ${message}`);
    }
    if (++count > 250000 || depth > 32) {
      fail('Los datos de campaña son demasiado grandes o anidados.');
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return;
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      fail('Los datos de campaña deben ser JSON válido, sin ciclos.');
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      fail('Los datos de campaña deben contener objetos JSON.');
    }
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (['constructor', 'prototype', '__proto__'].includes(key)) {
        fail('Los datos de campaña contienen una clave no permitida.');
      }
      visit(child, depth + 1, `${path}.${key}`);
    }
    seen.delete(value);
  }
  try {
    visit(value, 0, 'campaña');
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Los datos de campaña no son válidos.'];
  }
}
