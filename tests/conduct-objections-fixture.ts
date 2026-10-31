import { present } from './assert-present.ts';
import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type {
  BattleSnapshot,
  TacticalAction,
} from '../packages/game/public/compatibility-types.ts';
import type { ActiveGame } from './local-contract-fixture.ts';
import type { SavedGame } from '../packages/game/save.ts';
import { fightOnArrival } from './assault-fixture.ts';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { authoredEditorPackage } from './authored-editor-fixture.ts';
import { contractQuote } from '../packages/game/contracts.js';
import { createBattle, actBattle, presentedActBattle, canSee } from '../packages/game/tactical.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { travelLegHours } from '../packages/game/squad-travel.js';

export const conductActor = (b: BattleSnapshot) => b.units.find((unit) => unit.id === '100');
export const conductWitness = (b: BattleSnapshot) => b.units.find((unit) => unit.id === '107');
export const conductCivilian = (b: BattleSnapshot) =>
  b.npcs.find((npc) => npc.id === 'local-buenos_aires');
export function saveConductPair(pair: ActiveGame): ActiveGame;
export function saveConductPair(pair: {
  campaign: CampaignSnapshot;
  battle?: BattleSnapshot | null;
}): SavedGame;
export function saveConductPair(pair: {
  campaign: CampaignSnapshot;
  battle?: BattleSnapshot | null;
}): SavedGame {
  const restored = decodeSave(encodeSave(pair.campaign, pair.battle ?? null));
  if (pair.battle) {
    assert.ok(restored.battle);
  }
  return restored;
}
export function conductOrder(state: CampaignSnapshot, action: CampaignAction) {
  const next = dispatchCampaign(state, action);
  assert.equal(next.lastError, null, `${action.type}: ${next.lastError}`);
  return next;
}

export function preparedConductArena({
  oldPinned = false,
  hiddenWitness = false,
  nearbyContact = false,
} = {}) {
  // Conscience and six-hour arrivals are explicit options in this experiment.
  const content = authoredEditorPackage();
  if (oldPinned) {
    // Declared old content before campaign creation; no runtime receipt reset.
    const character = present(content.characters.find((person) => person.id === 'person-107'));
    const abilities = character.abilities?.filter((ability) => ability !== 'civilian_conscience');
    if (abilities !== undefined) {
      character.abilities = abilities;
    }
    if (!character.abilities?.length) {
      delete character.abilities;
    }
  }
  let campaign = initialCampaign(42, content);
  const prices = [];
  for (const id of [107, 100]) {
    const quote = contractQuote(
        campaign,
        rosterFor(campaign).find((person) => person.id === id),
        'day',
      ),
      cash = campaign.resources.treasury;
    campaign = conductOrder(campaign, { type: 'recruitCivic', id, term: 'day' });
    assert.equal(campaign.resources.treasury, cash - quote.price);
    prices.push({ id, price: quote.price });
  }
  for (let i = 0; i < 6; i++) {
    campaign = conductOrder(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  }
  assert.deepEqual(campaign.recruited, [107, 100]);
  assert.equal(campaign.resources.treasury, 3080);
  // The late-day witnessed event must still precede the actual paid expiry.
  campaign = conductOrder(campaign, {
    type: 'wait',
    hours: 18 - campaign.hour - travelLegHours('retiro', 'buenos_aires'),
  });
  campaign = fightOnArrival(conductOrder(campaign, { type: 'attack', sector: 'buenos_aires' }));
  const request = present(campaign.pendingBattle),
    width = 48,
    height = 16;
  // Initial prepared arena only. All native people, HP, skills, finite gear,
  // terms and hostile force are retained. This is not an opening victory.
  const tiles = Array.from({ length: width * height }, (_, i) => ({
    x: i % width,
    y: Math.floor(i / width),
    type: 'grass',
    blocked: false,
    cover: 0,
  }));
  if (hiddenWitness) {
    for (const tile of tiles) {
      if (tile.y === 4 && tile.x <= 5) {
        Object.assign(tile, {
          type: 'wall',
          material: 'stone',
          blocked: true,
          blocksSight: true,
          cover: 90,
        });
      }
    }
  }
  const battle = createBattle(
    request.squad.map((unit) => ({
      ...unit,
      x: unit.id === 100 ? 2 : 1,
      y: unit.id === 107 && hiddenWitness ? 5 : 3,
      facing: 2,
    })),
    {
      ...request,
      width,
      height,
      seed: 42,
      exploration: true,
      weather: { rain: 0, humidity: 0 },
      tiles,
      props: [],
      enemies: present(request.enemies).map((unit, i) => ({
        ...unit,
        x: 44 + (i % 3),
        y: 8 + Math.floor(i / 3),
        patrol: false,
        overwatch: false,
      })),
      npcs: present(request.npcs).map((npc, i) => ({
        ...npc,
        ...(nearbyContact && npc.id === 'dorrego'
          ? { x: 1, y: 2 }
          : {
              x: npc.id === 'local-buenos_aires' ? 3 : 47 - i,
              y: npc.id === 'local-buenos_aires' ? 3 : 15,
            }),
      })),
    },
  );
  if (request.finiteArtilleryArsenal) {
    battle.finiteArtilleryArsenal = structuredClone(request.finiteArtilleryArsenal);
  }
  assert.equal(present(conductCivilian(battle)).hp, 100);
  assert.equal(present(conductActor(battle)).hp, 70);
  assert.equal(present(conductWitness(battle)).hp, 72);
  assert.equal(canSee(battle, conductWitness(battle), conductActor(battle)), !hiddenWitness);
  assert.equal(canSee(battle, conductWitness(battle), conductCivilian(battle)), !hiddenWitness);
  const start = saveConductPair({ campaign, battle });
  return { start, prices, oldPinned, hiddenWitness, nearbyContact };
}

export function conductStep(
  pair: ActiveGame,
  action: TacticalAction,
  history?: TacticalAction[],
): ActiveGame {
  const before = structuredClone(pair),
    ordinary = actBattle(pair.battle, action),
    presented = presentedActBattle(pair.battle, action);
  assert.equal(ordinary.lastError, null, `${JSON.stringify(action)}: ${ordinary.lastError}`);
  assert.deepEqual(presented.state, ordinary);
  assert.deepEqual(pair, before, 'the real order and presentation preserve the input');
  const campaign = conductOrder(pair.campaign, {
    type: 'syncTacticalTime',
    battleId: present(pair.campaign.pendingBattle).id,
    elapsedSeconds: present(ordinary.elapsedSeconds),
    sectorState: ordinary,
  });
  history?.push(structuredClone(action));
  return saveConductPair({
    campaign,
    battle: { ...ordinary, syncedSeconds: present(ordinary.elapsedSeconds) },
  });
}

export function performConductEvent(start: ActiveGame) {
  let pair = saveConductPair(start);
  const history: TacticalAction[] = [],
    checkpoints: ActiveGame[] = [];
  pair = conductStep(pair, { type: 'weapon', unitId: '100', slot: 'blade' }, history);
  for (let i = 0; i < 4; i++) {
    pair = conductStep(
      pair,
      {
        type: 'melee',
        unitId: '100',
        targetId: present(conductCivilian(pair.battle)).id,
        targetKind: 'npc',
      },
      history,
    );
    checkpoints.push(structuredClone(pair));
  }
  assert.equal(present(conductCivilian(pair.battle)).hp, 0);
  return { pair, history, checkpoints };
}

export function executePaidConductRoute(start: ActiveGame) {
  const earned = performConductEvent(start);
  let pair = earned.pair;
  const history = earned.history;
  for (const id of ['100', '107']) {
    const unit = present(pair.battle.units.find((actor) => actor.id === id));
    pair = conductStep(pair, { type: 'move', unitId: id, x: id === '100' ? 2 : 1, y: 0 }, history);
    assert.ok(present(pair.battle.units.find((actor) => actor.id === id)).energy < unit.energy);
  }
  const exit = pair.battle.exits.find((exit) => exit.destination === 'retiro');
  assert.ok(exit);
  pair = conductStep(pair, { type: 'exit', unitIds: ['100', '107'], exitId: exit.id }, history);
  assert.equal(pair.battle.status, 'retreat');
  const campaign = conductOrder(pair.campaign, {
    type: 'battleResult',
    battleId: present(pair.campaign.pendingBattle).id,
    outcome: 'retreat',
    sectorState: pair.battle,
    survivors: pair.battle.units.filter((unit) => unit.side === 'player'),
  });
  assert.equal(campaign.location, 'retiro');
  return { ...earned, pair, history, returned: saveConductPair({ campaign }).campaign };
}
