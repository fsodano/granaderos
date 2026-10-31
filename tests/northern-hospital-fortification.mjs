import assert from 'node:assert/strict';
import { dispatchCampaign } from '../packages/game/campaign.js';

const clock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);

// Buy the existing defenses before clinic preparation advances the clock.
// Later hiring and service quotes use the actually debited treasury.
export function prepareNorthernHospitalFortification(
  start,
  { sector = 'tucuman', report = () => {} } = {},
) {
  let campaign = start;
  const receipt = {
    sector,
    fromLevel: start.sectors[sector]?.fort,
    orders: [],
    cost: 0,
    startSeconds: clock(start),
  };
  try {
    assert.equal(
      campaign.pendingBattle,
      null,
      'Resolve the actual battle before preparing hospital defenses.',
    );
    assert.equal(
      campaign.pendingEncounter,
      null,
      'Resolve the actual encounter before preparing hospital defenses.',
    );
    assert.equal(
      campaign.sectors[sector]?.owner,
      'patriot',
      'Hospital defenses require an actually controlled sector.',
    );
    assert.ok(
      Number.isInteger(receipt.fromLevel) && receipt.fromLevel >= 0 && receipt.fromLevel <= 3,
    );
    const total = (3 - receipt.fromLevel) * 150;
    assert.ok(
      campaign.resources.treasury >= total,
      'Actual funds must cover every remaining hospital fortification level.',
    );
    for (let level = receipt.fromLevel; level < 3; level++) {
      const action = { type: 'fortify', sector },
        cash = campaign.resources.treasury,
        at = clock(campaign);
      const next = dispatchCampaign(campaign, action);
      assert.equal(next.lastError, null, next.lastError);
      campaign = next;
      receipt.orders.push({
        action,
        cost: cash - campaign.resources.treasury,
        from: at,
        to: clock(campaign),
      });
      receipt.cost += cash - campaign.resources.treasury;
      assert.equal(campaign.sectors[sector].fort, level + 1);
      assert.equal(cash - campaign.resources.treasury, 150);
      assert.equal(clock(campaign), at, 'Fortification cannot consume or extend clinic time.');
      report({ event: 'northernHospitalFortified', sector, level: level + 1, cost: 150, campaign });
      // Even a zero-time Native order can release an existing deferred encounter.
      // Keep that accepted paid prefix and stop before another preparation order.
      assert.equal(
        campaign.pendingEncounter,
        null,
        'Hospital fortification stopped at an actual encounter.',
      );
      assert.equal(
        campaign.pendingBattle,
        null,
        'Hospital fortification stopped at an actual battle.',
      );
    }
    receipt.endSeconds = clock(campaign);
    return { campaign, receipt };
  } catch (error) {
    error.campaign = campaign;
    error.hospitalFortification = receipt;
    throw error;
  }
}
