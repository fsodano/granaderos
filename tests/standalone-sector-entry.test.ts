import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PRESENTATION } from '../content/campaigns/default.js';
import { OPERATIVES } from '../packages/game/data.js';
import { battleFromRequest } from '../packages/game/battle-handoff.js';

function standaloneRequest() {
  const { request, operativeIds, horse } = DEFAULT_PRESENTATION.skirmish;
  return {
    ...request,
    squad: operativeIds.map((id) => {
      const operative = OPERATIVES.find((entry) => entry.id === id);
      assert.ok(operative);
      return { ...operative, horse };
    }),
  };
}

void test('the authored standalone battle enters its sector without a campaign save', () => {
  const request = standaloneRequest();
  const battle = battleFromRequest(request);
  assert.equal(battle.sectorId, request.id);
  assert.equal(battle.status, 'active');
  assert.ok(battle.sectorSession);
  assert.equal(battle.units.filter((unit) => unit.side === 'player').length, request.squad.length);
  assert.equal(Object.hasOwn(request, 'sector'), false);
});

void test('an explicit entry sector keeps its authority over the standalone scene id', () => {
  const battle = battleFromRequest({ ...standaloneRequest(), sector: 'retiro' });
  assert.equal(battle.sectorId, 'retiro');
});
