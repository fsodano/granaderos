import { validateDialogueConditions as validateConditionDocuments } from '../campaign-format/dialogue-schema.js';
export { DIALOGUE_PERSON_STATES } from '../campaign-format/dialogue-schema.js';
import { CHARACTER_SUPPLY_LABELS } from './character-supplies.js';
import { isUnconscious } from './actor-condition.js';
import { rosterFor } from './recruitment.js';
import { CAMPAIGN_PROJECT_LABELS, campaignProjectComplete } from './campaign-projects.js';
import { atDialogueMeeting } from './dialogue-movement.js';
import { contentQuestStatus } from './content-quests.js';
import { campaignSectors } from './campaign-definition.js';
import { scenarioFor } from './campaign-scenario.js';
import { operativeIdForCharacter } from './content-character-ids.js';
export const DIALOGUE_PERSON_STATE_LABELS = Object.freeze({
  alive: 'Vivo',
  dead: 'Muerto',
  serving: 'Incorporado al servicio',
  present: 'Presente en el mundo',
  conscious: 'Consciente',
  unconscious: 'Inconsciente',
  wounded: 'Herido',
  bleeding: 'Con hemorragia',
  stable: 'Consciente y sin sangrado',
  healthy: 'Salud completa y consciente',
});

function characterPhysical(s, character, battle) {
  const id = operativeIdForCharacter(s.contentCampaign.package, character),
    record = s.operativeState[id],
    request = s.pendingBattle,
    deployed = [...(request?.squad ?? []), ...(request?.missionAllies ?? [])].some(
      (u) => Number(u.id) === id,
    );
  const scene =
    battle &&
    request &&
    battle.sectorId === request.sector &&
    (battle.sceneId ?? null) === (request.sceneId ?? null) &&
    (!battle.battleId || battle.battleId === request.id)
      ? battle
      : null;
  const unit = deployed
    ? scene?.units.find((u) => u.side === 'player' && Number(u.id) === id)
    : null;
  const identifies = (n) => {
    const missionId = scenarioFor(s).missionCivilianOperativeId(n);
    return (
      (n.operativeId != null && Number(n.operativeId) === id) ||
      n.contentId === character ||
      (missionId != null && Number(missionId) === id)
    );
  };
  const resident = !s.recruited.includes(id)
    ? scene?.npcs?.find(
        (n) =>
          identifies(n) &&
          request.npcs?.some((expected) => expected.id === n.id && identifies(expected)),
      )
    : null;
  return { id, record, deployed, unit, resident };
}
function characterState(s, character, battle, state) {
  const { id, record, deployed, unit, resident } = characterPhysical(s, character, battle);
  const physical = unit ?? resident ?? record,
    alive = unit || resident ? physical.hp > 0 : record?.alive === true;
  const physicalKnown = !deployed || Boolean(unit),
    conscious = physicalKnown && alive && !isUnconscious(physical),
    maxHp =
      (unit ?? resident)?.maxHp ??
      (['wounded', 'healthy'].includes(state)
        ? rosterFor(s).find((o) => o.id === id)?.maxHp
        : undefined);
  const stable = conscious && (physical.bleeding ?? 0) === 0;
  return {
    alive,
    dead: Boolean(record) && !alive,
    serving: alive && !record?.captured && s.recruited.includes(id),
    present:
      alive &&
      !record?.captured &&
      !s.recruited.includes(id) &&
      Boolean(
        s.contentPresence?.people[character]?.appeared &&
        s.contentPresence.people[character].sector,
      ),
    conscious,
    unconscious: physicalKnown && alive && !conscious,
    wounded: physicalKnown && alive && physical.hp < maxHp,
    bleeding: physicalKnown && alive && (physical.bleeding ?? 0) > 0,
    stable,
    healthy: stable && physical.hp === maxHp,
  };
}
export function dialogueConditionsMet(s, conditions, battle = null) {
  return (conditions ?? []).every((c) => {
    if (c.type === 'character')
      return characterState(s, c.character, battle, c.state)[c.state] === true;
    if (c.type === 'supply') {
      // Legacy stories see a complete implicit kit; it is no longer consumed.
      if (['priming', 'flints'].includes(c.item)) {
        const value = c.item === 'priming' ? 50 : 4;
        return value >= c.min && (c.max === null || value <= c.max);
      }
      const { record, deployed, unit, resident } = characterPhysical(s, c.character, battle);
      // Deployed stock lives in the open scene; the service sheet is a stale snapshot.
      if (deployed && !unit) return false;
      const value = (unit ?? resident?.civilianSupplies ?? record)?.[c.item];
      return Number.isSafeInteger(value) && value >= c.min && (c.max === null || value <= c.max);
    }
    if (c.type === 'meeting') return atDialogueMeeting(s, c.character, battle);
    if (c.type === 'quest') return contentQuestStatus(s, c.quest) === c.status;
    if (c.type === 'project')
      return (
        Object.hasOwn(CAMPAIGN_PROJECT_LABELS, c.project) &&
        campaignProjectComplete(s, c.project) === c.completed
      );
    if (c.type === 'sector') return s.sectors[c.sector]?.owner === c.owner;
    if (!['day', 'treasury'].includes(c.type)) return false;
    const value = c.type === 'day' ? Math.floor(s.hour / 24) + 1 : s.resources.treasury;
    return value >= c.min && (c.max === null || value <= c.max);
  });
}

export function validateDialogueConditions(conditions, characters, quests, context = null) {
  return validateConditionDocuments(
    conditions,
    characters,
    quests,
    new Set(campaignSectors(context).map((sector) => sector.id)),
  );
}
