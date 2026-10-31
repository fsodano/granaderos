import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { completeQueuedAssault } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { contractQuote } from '../packages/game/contracts.js';
import { pendingHire } from '../packages/game/hiring-arrivals.js';
import { advanceCampaignHours } from './campaign-wait-fixture.ts';
import { equipOpeningRifles } from './opening-equipment.ts';
import { order, sync, visit, leave } from './local-contract-fixture.ts';
import { finishReloadsBeforeMarch } from './pre-march-reload.ts';
import { supplyRouteAmmunition } from './route-ammunition.ts';

// Hire a second squad at the controlled reception site, recover actual weapons,
// buy its missing cartridges, then wait for both real journeys before attacking.
export function prepareNorthernSupport(
  start: CampaignSnapshot,
  sector: string,
  { maxWeeklyPrice = Infinity, preferMarksmanship = false } = {},
) {
  let s = start;
  const field = s.activeSquadId,
    ids = rosterFor(s)
      .filter(
        (o) =>
          o.id >= 100 &&
          present(s.operativeState[o.id]).alive &&
          !s.recruited.includes(o.id) &&
          contractQuote(s, o, 'week').price <= maxWeeklyPrice,
      )
      .sort(
        (a, b) =>
          (preferMarksmanship ? b.marksmanship - a.marksmanship : 0) ||
          contractQuote(s, a, 'week').price - contractQuote(s, b, 'week').price ||
          a.id - b.id,
      )
      .slice(0, 6)
      .map((o) => o.id);
  assert.equal(ids.length, 6, 'six living replacements must remain available');
  const cost = ids.reduce(
      (sum, id) =>
        sum + contractQuote(s, present(rosterFor(s).find((o) => o.id === id)), 'week').price,
      0,
    ),
    funds = s.resources.treasury;
  for (const id of ids) {
    s = order(s, { type: 'recruitCivic', id, term: 'week', destination: s.location });
  }
  assert.equal(s.resources.treasury, funds - cost);
  for (const id of ids) {
    assert.equal(s.recruited.includes(id), true, 'Recruitment grants immediate control');
  }
  const wait = Math.max(0, ...ids.map((id) => (pendingHire(s, id)?.dueAt ?? s.hour) - s.hour));
  s = advanceCampaignHours(s, wait);
  assert.ok(
    ids.every(
      (id) => s.recruited.includes(id) && present(s.operativeState[id]).location === s.location,
    ),
  );
  s = order(s, { type: 'createSquad', ids, name: `Apoyo de ${sector}`, sector: s.location });
  const support = s.activeSquadId,
    p = visit(s),
    rearmed = equipOpeningRifles(p.battle, ids);
  s = leave(sync({ campaign: p.campaign, battle: rearmed.battle }));
  s = supplyRouteAmmunition(s, ids).campaign;
  for (const id of [field, support]) {
    s = order(s, { type: 'selectSquad', id });
    s = finishReloadsBeforeMarch(s);
    s = order(s, { type: 'attack', sector, queue: true });
  }
  s = completeQueuedAssault(s, [field, support], sector);
  assert.equal(present(s.pendingBattle).squad.length, start.squad.length + ids.length);
  return { campaign: s, ids, cost };
}
