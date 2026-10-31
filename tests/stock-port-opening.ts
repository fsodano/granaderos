import type { ActiveGame } from './local-contract-fixture.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { fightOnArrival } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { initialCampaign, dailyIncome, rosterFor } from '../packages/game/campaign.js';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { defaultProfile } from '../packages/game/character-profile.ts';
import { enterSector } from '../packages/game/world.js';
import { actBattle, endTurn } from '../packages/game/tactical.js';
import { autoBandageBattle } from '../packages/game/auto-bandage.js';
import { unitAmmunitionByType } from '../packages/game/campaign-ammunition.js';
import { fight } from './cuyo-route-driver.ts';
import { approachNPC } from './approach-npc.ts';
import { takeFiniteCache, leaveFiniteCache } from './finite-cache-driver.ts';
import { order, visit, leave, saved, sync } from './local-contract-fixture.ts';
import { advanceCampaignHours } from './campaign-wait-fixture.ts';
import {
  contractQuote,
  contractRenewalQuote,
  contractExpiresSeconds,
} from '../packages/game/contracts.js';
import { hireArrivalDueSeconds, hiringArrivalOptions } from '../packages/game/hiring-arrivals.js';
import { immediateRecruitmentExpectation } from './immediate-recruitment-fixture.ts';
import type { BattleOrder } from './opening-driver.ts';
const clock = (s: CampaignSnapshot) => s.hour * 3600 + (s.secondOfHour ?? 0);
function tactical(pair: ActiveGame, action: BattleOrder) {
  const battle = action.type === 'endTurn' ? endTurn(pair.battle) : actBattle(pair.battle, action);
  assert.equal(battle.lastError, null, battle.lastError ?? undefined);
  return sync({ campaign: pair.campaign, battle });
}

// Keep only actual still-serving survivors. An expired contract cannot be
// recovered by a renewal; casualties and captured people remain unchanged.
export function retainStockOpeningService(
  start: CampaignSnapshot,
  ids: number[],
  untilSeconds: number,
) {
  assert.ok(Array.isArray(ids) && new Set(ids).size === ids.length);
  assert.ok(Number.isSafeInteger(untilSeconds) && untilSeconds >= clock(start));
  const original = structuredClone(start),
    renewals = [];
  let state = start;
  for (const id of ids) {
    const record = state.operativeState[id];
    assert.ok(record, `The opening survivor ${id} must exist.`);
    if (!record.alive || record.captured) {
      continue;
    }
    assert.ok(
      state.recruited.includes(id) && state.contracts[id],
      `The living opening survivor ${id} must still serve before renewal.`,
    );
    let expiry = contractExpiresSeconds(state.contracts[id]);
    assert.ok(
      expiry === null || expiry > clock(state),
      `The opening cannot restore expired service for ${id}.`,
    );
    for (let attempts = 0; expiry !== null && expiry <= untilSeconds; attempts++) {
      assert.ok(attempts < 120, 'Opening service renewal must have a bounded horizon.');
      const op = rosterFor(state).find((op) => op.id === id),
        quote = contractRenewalQuote(state, op, 'day'),
        contract = state.contracts[id],
        treasuryBefore = state.resources.treasury;
      assert.equal(quote.available, true, quote.reason ?? undefined);
      assert.ok(
        quote.price > 0 && present(quote.hours) > 0,
        'The opening retains a real paid day term.',
      );
      const action: CampaignAction = {
        type: 'renewContract',
        id,
        term: 'day',
        expectedExpiresAt: present(present(contract).expiresAt),
        expectedExpiresSecond: present(contract).expiresSecond ?? 0,
      };
      const before = state;
      state = order(state, action);
      assert.equal(state.resources.treasury, treasuryBefore - quote.price);
      assert.equal(clock(state), clock(before));
      assert.equal(
        contractExpiresSeconds(state.contracts[id]),
        expiry + present(quote.hours) * 3600,
      );
      assert.equal(present(state.contracts[id]).kind, 'paid');
      assert.equal(present(state.contracts[id]).term, 'day');
      assert.equal(present(state.contracts[id]).paid, quote.price);
      renewals.push({
        id,
        action,
        quote: structuredClone(quote),
        hour: state.hour,
        secondOfHour: state.secondOfHour ?? 0,
        treasuryBefore,
        treasury: state.resources.treasury,
        debited: treasuryBefore - state.resources.treasury,
        previousExpirySeconds: expiry,
        expirySeconds: contractExpiresSeconds(state.contracts[id]),
        contract: structuredClone(state.contracts[id]),
      });
      expiry = contractExpiresSeconds(state.contracts[id]);
    }
  }
  assert.deepEqual(start, original, 'Retention cannot change the input checkpoint.');
  return { campaign: state, renewals };
}

// The ordinary fresh-player route, with no prepared equipment or outcome.
// Notes describe actual receipts and never alter the campaign.
export function stockPortOpening({ seed = 8, content = defaultContentPackage() } = {}) {
  const notes = [];
  let state = initialCampaign(seed, content);
  assert.equal(state.resources.treasury, 3200);
  notes.push({
    stage: 'stock-start',
    treasury: state.resources.treasury,
    seed: state.seed,
    controlledSectors: Object.entries(state.sectors)
      .filter(([, sector]) => sector.owner === 'patriot')
      .map(([id]) => id)
      .sort(),
    recruited: [...state.recruited],
  });
  const profile = {
    ...defaultProfile(),
    classId: 'soldado',
    attributes: {
      maxHp: 85,
      agility: 75,
      dexterity: 75,
      strength: 55,
      leadership: 35,
      wisdom: 35,
      marksmanship: 85,
      mechanical: 35,
      explosives: 35,
      medical: 35,
    },
  };
  state = order(state, {
    type: 'createOfficer',
    name: 'Isabel del Norte',
    profile,
    answers: {
      origin: 'cabildo',
      doctrine: 'line_marksman',
      crisis: 'rally',
      specialty: 'teacher',
      temperament: 'steady',
    },
  });
  const hires = [];
  for (const id of [123, 115, 114, 131, 120]) {
    const destination = state.location,
      op = rosterFor(state).find((op) => op.id === id),
      quote = contractQuote(state, op, 'day');
    assert.equal(quote.available, true, quote.reason ?? undefined);
    assert.ok(hiringArrivalOptions(state).some((site) => site.id === destination));
    const arrival = immediateRecruitmentExpectation(state, present(op), 'day', quote, destination);
    const money = state.resources.treasury;
    state = order(state, { type: 'recruitCivic', id, term: 'day', destination });
    assert.equal(state.resources.treasury, money - quote.total);
    hires.push({
      id,
      quote: structuredClone(quote),
      arrival: structuredClone(arrival),
      debited: money - state.resources.treasury,
    });
  }
  assert.equal(new Set(hires.map((hire) => hire.id)).size, 5);
  state = advanceCampaignHours(
    state,
    Math.max(6, ...hires.map((hire) => hire.arrival.travelHours)),
  );
  assert.equal(state.squad.length, 6);
  assert.ok(state.resources.treasury > 0);
  for (const hire of hires) {
    const contract = state.contracts[hire.id],
      due = hireArrivalDueSeconds(hire.arrival);
    assert.equal(state.recruited.filter((id) => id === hire.id).length, 1);
    assert.equal(present(contract).kind, 'paid');
    assert.equal(present(contract).term, 'day');
    assert.equal(present(contract).paid, hire.quote.price);
    assert.equal(
      present(present(contract).started) * 3600 + (present(contract).startedSecond ?? 0),
      due,
    );
    assert.equal(contractExpiresSeconds(contract), due + present(hire.quote.hours) * 3600);
  }
  notes.push({
    stage: 'paid-arrivals',
    hour: state.hour,
    secondOfHour: state.secondOfHour ?? 0,
    treasury: state.resources.treasury,
    hires: hires.map((hire) => ({ ...hire, contract: structuredClone(state.contracts[hire.id]) })),
    squad: [...state.squad],
  });
  let p = takeFiniteCache(visit(state), 120, [
    { weapon: 1801, count: 1 },
    { ammoType: 'musket_75', count: 12 },
  ]);
  const actor = present(p.battle).units.find((u) => u.id === '120'),
    key = Object.keys(present(actor).inventory).find((k) => {
      const item = present(actor).inventory[k];
      return typeof item === 'object' && item.weapon === 1801;
    });
  assert.ok(key);
  const rifle = structuredClone(present(actor).inventory[key]);
  p = tactical(p, { type: 'equipLoot', unitId: '120', inventoryKey: key });
  p = tactical(p, { type: 'reload', unitId: '120' });
  const armed = present(p.battle).units.find((u) => u.id === '120');
  notes.push({
    stage: 'finite-cache',
    operativeId: 120,
    rifle,
    weapon: present(armed).weapon,
    loaded: present(armed).loaded,
    ammunition: unitAmmunitionByType(armed),
  });
  state = leaveFiniteCache(p);
  state = fightOnArrival(order(state, { type: 'attack', sector: 'buenos_aires' }));
  const request = structuredClone(present(state.pendingBattle)),
    result = fight(request, null, {
      scoutCostWeight: 0.01,
      avoidCivilians: true,
      fallbackOrders: true,
    });
  assert.equal(
    result.battle.status,
    'victory',
    JSON.stringify(result.battle.units.map(({ id, hp, side }) => ({ id, hp, side }))),
  );
  p = { campaign: state, battle: enterSector(request) };
  for (const [index, action] of result.orders.entries()) {
    p = tactical(p, action);
    if (index === Math.floor(result.orders.length / 2)) {
      p = saved(p);
    }
  }
  assert.deepEqual(present(p.battle).units, result.battle.units);
  assert.equal(present(p.battle).seed, result.battle.seed);
  notes.push({
    stage: 'battle-replay',
    battleId: present(request).id,
    outcome: present(p.battle).status,
    turn: present(p.battle).turn,
    orders: result.orders.length,
    elapsedSeconds: present(p.battle).elapsedSeconds,
    seed: present(p.battle).seed,
    troops: present(p.battle)
      .units.filter((u) => u.side === 'player')
      .map((u) => ({
        id: u.id,
        hp: u.hp,
        bleeding: u.bleeding,
        loaded: u.loaded,
        ammunition: unitAmmunitionByType(u),
        medkits: u.medkits,
      })),
  });
  p = tactical(saved(p), { type: 'explore' });
  const aid = autoBandageBattle(p.battle),
    dressingsBefore = present(p.battle)
      .units.filter((u) => u.side === 'player')
      .reduce((total, u) => total + u.medkits, 0);
  for (const action of aid.steps) {
    p = tactical(p, action);
  }
  notes.push({
    stage: 'finite-aid',
    orders: aid.steps.length,
    dressingsBefore,
    dressingsAfter: present(p.battle)
      .units.filter((u) => u.side === 'player')
      .reduce((total, u) => total + u.medkits, 0),
    troops: present(p.battle)
      .units.filter((u) => u.side === 'player')
      .map((u) => ({ id: u.id, hp: u.hp, bleeding: u.bleeding, medkits: u.medkits })),
  });
  state = order(p.campaign, {
    type: 'battleResult',
    battleId: present(request).id,
    outcome: 'victory',
    sectorState: p.battle,
    survivors: present(p.battle).units.filter((u) => u.side === 'player'),
  });
  assert.equal(present(state.sectors['buenos_aires']).owner, 'patriot');
  assert.equal(present(state.sectors['retiro']).owner, 'patriot');
  assert.equal(dailyIncome(state), 0);
  assert.equal(state.townIncome.activations['buenos_aires'], undefined);
  p = visit(saved({ campaign: state }).campaign);
  const npc = present(p.battle).npcs.find((n) => n.id === 'local-buenos_aires'),
    speaker = present(p.battle).units.find(
      (u) => u.side === 'player' && u.hp >= 15 && !u.unconscious && !u.routed,
    );
  assert.ok(npc);
  assert.ok(speaker);
  p = sync({ campaign: p.campaign, battle: approachNPC(p.battle, speaker.id, npc.id) });
  state = order(p.campaign, {
    type: 'talkNPC',
    npcId: npc.id,
    unitId: Number(speaker.id),
    approach: 'direct',
    sectorState: p.battle,
  });
  assert.equal(present(state.lastConversation).outcome, 'incomeActivated');
  assert.equal(dailyIncome(state), 8000);
  notes.push({
    stage: 'physical-port-agreement',
    sector: 'buenos_aires',
    npcId: npc.id,
    speakerId: Number(speaker.id),
    hour: state.hour,
    secondOfHour: state.secondOfHour ?? 0,
    daily: dailyIncome(state),
    treasury: state.resources.treasury,
  });
  state = saved({ campaign: leave(saved({ campaign: state, battle: p.battle })) }).campaign;
  const remaining = 24 - (state.hour % 24),
    retained = retainStockOpeningService(
      state,
      hires.map((hire) => hire.id),
      clock(state) + remaining * 3600,
    );
  state = retained.campaign;
  for (const receipt of retained.renewals) {
    notes.push({ stage: 'opening-service-renewal', purpose: 'first-midnight', ...receipt });
  }
  const money = state.resources.treasury;
  state = advanceCampaignHours(state, remaining);
  assert.equal(state.resources.treasury, money + 8000);
  assert.ok(state.townIncome.activations['buenos_aires']);
  assert.equal(state.townIncome.lastPaidDay, Math.floor(state.hour / 24));
  notes.push({
    stage: 'first-midnight-payment',
    hour: state.hour,
    secondOfHour: state.secondOfHour ?? 0,
    treasuryBefore: money,
    treasury: state.resources.treasury,
    received: state.resources.treasury - money,
    paidDay: state.townIncome.lastPaidDay,
    renewalCost: retained.renewals.reduce((sum, receipt) => sum + receipt.debited, 0),
  });
  const restored = saved({ campaign: state }).campaign;
  assert.deepEqual(restored, state);
  const continuing = retainStockOpeningService(
    restored,
    hires.map((hire) => hire.id),
    clock(restored) + 3600,
  );
  state = continuing.campaign;
  for (const receipt of continuing.renewals) {
    notes.push({ stage: 'opening-service-renewal', purpose: 'no-duplicate-payment', ...receipt });
  }
  const continuedMoney = state.resources.treasury;
  state = advanceCampaignHours(state, 1);
  assert.equal(state.resources.treasury, continuedMoney);
  notes.push({
    stage: 'no-duplicate-payment',
    hour: state.hour,
    secondOfHour: state.secondOfHour ?? 0,
    treasury: state.resources.treasury,
    paidDay: state.townIncome.lastPaidDay,
  });
  return { campaign: state, notes };
}
