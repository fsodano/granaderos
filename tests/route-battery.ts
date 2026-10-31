import type {
  CampaignSnapshot,
  CampaignAction,
  CampaignArtillery,
  CampaignJourney,
  CampaignOperativeState,
} from '../packages/game/public/campaign-types.ts';
import type { JourneyModeValue } from '../packages/game/domain/journeys/journey.ts';
import { present } from './assert-present.ts';
type BatteryClock = { hour: number; second: number };
type CrewFatigue = { id: number; fatigue: number };
type BatteryFailure = {
  id?: number | string;
  price?: number;
  treasury?: number;
  sector?: string;
  destination?: string;
  source?: string;
  selected?: string[];
  forecast?: CrewFatigue[];
  units?: ({ id: number } & CampaignOperativeState)[];
  count?: number;
  available?: Pick<CampaignArtillery, 'id' | 'type' | 'loaded' | 'ammo'>[];
};
export type RouteBatteryEvent =
  | ({ event: 'finiteBatteryUnavailable'; message: string } & BatteryFailure)
  | ({
      event: 'routeBatteryEncounterResolved';
      stage: string;
      groupId: string | undefined;
      sector: string | undefined;
    } & BatteryClock)
  | ({
      event: 'routeBatteryRenewal';
      id: number;
      price: number;
      action: CampaignAction;
    } & BatteryClock)
  | ({ event: 'routeBatteryTravelOrder'; action: CampaignAction; sector: string } & BatteryClock)
  | ({
      event: 'routeBatteryDepartureRest';
      ids: number[];
      sector: string;
      destination: string;
      plannedHours: number;
    } & BatteryClock)
  | ({ event: 'routeBatteryRestStage'; destination: string; stage: string } & BatteryClock &
      ({ forecast: CrewFatigue[]; plannedHours: number } | { inFlight: true }))
  | ({ event: 'routeBatteryDetour'; destination: string; waypoints: string[] } & BatteryClock)
  | ({ event: 'routeArsenalRecovered'; sector: string; ids: string[] } & BatteryClock)
  | {
      event: 'routeBatteryStored';
      sector: string;
      id: string;
      record: CampaignArtillery;
      hour: number;
    }
  | {
      event: 'routeBatteryShipment';
      id: string;
      from: string;
      to: string;
      cost: number;
      dueAt: number;
      record: CampaignArtillery;
      hour: number;
    }
  | ({
      event: 'routeBatteryPrepared';
      destination: string;
      selections: string[];
      records: CampaignArtillery[];
    } & BatteryClock)
  | { event: 'routeMixedBatteryPrepared'; destination: string; records: CampaignArtillery[] };
type BatteryReporter = (event: RouteBatteryEvent) => void;
export type BatteryEncounterResolver = (
  campaign: CampaignSnapshot,
  options: { report: BatteryReporter; stage: string },
) => CampaignSnapshot;
export interface RouteBatteryOptions {
  destination?: string;
  excludeIds?: readonly string[];
  keepServing?: number[];
  resolveEncounter?: BatteryEncounterResolver | undefined;
  waypointsFor?: ((campaign: CampaignSnapshot, destination: string) => string[]) | undefined;
  report?: BatteryReporter;
}
type BatteryPiece = { sector: string; source: 'depot' | 'field'; gun: CampaignArtillery };
import assert from 'node:assert/strict';
import { rosterFor } from '../packages/game/campaign.js';
import { FINITE_ARTILLERY_ARSENALS } from '../packages/game/finite-artillery-arsenals.js';
import { ARTILLERY, artilleryProfile } from '../packages/game/artillery-definitions.ts';
import {
  artilleryTransportPath,
  artilleryTransportQuote,
  storedArtilleryRecord,
} from '../packages/game/artillery-transport.js';
import { depotSelection } from '../packages/game/artillery-depots.ts';
import { contractExpiresSeconds, contractQuote } from '../packages/game/contracts.js';
import { tooTiredToMarch } from '../packages/game/march-fatigue.js';
import { campaignMarchFatigueRate } from '../packages/game/march-fatigue.js';
import {
  queueSquadTravel,
  squadTravelStatus,
  travelLegHours,
} from '../packages/game/squad-travel.js';
import { campaignPlace, worldCell, worldOwner } from '../packages/game/world-cells.ts';
import { mountForOperative } from '../packages/game/horses.js';
import { sleepOrderReason } from '../packages/game/sleep.js';
import { order, visit, saved } from './local-contract-fixture.ts';
import { takeFiniteCache, leaveFiniteCache } from './finite-cache-driver.ts';
import {
  captureRouteStrategicInput,
  recordRouteStrategicEvidence,
} from './route-strategic-failure-evidence.ts';

const clock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0);
const serving = (s: CampaignSnapshot, id: number) =>
  s.recruited.includes(id) &&
  s.operativeState[id]?.alive &&
  !present(s.operativeState[id]).captured &&
  s.contracts[id] &&
  (contractExpiresSeconds(s.contracts[id]) === null ||
    present(contractExpiresSeconds(s.contracts[id])) > clock(s));
function fail(report: BatteryReporter, message: string, details: BatteryFailure = {}): never {
  report({ event: 'finiteBatteryUnavailable', message, ...details });
  throw Error(message);
}
const controlled = (s: CampaignSnapshot, sector: string) => s.sectors[sector]?.owner === 'patriot';
const pieces = (s: CampaignSnapshot): BatteryPiece[] =>
  [
    ...Object.entries(s.artilleryDepots ?? {}).flatMap(([sector, guns]) =>
      guns.map((gun) => ({ sector, source: 'depot' as const, gun })),
    ),
    ...Object.entries(s.sectorStates ?? {}).flatMap(([sector, scene]) =>
      (scene.artillery ?? []).map((gun) => ({ sector, source: 'field' as const, gun })),
    ),
  ]
    .filter((row) => controlled(s, row.sector) && row.gun.side === 'player')
    .map((row) => ({ ...row, gun: { ...row.gun, side: 'player' } }));
const fit = (
  s: CampaignSnapshot,
  types: readonly string[],
  destination: string,
  excludeIds: ReadonlySet<string>,
) => {
  const rows = pieces(s).filter(
      (row) =>
        !excludeIds.has(row.gun.id) &&
        (row.sector === destination || artilleryTransportPath(s, row.sector, destination, 'carts')),
    ),
    chosen: BatteryPiece[] = [];
  for (const type of types) {
    const row = rows
      .filter(
        (row) =>
          row.gun.type === type && !chosen.some((candidate) => candidate.gun.id === row.gun.id),
      )
      .sort(
        (a, b) =>
          Number(b.sector === s.location) - Number(a.sector === s.location) ||
          Number(b.source === 'depot') - Number(a.source === 'depot') ||
          b.gun.ammo + Number(b.gun.loaded) - a.gun.ammo - Number(a.gun.loaded) ||
          a.gun.id.localeCompare(b.gun.id),
      )[0];
    if (row) {
      chosen.push(row);
    }
  }
  return chosen;
};
function resolveBatteryEncounter(
  state: CampaignSnapshot,
  report: BatteryReporter,
  resolveEncounter: BatteryEncounterResolver | undefined,
  keepServing: number[],
  stage: string,
) {
  if (!resolveEncounter || (!state.pendingBattle && !state.pendingEncounter)) {
    return state;
  }
  const before = structuredClone(state),
    next = resolveEncounter(structuredClone(state), { report, stage });
  assert.ok(
    next && !next.pendingBattle && !next.pendingEncounter,
    'The real battery encounter must finish before transport resumes.',
  );
  assert.ok(
    clock(next) >= clock(before),
    'Encounter resolution cannot move the campaign clock backwards.',
  );
  for (const [id, record] of Object.entries(before.operativeState)) {
    if (!record.alive) {
      assert.equal(
        present(next.operativeState[Number(id)]).alive,
        false,
        'Encounter resolution cannot restore an earlier casualty.',
      );
    }
  }
  // A settled actual defense can lose explicitly retained reserves. Keep
  // renewing its surviving paid bodies; all new deaths remain permanent.
  const retained = keepServing.filter((id) => present(next.operativeState[Number(id)]).alive);
  keepServing.splice(0, keepServing.length, ...retained);
  report({
    event: 'routeBatteryEncounterResolved',
    stage,
    groupId: before.pendingEncounter?.groupId ?? before.pendingBattle?.defenseGroupId,
    sector: before.pendingEncounter?.sector ?? before.pendingBattle?.sector,
    hour: next.hour,
    second: next.secondOfHour ?? 0,
  });
  return saved({ campaign: next }).campaign;
}
function renewCrew(
  state: CampaignSnapshot,
  report: BatteryReporter,
  keepServing: readonly number[],
) {
  let s = state;
  for (const id of new Set([...s.squad, ...keepServing])) {
    if (!serving(s, id)) {
      try {
        fail(report, `The named serving battery participant ${id} is no longer available.`, { id });
      } catch (error) {
        recordRouteStrategicEvidence({
          helper: 'prepareRouteBattery',
          stage: 'renew-crew-unavailable',
          campaign: s,
          context: { id, keepServing, squad: s.squad },
          error,
        });
        throw error;
      }
    }
    const expiry = contractExpiresSeconds(s.contracts[id]);
    if (expiry === null || expiry > clock(s) + 2 * 3600) {
      continue;
    }
    const quote = contractQuote(s, present(rosterFor(s).find((op) => op.id === id)), 'day');
    if (!quote.available || s.resources.treasury < quote.price) {
      fail(report, `The real battery crew renewal for ${id} is unaffordable.`, {
        id,
        price: quote.price,
        treasury: s.resources.treasury,
      });
    }
    const cash = s.resources.treasury,
      contract = present(s.contracts[id]),
      action: CampaignAction = {
        type: 'renewContract',
        id,
        term: 'day',
        expectedExpiresAt: present(contract.expiresAt),
        expectedExpiresSecond: contract.expiresSecond ?? 0,
      };
    s = order(s, action);
    assert.equal(s.resources.treasury, cash - quote.price);
    report({
      event: 'routeBatteryRenewal',
      id,
      price: quote.price,
      action,
      hour: s.hour,
      second: s.secondOfHour ?? 0,
    });
  }
  return s;
}
// The public route preview exposes geography and leg durations. Reserve enough
// fatigue to stop before exhaustion; a rural stop does not presume a cleared
// town, a won battle or any hidden tactical enemy position.
const ruralRestStop = (s: CampaignSnapshot, id: string) =>
  worldOwner(s, id) === 'neutral' && !worldCell(id, s)?.locality;
function projectedCrewFatigue(
  s: CampaignSnapshot,
  path: readonly string[],
  mode: JourneyModeValue,
  journey: CampaignJourney | null = null,
) {
  const roster = rosterFor(s);
  return s.squad.map((id) => {
    const record = present(s.operativeState[id]),
      unit = {
        ...present(roster.find((op) => op.id === id)),
        ...record,
        ...mountForOperative(s.horseState, id),
      };
    let fatigue = record.fatigue ?? 0;
    for (let index = 1; index < path.length; index++) {
      const hours =
        index === 1 && journey
          ? Math.ceil(
              (journey.pendingSeconds ?? 0) / 3600 +
                present(
                  squadTravelStatus(
                    { ...present(s.squads.find((q) => q.id === s.activeSquadId)), journey },
                    s,
                  ),
                ).legRemaining,
            )
          : travelLegHours(present(path[index - 1]), present(path[index]), mode, s);
      const mountain = path
        .slice(index - 1, index + 1)
        .some((location) => campaignPlace(location, s)?.biome === 'mountain');
      fatigue += hours * campaignMarchFatigueRate(s, unit, { mode, mountain });
    }
    return { id, fatigue };
  });
}
function travel(
  state: CampaignSnapshot,
  sector: string,
  report: BatteryReporter,
  keepServing: number[],
  resolveEncounter: BatteryEncounterResolver | undefined,
  waypointsFor: RouteBatteryOptions['waypointsFor'],
) {
  let s = state;
  const issue = (action: CampaignAction) => {
    const diagnosticBefore = captureRouteStrategicInput(s);
    try {
      s = order(s, action);
    } catch (error) {
      recordRouteStrategicEvidence({
        helper: 'prepareRouteBattery',
        stage: 'campaign-action-refusal',
        campaign: diagnosticBefore ?? s,
        action,
        error,
        context: { destination: sector },
        preDispatchInputIndependentlyCloned: diagnosticBefore !== null,
      });
      throw error;
    }
    report({
      event: 'routeBatteryTravelOrder',
      action: structuredClone(action),
      hour: s.hour,
      second: s.secondOfHour ?? 0,
      sector: s.location,
    });
  };
  for (let attempt = 0; attempt < 720; attempt++) {
    s = resolveBatteryEncounter(s, report, resolveEncounter, keepServing, 'crew-travel');
    if (s.pendingBattle || s.pendingEncounter) {
      fail(report, 'Resolve the real encounter before moving the battery crew.', {
        sector: s.location,
        destination: sector,
      });
    }
    const journey = s.squads.find((q) => q.id === s.activeSquadId)?.journey;
    if (!journey && s.location === sector) {
      return s;
    }
    s = renewCrew(s, report, keepServing);
    if (journey?.status === 'ready') {
      fail(report, 'The battery crew reached an unresolved assault.', { destination: sector });
    }
    if (journey?.status === 'paused') {
      issue({ type: 'cancelTravel', choice: 'stop' });
      continue;
    }
    if (!journey) {
      const tired = s.squad.filter(
        (id) =>
          tooTiredToMarch(present(s.operativeState[id])) || present(s.operativeState[id]).asleep,
      );
      if (tired.length) {
        for (const id of tired) {
          const r = present(s.operativeState[id]);
          if (r.asleep && (r.energy ?? 0) >= 100) {
            issue({ type: 'setSleep', operativeId: id, asleep: false });
          } else if (!r.asleep) {
            issue({ type: 'setSleep', operativeId: id, asleep: true });
          }
        }
        issue({ type: 'wait', hours: 1 });
        continue;
      }
      for (const id of s.squad) {
        if (present(s.operativeState[id]).assignment !== 'active') {
          issue({ type: 'assignCare', id, assignment: 'active' });
        }
      }
      const waypoints = waypointsFor?.(s, sector) ?? [];
      assert.ok(
        Boolean(Array.isArray(waypoints)),
        'The battery detour must supply ordinary travel waypoints.',
      );
      const mode = waypoints.length ? 'march' : s.routes['posta'] ? 'posta' : 'march',
        draft = {
          ...present(s.squads.find((q) => q.id === s.activeSquadId)),
          members: [...s.squad],
        };
      queueSquadTravel(s, draft, { sector, mode, intent: 'travel', waypoints });
      const preview = present(squadTravelStatus(draft, s));
      // Recover the existing fatigue reserve at the admitted departure point.
      // Waiting until exhaustion can strand a detour crew in hostile territory,
      // where the ordinary sleep order correctly refuses to protect them.
      const forecast = projectedCrewFatigue(s, preview.path, mode),
        sleep = forecast
          .filter(
            ({ id, fatigue }) => (present(s.operativeState[id]).fatigue ?? 0) > 0 && fatigue >= 80,
          )
          .map(({ id }) => id);
      if (sleep.length) {
        for (const id of sleep) {
          const reason = sleepOrderReason(s, id, true);
          if (reason) {
            fail(
              report,
              `The battery crew needs an actual safe rest stop before this journey: ${reason}`,
              { id, sector: s.location, destination: sector },
            );
          }
          issue({ type: 'setSleep', operativeId: id, asleep: true });
        }
        report({
          event: 'routeBatteryDepartureRest',
          ids: sleep,
          sector: s.location,
          destination: sector,
          plannedHours: preview.remaining,
          hour: s.hour,
          second: s.secondOfHour ?? 0,
        });
        issue({ type: 'wait', hours: 1 });
        continue;
      }
      let stage = sector,
        stagedWaypoints = waypoints;
      if (forecast.some((row) => row.fatigue >= 80)) {
        const index = preview.path.findLastIndex(
          (location, index) =>
            index > 0 &&
            ruralRestStop(s, location) &&
            projectedCrewFatigue(s, preview.path.slice(0, index + 1), mode).every(
              (row) => row.fatigue < 80,
            ),
        );
        if (index < 1) {
          fail(
            report,
            'The actual battery route needs a reachable rural rest stop before exhaustion.',
            { sector: s.location, destination: sector, forecast },
          );
        }
        stage = present(preview.path[index]);
        stagedWaypoints = waypoints.filter((location) => preview.path.indexOf(location) < index);
        report({
          event: 'routeBatteryRestStage',
          destination: sector,
          stage,
          forecast,
          plannedHours: preview.remaining,
          hour: s.hour,
          second: s.secondOfHour ?? 0,
        });
      }
      issue({
        type: 'travel',
        sector: stage,
        queue: true,
        mode,
        ...(stagedWaypoints.length ? { waypoints: stagedWaypoints } : {}),
      });
      if (stagedWaypoints.length) {
        report({
          event: 'routeBatteryDetour',
          destination: stage,
          waypoints: stagedWaypoints,
          hour: s.hour,
          second: s.secondOfHour ?? 0,
        });
      }
    } else {
      // A real encounter may interrupt an older long journey. Stop at the next
      // admitted rural boundary while the crew still has its fatigue reserve.
      if (
        !journey.returning &&
        journey.path.length > 2 &&
        ruralRestStop(s, present(journey.path[1])) &&
        projectedCrewFatigue(s, journey.path, journey.mode, journey).some(
          (row) => row.fatigue >= 80,
        ) &&
        projectedCrewFatigue(s, journey.path.slice(0, 2), journey.mode, journey).every(
          (row) => row.fatigue < 80,
        )
      ) {
        const stage = present(journey.path[1]);
        issue({ type: 'cancelTravel', choice: 'stop' });
        report({
          event: 'routeBatteryRestStage',
          destination: sector,
          stage,
          inFlight: true,
          hour: s.hour,
          second: s.secondOfHour ?? 0,
        });
      } else {
        issue({ type: 'wait', hours: 1 });
      }
    }
  }
  fail(
    report,
    `The actual battery crew journey to ${sector} did not finish within 720 hourly orders.`,
  );
}
function readyCrew(
  state: CampaignSnapshot,
  required: number,
  report: BatteryReporter,
  keepServing: number[],
  resolveEncounter: BatteryEncounterResolver | undefined,
) {
  let s = state;
  const ready = () =>
    s.squad.filter((id) => {
      const r = present(s.operativeState[id]);
      return (
        r?.alive &&
        r.hp >= 15 &&
        !r.unconscious &&
        !r.routed &&
        !r.captured &&
        !r.asleep &&
        (r.energy ?? 0) > 10
      );
    });
  for (let hour = 0; hour < 168; hour++) {
    s = resolveBatteryEncounter(s, report, resolveEncounter, keepServing, 'crew-rest');
    for (const id of s.squad) {
      const r = present(s.operativeState[id]);
      if (r.asleep && (r.energy ?? 0) >= 75) {
        s = order(s, { type: 'setSleep', operativeId: id, asleep: false });
      }
    }
    if (ready().length >= required) {
      for (const id of s.squad) {
        if (present(s.operativeState[id]).assignment !== 'active') {
          s = order(s, { type: 'assignCare', id, assignment: 'active' });
        }
      }
      return s;
    }
    if (s.pendingBattle || s.pendingEncounter) {
      fail(report, 'Resolve the actual encounter before the artillery crew can rest.');
    }
    for (const id of s.squad) {
      if (present(s.operativeState[id]).assignment !== 'rest') {
        s = order(s, { type: 'assignCare', id, assignment: 'rest' });
      }
    }
    s = renewCrew(s, report, keepServing);
    s = order(s, { type: 'wait', hours: 1 });
  }
  fail(report, `The actual local battery crew cannot supply ${required} capable soldiers.`, {
    sector: s.location,
    units: s.squad.map((id) => ({ id, ...present(s.operativeState[id]) })),
  });
}

// Recover only the campaign's real conquered arsenals. Move each existing
// physical gun once through ordinary local storage or paid transport. A lost
// route, dead crew, depleted source or interrupted delivery is a real failure.
// Explicit supporting soldiers retain their actual paid terms during each
// journey/rest/delivery wait, even when they are outside the gun's crew squad.
export function prepareRouteBattery(
  start: CampaignSnapshot,
  types: readonly string[],
  {
    destination = start.location,
    excludeIds = [],
    keepServing = [],
    resolveEncounter,
    waypointsFor,
    report = () => {},
  }: RouteBatteryOptions = {},
) {
  assert.ok(
    Boolean(Array.isArray(types)) &&
      types.length <= 3 &&
      types.every((type) => Object.hasOwn(ARTILLERY, type)),
    'Choose up to three existing artillery types.',
  );
  assert.ok(
    Boolean(Array.isArray(keepServing)) &&
      keepServing.every((id) => Number.isSafeInteger(id) && serving(start, id)),
    'Only explicitly named actual serving soldiers can retain their paid terms.',
  );
  assert.ok(
    resolveEncounter === undefined || typeof resolveEncounter === 'function',
    'The battery encounter resolver must be a public campaign driver.',
  );
  keepServing = [...keepServing];
  assert.ok(
    waypointsFor === undefined || typeof waypointsFor === 'function',
    'The battery detour must be an ordinary route planner.',
  );
  let s = saved({ campaign: structuredClone(start) }).campaign;
  s = resolveBatteryEncounter(s, report, resolveEncounter, keepServing, 'preparation');
  if (s.pendingBattle || s.pendingEncounter) {
    fail(report, 'Resolve the actual encounter before preparing finite artillery.');
  }
  if (!controlled(s, destination)) {
    fail(report, 'The real artillery destination must be controlled.', { destination });
  }
  const selected: CampaignArtillery[] = [];
  for (const type of types) {
    const unavailable = new Set([...excludeIds, ...selected.map((gun) => gun.id)]);
    let row = fit(s, [type], destination, unavailable)[0];
    if (!row) {
      const arsenal = Object.values(FINITE_ARTILLERY_ARSENALS)
        .filter(
          (source) =>
            source.pieces.some((gun) => gun.type === type && !unavailable.has(gun.id)) &&
            controlled(s, source.sector) &&
            !s.artilleryArsenalRecoveries?.[source.sector] &&
            (source.sector === destination ||
              artilleryTransportPath(s, source.sector, destination, 'carts')),
        )
        .sort((a, b) => Number(b.sector === s.location) - Number(a.sector === s.location))[0];
      if (!arsenal) {
        fail(report, `No remaining controlled physical arsenal can supply ${type}.`, {
          destination,
          selected: selected.map((gun) => gun.id),
        });
      }
      s = readyCrew(
        travel(s, arsenal.sector, report, keepServing, resolveEncounter, waypointsFor),
        1,
        report,
        keepServing,
        resolveEncounter,
      );
      for (const id of s.squad) {
        if (present(s.operativeState[id]).assignment !== 'active') {
          s = order(s, { type: 'assignCare', id, assignment: 'active' });
        }
      }
      const pair = visit(s),
        carrier = pair.battle.units
          .filter(
            (unit) =>
              unit.side === 'player' &&
              unit.hp >= 15 &&
              !unit.unconscious &&
              !unit.routed &&
              !unit.asleep &&
              (unit.energy ?? 0) > 10,
          )
          .sort((a, b) => b.energy - a.energy)[0];
      if (!carrier) {
        fail(report, 'A real awake local soldier must open the conquered arsenal.', {
          sector: arsenal.sector,
        });
      }
      s = leaveFiniteCache(takeFiniteCache(pair, carrier.id, []));
      report({
        event: 'routeArsenalRecovered',
        sector: arsenal.sector,
        ids: arsenal.pieces.map((gun) => gun.id),
        hour: s.hour,
        second: s.secondOfHour ?? 0,
      });
      row = fit(s, [type], destination, unavailable)[0];
    }
    if (!row) {
      fail(report, `The recovered ${type} has no available canonical custody.`);
    }
    selected.push(structuredClone(row.gun));
  }
  for (const gun of selected) {
    const row = pieces(s).find((row) => row.gun.id === gun.id);
    assert.ok(row, 'The selected actual piece must retain its original custody.');
    if (row.sector === destination && row.source === 'depot') {
      continue;
    }
    s = readyCrew(
      travel(s, row.sector, report, keepServing, resolveEncounter, waypointsFor),
      artilleryProfile(s, gun).crew,
      report,
      keepServing,
      resolveEncounter,
    );
    for (const id of s.squad) {
      if (present(s.operativeState[id]).assignment !== 'active') {
        s = order(s, { type: 'assignCare', id, assignment: 'active' });
      }
    }
    if (row.sector === destination) {
      s = order(s, { type: 'storeArtillery', sector: row.sector, artilleryId: gun.id });
      report({
        event: 'routeBatteryStored',
        sector: row.sector,
        id: gun.id,
        record: storedArtilleryRecord(gun),
        hour: s.hour,
      });
    } else {
      if (!s.routes['carts']) {
        s = order(s, { type: 'transport', mode: 'carts' });
      }
      const quote = artilleryTransportQuote(
        s,
        row.sector,
        gun.id,
        destination,
        'carts',
        row.source,
      );
      if (!quote.available) {
        fail(report, quote.reason, { id: gun.id, source: row.sector, destination });
      }
      const cash = s.resources.treasury;
      s = order(s, {
        type: 'transportArtillery',
        sector: row.sector,
        artilleryId: gun.id,
        to: destination,
        mode: 'carts',
        source: row.source,
      });
      assert.equal(s.resources.treasury, cash - quote.cost);
      const transfer = present(s.artilleryTransfers?.find((transfer) => transfer.id === gun.id));
      assert.deepEqual(transfer.gun, storedArtilleryRecord(gun));
      report({
        event: 'routeBatteryShipment',
        id: gun.id,
        from: row.sector,
        to: destination,
        cost: quote.cost,
        dueAt: transfer.dueAt,
        record: structuredClone(transfer.gun),
        hour: s.hour,
      });
    }
  }
  s = travel(s, destination, report, keepServing, resolveEncounter, waypointsFor);
  for (
    let hour = 0;
    selected.some(
      (gun) => !(s.artilleryDepots?.[destination] ?? []).some((stored) => stored.id === gun.id),
    ) && hour < 720;
    hour++
  ) {
    s = resolveBatteryEncounter(s, report, resolveEncounter, keepServing, 'gun-delivery');
    if (s.pendingEncounter || s.pendingBattle) {
      fail(report, 'Resolve the actual encounter before finite artillery delivery.', {
        destination,
      });
    }
    s = renewCrew(s, report, keepServing);
    s = order(s, { type: 'wait', hours: 1 });
  }
  const actual = selected.map((gun) => {
    const delivered = s.artilleryDepots?.[destination]?.find((stored) => stored.id === gun.id);
    if (!delivered) {
      fail(report, 'The exact finite gun has not arrived at the controlled destination.', {
        id: gun.id,
        destination,
      });
    }
    assert.deepEqual(
      delivered,
      storedArtilleryRecord(gun),
      'Transport/storage must not add shots, restore loading or replace the gun.',
    );
    return delivered;
  });
  const selections = actual.map(depotSelection);
  for (const [id, record] of Object.entries(start.operativeState)) {
    if (!record.alive) {
      assert.equal(
        present(s.operativeState[Number(id)]).alive,
        false,
        'Earlier casualties remain permanent.',
      );
    }
  }
  report({
    event: 'routeBatteryPrepared',
    destination,
    selections,
    records: structuredClone(actual),
    hour: s.hour,
    second: s.secondOfHour ?? 0,
  });
  return { campaign: saved({ campaign: s }).campaign, selections };
}

// Earlier bots bought three identical light pieces. Select distinct actual
// reachable guns for that tactical plan; missing property remains a failure.
export function prepareRouteMixedBattery(
  start: CampaignSnapshot,
  count: number,
  {
    destination = start.location,
    preferredTypes = ['swivel', 'bronze4', 'field8'],
    excludeIds = [],
    keepServing = [],
    resolveEncounter,
    waypointsFor,
    report = () => {},
  }: RouteBatteryOptions & { preferredTypes?: readonly string[] } = {},
) {
  assert.ok(Number.isSafeInteger(count) && count >= 1 && count <= 3);
  const reachable = (sector: string) =>
    sector === destination || artilleryTransportPath(start, sector, destination, 'carts');
  const pool = pieces(start)
    .filter((row) => reachable(row.sector))
    .map((row) => row.gun);
  for (const source of Object.values(FINITE_ARTILLERY_ARSENALS)) {
    if (
      controlled(start, source.sector) &&
      !start.artilleryArsenalRecoveries?.[source.sector] &&
      reachable(source.sector)
    ) {
      for (const gun of source.pieces) {
        assert.equal(gun.side, 'player');
        pool.push({ ...gun, side: 'player' });
      }
    }
  }
  const unavailable = new Set(excludeIds),
    priority = (type: string) => {
      const index = preferredTypes.indexOf(type);
      return index < 0 ? preferredTypes.length : index;
    };
  const available = [...new Map(pool.map((gun) => [gun.id, gun])).values()]
    .filter(
      (gun) => !unavailable.has(gun.id) && artilleryProfile(start, gun).crew <= start.squad.length,
    )
    .sort(
      (a, b) =>
        priority(a.type) - priority(b.type) ||
        b.ammo + Number(b.loaded) - a.ammo - Number(a.loaded) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, count);
  if (available.length !== count) {
    fail(
      report,
      'The controlled reachable finite gun pool or actual crew cannot form the requested mixed battery.',
      {
        destination,
        count,
        available: available.map((gun) => ({
          id: gun.id,
          type: gun.type,
          loaded: gun.loaded,
          ammo: gun.ammo,
        })),
      },
    );
  }
  const result = prepareRouteBattery(
    start,
    available.map((gun) => gun.type),
    { destination, excludeIds, keepServing, resolveEncounter, waypointsFor, report },
  );
  const records = result.selections.map((selection) =>
    present(
      result.campaign.artilleryDepots?.[destination]?.find(
        (gun) => depotSelection(gun) === selection,
      ),
    ),
  );
  report({ event: 'routeMixedBatteryPrepared', destination, records: structuredClone(records) });
  return { ...result, records };
}
