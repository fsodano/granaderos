const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;

// Pure data admission. Authored JSON selects routes and finite resources;
// it cannot replace the shared movement, encounter or combat rules.
export function validateEnemyStrategy(value, world) {
  if (value === undefined) return [];
  const errors = [],
    bad = (message) => errors.push(`Estrategia enemiga: ${message}`);
  if (!exact(value, ['version', 'theaters']) || value.version !== 1 || !object(value.theaters)) {
    bad('se necesita una política de versión 1.');
    return errors;
  }
  const theaters = new Set((world?.theaters ?? []).map((t) => t?.id)),
    sectors = new Map((world?.sectors ?? []).map((s) => [s?.id, s]));
  if (Object.keys(value.theaters).length > theaters.size) bad('hay demasiadas regiones.');
  for (const [theater, policy] of Object.entries(value.theaters)) {
    if (
      !theaters.has(theater) ||
      !exact(policy, ['legHours', 'reserve', 'raidEveryHours', 'axis']) ||
      !integer(policy.legHours, 1, 240) ||
      !integer(policy.reserve, 0, 100000) ||
      !integer(policy.raidEveryHours, 1, 876000) ||
      !Array.isArray(policy.axis) ||
      !policy.axis.length ||
      policy.axis.length > sectors.size
    ) {
      bad(`política inválida: ${theater}.`);
      continue;
    }
    if (
      new Set(policy.axis).size !== policy.axis.length ||
      policy.axis.some((id) => sectors.get(id)?.theater !== theater)
    ) {
      bad(`el eje de ${theater} necesita localidades únicas de su región.`);
      continue;
    }
    for (let i = 1; i < policy.axis.length; i++)
      if (
        !sectors.get(policy.axis[i - 1]).neighbors?.includes(policy.axis[i]) ||
        !sectors.get(policy.axis[i]).neighbors?.includes(policy.axis[i - 1])
      )
        bad(`el eje de ${theater} necesita un camino conectado.`);
  }
  return errors;
}
