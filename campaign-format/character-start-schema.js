export const CHARACTER_SUPPLY_LIMIT = 1000;
export const CHARACTER_SUPPLY_FIELDS = Object.freeze([
  'rations',
  'torches',
  'medkits',
  'boleadoras',
]);
export function validStartingCondition(value, maxHp) {
  const bounds = {
    hp: [1, maxHp],
    energy: [0, 100],
    fatigue: [0, 100],
    bleeding: [0, 10],
    bandaged: [0, maxHp],
  };
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(bounds).length &&
    Object.entries(bounds).every(
      ([key, [min, max]]) =>
        Object.hasOwn(value, key) &&
        Number.isSafeInteger(value[key]) &&
        value[key] >= min &&
        value[key] <= max,
    ) &&
    value.bandaged <= maxHp - value.hp &&
    (value.bleeding === 0 || (value.hp < maxHp && value.bandaged < maxHp - value.hp))
  );
}
export function validStartingSupplies(value) {
  const fields = CHARACTER_SUPPLY_FIELDS;
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every(
      (key) => fields.includes(key) || ['priming', 'flints'].includes(key),
    ) &&
    fields.every((k) => Object.hasOwn(value, k)) &&
    Object.values(value).every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= CHARACTER_SUPPLY_LIMIT,
    )
  );
}
