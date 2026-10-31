import type { CampaignContent, CharacterDefinition } from '../campaign-format/types.ts';
import type { CampaignOperative, CampaignSnapshot } from './public/campaign-types.ts';
import type { BattleNpc, BattleSnapshot, BattleUnit } from './public/compatibility-types.ts';
import { OPERATIVES } from './data.js';
import { CIVIC_RECRUITS } from './civic-recruits.js';

type CharacterContext = Pick<CampaignSnapshot, 'contentCampaign'>;
type CharacterDefinitions = Pick<
  CampaignContent,
  'scenario' | 'campaignStory' | 'characters' | 'includeOriginalResidents'
>;
type CharacterIndex = {
  byCharacter: Map<string, number>;
  byOperative: Map<number, CharacterDefinition>;
};
type CachedIndex = {
  generic: boolean;
  members: { definition: CharacterDefinition; id: string }[];
  index: CharacterIndex;
};
const originals = [...OPERATIVES, ...CIVIC_RECRUITS];
const legacyIds = new Map(originals.map((o) => [`person-${o.id}`, o.id]));
const indexes = new WeakMap<CharacterDefinitions, CachedIndex>();
export function legacyOperativeId(id: string): number | undefined {
  return legacyIds.get(id);
}
// Explicit generic campaigns never acquire stock numeric powers. Omitted
// scenarios retain their legacy mapping so older pinned saves remain readable.
export const hasGenericCharacterIds = (
  content: Partial<CharacterDefinitions> | null | undefined,
): boolean => content?.scenario === 'generic-v1';
export const hasGenericCharacterDefinitions = (
  content: Partial<CharacterDefinitions> | null | undefined,
): boolean => hasGenericCharacterIds(content) || Boolean(content?.campaignStory);
export const includesOriginalResidents = (
  content: Partial<CharacterDefinitions> | null | undefined,
): boolean =>
  hasGenericCharacterDefinitions(content)
    ? content?.includeOriginalResidents === true
    : content?.includeOriginalResidents !== false;
export function isContractCharacter(
  definition: Pick<CharacterDefinition, 'id' | 'recruitmentSource'>,
): boolean {
  if (definition.recruitmentSource !== undefined) {
    return definition.recruitmentSource === 'contract';
  }
  const id = legacyOperativeId(definition.id);
  return id !== undefined && id >= 100;
}
export function isWorldCharacter(
  definition: Pick<CharacterDefinition, 'recruitmentSource'>,
): boolean {
  return definition.recruitmentSource === 'encounter';
}
export function isHistoricalCharacter(
  definition: Pick<CharacterDefinition, 'id'>,
  content: Partial<CharacterDefinitions> | null | undefined,
): boolean {
  const id = legacyOperativeId(definition.id);
  return !hasGenericCharacterIds(content) && id !== undefined && id < 100;
}
function indexFor(content: CharacterDefinitions): CharacterIndex {
  const previous = indexes.get(content),
    characters = content.characters,
    generic = hasGenericCharacterIds(content);
  // Campaign copies lose Object.freeze. Reuse their index while membership and
  // IDs match, including mutable editor/save snapshots. Definitions stay live
  // by reference; replacements, reordering and in-place ID edits rebuild it.
  if (
    previous &&
    previous.generic === generic &&
    previous.members.length === characters.length &&
    previous.members.every(
      (member, i) => member.definition === characters[i] && member.id === characters[i]?.id,
    )
  ) {
    return previous.index;
  }
  let next = 2000;
  const entries = [...characters]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((character): [CharacterDefinition, number] => [
      character,
      (generic ? undefined : legacyOperativeId(character.id)) ?? next++,
    ]);
  const index = {
    byCharacter: new Map(entries.map(([character, id]) => [character.id, id])),
    byOperative: new Map(entries.map(([character, id]) => [id, character])),
  };
  indexes.set(content, {
    generic,
    members: characters.map((definition) => ({ definition, id: definition.id })),
    index,
  });
  return index;
}
export function operativeIdForCharacter(
  content: CharacterDefinitions,
  id: string | undefined,
): number | undefined {
  return id === undefined ? undefined : indexFor(content).byCharacter.get(id);
}
export function characterForOperative(
  state: CharacterContext,
  id: string | number | undefined,
): CharacterDefinition | undefined {
  return state.contentCampaign
    ? indexFor(state.contentCampaign.package).byOperative.get(Number(id))
    : undefined;
}
export function isContractOperative(
  state: CharacterContext,
  operative: Pick<CampaignOperative, 'id'>,
): boolean {
  const definition = characterForOperative(state, operative.id);
  return definition
    ? isContractCharacter(definition)
    : CIVIC_RECRUITS.some((o) => o.id === operative.id) && !state.contentCampaign;
}
export function gainsExperience(
  state: CharacterContext,
  operative: Pick<CampaignOperative, 'id' | 'progression'>,
): boolean {
  return (
    operative.id === 1000 ||
    ((isContractOperative(state, operative) ||
      characterForOperative(state, operative.id)?.recruitmentSource === 'encounter') &&
      operative.progression !== 'fixed')
  );
}

// All deployed and retained actor copies must agree with pinned definitions.
export function campaignActors(
  value: CampaignSnapshot | BattleSnapshot,
): (BattleUnit | BattleNpc | CampaignOperative)[] {
  const actors = (scene: BattleSnapshot | null | undefined) =>
    scene ? [...scene.units, ...scene.npcs] : [];
  if ('units' in value) {
    return actors(value);
  }
  const pending = value.pendingBattle;
  return [
    ...(pending?.squad ?? []),
    ...(pending?.missionAllies ?? []),
    ...(pending?.npcs ?? []),
    ...Object.values(value.missionAllies ?? {}),
    ...Object.values(value.sectorStates ?? {}).flatMap(actors),
    ...Object.values(value.sceneStates ?? {}).flatMap(actors),
  ];
}
export function characterForActor(
  state: CharacterContext,
  actor: { id: string | number; operativeId?: number; contentId?: string },
): CharacterDefinition | undefined {
  if (!state.contentCampaign) {
    return undefined;
  }
  const reference =
    actor.operativeId ??
    (Number.isFinite(Number(actor.id))
      ? Number(actor.id)
      : operativeIdForCharacter(state.contentCampaign.package, actor.contentId));
  return characterForOperative(state, reference);
}
