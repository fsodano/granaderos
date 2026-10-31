import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type { SectorInventoryEntry } from '../packages/game/public/sector-inventory-types.ts';
import { equipmentReceipt } from './equipment-receipt.ts';
import { present } from './assert-present.ts';
export type RouteDressingShortage = {
  operativeId: number;
  sector: string;
  target: number;
  carried: number;
  availability: 'inaccessible-stock' | 'no-reachable-stock';
  inaccessibleCount: number;
  sites: {
    id: string;
    operativeId: number | null;
    reason: string | null;
    dressings: Pick<SectorInventoryEntry, 'key' | 'count' | 'reachable' | 'reason'>[];
  }[];
};
export type RouteDressingEvent =
  | {
      event: 'routeDressingDonation';
      donor: number;
      recipient: number;
      sector: string;
      count: number;
    }
  | ({ event: 'finiteDressingShortage' } & RouteDressingShortage)
  | {
      event: 'routeDressingsCollected';
      operativeId: number;
      sector: string;
      siteId: string;
      count: number;
      sourceKey: string;
    };
export type RouteDressingOptions = {
  reserves?: Readonly<Record<number, number>>;
  report?: (event: RouteDressingEvent) => void;
  discover?: boolean;
  onOrder?: (event: { campaign: CampaignSnapshot; action: CampaignAction }) => void;
};
export type RouteDressingResult = { campaign: CampaignSnapshot } & (
  | { supplied: false; reason: 'finite-dressing-shortage'; details: RouteDressingShortage }
  | { supplied: true; reason: null; details: null }
);
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { operativeLocation } from '../packages/game/squads.js';
import { sectorInventoryModel, sectorInventorySites } from '../packages/game/sector-inventory.js';
import { applyItemQuantity } from '../packages/game/tactical-inventory.js';
import { discoverRouteCache } from './finite-route-equipment.ts';
import { order, saved } from './local-contract-fixture.ts';

// Shared carried-stock selection. The Native inventory model still decides
// whether the actual serving local donor can handle equipment here.
export function routeDressingDonor(
  s: CampaignSnapshot,
  operativeId: number,
  { reserves = {} }: Pick<RouteDressingOptions, 'reserves'> = {},
) {
  const sector = operativeLocation(s, operativeId);
  return s.recruited.find((id) => {
    const r = present(s.operativeState[id]);
    if (
      id === operativeId ||
      !r.alive ||
      r.captured ||
      r.medkits <= (reserves[id] ?? 0) ||
      operativeLocation(s, id) !== sector
    ) {
      return false;
    }
    const model = sectorInventoryModel(s, sector, rosterFor(s), id);
    return model.operativeId === id && !model.reason;
  });
}

// Use known local dressings first, then actual carried donations or a real
// discovered cache. No purchase, remote transfer, stock grant or refill.
export function attemptRouteDressings(
  start: CampaignSnapshot,
  operativeId: number,
  target: number,
  { reserves = {}, report = () => {}, discover = true, onOrder }: RouteDressingOptions = {},
): RouteDressingResult {
  assert.ok(Number.isSafeInteger(target) && target >= 0 && target <= 100000);
  assert.equal(typeof discover, 'boolean');
  assert.ok(onOrder === undefined || typeof onOrder === 'function');
  operativeId = Number(operativeId);
  assert.ok(
    Number.isSafeInteger(operativeId) && Object.hasOwn(start.operativeState, operativeId),
    'The actual dressing recipient must exist.',
  );
  let s = structuredClone(start),
    discovered = false;
  const sector = operativeLocation(s, operativeId);
  const sites = () =>
    sectorInventorySites(s, sector).map((site) => ({
      site,
      model: sectorInventoryModel(s, site.id, rosterFor(s), operativeId),
    }));
  while ((present(s.operativeState[operativeId]).medkits ?? 0) < target) {
    const recipient = sectorInventoryModel(s, sector, rosterFor(s), operativeId);
    assert.equal(
      recipient.operativeId,
      operativeId,
      'The actual dressing recipient must be present.',
    );
    assert.equal(recipient.carriedReason, null, recipient.carriedReason ?? undefined);
    const source = sites()
      .map(({ site, model }) => ({
        site,
        model,
        row:
          model.operativeId === operativeId &&
          model.entries.find(
            (row) =>
              row.reachable && row.count > 0 && equipmentReceipt(row.expected).item === 'medkits',
          ),
      }))
      .find((source) => source.row);
    if (!source) {
      const donor = routeDressingDonor(s, operativeId, { reserves });
      if (donor !== undefined) {
        const count = Math.min(
            present(s.operativeState[donor]).medkits - (reserves[donor] ?? 0),
            target - (present(s.operativeState[operativeId]).medkits ?? 0),
          ),
          action: CampaignAction = {
            type: 'sectorInventory',
            sector,
            operativeId: donor,
            direction: 'drop',
            item: 'medkits',
            count,
          };
        s = order(s, action);
        onOrder?.({ campaign: s, action });
        report({ event: 'routeDressingDonation', donor, recipient: operativeId, sector, count });
        continue;
      }
      if (discover && !discovered) {
        discovered = true;
        s = discoverRouteCache(s, operativeId);
        continue;
      }
      const quotedSites = sites().map(({ site, model }) => ({
        id: site.id,
        operativeId: model.operativeId,
        reason: model.reason,
        dressings: model.entries
          .filter((row) => equipmentReceipt(row.expected).item === 'medkits')
          .map(({ key, count, reachable, reason }) => ({ key, count, reachable, reason })),
      }));
      const inaccessibleCount = quotedSites.reduce(
        (sum, site) =>
          sum + site.dressings.filter((row) => !row.reachable).reduce((n, row) => n + row.count, 0),
        0,
      );
      const details: RouteDressingShortage = {
        operativeId,
        sector,
        target,
        carried: present(s.operativeState[operativeId]).medkits ?? 0,
        availability: inaccessibleCount > 0 ? 'inaccessible-stock' : 'no-reachable-stock',
        inaccessibleCount,
        sites: quotedSites,
      };
      report({ event: 'finiteDressingShortage', ...details });
      return {
        campaign: saved({ campaign: s }).campaign,
        supplied: false,
        reason: 'finite-dressing-shortage',
        details,
      };
    }
    const { site, model } = source;
    const row = source.row;
    assert.ok(row);
    let count = Math.min(row.count, target - (present(s.operativeState[operativeId]).medkits ?? 0));
    while (count > 0) {
      try {
        applyItemQuantity(model.personal, { ...equipmentReceipt(row.expected), count });
        break;
      } catch {
        count--;
      }
    }
    assert.ok(count, 'The actual physician has no carrying room for the remaining dressings.');
    const cash = s.resources.treasury,
      old = present(s.operativeState[operativeId]).medkits ?? 0;
    const action: CampaignAction = {
      type: 'sectorInventory',
      sector: site.id,
      operativeId,
      direction: 'take',
      sourceKey: row.key,
      expected: row.expected,
      count,
    };
    s = order(s, action);
    onOrder?.({ campaign: s, action });
    assert.equal(s.resources.treasury, cash);
    assert.equal(present(s.operativeState[operativeId]).medkits, old + count);
    report({
      event: 'routeDressingsCollected',
      operativeId,
      sector,
      siteId: site.id,
      count,
      sourceKey: row.key,
    });
  }
  return { campaign: saved({ campaign: s }).campaign, supplied: true, reason: null, details: null };
}

// Existing callers remain strict. Only the explicit attempt API can hand its
// actual post-discovery campaign to a different legal recovery plan.
export function supplyRouteDressings(
  start: CampaignSnapshot,
  operativeId: number,
  target: number,
  options?: RouteDressingOptions,
) {
  const result = attemptRouteDressings(start, operativeId, target, options);
  if (!result.supplied) {
    throw Error(
      `No actual reachable finite dressings remain for ${operativeId} at ${result.details.sector}.`,
    );
  }
  return result.campaign;
}
