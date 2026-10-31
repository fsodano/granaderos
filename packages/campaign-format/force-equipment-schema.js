export const FORCE_EQUIPMENT_GROUPS = Object.freeze({
  oppositionEquipment: {
    label: 'Enemigos',
    bladeField: 'oppositionBlades',
    appearanceField: 'oppositionAppearance',
    roles: {
      officer: 'Oficiales enemigos',
      line: 'Infantería enemiga',
      veteran: 'Veteranos enemigos',
    },
  },
  militiaEquipment: {
    label: 'Milicias',
    bladeField: 'militiaBlades',
    appearanceField: 'militiaAppearance',
    roles: { green: 'Cívicos', regular: 'Montoneros', veteran: 'Soldados de línea' },
  },
});
export function validateForceEquipment(field, value, weaponIds) {
  const group = FORCE_EQUIPMENT_GROUPS[field],
    roles = Object.keys(group.roles);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== roles.length ||
    !roles.every((role) => Object.hasOwn(value, role))
  ) {
    return [`${group.label}: elegí un arma para cada tipo de tropa.`];
  }
  return roles.flatMap((role) =>
    value[role] === null || weaponIds.has(value[role])
      ? []
      : [`${group.roles[role]}: el arma no existe.`],
  );
}

const validAppearance = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 2 &&
  Object.hasOwn(value, 'spriteAppearance') &&
  Object.hasOwn(value, 'skinTone') &&
  typeof value.spriteAppearance === 'string' &&
  value.spriteAppearance.length > 0 &&
  value.spriteAppearance.length <= 100 &&
  ['light', 'brown', 'dark'].includes(value.skinTone);

export function validateForceAppearance(field, value) {
  const group = FORCE_EQUIPMENT_GROUPS[field],
    roles = Object.keys(group.roles);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== roles.length ||
    !roles.every((role) => Object.hasOwn(value, role))
  ) {
    return [`${group.label}: elegí una apariencia para cada tipo de tropa.`];
  }
  return roles.flatMap((role) =>
    validAppearance(value[role])
      ? []
      : [`${group.roles[role]}: elegí una apariencia y una paleta de piel válidas.`],
  );
}
