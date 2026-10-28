import { validateDialogueConditions } from './dialogue-schema.js';
const need = (ok, message) => {
  if (!ok) throw Error(message);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export function validateCampaignStory(value, characters, quests, sectorIds = new Set()) {
  if (value == null) return;
  need(
    exact(value, ['introduction', 'victory', 'defeat', 'chapters', 'failureConditions']) &&
      ['introduction', 'victory', 'defeat'].every((k) => text(value[k], 1000)),
    'La campaña necesita introducción, victoria, derrota y capítulos válidos.',
  );
  need(
    Array.isArray(value.chapters) && value.chapters.length >= 1 && value.chapters.length <= 12,
    'La campaña admite entre uno y doce capítulos.',
  );
  const conditions = (list, required) => {
    validateDialogueConditions(list, characters, quests, sectorIds);
    need(
      Array.isArray(list) &&
        (!required || list.length > 0) &&
        list.every((c) => c.type !== 'meeting'),
      'Los objetivos necesitan condiciones de campaña; los encuentros se resuelven mediante encargos.',
    );
  };
  const ids = new Set();
  for (const chapter of value.chapters) {
    need(
      exact(chapter, ['id', 'name', 'objective', 'conditions']) &&
        typeof chapter.id === 'string' &&
        /^[a-z][a-z0-9-]{0,59}$/.test(chapter.id) &&
        !['constructor', 'prototype'].includes(chapter.id) &&
        !ids.has(chapter.id) &&
        text(chapter.name, 100) &&
        text(chapter.objective, 1000),
      'El capítulo necesita identidad única, nombre y objetivo válidos.',
    );
    ids.add(chapter.id);
    conditions(chapter.conditions, true);
  }
  conditions(value.failureConditions, false);
}
