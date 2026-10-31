import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignOperative,
} from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import {
  carriedAmmunition,
  ammunitionOrderQuote,
  AMMUNITION_ORDER_LIMIT,
} from '../packages/game/campaign-ammunition.js';
import { ammoTypeFor, ammoCount } from '../packages/game/ammo-types.js';
import { AMMUNITION_FAMILIES } from '../packages/game/ammunition-families.js';
import { sectorInventoryModel, sectorInventorySites } from '../packages/game/sector-inventory.js';
import { operativeLocation, operativeInTransit } from '../packages/game/squads.js';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { finiteCachesFor } from '../packages/game/campaign-physical.js';
import { discoverRouteCache } from './finite-route-equipment.ts';

import type { EquipmentItem } from '../packages/game/public/compatibility-types.ts';
import type { SectorInventoryEntry } from '../packages/game/public/sector-inventory-types.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
export type AmmunitionTransaction = {
  action: CampaignAction;
  sector: string;
  hour: number;
  secondOfHour: number;
  cost: number;
  quantity: number;
  family: string;
  sourceKind: string;
};
type PublicAmmunitionStock = {
  depot: number;
  sites: {
    id: string;
    reason: string | null;
    ammunition: { key: string; count: number; reachable: boolean; reason: string | null }[];
  }[];
  localCarriers: {
    id: number;
    field: boolean;
    selectedFamily: string | null;
    loaded: number;
    loose: number;
  }[];
};
export type RouteAmmunitionEvent =
  | AmmunitionTransaction
  | {
      event: 'ammunitionCacheDiscovered';
      sector: string;
      cacheId: string;
      hour: number;
      secondOfHour: number;
    }
  | {
      event: 'ammunitionShortage';
      operativeId: number;
      sector: string;
      family: string;
      target: number;
      remaining: number;
      carried: number;
      publicStock: PublicAmmunitionStock;
    };
type AmmunitionOptions = {
  target?: number;
  shareFieldSurplus?: boolean;
  report?: (event: RouteAmmunitionEvent) => void;
  onDiagnosticCheckpoint?: ((campaign: CampaignSnapshot) => void) | null;
};
let diagnosticSequence = 0;
// Opt-in raw observation only. Never normalize a save or apply another order.
export function recordRouteAmmunitionDiagnostic(
  stage: string,
  campaign: CampaignSnapshot,
  context: object = {},
) {
  const root = process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR'];
  if (!root) {
    return null;
  }
  try {
    const directory = join(root, 'ammunition-preparation');
    mkdirSync(directory, { recursive: true });
    const label = stage.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const path = join(directory, `${process.pid}-${++diagnosticSequence}-${label}.json`);
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        stage,
        sourceSnapshot: process.env['GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT'] ?? null,
        scope: 'Raw passive checkpoint. No extra dispatch, synchronization or save normalization.',
        context,
        campaign,
      }) + '\n',
      { flag: 'wx' },
    );
    return path;
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        event: 'ammunitionDiagnosticWriteFailed',
        stage,
        message: error instanceof Error ? error.message : String(error),
      }) + '\n',
    );
    return null;
  }
}

// Refill the actual selected load from finite depot and reachable known loot.
// Discover the authored cache only after known physical stocks run out.
export function supplyRouteAmmunition(
  start: CampaignSnapshot,
  ids: number[],
  {
    target = 10,
    shareFieldSurplus = false,
    report = () => {},
    onDiagnosticCheckpoint = null,
  }: AmmunitionOptions = {},
) {
  assert.ok(
    Number.isSafeInteger(target) && target >= 0 && target <= 1_000_000,
    'Use a finite integer ammunition target.',
  );
  assert.equal(typeof shareFieldSurplus, 'boolean');
  let campaign = structuredClone(start);
  const transactions: AmmunitionTransaction[] = [];
  for (const id of ids) {
    const op = rosterFor(campaign).find((unit) => unit.id === id);
    assert.ok(
      op &&
        campaign.recruited.includes(id) &&
        campaign.operativeState[id]?.alive &&
        !campaign.operativeState[id]?.captured,
      `El combatiente no está disponible: ${id}.`,
    );
    const carried = () => carriedAmmunition(op, campaign.operativeState[id]);
    const unit = carried(),
      family = ammoTypeFor({ ...unit, activeSlot: 'primary' });
    if (!family || unit.weaponDropped) {
      continue;
    }
    let remaining = Math.max(0, target - unit.loaded - ammoCount(unit, family)),
      checkedCache = false;
    while (remaining) {
      const access = ammunitionOrderQuote(campaign, op, family, 1, 'take', true);
      assert.ok(
        access.available || access.reason === 'El depósito no tiene suficientes cartuchos.',
        `ammunition for ${id} at ${campaign.location}: ${access.reason}`,
      );
      const stored: number = campaign.ammunitionStores[campaign.location]?.[family] ?? 0;
      let action: CampaignAction, quantity: number, sourceKind: string;
      if (stored) {
        quantity = Math.min(remaining, AMMUNITION_ORDER_LIMIT, stored);
        while (
          quantity > 0 &&
          !ammunitionOrderQuote(campaign, op, family, quantity, 'take', true).available
        ) {
          quantity--;
        }
        assert.ok(quantity > 0, `No queda espacio en los bolsillos para los cartuchos de ${id}.`);
        action = { type: 'ammunition', operativeId: id, family, quantity, direction: 'take' };
        sourceKind = 'depot';
      } else {
        const sites = sectorInventorySites(campaign, campaign.location).map((site) => ({
          site,
          model: sectorInventoryModel(campaign, site.id, rosterFor(campaign), id),
        }));
        const familyDefinition = Object.values(AMMUNITION_FAMILIES).find(
          (value) => value.id === family,
        );
        assert.ok(familyDefinition);
        const matches = (row: SectorInventoryEntry) => {
          const item = equipmentReceipt(row.expected);
          return (
            row.count > 0 && item.kind === 'ammunition' && item.ammoType === familyDefinition.type
          );
        };
        const source = sites
          .map(({ site, model }) => ({
            site,
            model,
            row:
              model.operativeId === id
                ? model.entries.find((row) => row.reachable && matches(row))
                : undefined,
          }))
          .find((source) => source.row);
        const { site, model, row } = source ?? {};
        if (!row && !checkedCache) {
          checkedCache = true;
          const cacheId = finiteCachesFor(campaign)[campaign.location]?.chest;
          const chest = campaign.sectorStates[campaign.location]?.props?.find(
            (prop) => prop.id === cacheId,
          );
          if (cacheId && (!chest?.open || !chest.knownToPlayer)) {
            campaign = discoverRouteCache(campaign, id);
            report({
              event: 'ammunitionCacheDiscovered',
              sector: campaign.location,
              cacheId,
              hour: campaign.hour,
              secondOfHour: campaign.secondOfHour ?? 0,
            });
            continue;
          }
        }
        // Only this explicitly supplied field may share its loose surplus. A
        // donor retains the same target in its selected family, including its
        // existing barrel load. Rear personnel and other loads stay untouched.
        if (!row && shareFieldSurplus) {
          const donor = ids
            .filter((donorId) => donorId !== id)
            .map(
              (
                donorId,
              ): {
                person: CampaignOperative;
                carried: CampaignOperative & {
                  inventory: Record<string, EquipmentItem>;
                  loaded: number;
                  ammo: number;
                };
                quantity: number;
              } | null => {
                const person = rosterFor(campaign).find((person) => person.id === donorId),
                  body = campaign.operativeState[donorId];
                if (
                  !person ||
                  !campaign.recruited.includes(donorId) ||
                  !body?.alive ||
                  body.captured ||
                  operativeInTransit(campaign, donorId) ||
                  operativeLocation(campaign, donorId) !== campaign.location
                ) {
                  return null;
                }
                const carried = carriedAmmunition(person, body);
                if (
                  carried.weaponDropped ||
                  ammoTypeFor({ ...carried, activeSlot: 'primary' }) !== family
                ) {
                  return null;
                }
                const quantity = Math.min(
                  remaining,
                  AMMUNITION_ORDER_LIMIT,
                  ammoCount(carried, family),
                  Math.max(0, carried.loaded + ammoCount(carried, family) - target),
                );
                return quantity > 0 &&
                  ammunitionOrderQuote(campaign, person, family, quantity, 'store', true).available
                  ? { person, carried, quantity }
                  : null;
              },
            )
            .find(Boolean);
          if (donor) {
            const { person, quantity } = donor,
              cash = campaign.resources.treasury,
              stored: number = campaign.ammunitionStores[campaign.location]?.[family] ?? 0;
            const action: CampaignAction = {
              type: 'ammunition',
              operativeId: person.id,
              family,
              quantity,
              direction: 'store',
            };
            campaign = dispatchCampaign(campaign, action);
            assert.equal(campaign.lastError, null, campaign.lastError ?? undefined);
            const after = carriedAmmunition(person, campaign.operativeState[person.id]);
            assert.equal(campaign.resources.treasury, cash);
            assert.equal(after.loaded, donor.carried.loaded);
            assert.equal(ammoCount(after, family), ammoCount(donor.carried, family) - quantity);
            assert.ok(after.loaded + ammoCount(after, family) >= target);
            assert.equal(
              present(campaign.ammunitionStores[campaign.location])[family],
              stored + quantity,
            );
            const transaction = {
              action,
              sector: campaign.location,
              hour: campaign.hour,
              secondOfHour: campaign.secondOfHour ?? 0,
              cost: 0,
              quantity,
              family,
              sourceKind: 'field-surplus',
            };
            transactions.push(transaction);
            report(transaction);
            continue;
          }
        }
        if (!row) {
          const publicStock = {
            depot: stored,
            sites: sites.map(({ site, model }) => ({
              id: site.id,
              reason: model.reason,
              ammunition: model.entries.filter(matches).map((row) => ({
                key: row.key,
                count: row.count,
                reachable: row.reachable,
                reason: row.reason,
              })),
            })),
            localCarriers: rosterFor(campaign)
              .filter(
                (person) =>
                  campaign.recruited.includes(person.id) &&
                  present(campaign.operativeState[person.id]).alive &&
                  !present(campaign.operativeState[person.id]).captured &&
                  !operativeInTransit(campaign, person.id) &&
                  operativeLocation(campaign, person.id) === campaign.location,
              )
              .map((person) => {
                const unit = carriedAmmunition(person, campaign.operativeState[person.id]);
                return {
                  id: person.id,
                  field: ids.includes(person.id),
                  selectedFamily: ammoTypeFor({ ...unit, activeSlot: 'primary' }),
                  loaded: unit.loaded,
                  loose: ammoCount(unit, family),
                };
              }),
          };
          report({
            event: 'ammunitionShortage',
            operativeId: id,
            sector: campaign.location,
            family,
            target,
            remaining,
            carried: carried().loaded + ammoCount(carried(), family),
            publicStock,
          });
          const error = Error(
            `Finite ammunition shortage for ${id} at ${campaign.location}: ${remaining} ${family} rounds are missing. Public finite stock: ${JSON.stringify(publicStock)}`,
          );
          if (process.env['GRANADEROS_CAMPAIGN_FAILURE_DIR']) {
            recordRouteAmmunitionDiagnostic('finite-ammunition-refusal', campaign, {
              operativeId: id,
              ids,
              target,
              family,
              remaining,
              publicStock,
              acceptedAmmunitionTransactions: transactions,
              cacheExplorationOrdersIncluded: false,
              checkpointKind: 'actual-partial-campaign-after-existing-accepted-orders',
            });
            if (typeof onDiagnosticCheckpoint === 'function') {
              try {
                onDiagnosticCheckpoint(structuredClone(campaign));
              } catch (diagnosticError) {
                process.stderr.write(
                  JSON.stringify({
                    event: 'ammunitionDiagnosticCallbackFailed',
                    message:
                      diagnosticError instanceof Error
                        ? diagnosticError.message
                        : String(diagnosticError),
                  }) + '\n',
                );
              }
            }
          }
          throw error;
        }
        const stack = equipmentReceipt(row.expected);
        quantity = Math.min(remaining, row.count);
        while (quantity > 0) {
          try {
            applyItemQuantity(present(present(model).personal), { ...stack, count: quantity });
            break;
          } catch {
            quantity--;
          }
        }
        assert.ok(quantity > 0, `No queda espacio en los bolsillos para los cartuchos de ${id}.`);
        action = {
          type: 'sectorInventory',
          sector: present(site).id,
          operativeId: id,
          direction: 'take',
          sourceKey: row.key,
          expected: row.expected,
          count: quantity,
        };
        sourceKind = row.kind;
      }
      const before = campaign.resources.treasury,
        stock = ammoCount(carried(), family);
      campaign = dispatchCampaign(campaign, action);
      assert.equal(campaign.lastError, null, campaign.lastError ?? undefined);
      assert.equal(campaign.resources.treasury, before);
      assert.equal(ammoCount(carried(), family), stock + quantity);
      if (sourceKind === 'depot') {
        assert.equal(
          campaign.ammunitionStores[campaign.location]?.[family] ?? 0,
          stored - quantity,
        );
      }
      const transaction = {
        action,
        sector: campaign.location,
        hour: campaign.hour,
        secondOfHour: campaign.secondOfHour ?? 0,
        cost: 0,
        quantity,
        family,
        sourceKind,
      };
      transactions.push(transaction);
      report(transaction);
      remaining -= quantity;
    }
    assert.ok(carried().loaded + ammoCount(carried(), family) >= target);
  }
  return { campaign, transactions };
}
