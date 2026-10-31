const need = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const CONTENT_QUEST_STATES = Object.freeze(['not-started', 'active', 'completed', 'failed']);
export function validateContentQuests(quests, characters) {
  if (quests === undefined) {
    return;
  }
  need(Array.isArray(quests) && quests.length <= 100, 'La campaña admite hasta 100 encargos.');
  const ids = new Set();
  for (const quest of quests) {
    need(
      object(quest) &&
        ['id', 'title', 'description'].every((field) => Object.hasOwn(quest, field)) &&
        Object.keys(quest).every((field) =>
          ['id', 'title', 'description', 'deadlineHours', 'requiredAlive'].includes(field),
        ) &&
        typeof quest.id === 'string' &&
        /^[a-z][a-z0-9-]{0,59}$/.test(quest.id) &&
        !['constructor', 'prototype'].includes(quest.id) &&
        !ids.has(quest.id) &&
        typeof quest.title === 'string' &&
        quest.title.trim().length > 0 &&
        quest.title.length <= 100 &&
        typeof quest.description === 'string' &&
        quest.description.trim().length > 0 &&
        quest.description.length <= 1000,
      'El encargo necesita identidad, título y descripción válidos.',
    );
    ids.add(quest.id);
    need(
      quest.deadlineHours == null ||
        (Number.isSafeInteger(quest.deadlineHours) &&
          quest.deadlineHours >= 1 &&
          quest.deadlineHours <= 720),
      'El plazo del encargo debe ser de 1 a 720 horas, o quedar vacío.',
    );
    need(
      quest.requiredAlive === undefined ||
        (Array.isArray(quest.requiredAlive) &&
          quest.requiredAlive.length <= 6 &&
          new Set(quest.requiredAlive).size === quest.requiredAlive.length &&
          quest.requiredAlive.every((id) => characters?.has(id))),
      'El encargo necesita hasta seis personajes existentes, sin repetir.',
    );
  }
}
