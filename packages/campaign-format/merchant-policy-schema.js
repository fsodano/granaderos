export function validateMerchantPolicies(value, world) {
  if (value === undefined) return [];
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max,
    text = (v, max = 1000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (
    !object(value) ||
    Object.keys(value).length !== 3 ||
    !object(value.preferences) ||
    !object(value.legacyAmmunitionLimits) ||
    !integer(value.defaultLegacyAmmunitionLimit, 0, 1000000)
  )
    return ['Comerciantes de campaña: política inválida.'];
  const errors = [],
    sectors = new Set((world?.sectors ?? []).map((s) => s.id));
  for (const [at, p] of Object.entries(value.preferences))
    if (
      !sectors.has(at) ||
      !object(p) ||
      Object.keys(p).length !== 7 ||
      !text(p.name, 200) ||
      !text(p.description) ||
      !integer(p.buyPercent, 0, 79) ||
      !integer(p.preferredPercent, 0, 79) ||
      !integer(p.minimumWeaponCondition, 0, 100) ||
      !Array.isArray(p.preferredItems) ||
      p.preferredItems.length > 200 ||
      new Set(p.preferredItems.map(String)).size !== p.preferredItems.length ||
      !p.preferredItems.every(
        (id) => integer(id, 1800, 1813) || ['bronze4', 'field8', 'swivel'].includes(id),
      ) ||
      !((p.weaponRefusal === null && p.minimumWeaponCondition === 0) || text(p.weaponRefusal))
    )
      errors.push(`Comerciantes de campaña: preferencia inválida en ${at}.`);
  for (const [at, limit] of Object.entries(value.legacyAmmunitionLimits))
    if (!sectors.has(at) || !integer(limit, 0, 1000000))
      errors.push(`Comerciantes de campaña: reserva antigua inválida en ${at}.`);
  return errors;
}
