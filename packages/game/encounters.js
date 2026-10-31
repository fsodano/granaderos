import { contractQuote, contractTermsFor } from './contracts.js';
import { campaignCivilian, civilianDiedHere } from './campaign-civilians.js';
import { campaignPlace } from './world-cells.ts';
import {
  legacyOperativeId,
  characterForOperative,
  isWorldCharacter,
  isContractOperative,
  operativeIdForCharacter,
  hasGenericCharacterIds,
  includesOriginalResidents,
} from './content-character-ids.ts';
import { characterPresentInSector } from './campaign-presence.js';
import { authoredOperative } from './content-roster.ts';
import { campaignSectors } from './campaign-definition.js';
import { DEFAULT_CATALOGUE } from '../../content/campaigns/default.js';
import { questContactIds } from './quest-beneficiaries.js';
import { scenarioFor } from './campaign-scenario.js';
export const ENCOUNTERS = structuredClone(DEFAULT_CATALOGUE.encounters);
export const canRecruitEncounter = (n) => n.operativeId !== undefined && n.recruitable !== false;
/** @returns {Array<{id:string;contentId?:string;operativeId?:number;name:string;sector:string|null;x:number;y:number;greeting:string;requiredLeadership:number;requiredLiberated:number;requiredSector:string|null;recruitable?:boolean;noncombatant?:boolean;dialogue?:string}>} */
export function encounterDefinitions(s) {
  const content = s.contentCampaign?.package;
  const original = ENCOUNTERS.filter((n) =>
    n.operativeId === undefined
      ? includesOriginalResidents(content)
      : !content ||
        (!hasGenericCharacterIds(content) &&
          content.characters.some(
            (c) => legacyOperativeId(c.id) === n.operativeId && !isWorldCharacter(c),
          )),
  );
  return [
    ...original,
    ...(content?.characters ?? []).filter(isWorldCharacter).map((c) => {
      const { dialogue, ...encounter } = c.encounter;
      return {
        id: `authored-${c.id}`,
        contentId: c.id,
        operativeId: operativeIdForCharacter(content, c.id),
        name: c.name,
        sector: null,
        x: 3,
        y: 7,
        ...encounter,
      };
    }),
  ].map((n) =>
    content?.errands?.some((q) => questContactIds(q).includes(n.id))
      ? { ...n, dialogue: 'special' }
      : n,
  );
}
export function encounterForOperative(id) {
  return ENCOUNTERS.find((n) => n.operativeId === Number(id));
}
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {string} sector
 * @returns {import('./public/compatibility-types.ts').BattleNpc[]} */
export function encountersFor(s, sector) {
  return encounterDefinitions(s)
    .filter((n) => {
      if (civilianDiedHere(s, n, sector)) {
        return true;
      }
      if (s.civilianState?.people[`npc-${n.id}`]?.health.hp === 0) {
        return false;
      }
      if (n.operativeId === undefined) {
        return n.sector === sector;
      }
      const character = characterForOperative(s, n.operativeId);
      if (
        (s.contentCampaign && !character) ||
        isContractOperative(s, { id: n.operativeId }) ||
        s.recruited.includes(n.operativeId) ||
        s.operativeState?.[n.operativeId]?.alive === false
      ) {
        return false;
      }
      return s.contentPresence && character
        ? characterPresentInSector(s, character.id, sector)
        : n.sector === sector;
    })
    .map((n) => {
      const op =
        n.operativeId === undefined
          ? null
          : authoredOperative(s, { id: n.operativeId, name: n.name });
      const person = op?.contentId ? s.contentPresence?.people[op.contentId] : null;
      return campaignCivilian(
        s,
        op?.contentId
          ? {
              ...n,
              sector,
              name: op.name,
              portraitId: op.portraitId,
              contentId: op.contentId,
              ...(op.genericCharacter ? { genericCharacter: true } : {}),
              ...(person ? { presenceRevision: person.revision } : {}),
              ...(op.abilities === undefined ? {} : { abilities: [...op.abilities] }),
              ...(op.storyProfile ? { storyProfile: op.storyProfile } : {}),
              ...(op.spriteAppearance ? { spriteAppearance: op.spriteAppearance } : {}),
              ...(op.skinTone ? { skinTone: op.skinTone } : {}),
            }
          : { ...n },
      );
    });
}
export function encounterRequirements(s, npc, actor) {
  const sectors = campaignSectors(s);
  const liberated = new Set(
    sectors
      .filter((d) => s.sectors[d.id]?.owner === 'patriot')
      .map((d) => scenarioFor(s).recruitmentLocalityId(s, d.id)),
  ).size;
  if (actor.leadership < npc.requiredLeadership) {
    return `Necesitás un interlocutor con al menos ${npc.requiredLeadership} puntos de liderazgo.`;
  }
  if (liberated < npc.requiredLiberated) {
    return `Primero asegurá al menos ${npc.requiredLiberated} localidades patriotas.`;
  }
  if (npc.requiredSector && s.sectors[npc.requiredSector]?.owner !== 'patriot') {
    return `Primero liberá ${sectors.find((d) => d.id === npc.requiredSector)?.name ?? 'la localidad requerida'}.`;
  }
  return null;
}

// The directory supplies fixed hints and last encounters, not live random rolls.
export function encounterContacts(s) {
  return encounterDefinitions(s)
    .filter(
      (n) =>
        canRecruitEncounter(n) &&
        !isContractOperative(s, { id: n.operativeId }) &&
        !s.recruited.includes(n.operativeId) &&
        s.operativeState?.[n.operativeId]?.alive !== false,
    )
    .flatMap((n) => {
      const c = characterForOperative(s, n.operativeId),
        p = c && s.contentCampaign.package.placements.find((p) => p.character === c.id);
      if (s.contentPresence && (!p || (p.afterDeath && !s.contentPresence.people[c.id].appeared))) {
        return [];
      }
      const met = s.conversations?.[n.id]?.sector;
      const place =
        met ?? (s.contentPresence ? (p?.mode === 'fixed' ? p.sectors[0] : null) : n.sector);
      return [
        {
          ...n,
          name: c?.name ?? n.name,
          locationLabel: place
            ? `${met ? 'Último encuentro: ' : ''}${campaignPlace(place, s)?.name ?? place}`
            : 'Ubicación por descubrir',
        },
      ];
    });
}

// Local service terms do not turn a resident into a bulletin candidate.
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {import('./public/compatibility-types.ts').BattleNpc} npc
 * @returns {import('./public/hud-types.ts').EncounterHireQuote[]} */
export function encounterHireTerms(s, npc) {
  const c = characterForOperative(s, npc.operativeId);
  if (!c || !isWorldCharacter(c) || c.service !== 'contract' || !canRecruitEncounter(npc)) {
    return [];
  }
  const op = authoredOperative(s, { id: npc.operativeId });
  return Object.entries(contractTermsFor(s)).map(([term, period]) => {
    const q = contractQuote(s, op, term),
      funded = s.resources.treasury >= q.total;
    return {
      ...q,
      name: period.name,
      available: q.available && funded,
      reason: q.reason ?? (funded ? null : `Necesitás ${q.total} pesos para este contrato.`),
    };
  });
}
