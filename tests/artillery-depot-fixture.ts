import { present } from './assert-present.ts';
import { wakeBatteryCrew } from './stationed-artillery-fixture.ts';
import { advanceCampaignHours } from './campaign-wait-fixture.ts';
import assert from 'node:assert/strict';
import { fieldGun } from './artillery-transport-fixture.ts';
import { order, saved } from './local-contract-fixture.ts';
import { contentFixtureCache } from './content-fixture-cache.ts';
export const homeDepotGun = contentFixtureCache((content) => {
  let s = fieldGun(content);
  const gun = present(present(s.sectorStates['san_nicolas']).artillery[0]);
  s = order(s, {
    type: 'transportArtillery',
    sector: 'san_nicolas',
    artilleryId: gun.id,
    to: 'retiro',
    mode: 'carts',
  });
  const due = present(present(s.artilleryTransfers)[0]).dueAt;
  s = order(s, { type: 'travel', sector: 'retiro' });
  s = wakeBatteryCrew(s);
  if (s.hour < due) {
    s = advanceCampaignHours(s, due - s.hour);
  }
  assert.equal(present(present(present(s.artilleryDepots)['retiro'])[0]).id, gun.id);
  s = saved({ campaign: s }).campaign;
  return wakeBatteryCrew(s);
});
