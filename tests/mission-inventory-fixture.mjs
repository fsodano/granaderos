import { completeTestTravel } from './campaign-test-helpers.ts';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { enterSector } from '../packages/game/world.js';
import { actBattle } from '../packages/game/tactical.js';
import { attendYatasto } from './mission-helpers.mjs';
export const order = (s, a) => {
  const n = dispatchCampaign(s, a);
  assert.equal(n.lastError, null, n.lastError);
  return n;
};
export function completedConferenceStock() {
  let s = initialCampaign(45);
  s.phase = 2;
  s.flags.sanLorenzo = true;
  s.flags.northPact = true;
  for (const id of ['cordoba', 'tucuman', 'salta']) {
    s.sectors[id].owner = 'patriot';
  }
  s = completeTestTravel(s, { sector: 'tucuman' });
  for (const action of [{ type: 'visitSector' }, { type: 'visitMission', mission: 'yatasto' }]) {
    s = order(s, action);
    let b = enterSector(s.pendingBattle);
    b = actBattle(b, { type: 'drop', unitId: '4', item: 'medkits', count: 1 });
    assert.equal(b.lastError, null);
    s = order(s, {
      type: 'leaveSector',
      battleId: s.pendingBattle.id,
      sectorState: b,
      survivors: b.units.filter((u) => u.side === 'player'),
    });
  }
  return attendYatasto(s);
}
