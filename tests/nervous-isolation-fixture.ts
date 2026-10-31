import { present } from './assert-present.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import type { SavedGame } from '../packages/game/save.ts';
import { fightOnArrivalOrder } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { authoredEditorPackage } from './authored-editor-fixture.ts';
import { contractQuote } from '../packages/game/contracts.js';
import {
  createBattle,
  actBattle,
  endTurn,
  presentedActBattle,
  presentedEndTurn,
  weaponFor,
} from '../packages/game/tactical.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { syncBattleTime } from '../packages/game/time.js';
import { travelLegHours } from '../packages/game/squad-travel.js';

export const nervousActor = (battle: BattleSnapshot, id: string | number) => battle.units.find((unit) => unit.id === String(id));
export function nervousSaved(pair: ActiveGame): ActiveGame;
export function nervousSaved(pair: {campaign: CampaignSnapshot; battle?: BattleSnapshot | null}): SavedGame;
export function nervousSaved(pair: {campaign: CampaignSnapshot; battle?: BattleSnapshot | null}): SavedGame {
  const restored = decodeSave(encodeSave(pair.campaign, pair.battle ?? null));
  if (pair.battle) { assert.ok(restored.battle); }
  return restored;
}
export const nervousOrder = (campaign: CampaignSnapshot, action: CampaignAction) => {
  const next = dispatchCampaign(campaign, action);
  assert.equal(next.lastError, null, `${action.type}: ${next.lastError}`);
  return next;
};

export type NervousOptions = {oldPinned?: boolean; oldRenewal?: boolean; term?: string};
export type NervousEvent = TacticalAction | {type: 'enemyTurn'};
export function preparedNervousArena({ oldPinned = false, oldRenewal = false, term = 'day' }: NervousOptions = {}) {
  // This experiment pins optional caregiver traits and six-hour arrivals.
  const content = authoredEditorPackage();
  // This declared clinical experiment pins the original pre-kinetic Brown Bess
  // balance before campaign creation. The separate kinetic acceptance tests the
  // authored energy profile; no executed health, gear or RNG is reset here.
  const clinicalGun = present(content.weapons.find((weapon) => weapon.template === 1800));
  delete clinicalGun.projectileEnergy;
  delete clinicalGun.projectileAirDrag;
  for (const load of clinicalGun.alternativeLoads ?? []) {
    delete load.projectileEnergy;
    delete load.projectileAirDrag;
  }
  // Compatibility control is declared before campaign creation; care remains.
  if (oldPinned) {
    const cejas = present(content.characters.find((person) => person.id === 'person-130'));
    cejas.abilities = present(cejas.abilities).filter((ability) => ability !== 'nervous_isolation');
  }
  if (oldRenewal) {
    const cejas = present(content.characters.find((person) => person.id === 'person-130'));
    cejas.abilities = present(cejas.abilities).filter((ability) => ability !== 'low_morale_refusal');
  }
  let campaign = initialCampaign(42, content);
  const prices: {id: number; price: number}[] = [];
  const
    campaignHistory: CampaignAction[] = [],
    campaignStart = nervousSaved({ campaign });
  const campaignStep = (action: CampaignAction) => {
    campaign = nervousOrder(campaign, action);
    campaignHistory.push(structuredClone(action));
  };
  for (const id of [130, 110]) {
    const quote = contractQuote(
        campaign,
        present(rosterFor(campaign).find((person) => person.id === id)),
        term,
      ),
      before = campaign.resources.treasury;
    campaignStep({ type: 'recruitCivic', id, term });
    prices.push({ id, price: quote.price });
    assert.equal(campaign.resources.treasury, before - quote.price);
  }
  campaignStep({ type: 'wait', hours: 6 });
  assert.ok([130, 110].every((id) => campaign.recruited.includes(id)));
  if (term === 'day') {
    assert.deepEqual(prices, [
      { id: 130, price: 36 },
      { id: 110, price: 60 },
    ]);
  }
  if (term === 'week') {
    assert.deepEqual(prices, [
      { id: 130, price: 252 },
      { id: 110, price: 420 },
    ]);
  }
  assert.equal(
    campaign.resources.treasury,
    3200 - prices.reduce((sum, item) => sum + item.price, 0),
  );
  // Preserve the declared daylight clinical contact after the shorter city road.
  // The paid wait is part of the official campaign replay and contract clock.
  campaignStep({
    type: 'wait',
    hours: 18 - campaign.hour - travelLegHours('retiro', 'buenos_aires'),
  });
  campaignStep({ type: 'attack', sector: 'buenos_aires' });
  campaignStep(fightOnArrivalOrder(campaign));
  const request = present(campaign.pendingBattle),
    width = 48,
    height = 16;
  // Prepared initial observation arena, not a native opening victory. Positions,
  // passive hostile posts and seed42 are fixed before the first official save.
  // Native people, health, skills, terms and finite kit remain; only the
  // pre-admission Brown Bess profile exception above is declared.
  const battle = createBattle(
    request.squad.map((unit) => ({ ...unit, x: 1, y: unit.id === 130 ? 3 : 5, facing: 2 })),
    {
      ...request,
      width,
      height,
      seed: 42,
      props: [],
      tiles: Array.from({ length: width * height }, (_, i) => ({
        x: i % width,
        y: Math.floor(i / width),
        type: 'grass',
        blocked: false,
        cover: 0,
      })),
      wallEdges: [
        { x: 7, y: 2, axis: 'x' },
        { x: 7, y: 3, axis: 'x' },
        { x: 7, y: 2, axis: 'y' },
        { x: 8, y: 2, axis: 'y' },
      ].map((edge, i) => ({
        ...edge,
        id: `clinical-screen:${i}`,
        type: 'wall',
        material: 'stone',
        blocked: true,
        blocksSight: true,
        cover: 100,
      })),
      enemies: present(request.enemies).map((unit, i) => ({
        ...unit,
        x: i === 0 ? 14 : i === 1 ? 11 : 46,
        y: i === 0 ? 3 : i === 1 ? 5 : 12 + i,
        patrol: false,
        overwatch: false,
      })),
      npcs: present(request.npcs).map((npc, i) => ({ ...npc, x: 40 + i, y: 15 })),
    },
  );
  if (request.finiteArtilleryArsenal) {
    battle.finiteArtilleryArsenal = structuredClone(request.finiteArtilleryArsenal);
  }
  const start = nervousSaved({ campaign, battle });
  const pinnedGun = present(present(start.campaign.contentCampaign).package.weapons.find(
    (weapon) => weapon.template === 1800,
  ));
  assert.equal(Object.hasOwn(pinnedGun, 'projectileEnergy'), false);
  assert.equal(Object.hasOwn(pinnedGun, 'projectileAirDrag'), false);
  assert.ok(
    (pinnedGun.alternativeLoads ?? []).every(
      (load) =>
        !Object.hasOwn(load, 'projectileEnergy') && !Object.hasOwn(load, 'projectileAirDrag'),
    ),
  );
  assert.equal(
    weaponFor(present(nervousActor(start.battle, 110))).projectileEnergy,
    undefined,
    'the official saved clinical load retains its explicit legacy profile',
  );
  return { start, prices, oldPinned, campaignStart, campaignHistory };
}

export function nervousStep(pair: ActiveGame, event: NervousEvent, history?: NervousEvent[]): ActiveGame {
  const source = structuredClone(pair),
    ordinary = event.type === 'enemyTurn' ? endTurn(pair.battle) : actBattle(pair.battle, event),
    presented =
      event.type === 'enemyTurn'
        ? presentedEndTurn(pair.battle)
        : presentedActBattle(pair.battle, event);
  assert.equal(ordinary.lastError, null, `${JSON.stringify(event)}: ${ordinary.lastError}`);
  assert.deepEqual(presented.state, ordinary);
  assert.deepEqual(pair, source);
  const synced = syncBattleTime(pair.campaign, ordinary);
  assert.equal(synced.error, null, synced.error ?? undefined);
  history?.push(structuredClone(event));
  return nervousSaved({campaign: synced.campaign, battle: present(synced.battle)});
}

export const nervousInjuryOrders: NervousEvent[] = [
  { type: 'move', unitId: '130', x: 4, y: 3 },
  { type: 'fire', unitId: '130', targetId: 'enemy-1', aim: 4 },
  { type: 'fire', unitId: '110', targetId: 'enemy-1', aim: 4 },
  { type: 'enemyTurn' },
  { type: 'move', unitId: '110', x: 5, y: 3 },
  { type: 'enemyTurn' },
  { type: 'move', unitId: '110', x: 5, y: 2 },
  { type: 'move', unitId: '130', x: 6, y: 3 },
  { type: 'reload', unitId: '130' },
  { type: 'fire', unitId: '130', targetId: 'enemy-0', aim: 4 },
  { type: 'enemyTurn' },
];

// Hostile damage and one further real miss earn the threshold. The wounded
// doctor spends her own dressing and moves behind the declared stone screen.
// Acosta's resulting critical condition supplies no military support.
export const nervousFearOrders: NervousEvent[] = [
  ...nervousInjuryOrders,
  { type: 'weapon', unitId: '130', slot: 'medical' },
  { type: 'heal', unitId: '130', targetId: '130' },
  { type: 'move', unitId: '130', x: 6, y: 1 },
  { type: 'enemyTurn' },
];

export function earnNervousIsolation(options: NervousOptions = {}) {
  const fixture = preparedNervousArena(options);
  let pair = fixture.start;
  const history: NervousEvent[] = [];
  let wounded: ActiveGame | undefined, beforeFear: ActiveGame | undefined;
  for (let i = 0; i < nervousFearOrders.length; i++) {
    if (i === nervousInjuryOrders.length) {
      wounded = structuredClone(pair);
    }
    if (i === nervousFearOrders.length - 1) {
      beforeFear = structuredClone(pair);
    }
    pair = nervousStep(pair, present(nervousFearOrders[i]), history);
  }
  return { ...fixture, pair, history, wounded, beforeFear };
}
