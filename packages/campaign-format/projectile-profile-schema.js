const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) =>
  record(value) &&
  Object.keys(value).length === fields.length &&
  fields.every((field) => Object.hasOwn(value, field));
const modelIdentifier = (value) =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);

export function isProjectileEnergyRecord(value) {
  return (
    exact(value, ['model', 'massGrams', 'muzzleVelocityMps']) &&
    modelIdentifier(value.model) &&
    Number.isFinite(value.massGrams) &&
    value.massGrams > 0 &&
    Number.isFinite(value.muzzleVelocityMps) &&
    value.muzzleVelocityMps > 0
  );
}

export function isProjectileAirDragRecord(value) {
  return (
    exact(value, ['model', 'retentionAtRange']) &&
    modelIdentifier(value.model) &&
    Number.isFinite(value.retentionAtRange) &&
    value.retentionAtRange > 0 &&
    value.retentionAtRange <= 1
  );
}

export const validMaterialRangeSlope = (value) =>
  Number.isFinite(value) && value >= 0 && value <= 1;
