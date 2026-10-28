export const SERVICE_REFUSAL_LIMIT = 3;
export const SERVICE_REFUSAL_REASON_LIMIT = 300;
export const PREFERRED_COMPANION_LIMIT = 3;
export function validateServiceRefusals(character, characters) {
  const preferences = character.serviceRefusals;
  if (preferences === undefined) return [];
  const fail = (message) => [`${character.id}: ${message}`];
  if (!Array.isArray(preferences) || preferences.length > SERVICE_REFUSAL_LIMIT)
    return fail(`elegí hasta ${SERVICE_REFUSAL_LIMIT} rechazos de servicio.`);
  const seen = new Set();
  for (const preference of preferences) {
    if (
      !preference ||
      typeof preference !== 'object' ||
      Array.isArray(preference) ||
      Object.keys(preference).length !== 2 ||
      !Object.hasOwn(preference, 'character') ||
      !Object.hasOwn(preference, 'reason') ||
      !characters.has(preference.character) ||
      preference.character === character.id ||
      seen.has(preference.character)
    )
      return fail('el rechazo necesita otro personaje existente, sin repetir.');
    if (
      typeof preference.reason !== 'string' ||
      !preference.reason.trim() ||
      preference.reason.length > SERVICE_REFUSAL_REASON_LIMIT ||
      /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(preference.reason)
    )
      return fail(
        `el motivo del rechazo debe tener de 1 a ${SERVICE_REFUSAL_REASON_LIMIT} caracteres, sin símbolos de marcado.`,
      );
    seen.add(preference.character);
  }
  return [];
}
export function validatePreferredCompanions(character, characters) {
  const preferences = character.preferredCompanions;
  if (preferences === undefined) return [];
  const fail = (message) => [`${character.id}: ${message}`];
  if (!Array.isArray(preferences) || preferences.length > PREFERRED_COMPANION_LIMIT)
    return fail(`elegí hasta ${PREFERRED_COMPANION_LIMIT} compañeros preferidos.`);
  const seen = new Set();
  for (const preference of preferences) {
    if (
      !preference ||
      typeof preference !== 'object' ||
      Array.isArray(preference) ||
      Object.keys(preference).length !== 2 ||
      !Object.hasOwn(preference, 'character') ||
      !Object.hasOwn(preference, 'reason') ||
      !characters.has(preference.character) ||
      preference.character === character.id ||
      seen.has(preference.character)
    )
      return fail('la preferencia necesita otro personaje existente, sin repetir.');
    if (
      typeof preference.reason !== 'string' ||
      !preference.reason.trim() ||
      preference.reason.length > SERVICE_REFUSAL_REASON_LIMIT ||
      /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(preference.reason)
    )
      return fail(
        `el motivo de la preferencia debe tener de 1 a ${SERVICE_REFUSAL_REASON_LIMIT} caracteres, sin símbolos de marcado.`,
      );
    if (
      Array.isArray(character.serviceRefusals) &&
      character.serviceRefusals.some((refusal) => refusal?.character === preference.character)
    )
      return fail('la misma persona no puede ser un compañero preferido y un rechazo de servicio.');
    seen.add(preference.character);
  }
  return [];
}
