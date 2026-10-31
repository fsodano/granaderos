import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { scaffoldDocuments } from '../apps/campaign-editor/infrastructure/project-scaffold.js';
import { compileCampaignPackage } from '../packages/game/campaign-library.js';
import { operativeIdForCharacter } from '../packages/game/content-character-ids.js';
import { contractQuote, contractExpiresSeconds } from '../packages/game/contracts.js';
import { rosterFor } from '../packages/game/campaign.js';
import { buildBuilding } from '../packages/game/buildings.js';
import { prepareCampaignBattle } from '../packages/game/battle-handoff.js';
import {
  actBattle,
  getReachable,
  lookPreview,
  artilleryContact,
  artilleryCrewPlan,
  artilleryCosts,
} from '../packages/game/tactical.js';
import { sameCell, spacePoint } from '../packages/game/tactical-space.js';
import { syncBattleTime } from '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.js';
import { npcRoutes } from '../packages/game/npc-ai.js';
import { createBattle } from '../packages/game/tactical.js';
import { buildTerrace } from '../packages/game/buildings.js';
import { validateBattleSnapshot } from '../packages/game/validate-battle.js';

const OCCUPANCY_SECTOR = 'watch-post',
  OCCUPANCY_GUN = 'arsenal:resident-post:1',
  OCCUPANCY_CHEST = 'resident-post-arsenal';
const campaignClock = (c) => c.hour * 3600 + (c.secondOfHour ?? 0);
const pairedSave = (pair) => decodeSave(encodeSave(pair.campaign, pair.battle ?? null));
const actor = (battle, id) => battle.units.find((unit) => unit.id === String(id));
const resident = (battle) => battle.npcs.find((npc) => npc.contentId === 'neighbor');

function occupancyContent() {
  const documents = scaffoldDocuments('resident-post-occupancy'),
    base = documents.content.characters[0];
  documents.content.characters = ['first-gunner', 'second-gunner', 'observer'].map((id, index) => ({
    ...structuredClone(base),
    id,
    name: `Guardia ${index + 1}`,
    nickname: `Guardia ${index + 1}`,
    monthlyPay: 30,
    arrivalHours: 0,
    attributes: { ...base.attributes, maxHp: 80, medical: 0 },
    startingCondition: { hp: 80, bleeding: 0, bandaged: 0, energy: 100, fatigue: 0 },
    startingSupplies: { medkits: 0, rations: 2, torches: 0, boleadoras: 0 },
  }));
  const neighbor = {
    ...structuredClone(base),
    id: 'neighbor',
    name: 'Vecina del puesto',
    nickname: 'Vecina',
    recruitmentSource: 'encounter',
    service: 'permanent',
    monthlyPay: 0,
    weapon: null,
    encounter: {
      recruitable: false,
      greeting: 'Esta es mi casa.',
      requiredLeadership: 0,
      requiredLiberated: 0,
      requiredSector: null,
    },
  };
  delete neighbor.arrivalHours;
  documents.content.characters.push(neighbor);
  documents.content.placements = [
    {
      id: 'neighbor-post',
      character: 'neighbor',
      mode: 'fixed',
      sectors: [OCCUPANCY_SECTOR],
      moveChance: 100,
      afterDeath: null,
      delayMin: 0,
      delayMax: 0,
    },
  ];
  documents.content.rules.startingTreasury = 1000;
  documents.content.rules.deploymentCartridges = 0;
  documents.content.startingTerritory[OCCUPANCY_SECTOR] = { owner: 'patriot', loyalty: 65 };
  documents.content.arrivalSites.push({ sector: OCCUPANCY_SECTOR, facilities: ['barracks'] });
  documents.world.arrivalFacilities[OCCUPANCY_SECTOR] = ['barracks'];
  documents.content.campaignStory.chapters[0].conditions = [{ type: 'day', min: 1000, max: null }];
  documents.world.expansion.rural = [];
  documents.world.expansion.buildingTargets[OCCUPANCY_SECTOR] = 1;
  documents.world.enemyStrategy = {
    version: 1,
    theaters: {
      frontier: { legHours: 1, reserve: 3, raidEveryHours: 4, axis: [OCCUPANCY_SECTOR] },
    },
  };
  const map = documents.maps[OCCUPANCY_SECTOR],
    home = buildBuilding({
      id: 'neighbor-home',
      x: 4,
      y: 5,
      width: 3,
      height: 3,
      roof: 'tile',
      material: 'adobe',
      doors: [
        { id: 'neighbor-west', x: 4, y: 7, axis: 'y', open: true },
        { id: 'neighbor-south', x: 4, y: 8, axis: 'x', open: true },
      ],
    }).building;
  // The two internal walls leave one accessible home cell beside the guard post.
  home.walls.push(
    { id: 'neighbor-inner-north', x: 4, y: 7, axis: 'x', type: 'wall' },
    { id: 'neighbor-inner-east', x: 5, y: 7, axis: 'y', type: 'wall' },
  );
  map.buildings = [home];
  map.props = [
    {
      id: OCCUPANCY_CHEST,
      type: 'chest',
      x: 3,
      y: 9,
      footprint: { width: 1, height: 1 },
      blocksMovement: true,
    },
  ];
  map.upperSurfaces = [];
  map.climbLinks = [];
  documents.world.physical.caches[OCCUPANCY_SECTOR] = { chest: OCCUPANCY_CHEST, contents: [] };
  documents.world.physical.arsenals[OCCUPANCY_SECTOR] = {
    version: 1,
    sector: OCCUPANCY_SECTOR,
    chest: OCCUPANCY_CHEST,
    pieces: [{ id: OCCUPANCY_GUN, type: 'bronze4', side: 'player', loaded: true, ammo: 2 }],
  };
  const declared = structuredClone(documents),
    content = compileCampaignPackage(documents.manifest, {
      content: documents.content,
      world: documents.world,
      maps: documents.maps,
      presentation: documents.presentation,
      assets: documents.assets,
    });
  assert.deepEqual(documents, declared);
  return content;
}

function paidResidentCrew() {
  const content = occupancyContent(),
    ids = ['first-gunner', 'second-gunner', 'observer'].map((id) =>
      operativeIdForCharacter(content, id),
    );
  let campaign = initialCampaign(42, content),
    battle = null;
  const dispatch = (action) => {
    const before = structuredClone(campaign),
      next = dispatchCampaign(campaign, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    assert.deepEqual(campaign, before);
    campaign = next;
  };
  const enter = () => {
    dispatch({ type: 'visitSector' });
    const pair = prepareCampaignBattle(campaign);
    assert.equal(pair.error, null, pair.error);
    ({ campaign, battle } = pairedSave(pair));
    assert.equal(battle.mode, 'exploration');
    return battle;
  };
  const step = (action, { blocked = [] } = {}) => {
    const before = structuredClone(battle),
      next = actBattle(battle, action);
    assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
    assert.deepEqual(battle, before);
    for (const point of [resident(next), ...(resident(next).lastMovePath ?? [])])
      assert.ok(
        !blocked.some((post) => sameCell(point, post)),
        'A quiet NPC must not enter an actual paid resident guard post: ' +
          JSON.stringify({
            action,
            npc: spacePoint(resident(next)),
            path: resident(next).lastMovePath,
            blocked,
          }),
      );
    const pair = syncBattleTime(campaign, next);
    assert.equal(pair.error, null, pair.error);
    ({ campaign, battle } = pairedSave(pair));
  };
  const move = (id, to, options) => {
    const unit = actor(battle, id),
      quote = getReachable(battle, unit, { stopAt: (point) => sameCell(point, to) })[0];
    assert.ok(quote?.cost > 0, 'A declared placement needs a valid game path.');
    step({ type: 'move', unitId: unit.id, ...spacePoint(to) }, options);
    assert.ok(sameCell(actor(battle, id), to));
  };
  const exit = () => {
    dispatch({
      type: 'leaveSector',
      battleId: campaign.pendingBattle.id,
      sectorState: battle,
      survivors: battle.units.filter((unit) => unit.side === 'player'),
    });
    battle = null;
    campaign = pairedSave({ campaign }).campaign;
  };
  for (const id of ids) {
    const quote = contractQuote(
        campaign,
        rosterFor(campaign).find((op) => op.id === id),
        'week',
      ),
      cash = campaign.resources.treasury;
    assert.equal(quote.available, true, quote.reason);
    assert.ok(quote.total > 0);
    dispatch({
      type: 'recruitCombatant',
      characterId: String(id),
      term: 'week',
      destination: OCCUPANCY_SECTOR,
    });
    assert.equal(campaign.resources.treasury, cash - quote.total);
    assert.equal(campaign.operativeState[id].location, OCCUPANCY_SECTOR);
  }
  assert.equal(campaign.hiringArrivals.length, 0);
  for (const members of [ids.slice(0, 2), ids.slice(2)])
    dispatch({
      type: 'createSquad',
      name: 'Guardia residente',
      ids: members,
      sector: OCCUPANCY_SECTOR,
    });
  const homeA = campaign.squads.find((home) => home.members.includes(ids[0])),
    homeB = campaign.squads.find((home) => home.members.includes(ids[2]));
  dispatch({ type: 'selectSquad', id: homeA.id });
  enter();
  const building = battle.buildings.find((row) => row.id === 'neighbor-home'),
    post = { x: building.x, y: building.y + 2, tacticalLevel: 0 },
    gunPoint = { x: building.x - 1, y: building.y + 3, tacticalLevel: 0 },
    secondPost = { x: building.x, y: building.y + 3, tacticalLevel: 0 };
  assert.deepEqual(spacePoint(resident(battle)), {
    x: building.x - 1,
    y: building.y + 2,
    tacticalLevel: 0,
  });
  assert.equal(battle.startSeconds % 86400 < 6 * 3600, true);
  assert.equal(battle.buildings.length, 1);
  assert.ok(
    building.rooms.some((room) => room.cells.length === 1 && sameCell(room.cells[0], post)),
  );
  // The first actual soldier remains beside the NPC until the second soldier
  // has paid for the post. The ordinary conversation pause keeps setup calm.
  move(ids[0], { x: building.x - 2, y: building.y + 2, tacticalLevel: 0 });
  move(ids[1], { x: building.x, y: building.y + 4, tacticalLevel: 0 });
  const chest = battle.props.find((prop) => prop.id === OCCUPANCY_CHEST),
    look = { type: 'look', unitId: String(ids[1]), ...spacePoint(chest) },
    lookQuote = lookPreview(battle, actor(battle, ids[1]), look);
  assert.equal(lookQuote.valid, true);
  assert.equal(lookQuote.prepare, false);
  step(look);
  step({
    type: 'useItem',
    unitId: String(ids[1]),
    environment: { kind: 'container', id: OCCUPANCY_CHEST, verb: 'open' },
  });
  const gun = battle.artillery.find((piece) => piece.id === OCCUPANCY_GUN);
  assert.ok(gun);
  assert.ok(sameCell(gun, gunPoint));
  assert.equal(gun.loaded, true);
  assert.equal(gun.ammo, 2);
  move(ids[1], post);
  move(ids[0], secondPost);
  for (const id of ids.slice(0, 2))
    assert.equal(artilleryContact(battle, actor(battle, id), gun), true);
  const plan = artilleryCrewPlan(
    battle,
    actor(battle, ids[0]),
    gun,
    artilleryCosts(battle, actor(battle, ids[0]), gun).fire,
  );
  assert.equal(plan.reason, null);
  assert.deepEqual(new Set(plan.crew), new Set(ids.slice(0, 2).map(String)));
  const posts = new Map(ids.slice(0, 2).map((id) => [id, spacePoint(actor(battle, id))])),
    finiteGun = structuredClone(gun),
    paidCash = campaign.resources.treasury;
  assert.deepEqual(spacePoint(resident(battle)), {
    x: building.x - 1,
    y: building.y + 2,
    tacticalLevel: 0,
  });
  exit();
  for (const [id, point] of posts) {
    assert.ok(sameCell(campaign.operativeState[id].residentPosition, point));
    assert.ok(contractExpiresSeconds(campaign.contracts[id]) > campaignClock(campaign) + 6 * 3600);
  }
  return {
    ids,
    homeA: homeA.id,
    homeB: homeB.id,
    posts,
    finiteGun,
    paidCash,
    post,
    building,
    dispatch,
    enter,
    step,
    move,
    exit,
    get campaign() {
      return campaign;
    },
    get battle() {
      return battle;
    },
  };
}

test('a resident keeps a paid gunner post clear while another squad visits, after save/load', () => {
  const fixture = paidResidentCrew(),
    { ids, posts, finiteGun, post } = fixture;
  fixture.dispatch({ type: 'selectSquad', id: fixture.homeB });
  fixture.enter();
  assert.deepEqual(
    fixture.battle.units.filter((unit) => unit.side === 'player').map((unit) => unit.id),
    [String(ids[2])],
  );
  const before = structuredClone(fixture.battle),
    observer = actor(before, ids[2]);
  assert.deepEqual(
    getReachable(before, observer, { stopAt: (point) => sameCell(point, post) }),
    [],
  );
  const refused = actBattle(before, { type: 'move', unitId: observer.id, ...spacePoint(post) });
  assert.ok(refused.lastError);
  const {
    lastError: refusal,
    log: refusalLog,
    publicJournal: refusalJournal,
    ...refusedProgress
  } = refused;
  const {
    lastError: priorError,
    log: priorLog,
    publicJournal: priorJournal,
    ...priorProgress
  } = before;
  assert.deepEqual(refusedProgress, priorProgress);
  assert.deepEqual(fixture.battle, before);
  const blocked = [...posts.values()];
  fixture.move(ids[2], { x: post.x - 2, y: post.y + 3, tacticalLevel: 0 }, { blocked });
  for (let tick = 0; tick < 3; tick++) fixture.step({ type: 'ambient' }, { blocked });
  fixture.exit();
  fixture.dispatch({ type: 'selectSquad', id: fixture.homeA });
  fixture.enter();
  for (const [id, point] of posts)
    assert.ok(
      sameCell(actor(fixture.battle, id), point),
      'A paid resident returns to its actual post.',
    );
  const gun = fixture.battle.artillery.find((piece) => piece.id === finiteGun.id),
    plan = artilleryCrewPlan(
      fixture.battle,
      actor(fixture.battle, ids[0]),
      gun,
      artilleryCosts(fixture.battle, actor(fixture.battle, ids[0]), gun).fire,
    );
  assert.equal(plan.reason, null);
  assert.deepEqual(new Set(plan.crew), new Set(ids.slice(0, 2).map(String)));
  fixture.exit();
});

test('a real departure releases saved posts for inactive resident movement despite archived guard bodies', () => {
  const fixture = paidResidentCrew(),
    { ids, post } = fixture;
  const archived = fixture.campaign.sectorStates[OCCUPANCY_SECTOR];
  assert.ok(ids.slice(0, 2).every((id) => archived.units.some((unit) => unit.id === String(id))));
  fixture.dispatch({ type: 'travel', sector: 'cell-18-16', queue: true });
  const departure = campaignClock(fixture.campaign);
  assert.ok(fixture.campaign.squads.find((squad) => squad.id === fixture.homeA).journey);
  let crossed = false;
  for (let phase = 0; phase < 20 && !crossed; phase++) {
    fixture.dispatch({ type: 'advanceStrategicTime', seconds: 6 });
    const scene = fixture.campaign.sectorStates[OCCUPANCY_SECTOR],
      neighbor = resident(scene);
    crossed = [neighbor, ...(neighbor.lastMovePath ?? [])].some((point) => sameCell(point, post));
  }
  assert.equal(crossed, true, 'The inactive resident can use the physically released post.');
  assert.ok(campaignClock(fixture.campaign) > departure);
  assert.ok(
    ids
      .slice(0, 2)
      .every((id) =>
        fixture.campaign.sectorStates[OCCUPANCY_SECTOR].units.some(
          (unit) => unit.id === String(id),
        ),
      ),
    'Historical bodies remain in the retained snapshot.',
  );
  fixture.dispatch({ type: 'selectSquad', id: fixture.homeB });
  fixture.enter();
  assert.equal(fixture.battle.residentPositions, undefined);
  fixture.exit();
});

test('saved position references reject forged positions and upgrade an older active save without changing paid progress', () => {
  const fixture = paidResidentCrew();
  fixture.dispatch({ type: 'selectSquad', id: fixture.homeB });
  fixture.enter();
  const encoded = encodeSave(fixture.campaign, fixture.battle),
    expected = structuredClone(fixture.battle.residentPositions);
  assert.equal(expected.length, 2);
  const legacy = JSON.parse(encoded);
  delete legacy.battle.residentPositions;
  const restored = decodeSave(JSON.stringify(legacy));
  assert.deepEqual(restored.battle, fixture.battle);
  assert.deepEqual(restored.battle.residentPositions, expected);
  const omitted = structuredClone(fixture.battle);
  delete omitted.residentPositions;
  const rejected = syncBattleTime(fixture.campaign, omitted);
  assert.match(rejected.error, /Resident positions/);
  assert.equal(rejected.campaign, fixture.campaign);
  assert.equal(rejected.battle, omitted);
  for (const action of [
    { type: 'syncTacticalTime', elapsedSeconds: omitted.elapsedSeconds },
    { type: 'leaveSector', survivors: omitted.units.filter((unit) => unit.side === 'player') },
  ]) {
    const refused = dispatchCampaign(fixture.campaign, {
      ...action,
      battleId: fixture.campaign.pendingBattle.id,
      sectorState: omitted,
    });
    assert.match(refused.lastError, /Resident positions/);
    assert.deepEqual({ ...refused, lastError: null }, fixture.campaign);
  }
  for (const alter of [
    (reference) => reference.position.x++,
    (reference) => (reference.position.level = 1),
    (reference) => (reference.characterId = 'character:999'),
  ]) {
    const forged = JSON.parse(encoded);
    alter(forged.battle.residentPositions[0]);
    assert.throws(() => decodeSave(JSON.stringify(forged)), /resident position|Resident position/);
  }
  fixture.exit();
});

test('resident occupancy blocks NPC and soldier routes only on the saved physical level', () => {
  const building = buildBuilding({ id: 'roof', x: 0, y: 0, width: 3, height: 3 }).building;
  const terrace = buildTerrace(building);
  const field = createBattle([{ id: 110, name: 'Observer', hp: 80, x: 0, y: 0 }], {
    id: 'level-occupancy',
    sector: 'retiro',
    width: 4,
    height: 4,
    exploration: true,
    enemies: [],
    buildings: [building],
    ...terrace,
    npcs: [{ id: 'neighbor', name: 'Neighbor', x: 0, y: 0 }],
  });
  const reference = { characterId: 'character:115', position: { x: 1, y: 0, level: 1 } };
  const projected = { ...field, residentPositions: [reference] };
  validateBattleSnapshot(projected);
  const groundNpc = projected.npcs[0],
    upperNpc = { ...groundNpc, tacticalLevel: 1 };
  const upperField = { ...projected, npcs: [upperNpc] };
  assert.ok(npcRoutes(projected, groundNpc).records.has('1,0'));
  assert.equal(npcRoutes(upperField, upperNpc).records.has('1:1,0'), false);
  const observer = field.units[0];
  assert.ok(
    getReachable(projected, observer, { stopAt: (point) => sameCell(point, { x: 1, y: 0 }) })
      .length,
  );
  const upperObserver = { ...observer, tacticalLevel: 1 };
  assert.deepEqual(
    getReachable({ ...upperField, units: [upperObserver] }, upperObserver, {
      stopAt: (point) => sameCell(point, { x: 1, y: 0, tacticalLevel: 1 }),
    }),
    [],
  );
  assert.ok(
    npcRoutes({ ...upperField, residentPositions: undefined }, upperNpc).records.has('1:1,0'),
  );
});
