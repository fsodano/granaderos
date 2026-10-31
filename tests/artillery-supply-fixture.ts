import { present } from './assert-present.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import type { CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { wonBattery, fireStationed } from './stationed-artillery-fixture.ts';
import { visit, saved, sync, leave } from './local-contract-fixture.ts';
import { actBattle } from '../packages/game/tactical.js';
export function reloadPiece(p: ActiveGame): ActiveGame {
  const gun = present(present(p.battle.artillery[0])),
    actor = p.battle.units.find(
      (u) =>
        u.side === 'player' &&
        u.hp >= 15 &&
        !u.routed &&
        Math.hypot(u.x - gun.x, u.y - gun.y) <= 1.5,
    ),
    battle = actBattle(p.battle, {
      type: 'artilleryReload',
      unitId: present(actor).id,
      artilleryId: gun.id,
    });
  assert.equal(battle.lastError, null);
  return saved(sync({ campaign: p.campaign, battle }));
}
let empty: CampaignSnapshot | undefined;
export function emptyBattery() {
  if (empty) {
    return structuredClone(empty);
  }
  let p = visit(wonBattery());
  const remaining =
    present(p.battle.artillery[0]).ammo + Number(present(p.battle.artillery[0]).loaded);
  assert.ok(remaining > 0);
  for (let i = 0; i < remaining; i++) {
    p = fireStationed(p);
    assert.equal(
      present(p.battle.artillery[0]).ammo + Number(present(p.battle.artillery[0]).loaded),
      remaining - i - 1,
    );
  }
  assert.equal(present(p.battle.artillery[0]).ammo, 0);
  assert.equal(present(p.battle.artillery[0]).loaded, false);
  empty = saved({ campaign: leave(p) }).campaign;
  return structuredClone(empty);
}
