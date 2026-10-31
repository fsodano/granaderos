import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { approachNPC } from './approach-npc.ts';
import { worldOwner } from '../packages/game/world-cells.ts';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { CAMPAIGN_SECTORS } from '../packages/game/data.js';
import { transportPath } from '../packages/game/logistics.js';
// Follow real recovery and movement orders when test journeys cross exhaustion.
export function restForMarch(state: CampaignSnapshot) {
  if (
    state.pendingEncounter ||
    !['patriot', 'neutral'].includes(worldOwner(state, state.location) ?? '')
  ) {
    return state;
  }
  if (
    !state.squad.some(
      (id) => tooTiredToMarch(state.operativeState[id]) || present(state.operativeState[id]).asleep,
    )
  ) {
    return state;
  }
  let s = state;
  for (const id of s.squad) {
    const r = s.operativeState[id];
    if (!present(r).asleep && (present(r).fatigue > 0 || present(r).energy < 100)) {
      s = dispatchCampaign(s, { type: 'setSleep', operativeId: id, asleep: true });
      if (s.lastError) {
        throw Error(s.lastError);
      }
    }
  }
  for (let i = 0; s.squad.some((id) => present(s.operativeState[id]).asleep) && i < 20; i++) {
    s = dispatchCampaign(s, { type: 'wait', hours: 12 });
    if (s.lastError) {
      throw Error(s.lastError);
    }
    if (s.pendingEncounter) {
      return s;
    }
  }
  if (s.squad.some((id) => present(s.operativeState[id]).asleep)) {
    throw Error('The test squad did not finish its actual sleep.');
  }
  return s;
}
// Follow each real hour and resume after actual recovery. A notice is not arrival.
export function completeTestTravel(
  state: CampaignSnapshot,
  action: {
    sector: string;
    mode?: import('../packages/game/domain/journeys/journey.ts').JourneyModeValue;
  },
) {
  let s = state;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (s.pendingEncounter || s.pendingBattle) {
      return s;
    }
    const q = s.squads.find((q) => q.id === s.activeSquadId),
      journey = q?.journey;
    if (!journey && s.location === action.sector) {
      return restForMarch(s);
    }
    let next;
    if (journey?.status === 'paused') {
      next = dispatchCampaign(s, { type: 'cancelTravel', choice: 'stop' });
    } else if (journey) {
      if (journey.status === 'ready') {
        throw Error('The travel fixture reached an unresolved assault.');
      }
      next = dispatchCampaign(s, { type: 'wait', hours: 24 });
    } else {
      next = dispatchCampaign(restForMarch(s), { ...action, type: 'travel', queue: true });
    }
    if (next.lastError) {
      throw Error(`Integration-test march to ${action.sector} failed: ${next.lastError}`);
    }
    s = next;
  }
  throw Error(`The test squad did not reach ${action.sector} through its actual route.`);
}
export function marchToFront(state: CampaignSnapshot, action: CampaignAction) {
  if (action.type !== 'attack') {
    return state;
  }
  const target = action.sector ?? 'san_lorenzo',
    destinations =
      target === 'san_lorenzo'
        ? ['san_nicolas']
        : (CAMPAIGN_SECTORS.find((d) => d.id === target)?.neighbors ?? []);
  const s = restForMarch(state);
  if (s.location === target || destinations.includes(s.location)) {
    return s;
  }
  const destination = destinations.find(
    (id) => present(s.sectors[id]).owner === 'patriot' && transportPath(s, s.location, id),
  );
  return destination ? completeTestTravel(s, { sector: destination }) : s;
}

import { encounterForOperative } from '../packages/game/encounters.js';
import { enterSector } from '../packages/game/world.js';
import { createBattle } from '../packages/game/tactical.js';
export function meetLocalRecruit(
  state: CampaignSnapshot,
  action: CampaignAction | { type: 'recruit'; id: number },
) {
  if (action.type !== 'recruit') {
    return null;
  }
  const npc = encounterForOperative(action.id);
  if (!npc) {
    return null;
  }
  let s = state;
  if (s.location !== npc.sector) {
    s = completeTestTravel(s, { sector: npc.sector });
  }
  s = dispatchCampaign(s, { type: 'visitSector' });
  if (s.lastError) {
    throw Error(s.lastError);
  }
  let battle = enterSector(s.pendingBattle, s.sectorStates[present(s.pendingBattle).sector]);
  const actor = battle.units
    .filter(
      (u) =>
        present(s.pendingBattle).squad.some((member) => String(member.id) === u.id) &&
        u.side === 'player' &&
        u.hp >= 15 &&
        !u.unconscious &&
        !u.departure &&
        !u.surrendered &&
        !u.routed,
    )
    .sort((a, b) => (b.leadership ?? 0) - (a.leadership ?? 0))[0];
  if (!actor) {
    throw Error('No conscious deployed speaker is available for this meeting.');
  }
  battle = approachNPC(battle, actor.id, npc.id);
  const local = battle.npcs.find((n) => n.id === npc.id);
  s = dispatchCampaign(s, {
    type: 'talkNPC',
    npcId: npc.id,
    approach: 'recruit',
    unitId: actor.id,
    sectorState: battle,
  });
  if (s.lastError) {
    return s;
  }
  const joined = present(s.pendingBattle).squad.find((u) => u.id === action.id);
  if (joined && !battle.units.some((u) => Number(u.id) === action.id)) {
    const record = createBattle([joined], {
      width: battle.width,
      height: battle.height,
      enemies: [],
      exploration: true,
    }).units[0];
    battle.units.push({ ...present(record), x: present(local).x, y: present(local).y });
    battle.npcs = battle.npcs.filter((n) => n.id !== npc.id);
  }
  return dispatchCampaign(s, {
    type: 'leaveSector',
    battleId: present(s.pendingBattle).id,
    sectorState: battle,
    survivors: battle.units.filter((u) => u.side === 'player'),
  });
}
