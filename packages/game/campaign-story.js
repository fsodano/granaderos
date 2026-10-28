import { dialogueConditionsMet } from './dialogue-conditions.js';
import { campaignSectors } from './campaign-definition.js';
import { validateCampaignStory as validateStoryRecords } from '../campaign-format/story-schema.js';

const need = (ok, message) => {
  if (!ok) throw Error(message);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const time = (s) => s.hour * 3600 + (s.secondOfHour ?? 0);
const stamp = (s) => ({ hour: s.hour, secondOfHour: s.secondOfHour ?? 0 });
export const campaignStory = (s) => s?.contentCampaign?.package.campaignStory ?? null;
export function defaultCampaignStory() {
  return {
    introduction: 'Reuní una escuadra y cumplí los objetivos de esta campaña.',
    victory: 'La misión de la escuadra está cumplida.',
    defeat: 'La campaña no puede continuar.',
    chapters: [
      {
        id: 'chapter-1',
        name: 'Primer objetivo',
        objective: 'Llegá al segundo día de campaña.',
        conditions: [{ type: 'day', min: 2, max: null }],
      },
    ],
    failureConditions: [],
  };
}
export function validateCampaignStory(value, characters, quests, context = null) {
  return validateStoryRecords(
    value,
    characters,
    quests,
    new Set(campaignSectors(context).map((sector) => sector.id)),
  );
}

export const campaignChapterIndex = (s) =>
  campaignStory(s)
    ? Math.min(s.campaignProgress?.completed.length ?? 0, campaignStory(s).chapters.length - 1)
    : s.phase;
export const storyReferences = (story, type, id) =>
  [
    ...(story?.chapters ?? []).flatMap((c) => c.conditions),
    ...(story?.failureConditions ?? []),
  ].some(
    (c) => (c.type === type || (type === 'character' && c.type === 'supply')) && c[type] === id,
  );
export function initializeCampaignStory(s) {
  if (!campaignStory(s)) return;
  s.campaignProgress = { version: 1, completed: [], outcome: null };
  s.log = [{ hour: s.hour, text: campaignStory(s).introduction }];
}
// Campaign objectives use settled campaign state. Do not finish an open scene.
export function advanceCampaignStory(s, battle = null) {
  const story = campaignStory(s);
  if (!story || s.campaignProgress.outcome) return;
  const log = (value) => {
    s.log.unshift({ hour: s.hour, text: value });
    s.log = s.log.slice(0, 80);
  };
  if (
    s.defeated ||
    (story.failureConditions.length > 0 &&
      dialogueConditionsMet(s, story.failureConditions, battle))
  ) {
    s.defeated = true;
    s.campaignProgress.outcome = { type: 'defeat', ...stamp(s) };
    log(story.defeat);
    return;
  }
  if (s.pendingBattle) return;
  while (s.campaignProgress.completed.length < story.chapters.length) {
    const chapter = story.chapters[s.campaignProgress.completed.length];
    if (!dialogueConditionsMet(s, chapter.conditions)) break;
    s.campaignProgress.completed.push({ chapter: chapter.id, ...stamp(s) });
    log(`Objetivo cumplido: ${chapter.name}.`);
  }
  if (s.campaignProgress.completed.length === story.chapters.length) {
    s.completed = true;
    s.campaignProgress.outcome = { type: 'victory', ...stamp(s) };
    log(story.victory);
  }
}
export function validateCampaignProgress(s) {
  const story = campaignStory(s),
    p = s.campaignProgress;
  if (!story) {
    need(p === undefined, 'Esta campaña no utiliza capítulos propios.');
    return;
  }
  const message = 'El avance guardado de los capítulos no es válido.';
  need(
    exact(p, ['version', 'completed', 'outcome']) &&
      p.version === 1 &&
      Array.isArray(p.completed) &&
      p.completed.length <= story.chapters.length &&
      s.phase === 0,
    message,
  );
  const validTime = (e) =>
    Number.isSafeInteger(e.hour) &&
    e.hour >= 0 &&
    Number.isSafeInteger(e.secondOfHour) &&
    e.secondOfHour >= 0 &&
    e.secondOfHour < 3600 &&
    time(e) <= time(s);
  let previous = 0;
  for (const [i, e] of p.completed.entries()) {
    need(
      exact(e, ['chapter', 'hour', 'secondOfHour']) &&
        e.chapter === story.chapters[i].id &&
        validTime(e) &&
        time(e) >= previous,
      message,
    );
    previous = time(e);
  }
  need(!(s.completed && s.defeated), message);
  if (p.outcome === null)
    need(!s.completed && !s.defeated && p.completed.length < story.chapters.length, message);
  else {
    need(
      exact(p.outcome, ['type', 'hour', 'secondOfHour']) &&
        validTime(p.outcome) &&
        time(p.outcome) >= previous,
      message,
    );
    need(
      p.outcome.type === 'victory'
        ? s.completed && !s.defeated && p.completed.length === story.chapters.length
        : p.outcome.type === 'defeat' && s.defeated && !s.completed,
      message,
    );
  }
}
