import { isJsonObject, parseJsonObject } from '../packages/campaign-format/json-value.ts';
import type { JsonObject, JsonValue } from '../packages/campaign-format/types.ts';
import { present } from './assert-present.ts';
import { enterAssault } from './assault-fixture.ts';
import { syncBattleTime } from '../packages/game/time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { buildSectorMap } from '../packages/game/maps.js';
import { createBattle, actBattle, endTurn, getReachable } from '../packages/game/tactical.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
function deployed() {
  const campaign = enterAssault(
    dispatchCampaign(initialCampaign(), { type: 'travel', sector: 'buenos_aires' }),
    'san_nicolas',
  );
  const map = buildSectorMap(present(campaign.pendingBattle));
  return { campaign, battle: createBattle(map.squad, map) };
}

void test('campaign and authored battle save round-trip keeps the next enemy turn deterministic', () => {
  const { campaign, battle } = deployed();
  const u = battle.units.find((u) => u.side === 'player');
  const p = getReachable(battle, present(u)).find((p) => p.cost === 8);
  const moved = actBattle(battle, {
    type: 'move',
    unitId: present(u).id,
    x: present(p).x,
    y: present(p).y,
  });
  const pair = syncBattleTime(campaign, moved);
  const restored = decodeSave(encodeSave(pair.campaign, pair.battle));
  assert.deepEqual(restored, { campaign: pair.campaign, battle: pair.battle });
  assert.deepEqual(endTurn(restored.battle), endTurn(pair.battle));
  assert.deepEqual(decodeSave(encodeSave(initialCampaign())), {
    campaign: initialCampaign(),
    battle: null,
  });
});
void test('save rejects malformed data before it can enter the renderer or tactical rules', () => {
  const sample = deployed();
  const object = (value: JsonValue | undefined): JsonObject => {
    assert.ok(isJsonObject(value));
    return value;
  };
  const first = (value: JsonValue | undefined): JsonObject => {
    assert.ok(Array.isArray(value));
    return object(value[0]);
  };
  const mutations: ((battle: JsonObject) => void)[] = [
    (battle) => {
      first(battle['units'])['weapon'] = { name: 'forged' };
    },
    (battle) => {
      first(battle['units'])['morale'] = null;
    },
    (battle) => {
      first(battle['units'])['loaded'] = 100;
    },
    (battle) => {
      first(battle['units'])['ammo'] = 0.5;
    },
    (battle) => {
      first(battle['units'])['stance'] = 'flying';
    },
    (battle) => {
      first(battle['units'])['activeSlot'] = 'unknown';
    },
    (battle) => {
      battle['smoke'] = [{ x: 1, y: 1, radius: 'huge', turns: 3 }];
    },
    (battle) => {
      battle['log'] = [{}];
    },
    (battle) => {
      first(battle['tiles'])['type'] = 'unknown';
    },
    (battle) => {
      first(battle['tiles'])['blocked'] = 'false';
    },
    (battle) => {
      battle['artillery'] = [{ x: 1, y: 1, type: 'unknown' }];
    },
    (battle) => {
      battle['decor'] = [{ x: 1, y: 1, width: 100, height: 2, type: 'convent' }];
    },
    (battle) => {
      first(battle['units'])['x'] = -1;
    },
    (battle) => {
      battle['sectorId'] = 'salta';
    },
  ];
  for (const mutate of mutations) {
    const altered = parseJsonObject(encodeSave(sample.campaign, sample.battle));
    mutate(object(altered['battle']));
    assert.throws(() => decodeSave(JSON.stringify(altered)));
  }
  const absent = parseJsonObject(encodeSave(sample.campaign, sample.battle));
  absent['battle'] = null;
  assert.throws(() => decodeSave(JSON.stringify(absent)));
  for (const text of ['no JSON', '{}', 'x'.repeat(5000001)]) {
    assert.throws(() => decodeSave(text));
  }
});
