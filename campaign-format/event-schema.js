import { validateDialogueConditions, validateDialogueEffects } from './dialogue-schema.js';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const need = (ok, message) => {
  if (!ok) throw Error(message);
};

export function validateCampaignEvents(
  value,
  context,
  sectorIds = new Set((context?.world?.sectors ?? []).map((sector) => sector.id)),
) {
  if (value === undefined) return [];
  try {
    need(
      Array.isArray(value) && value.length <= 100,
      'La campaña admite hasta 100 eventos programados.',
    );
    const characters = new Set(
        (Array.isArray(context?.characters) ? context.characters : []).map((c) => c?.id),
      ),
      quests = new Set((Array.isArray(context?.quests) ? context.quests : []).map((q) => q?.id)),
      ids = new Set();
    for (const event of value) {
      need(
        exact(event, ['id', 'atHour', 'conditions', 'text', 'effects']) &&
          typeof event.id === 'string' &&
          /^[a-z][a-z0-9-]{0,59}$/.test(event.id) &&
          !['constructor', 'prototype'].includes(event.id) &&
          !ids.has(event.id) &&
          integer(event.atHour, 0, 24 * 365 * 100) &&
          typeof event.text === 'string' &&
          event.text.trim().length > 0 &&
          event.text.length <= 1000,
        'El evento necesita identidad única, hora, condiciones, texto y operaciones válidos.',
      );
      ids.add(event.id);
      need(
        event.atHour >= (context?.rules?.startingHour ?? 0),
        'El evento no puede ocurrir antes de la hora inicial de la campaña.',
      );
      need(
        Array.isArray(event.conditions) && event.conditions.every((c) => c?.type !== 'meeting'),
        'Los eventos admiten condiciones de campaña, sin encuentros.',
      );
      validateDialogueConditions(event.conditions, characters, quests, sectorIds);
      need(
        Array.isArray(event.effects) &&
          event.effects.length <= 2 &&
          event.effects.every((e) => ['quest', 'treasury'].includes(e?.type)),
        'Los eventos admiten una operación de tesorería y una de encargo.',
      );
      validateDialogueEffects(event.effects, quests, characters);
    }
    return [];
  } catch (error) {
    return [`Eventos de campaña: ${error.message}`];
  }
}
