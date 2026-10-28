import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../game/campaign.js';
import { encodeSave, decodeSave } from '../game/save.js';

test('assigning a combatant to a squad commits one revision and restores without duplicate membership', () => {
  const initial = initialCampaign();
  const formed = dispatchCampaign(initial, { type: 'createSquad', name: 'Reserva', ids: [10] });
  assert.equal(formed.lastError, null);
  const assigned = dispatchCampaign(formed, {
    type: 'assignToSquad',
    squadId: 'squad-1',
    operativeId: 10,
  });
  assert.equal(assigned.lastError, null);
  assert.equal(assigned.gameRevision, formed.gameRevision + 1);
  assert.equal(
    assigned.squads.flatMap((squad) => squad.members).filter((id) => id === 10).length,
    1,
  );
  assert.equal(assigned.operativeState[10].location, initial.location);
  assert.deepEqual(decodeSave(encodeSave(assigned)).campaign, assigned);
});
