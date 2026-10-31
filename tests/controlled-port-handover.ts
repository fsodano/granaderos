import {present} from './assert-present.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { decodeSave, encodeSave } from '../packages/game/save.ts';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { contractRenewalQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { occupyingGroups } from '../packages/game/enemy-groups.js';

const clock = (c: CampaignSnapshot) => c.hour * 3600 + (c.secondOfHour ?? 0);
export const controlledPortAvailable = (c: CampaignSnapshot, port = 'ensenada') =>
  c.sectors[port]?.owner === 'patriot' && !c.blockade && !occupyingGroups(c, port).length;
export const priorPortVictories = (notes, port = 'ensenada') =>
  notes
    .filter(
      (record) =>
        record.sector === port &&
        record.status === 'victory' &&
        record.turns > 0 &&
        record.actions > 0,
    )
    .map((record) => structuredClone(record));

// A previously earned port remains a real friendly destination. Travel and
// later meetings spend ordinary time; ownership is never a new battle receipt.
export function enterControlledPort(
  start: CampaignSnapshot,
  {
    fieldIds = start.squad,
    port = 'ensenada',
    mode = 'posta',
    resolveEncounter,
    report = () => {},
  } = {},
) {
  let c = decodeSave(encodeSave(start)).campaign;
  const before = structuredClone(start),
    field = [...fieldIds],
    groups = [],
    orders = [],
    renewals = [];
  assert.ok(field.length && new Set(field).size === field.length);
  const controlled = () => {
    assert.equal(
      c.sectors[port]?.owner,
      'patriot',
      'A controlled-port visit cannot replace a real conquest.',
    );
    assert.equal(
      c.blockade,
      false,
      'Resolve the actual naval blockade before the controlled-port meeting.',
    );
    assert.equal(
      occupyingGroups(c, port).length,
      0,
      'Resolve the actual port occupation before the meeting.',
    );
  };
  const encounter = () => {
    if (!c.pendingEncounter) {
      return;
    }
    assert.ok(
      resolveEncounter,
      'Resolve the actual encounter before continuing the controlled-port journey.',
    );
    const seconds = clock(c),
      pending = structuredClone(c.pendingEncounter);
    c = resolveEncounter(c);
    assert.ok(clock(c) >= seconds);
    assert.equal(c.pendingBattle, null);
    assert.equal(c.pendingEncounter, null);
    report({
      event: 'controlledPortEncounterResolved',
      encounter: pending,
      hour: c.hour,
      second: c.secondOfHour ?? 0,
    });
  };
  const order = (action: CampaignAction) => {
    const seconds = clock(c),
      cash = c.resources.treasury;
    c = dispatchCampaign(c, action);
    assert.equal(c.lastError, null, JSON.stringify(action) + ': ' + c.lastError);
    orders.push({
      action: structuredClone(action),
      from: seconds,
      to: clock(c),
      treasuryBefore: cash,
      treasuryAfter: c.resources.treasury,
    });
  };
  const retain = () => {
    for (const id of field) {
      assert.ok(
        c.recruited.includes(id) && present(c.operativeState[id]).alive && !present(c.operativeState[id]).captured,
        'The actual traveler must remain alive, serving and free.',
      );
      let expiry = contractExpiresSeconds(c.contracts[id]);
      assert.ok(
        expiry === null || expiry > clock(c),
        'An expired traveler cannot be restored by this journey.',
      );
      while (expiry !== null && expiry <= clock(c) + 3601) {
        const contract = c.contracts[id],
          quote = contractRenewalQuote(
            c,
            rosterFor(c).find((op) => op.id === id),
            'day',
          ),
          cash = c.resources.treasury;
        assert.equal(quote.available, true, quote.reason);
        order({
          type: 'renewContract',
          id,
          term: 'day',
          expectedExpiresAt: contract.expiresAt,
          expectedExpiresSecond: contract.expiresSecond ?? 0,
        });
        assert.equal(c.resources.treasury, cash - quote.price);
        const after = contractExpiresSeconds(c.contracts[id]);
        assert.equal(after, quote.expiresAt * 3600 + (quote.expiresSecond ?? 0));
        assert.ok(after > expiry);
        renewals.push({ id, quote });
        expiry = after;
      }
    }
  };
  encounter();
  assert.equal(c.pendingBattle, null);
  controlled();
  const origin = operativeLocation(c, field[0]);
  assert.ok(
    field.every(
      (id) =>
        c.recruited.includes(id) &&
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        !operativeInTransit(c, id) &&
        operativeLocation(c, id) === origin,
    ),
  );
  for (let offset = 0; offset < field.length; offset += 6) {
    const ids = field.slice(offset, offset + 6),
      slot =
        c.squads.find(
          (q) =>
            !groups.includes(q.id) &&
            q.location === origin &&
            !q.journey &&
            q.members.includes(ids[0]),
        ) ??
        c.squads.find(
          (q) => !groups.includes(q.id) && q.location === origin && !q.journey && !q.members.length,
        );
    if (slot) {
      order({ type: 'selectSquad', id: slot.id });
      order({ type: 'squad', ids });
    } else {
      order({ type: 'createSquad', name: 'Enlace del puerto controlado', ids, sector: origin });
    }
    groups.push(c.activeSquadId);
    for (const operativeId of ids) {
      order({ type: 'assignCare', operativeId, assignment: 'active' });
    }
  }
  let zeroTimeNotices = 0;
  for (let attempt = 0; attempt < 168; attempt++) {
    encounter();
    controlled();
    retain();
    if (
      groups.every((id) => {
        const q = c.squads.find((q) => q.id === id);
        return q.location === port && !q.journey;
      })
    ) {
      break;
    }
    for (const id of groups) {
      let q = c.squads.find((q) => q.id === id);
      if (q.location === port && !q.journey) {
        continue;
      }
      order({ type: 'selectSquad', id });
      q = c.squads.find((q) => q.id === id);
      if (q.journey?.status === 'paused') {
        order({ type: 'resumeTravel' });
      } else if (!q.journey) {
        order({ type: 'travel', sector: port, mode, queue: true });
      }
    }
    const seconds = clock(c);
    order({ type: 'wait', hours: 1 });
    zeroTimeNotices = clock(c) === seconds ? zeroTimeNotices + 1 : 0;
    assert.ok(
      zeroTimeNotices < 3,
      'Controlled-port travel stops after three consecutive zero-time notices.',
    );
  }
  encounter();
  controlled();
  assert.ok(
    groups.every((id) => {
      const q = c.squads.find((q) => q.id === id);
      return q.location === port && !q.journey;
    }),
    'The actual port journey must finish within its ordinary bounded orders.',
  );
  assert.ok(
    field.every(
      (id) =>
        c.recruited.includes(id) &&
        present(c.operativeState[id]).alive &&
        !present(c.operativeState[id]).captured &&
        operativeLocation(c, id) === port,
    ),
  );
  for (const [id, r] of Object.entries(start.operativeState)) {
    if (!r.alive) {
      assert.equal(present(c.operativeState[id]).alive, false);
      assert.equal(present(c.operativeState[id]).deathMinute, r.deathMinute);
    }
  }
  assert.equal(c.pendingBattle, null);
  assert.deepEqual(start, before);
  assert.deepEqual(decodeSave(encodeSave(c)).campaign, c);
  const receipt = {
    event: 'controlledPortArrival',
    port,
    origin,
    field,
    groups,
    orders,
    renewals,
    startSeconds: clock(start),
    endSeconds: clock(c),
    treasuryBefore: start.resources.treasury,
    treasuryAfter: c.resources.treasury,
  };
  report(receipt);
  return { campaign: c, receipt };
}
