import { formatAP, isAPField } from './action-point-format.js';
import { isContentImageReference } from './campaign-assets.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validWeaponArt = (value) =>
  isContentImageReference(value) && (!value.startsWith('data:') || value.length < 350000);
/** @type {ReadonlyArray<readonly ['price' | 'crew' | 'fireAP' | 'reloadAP' | 'moveAP' | 'pivotAP' | 'range' | 'damage' | 'radius' | 'penetration' | 'initialAmmo', string, number, number]>} */
export const ARTILLERY_FIELDS = Object.freeze([
  ['price', 'Precio de compra (pesos)', 0, 1000000],
  ['crew', 'Artilleros necesarios', 1, 6],
  ['fireAP', 'PA de disparo por artillero', 1, 100],
  ['reloadAP', 'PA de recarga por artillero', 1, 300],
  ['moveAP', 'PA para arrastrar por artillero', 1, 100],
  ['pivotAP', 'PA para girar por artillero', 1, 100],
  ['range', 'Alcance de bala rasa (celdas)', 1, 200],
  ['damage', 'Daño de bala rasa', 1, 300],
  ['radius', 'Escala de metralla (mitad del alcance)', 1, 20],
  ['penetration', 'Penetración de bala rasa', 0, 10],
  ['initialAmmo', 'Municiones de reserva al comprar', 0, 1000],
]);

export function validateArtilleryProfiles(value) {
  if (value === undefined) {
    return [];
  }
  if (
    !object(value) ||
    Object.keys(value).length !== 3 ||
    !['bronze4', 'field8', 'swivel'].every((key) => Object.hasOwn(value, key))
  ) {
    return ['Artillería: configurá los tres modelos, sin modelos adicionales.'];
  }
  const errors = [],
    keys = ['name', 'art', 'initialLoaded', ...ARTILLERY_FIELDS.map(([key]) => key)];
  for (const [type, p] of Object.entries(value)) {
    if (
      !object(p) ||
      Object.keys(p).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(p, key))
    ) {
      errors.push(`${type}: completá todos los datos de artillería, sin campos adicionales.`);
      continue;
    }
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) {
      errors.push(`${type}: el nombre debe tener de 1 a 80 caracteres.`);
    }
    if (!validWeaponArt(p.art)) {
      errors.push(`${type}: la imagen de artillería es inválida.`);
    }
    if (typeof p.initialLoaded !== 'boolean') {
      errors.push(`${type}: indicá si la pieza se entrega cargada.`);
    }
    for (const [key, label, min, max] of ARTILLERY_FIELDS) {
      if (!Number.isSafeInteger(p[key]) || p[key] < min || p[key] > max) {
        errors.push(
          isAPField(key)
            ? `${type}, ${label}: elegí de ${formatAP(min)} a ${formatAP(max)} PA, en pasos de 0,25.`
            : `${type}, ${label}: elegí un entero de ${min} a ${max}.`,
        );
      }
    }
  }
  return errors;
}
