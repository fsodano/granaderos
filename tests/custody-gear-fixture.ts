import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { makeOutfit } from '../packages/game/outfits.ts';
import { initialHorseState, MATURITY_HOURS } from '../packages/game/horses.js';

// Finite preexisting property for isolated custody tests. These helpers do not
// buy stock, grant a route reward, or change a new-player campaign constructor.
export function withCarriedPonchos(
  state: CampaignSnapshot,
  id: number,
  count = 1,
): CampaignSnapshot {
  const next = structuredClone(state),
    record = present(next.operativeState[id]);
  record.inventory ??= {};
  record.inventory['outfit'] = { ...makeOutfit('poncho'), count };
  return next;
}
export function withLegacyRepairReserve(
  state: CampaignSnapshot,
  id: number,
  points = 100,
): CampaignSnapshot {
  const next = structuredClone(state);
  present(next.operativeState[id]).toolkitPoints = points;
  return next;
}
export function withOwnedMount(
  state: CampaignSnapshot,
  { hired = false, name = 'Correo' } = {},
): { state: CampaignSnapshot; id: string } {
  const next = structuredClone(state);
  next.horseState ??= initialHorseState();
  const id = `horse-${next.horseState.nextId++}`;
  next.horseState.horses.push({
    id,
    name,
    sex: 'mare',
    location: next.location,
    bornAt: next.hour - MATURITY_HOURS,
    stamina: 100,
    condition: 100,
    feed: 7,
    assignedTo: null,
    hired,
    hireUntil: hired ? next.hour + 720 : null,
    pregnantUntil: null,
  });
  return { state: next, id };
}
