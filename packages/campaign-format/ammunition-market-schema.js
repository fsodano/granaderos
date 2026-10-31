export const AMMUNITION_FAMILY_LABELS = Object.freeze({
  ammoMusket: 'Cartuchos de mosquete',
  ammoRifle: 'Munición de fusil',
  ammoPistol: 'Cartuchos de pistola',
  ammoShot: 'Cargas de perdigones',
});
const keys = Object.keys(AMMUNITION_FAMILY_LABELS);
const ammunitionMarketLocations = (context) =>
  (context?.world?.sectors ?? []).filter(
    (sector) => (context.world.arrivalFacilities?.[sector.id] ?? []).length > 0,
  );
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const shape = (v, fields) =>
  object(v) && Object.keys(v).length === fields.length && fields.every((k) => Object.hasOwn(v, k));
const count = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
function profileErrors(p, label) {
  if (!shape(p, ['enabled', 'automaticPurchase', 'restockHours', 'families'])) {
    return [`${label}: completá las reglas sin campos adicionales.`];
  }
  const errors = [];
  if (typeof p.enabled !== 'boolean' || typeof p.automaticPurchase !== 'boolean') {
    errors.push(`${label}: los permisos deben estar activados o desactivados.`);
  }
  if (!Number.isSafeInteger(p.restockHours) || p.restockHours < 1 || p.restockHours > 720) {
    errors.push(`${label}: la reposición requiere entre 1 y 720 horas.`);
  }
  if (!shape(p.families, keys)) {
    return [...errors, `${label}: configurá las cuatro familias de munición.`];
  }
  for (const key of keys) {
    const f = p.families[key];
    if (
      !shape(f, ['initial', 'capacity', 'replenish', 'price']) ||
      !['initial', 'capacity', 'replenish'].every((k) => count(f[k])) ||
      f.initial > f.capacity ||
      !(f.price === null || count(f.price))
    ) {
      errors.push(
        `${label}, ${AMMUNITION_FAMILY_LABELS[key]}: usá cantidades enteras de 0 a 1000000, existencias iniciales no mayores que el máximo y un precio válido.`,
      );
    }
  }
  return errors;
}
export function validateAmmunitionMarket(value, context = null) {
  if (value === undefined) {
    return [];
  }
  if (!shape(value, ['defaults', 'locations']) || !object(value.locations)) {
    return ['Proveedores de munición: configurá las reglas generales y las localidades.'];
  }
  const errors = profileErrors(value.defaults, 'Proveedores de munición');
  for (const [at, p] of Object.entries(value.locations)) {
    const place = ammunitionMarketLocations(context).find((s) => s.id === at);
    if (!place) {
      errors.push(`Proveedor de munición: la localidad ${at} no admite abastecimiento.`);
    }
    errors.push(...profileErrors(p, place?.name ?? at));
  }
  return errors;
}
