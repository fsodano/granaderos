import { DEFAULT_CATALOGUE } from '../campaigns/default.js';
import { campaignSectors, campaignDefinitions, campaignWorld } from './campaign-definition.js';
import { SUPPLY_ITEMS } from './tactical-inventory.js';
import { OUTFITS } from './outfits.js';
import { sectorExits } from './tactical-exits.js';
import { canonicalContent } from './content-identity.js';
import { ENCOUNTERS } from './encounters.js';
import {
  legacyOperativeId,
  isWorldCharacter,
  hasGenericCharacterIds,
  hasGenericCharacterDefinitions,
  includesOriginalResidents,
} from './content-character-ids.js';
import { contentCellIds } from './content-map.js';
import { NPC_QUESTS } from './quests.js';
import { questContactIds } from './quest-beneficiaries.js';

export { QUEST_RESOURCES } from '../campaign-format/errand-schema.js';
import { validateErrandDefinitions } from '../campaign-format/errand-schema.js';

export function validateQuestDefinitions(quests, context) {
  const errors = validateErrandDefinitions(quests, { world: campaignWorld(context) });
  if (errors.length) return errors;
  for (const quest of quests) {
    const carried = quest.carried;
    if (
      carried &&
      !(
        (Object.hasOwn(SUPPLY_ITEMS, carried.item) &&
          carried.item !== 'ammo' &&
          carried.outfit === undefined) ||
        (Object.hasOwn(OUTFITS, carried.outfit) && carried.item === undefined)
      )
    )
      errors.push(`Encargo ${quest.id}: objeto de entrega inválido.`);
    const escort = quest.escort;
    if (
      escort &&
      !sectorExits(quest.sector, null, context).some(
        (exit) => exit.destination === escort.destination && exit.edge === escort.edge,
      )
    )
      errors.push(`Encargo ${quest.id}: la escolta necesita una salida existente.`);
  }
  return errors;
}

// A tactical copy must match the campaign's pinned definition. A save or an
// interaction cannot replace a cost, recipient or reward through its report.
export function validateQuestContext(campaign, battle) {
  const content = campaign.contentCampaign?.package;
  const definitions =
    content?.errands ?? (hasGenericCharacterDefinitions(content) ? [] : campaign.errandDefinitions);
  if (!battle || canonicalContent(battle.errandDefinitions) !== canonicalContent(definitions))
    throw Error('Los encargos del despliegue no coinciden con la campaña.');
}

// Pinned errands are authoritative. Generic campaigns never inherit historical
// deliveries when the collection is omitted; old stock callers retain defaults.
export function defaultErrands(context = null) {
  const content = campaignDefinitions(context);
  if (content?.errands !== undefined) return structuredClone(content.errands);
  if (content?.scenario === 'generic-v1' || content?.campaignStory) return [];
  return structuredClone(NPC_QUESTS).map((q) => ({
    ...q,
    cost: q.cost ?? {},
    reward:
      typeof q.reward === 'number'
        ? { treasury: q.reward, loyalty: true }
        : { treasury: 0, loyalty: true },
  }));
}
// Fictional local errand text and reward amounts are game tuning. Only fresh
// campaigns pin these definitions; omitted legacy collections stay unchanged.
export function freshDefaultErrands() {
  return structuredClone(DEFAULT_CATALOGUE.freshErrands);
}
export function errandContacts(content) {
  const characters = Array.isArray(content.characters) ? content.characters : [],
    placements = Array.isArray(content.placements) ? content.placements : [];
  const contacts = ENCOUNTERS.filter((n) =>
    n.operativeId === undefined
      ? includesOriginalResidents(content)
      : !hasGenericCharacterIds(content) &&
        characters.some(
          (c) => c && legacyOperativeId(c.id) === n.operativeId && !isWorldCharacter(c),
        ) &&
        n.operativeId < 100,
  ).map((n) => ({
    id: n.id,
    name:
      n.operativeId === undefined
        ? n.name
        : (characters.find((c) => c && legacyOperativeId(c.id) === n.operativeId)?.name ?? n.name),
    sector: n.sector,
    fixedSector: n.operativeId === undefined ? n.sector : null,
    canRecruit: n.operativeId !== undefined,
    characterId: n.operativeId === undefined ? undefined : `person-${n.operativeId}`,
  }));
  for (const c of characters.filter((c) => c && isWorldCharacter(c))) {
    const p = placements.find((p) => p?.character === c.id);
    if (!p) continue;
    const locality =
      campaignSectors(content).find(
        (s) =>
          contentCellIds([s.id], content)[0] ===
          contentCellIds(Array.isArray(p.sectors) ? p.sectors : [], content)[0],
      )?.id ?? null;
    contacts.push({
      id: `authored-${c.id}`,
      name: c.name,
      sector: locality,
      fixedSector: p.mode === 'fixed' && p.sectors?.length === 1 ? locality : null,
      canRecruit: c.encounter?.recruitable !== false,
      characterId: c.id,
    });
  }
  return contacts;
}
export function validateErrandContacts(content) {
  if (content.errands === undefined) return [];
  const contacts = errandContacts(content),
    errors = [];
  for (const q of content.errands)
    for (const npcId of questContactIds(q)) {
      const at = q.beneficiaries?.find((b) => b.npcId === npcId)?.sector ?? q.sector;
      const c = contacts.find((c) => c.id === npcId);
      if (!c) {
        errors.push(`Encargo ${q.id}: el contacto no existe o no aparece en el mapa.`);
        continue;
      }
      if (!q.carried && !q.escort) continue;
      if (c.canRecruit)
        errors.push(
          `Encargo ${q.id}: la entrega física o escolta necesita un contacto que no se incorpore a la escuadra.`,
        );
      const p = c.characterId && content.placements.find((p) => p?.character === c.characterId);
      if (
        c.characterId
          ? !(
              p?.mode === 'fixed' &&
              p.sectors?.length === 1 &&
              contentCellIds(p.sectors, content)[0] === contentCellIds([at], content)[0]
            )
          : c.sector !== at
      )
        errors.push(
          `Encargo ${q.id}: la entrega física o escolta necesita un contacto fijo en esa localidad.`,
        );
    }
  return errors;
}
