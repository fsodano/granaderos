import type {
  CampaignSnapshot,
  CampaignArtillery,
} from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { artilleryProfile } from '../packages/game/artillery-definitions.ts';
import { storedArtilleryRecord } from '../packages/game/artillery-transport.js';

// Declare old-save merchant custody from one existing finite owner. There is
// no sale, purchase, payment or new-player-route grant in this fixture.
export function legacyMerchantGun(
  state: CampaignSnapshot,
  {
    kind = 'depot',
    sector = state.location,
    artilleryId,
    model,
  }: {
    kind?: 'depot' | 'stock' | 'field';
    sector?: string;
    artilleryId?: string;
    model?: string;
  } = {},
) {
  const next = structuredClone(state);
  let gun: CampaignArtillery;
  if (kind === 'stock') {
    assert.ok(model);
    const count = present(next.armory[model]);
    assert.ok(count > 0);
    next.armory[model] = count - 1;
    const spec = artilleryProfile(next, model);
    assert.ok(next.nextArtilleryId !== undefined);
    gun = {
      id: `piece-${next.nextArtilleryId++}`,
      type: model,
      side: 'player',
      loaded: spec.initialLoaded,
      ammo: spec.initialAmmo,
    };
  } else {
    const source =
      kind === 'field'
        ? present(next.sectorStates[sector]).artillery
        : present(next.artilleryDepots)[sector];
    assert.ok(source);
    const index = source.findIndex((gun) => gun.id === artilleryId);
    assert.ok(index >= 0);
    gun = storedArtilleryRecord(present(source.splice(index, 1)[0]));
  }
  next.artilleryMerchants ??= {};
  next.artilleryMerchants[sector] ??= { guns: [] };
  next.artilleryMerchants[sector].guns.push(gun);
  return next;
}
