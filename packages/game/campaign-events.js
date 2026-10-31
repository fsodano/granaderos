import { campaignDefinitions, campaignSectors } from './campaign-definition.js';
import { validateCampaignEvents as validateEventRecords } from '../campaign-format/event-schema.js';
import { dialogueConditionsMet } from './dialogue-conditions.js';
import {
  questTransitionQuote,
  applyQuestTransition,
  updateContentQuests,
} from './content-quests.js';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};
const message = 'El registro de eventos de campaña es inválido.';
const order = (a, b) => a.atHour - b.atHour || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const eventsFor = (s) => [...(campaignDefinitions(s)?.campaignEvents ?? [])].sort(order);
const amountFor = (event) => {
  const effect = event.effects.find((e) => e.type === 'treasury');
  return effect ? effect.amount * (effect.operation === 'pay' ? -1 : 1) : 0;
};

export function validateCampaignEvents(value, context) {
  return validateEventRecords(
    value,
    context,
    new Set(campaignSectors(context).map((sector) => sector.id)),
  );
}

function validateReceipts(s, { complete = true } = {}) {
  const definitions = eventsFor(s),
    state = s.campaignEventState;
  if (!definitions.length) {
    need(state === undefined, message);
    return definitions;
  }
  need(
    exact(state, ['version', 'receipts']) &&
      state.version === 1 &&
      Array.isArray(state.receipts) &&
      state.receipts.length <= definitions.length,
    message,
  );
  for (const [i, receipt] of state.receipts.entries()) {
    const event = definitions[i];
    need(
      exact(receipt, ['event', 'hour', 'outcome', 'amount']) &&
        receipt.event === event.id &&
        receipt.hour === event.atHour &&
        integer(receipt.hour, 0, s.hour) &&
        ['applied', 'skipped'].includes(receipt.outcome) &&
        receipt.amount === (receipt.outcome === 'applied' ? amountFor(event) : 0),
      message,
    );
  }
  const due = definitions.filter((event) => event.atHour <= s.hour);
  if (complete) {
    need(state.receipts.length === due.length, message);
  } else {
    need(
      !definitions[state.receipts.length] || definitions[state.receipts.length].atHour >= s.hour,
      message,
    );
  }
  return definitions;
}
export function validateCampaignEventState(s) {
  validateReceipts(s);
}

export function initializeCampaignEvents(s) {
  if (!eventsFor(s).length) {
    return;
  }
  need(s.campaignEventState === undefined, message);
  s.campaignEventState = { version: 1, receipts: [] };
  advanceCampaignEvents(s);
  return true;
}
export function nextCampaignEventTime(s) {
  const now = s.hour * 3600 + (s.secondOfHour ?? 0);
  return Math.min(
    Infinity,
    ...eventsFor(s)
      .map((event) => event.atHour * 3600)
      .filter((time) => time > now),
  );
}

const logEvent = (s, text) => {
  s.log.unshift({ hour: s.hour, text });
  s.log = s.log.slice(0, 80);
};
// Every due event receives a permanent result. Conditions that fail at the
// scheduled instant never cause a later reward when the player returns.
export function advanceCampaignEvents(s, { note = logEvent } = {}) {
  const definitions = validateReceipts(s, { complete: false });
  if (!definitions.length) {
    return;
  }
  const receipts = s.campaignEventState.receipts;
  const due = definitions.slice(receipts.length).filter((event) => event.atHour <= s.hour);
  if (due.length) {
    need(
      due.every((event) => event.atHour === s.hour) && (s.secondOfHour ?? 0) === 0,
      'El evento de campaña necesita su hora exacta.',
    );
    updateContentQuests(s);
  }
  for (const event of due) {
    const amount = amountFor(event),
      quest = event.effects.find((e) => e.type === 'quest');
    const eligible =
      dialogueConditionsMet(s, event.conditions) &&
      s.resources.treasury + amount >= 0 &&
      s.resources.treasury + amount <= 1000000000 &&
      (!quest || questTransitionQuote(s, quest).available);
    if (eligible) {
      if (quest) {
        applyQuestTransition(s, quest, { campaignEvent: event.id });
      }
      s.resources.treasury += amount;
      note(s, event.text);
    }
    receipts.push({
      event: event.id,
      hour: event.atHour,
      outcome: eligible ? 'applied' : 'skipped',
      amount: eligible ? amount : 0,
    });
  }
  validateReceipts(s);
}
