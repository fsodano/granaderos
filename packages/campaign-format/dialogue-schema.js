import { CONTENT_QUEST_STATES } from './quest-schema.js';
const need = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const integer = (value, minimum, maximum) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const id = (value) =>
  typeof value === 'string' &&
  /^[a-z][a-z0-9-]{0,59}$/.test(value) &&
  !['constructor', 'prototype'].includes(value);
const text = (value, maximum) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const fields = exact;
export const DIALOGUE_PERSON_STATES = Object.freeze([
  'alive',
  'dead',
  'serving',
  'present',
  'conscious',
  'unconscious',
  'wounded',
  'bleeding',
  'stable',
  'healthy',
]);
export const DIALOGUE_SUPPLY_IDS = Object.freeze([
  'rations',
  'torches',
  'medkits',
  'boleadoras',
  'priming',
  'flints',
]);
export const DIALOGUE_PROJECT_IDS = Object.freeze(['foundry', 'army']);
export function validateDialogueConditions(conditions, characters, quests, sectorIds = new Set()) {
  if (conditions === undefined) {
    return;
  }
  need(
    Array.isArray(conditions) && conditions.length <= 6,
    'Cada opción admite hasta seis condiciones.',
  );
  for (const condition of conditions) {
    need(object(condition), 'La condición del diálogo no es válida.');
    if (condition.type === 'character') {
      need(
        exact(condition, ['type', 'character', 'state']) &&
          characters?.has(condition.character) &&
          DIALOGUE_PERSON_STATES.includes(condition.state),
        'La condición necesita un personaje y un estado válidos.',
      );
    } else if (condition.type === 'supply') {
      need(
        exact(condition, ['type', 'character', 'item', 'min', 'max']) &&
          characters?.has(condition.character) &&
          DIALOGUE_SUPPLY_IDS.includes(condition.item) &&
          integer(condition.min, 0, condition.item === 'medkits' ? 1000000 : 100000) &&
          (condition.max === null ||
            integer(condition.max, condition.min, condition.item === 'medkits' ? 1000000 : 100000)),
        'La condición necesita un personaje, un suministro y un intervalo válidos.',
      );
    } else if (condition.type === 'meeting') {
      need(
        exact(condition, ['type', 'character']) && characters?.has(condition.character),
        'La condición del encuentro necesita un personaje válido.',
      );
    } else if (condition.type === 'quest') {
      need(
        exact(condition, ['type', 'quest', 'status']) &&
          quests?.has(condition.quest) &&
          CONTENT_QUEST_STATES.includes(condition.status),
        'La condición necesita un encargo y un estado válidos.',
      );
    } else if (condition.type === 'project') {
      need(
        exact(condition, ['type', 'project', 'completed']) &&
          DIALOGUE_PROJECT_IDS.includes(condition.project) &&
          typeof condition.completed === 'boolean',
        'La condición necesita un proyecto y un estado válidos.',
      );
    } else if (condition.type === 'sector') {
      need(
        exact(condition, ['type', 'sector', 'owner']) &&
          sectorIds.has(condition.sector) &&
          ['patriot', 'royalist'].includes(condition.owner),
        'La condición necesita una localidad y un control válidos.',
      );
    } else if (condition.type === 'day' || condition.type === 'treasury') {
      need(
        exact(condition, ['type', 'min', 'max']) &&
          integer(condition.min, condition.type === 'day' ? 1 : 0, 1000000000) &&
          (condition.max === null || integer(condition.max, condition.min, 1000000000)),
        'La condición necesita un intervalo válido.',
      );
    } else {
      need(false, 'El tipo de condición del diálogo no está disponible.');
    }
  }
}
export function validateDialogueEffects(effects, quests, characters) {
  if (effects === undefined) {
    return;
  }
  need(
    Array.isArray(effects) && effects.length <= 3,
    'Cada opción admite pesos, un encargo y un movimiento.',
  );
  const types = new Set();
  for (const effect of effects) {
    need(
      object(effect) && !types.has(effect.type),
      'Las operaciones del diálogo no pueden repetirse.',
    );
    types.add(effect.type);
    if (effect.type === 'treasury') {
      need(
        exact(effect, ['type', 'operation', 'amount']) &&
          ['pay', 'receive'].includes(effect.operation) &&
          Number.isSafeInteger(effect.amount) &&
          effect.amount >= 1 &&
          effect.amount <= 1000000,
        'La operación necesita un importe entre 1 y 1000000 pesos.',
      );
    } else if (effect.type === 'movement') {
      need(
        exact(effect, ['type', 'character', 'destination']) &&
          characters?.has(effect.character) &&
          ['speaker', 'routine'].includes(effect.destination),
        'El movimiento necesita un personaje y el destino del encuentro.',
      );
    } else {
      need(
        effect.type === 'quest' &&
          exact(effect, ['type', 'quest', 'status']) &&
          quests?.has(effect.quest) &&
          ['active', 'completed', 'failed'].includes(effect.status),
        'La operación necesita un encargo y un estado válidos.',
      );
    }
  }
}
export function validateDialogue(graph, characters, quests, sectorIds = new Set()) {
  need(
    fields(graph, ['entry', 'nodes']) &&
      id(graph.entry) &&
      Array.isArray(graph.nodes) &&
      graph.nodes.length >= 1 &&
      graph.nodes.length <= 30,
    'El diálogo necesita un comienzo y entre 1 y 30 pasajes.',
  );
  const ids = new Set();
  for (const node of graph.nodes) {
    need(
      fields(node, ['id', 'title', 'text', 'choices']) &&
        id(node.id) &&
        !ids.has(node.id) &&
        text(node.title, 80) &&
        text(node.text, 1000) &&
        Array.isArray(node.choices) &&
        node.choices.length <= 12,
      'Cada pasaje necesita identidad, título, texto y hasta 12 opciones válidas.',
    );
    ids.add(node.id);
    const choices = new Set();
    for (const choice of node.choices) {
      need(
        object(choice) &&
          ['id', 'label', 'next'].every((field) => Object.hasOwn(choice, field)) &&
          Object.keys(choice).every((field) =>
            ['id', 'label', 'next', 'conditions', 'effects'].includes(field),
          ) &&
          id(choice.id) &&
          !choices.has(choice.id) &&
          text(choice.label, 160) &&
          id(choice.next),
        'Las opciones del diálogo no son válidas.',
      );
      choices.add(choice.id);
      validateDialogueConditions(choice.conditions, characters, quests, sectorIds);
      validateDialogueEffects(choice.effects, quests, characters);
    }
  }
  need(
    ids.has(graph.entry) &&
      graph.nodes.every((node) => node.choices.every((choice) => ids.has(choice.next))),
    'El comienzo o un destino del diálogo no existe.',
  );
}
