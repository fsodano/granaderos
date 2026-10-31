import type {
  CampaignSnapshot,
  TownIncomeReceipt,
} from '../packages/game/public/campaign-types.ts';
import type { BattleUnit } from '../packages/game/public/compatibility-types.ts';
import type { TownIncomeSource } from '../packages/game/town-income-query.ts';
import { present } from './assert-present.ts';
type IncomeFailure = {
  sourceId?: string | null;
  uncontrolled?: TownIncomeSource['uncontrolled'];
  operativeId?: number | undefined;
  price?: number;
  treasury?: number;
  sector?: string;
  destination?: string;
};
export type RouteTownIncomeEvent =
  | ({ event: 'townIncomeUnavailable'; message: string } & IncomeFailure)
  | {
      event: 'townIncomeActivated';
      sourceId: string;
      operativeId: number;
      receipt: TownIncomeReceipt;
      daily: number;
    }
  | {
      event: 'townIncomeTravelRenewal';
      operativeId: number;
      price: number;
      hour: number;
      secondOfHour: number;
    };
export type RouteTownIncomeOptions = {
  sourceId?: string;
  operativeId?: number | undefined;
  restoreLocation?: boolean;
  approach?: 'friendly' | 'direct';
  report?: (event: RouteTownIncomeEvent) => void;
};
type IncomeReporter = (event: RouteTownIncomeEvent) => void;
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { townIncomeSources } from '../packages/game/town-income.js';
import { contractExpiresSeconds, contractQuote } from '../packages/game/contracts.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { approachNPC } from './approach-npc.ts';
import { order, visit, sync, leave, saved } from './local-contract-fixture.ts';

const clock = (state: CampaignSnapshot) => state.hour * 3600 + (state.secondOfHour ?? 0);
const validSpeaker = (unit: BattleUnit) =>
  unit.side === 'player' &&
  unit.hp >= 15 &&
  !unit.unconscious &&
  !unit.routed &&
  !unit.surrendered &&
  !unit.departure &&
  !unit.asleep;
function notifyFailure(
  report: IncomeReporter,
  message: string,
  details: IncomeFailure = {},
): never {
  report({ event: 'townIncomeUnavailable', message, ...details });
  throw Error(message);
}

// This helper records the agreement through the same physical conversation as
// the player. Owning the town or an older dialogue flag is never enough.
export function meetLocalIncomeRepresentative(
  start: CampaignSnapshot,
  { sourceId, operativeId, approach = 'direct', report = () => {} }: RouteTownIncomeOptions = {},
) {
  let campaign = structuredClone(start);
  const source = townIncomeSources(campaign).find((row) =>
    sourceId ? row.id === sourceId : row.representative.sectorId === campaign.location,
  );
  if (!source) {
    notifyFailure(
      report,
      `There is no income representative for ${sourceId ?? campaign.location}.`,
    );
  }
  if (!source.controlled) {
    notifyFailure(report, `The complete town of ${source.name} is not controlled.`, {
      sourceId: source.id,
      uncontrolled: source.uncontrolled,
    });
  }
  if (source.activated) {
    return saved({ campaign }).campaign;
  }
  assert.ok(
    ['friendly', 'direct'].includes(approach),
    'Use a friendly or direct port conversation.',
  );
  if (campaign.location !== source.representative.sectorId) {
    notifyFailure(
      report,
      `The squad must physically reach ${source.representative.sectorId} before this meeting.`,
    );
  }
  if (campaign.pendingBattle || campaign.pendingEncounter) {
    notifyFailure(report, 'Resolve the current encounter before the port meeting.');
  }
  let pair = visit(campaign);
  const speakers = pair.battle.units
    .filter(validSpeaker)
    .sort((a, b) => (b.leadership ?? 0) - (a.leadership ?? 0) || Number(a.id) - Number(b.id));
  const speaker =
    operativeId === undefined
      ? speakers[0]
      : speakers.find((unit) => String(unit.id) === String(operativeId));
  if (!speaker) {
    notifyFailure(report, 'No valid awake deployed speaker is available for the port meeting.', {
      sourceId: source.id,
      operativeId,
    });
  }
  const npc = pair.battle.npcs.find(
    (unit) => unit.id === source.representative.npcId && unit.hp > 0 && !unit.departure,
  );
  if (!npc) {
    notifyFailure(
      report,
      `The actual representative ${source.representative.npcId} is unavailable.`,
    );
  }
  pair = sync({ campaign: pair.campaign, battle: approachNPC(pair.battle, speaker.id, npc.id) });
  campaign = order(pair.campaign, {
    type: 'talkNPC',
    npcId: npc.id,
    unitId: Number(speaker.id),
    approach,
    sectorState: pair.battle,
  });
  assert.equal(present(campaign.lastConversation).outcome, 'incomeActivated');
  assert.ok(campaign.townIncome.activations[source.id]);
  const receipt = { ...present(campaign.townIncome.activations[source.id]) };
  campaign = saved({ campaign: leave(saved({ campaign, battle: pair.battle })) }).campaign;
  report({
    event: 'townIncomeActivated',
    sourceId: source.id,
    operativeId: Number(speaker.id),
    receipt,
    daily: present(townIncomeSources(campaign).find((row) => row.id === source.id)).daily,
  });
  return campaign;
}

// Preserve the selected travelers through real paid renewals. Other groups,
// including doctors treating patients elsewhere, keep their actual assignments.
function renewTravelers(state: CampaignSnapshot, report: IncomeReporter) {
  let campaign = state;
  for (const id of campaign.squad) {
    const expiry = contractExpiresSeconds(campaign.contracts[id]);
    if (expiry === null || expiry > clock(campaign) + 2 * 3600) {
      continue;
    }
    const operative = rosterFor(campaign).find((unit) => unit.id === id),
      quote = contractQuote(campaign, present(operative), 'day');
    if (!quote.available || quote.price > campaign.resources.treasury) {
      notifyFailure(
        report,
        `Cannot pay the real travel renewal for ${id}: ${quote.reason ?? quote.price + ' pesos required'}.`,
        { operativeId: id, price: quote.price, treasury: campaign.resources.treasury },
      );
    }
    const money = campaign.resources.treasury;
    campaign = order(campaign, {
      type: 'renewContract',
      id,
      term: 'day',
      expectedExpiresAt: present(present(campaign.contracts[id]).expiresAt),
      expectedExpiresSecond: present(campaign.contracts[id]).expiresSecond ?? 0,
    });
    assert.equal(campaign.resources.treasury, money - quote.price);
    report({
      event: 'townIncomeTravelRenewal',
      operativeId: id,
      price: quote.price,
      hour: campaign.hour,
      secondOfHour: campaign.secondOfHour ?? 0,
    });
  }
  return campaign;
}
function travelTo(state: CampaignSnapshot, sector: string, report: IncomeReporter) {
  let campaign = state;
  for (let attempt = 0; attempt < 720; attempt++) {
    if (campaign.pendingBattle || campaign.pendingEncounter) {
      notifyFailure(report, 'Resolve the actual encounter before continuing the income journey.', {
        sector: campaign.location,
        destination: sector,
      });
    }
    const group = campaign.squads.find((row) => row.id === campaign.activeSquadId),
      journey = group?.journey;
    if (!journey && campaign.location === sector) {
      return campaign;
    }
    campaign = renewTravelers(campaign, report);
    if (journey?.status === 'paused') {
      campaign = order(campaign, { type: 'cancelTravel', choice: 'stop' });
      continue;
    }
    if (journey?.status === 'ready') {
      notifyFailure(report, 'The port journey reached an unresolved assault.', {
        destination: sector,
      });
    }
    if (!journey) {
      const tired = campaign.squad.filter(
        (id) =>
          tooTiredToMarch(campaign.operativeState[id]) ||
          present(campaign.operativeState[id]).asleep,
      );
      if (tired.length) {
        for (const id of tired) {
          if (!present(campaign.operativeState[id]).asleep) {
            campaign = order(campaign, { type: 'setSleep', operativeId: id, asleep: true });
          }
        }
        campaign = order(campaign, { type: 'wait', hours: 1 });
        continue;
      }
      campaign = order(campaign, { type: 'travel', sector, queue: true });
    } else {
      campaign = order(campaign, { type: 'wait', hours: 1 });
    }
  }
  notifyFailure(
    report,
    `The actual income journey to ${sector} did not finish within 720 hourly orders.`,
  );
}

export function ensureRouteTownIncome(
  start: CampaignSnapshot,
  {
    sourceId,
    operativeId,
    restoreLocation = true,
    approach = 'direct',
    report = () => {},
  }: RouteTownIncomeOptions = {},
) {
  let campaign = structuredClone(start);
  const origin = campaign.location,
    rows = townIncomeSources(campaign);
  const source = sourceId
    ? rows.find((row) => row.id === sourceId)
    : (rows.find((row) => row.controlled && row.activated) ??
      rows.find((row) => row.controlled && row.representative.sectorId === origin) ??
      rows.find((row) => row.controlled && row.id === 'buenos_aires') ??
      rows.find((row) => row.controlled));
  if (!source || !source.controlled) {
    notifyFailure(report, 'No complete controlled town can fund this route.', {
      sourceId: sourceId ?? null,
      uncontrolled: source?.uncontrolled ?? [],
    });
  }
  if (source.activated) {
    return saved({ campaign }).campaign;
  }
  if (campaign.squads.find((row) => row.id === campaign.activeSquadId)?.journey) {
    notifyFailure(report, 'Finish the current squad journey before starting the port visit.');
  }
  campaign = travelTo(campaign, source.representative.sectorId, report);
  campaign = renewTravelers(campaign, report);
  campaign = meetLocalIncomeRepresentative(campaign, {
    sourceId: source.id,
    operativeId,
    approach,
    report,
  });
  if (restoreLocation) {
    campaign = travelTo(campaign, origin, report);
  }
  return saved({ campaign }).campaign;
}
