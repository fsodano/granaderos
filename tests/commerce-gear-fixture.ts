import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { addEquipment } from '../packages/game/stored-equipment.js';
import { equipmentKey } from '../packages/game/equipment-catalog.ts';
import { changeAmmo, AMMO_TYPES } from '../packages/game/ammo-types.js';
import { makeGrenadeStack } from '../packages/game/grenades.ts';
import { syncCarriedAmmunition } from '../packages/game/physical-ammunition.js';

// Authored finite property for isolated custody/equipment scenarios. These
// helpers do not execute a purchase or alter a new-player route constructor.
export function withStoredGear(
  state: CampaignSnapshot,
  item: string | number,
  quantity = 1,
): CampaignSnapshot {
  const next = structuredClone(state);
  addEquipment(next, item, quantity);
  return next;
}
export function withCarriedAmmo(
  state: CampaignSnapshot,
  operativeId: number,
  family: string,
  quantity: number,
): CampaignSnapshot {
  assert.ok(Number.isSafeInteger(quantity) && quantity > 0);
  const next = structuredClone(state),
    record = next.operativeState[operativeId],
    operative = rosterFor(next).find((row) => row.id === operativeId);
  assert.ok(record && operative);
  changeAmmo(record, family, quantity);
  syncCarriedAmmunition(record, operative.weapon);
  return next;
}
export function withStoredAmmo(
  state: CampaignSnapshot,
  sector: string,
  family: string,
  quantity: number,
): CampaignSnapshot {
  assert.ok(Object.hasOwn(AMMO_TYPES, family) && Number.isSafeInteger(quantity) && quantity > 0);
  const next = structuredClone(state);
  next.ammunitionStores[sector] ??= {};
  const total = (next.ammunitionStores[sector][family] ?? 0) + quantity;
  assert.ok(total <= 1_000_000);
  next.ammunitionStores[sector][family] = total;
  return next;
}
export function asLegacyMerchantGear(
  state: CampaignSnapshot,
  instanceId: string,
  sector = state.location,
): CampaignSnapshot {
  const next = structuredClone(state),
    index = next.armoryItems.findIndex((row) => row.id === instanceId);
  assert.ok(index >= 0);
  const item = present(next.armoryItems.splice(index, 1)[0]);
  const key = equipmentKey(item);
  next.armory[key] = present(next.armory[key]) - 1;
  present(next.merchants[sector]).usedItems.push(item);
  return next;
}
export function assertTradeRejected(
  state: CampaignSnapshot,
  action: CampaignAction,
): CampaignSnapshot {
  const before = structuredClone(state),
    next = dispatchCampaign(state, action);
  assert.match(present(next.lastError), /comercio de equipo/);
  assert.deepEqual({ ...next, lastError: state.lastError }, before);
  assert.deepEqual(state, before);
  return next;
}

export function withCarriedGrenades(
  state: CampaignSnapshot,
  operativeId: number,
  quantity: number,
): CampaignSnapshot {
  assert.ok(Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 6);
  const next = structuredClone(state),
    record = next.operativeState[operativeId];
  assert.ok(record);
  record.inventory ??= {};
  const old = record.inventory['grenade:arsenal'];
  assert.ok(!old || (typeof old === 'object' && !Array.isArray(old) && old.kind === 'grenade'));
  const count = (old && typeof old === 'object' ? (old.count ?? 0) : 0) + quantity;
  assert.ok(count <= 6);
  record.inventory['grenade:arsenal'] =
    old && typeof old === 'object' ? { ...old, count } : makeGrenadeStack('arsenal', count);
  return next;
}

export function withCarriedRepairKit(
  state: CampaignSnapshot,
  operativeId: number,
  points = 100,
): CampaignSnapshot {
  assert.ok(Number.isSafeInteger(points) && points > 0 && points <= 100);
  const next = structuredClone(state),
    record = next.operativeState[operativeId];
  assert.ok(record);
  record.inventory ??= {};
  assert.equal(record.inventory['fixture:repair-kit'], undefined);
  record.inventory['fixture:repair-kit'] = {
    kind: 'repair-kit',
    name: 'Juego de herramientas',
    count: 1,
    weight: 2,
    repairPoints: points,
  };
  return next;
}
