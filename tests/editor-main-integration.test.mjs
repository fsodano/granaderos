import {inventoryUsage,applyItemQuantity,equipmentStacksMerge,pocketMergeCount} from "../game/tactical-inventory.js";
import {validateBattleSnapshot} from "../game/validate-battle.js";
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { ITEM_TYPES } from "../game/map-catalog.js";
import { blankMap, serializeMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
import { createMapPlaytest } from "../game/map-playtest.js";
import { actBattle } from "../game/tactical.js";
import { collectSectorCash, sectorCash } from "../game/economy.js";
import { enterSector } from "../game/world.js";
import { propBlocksAt } from "../game/props.js";
import { MAP_IDS } from "../game/maps.js";

const resources = ["ammo", "rations", "boleadoras", "medkits", "torches"];
const carried = (unit) => Object.fromEntries(resources.map((type) => [type, unit[type]]));
function supplyMap(type = "rations") {
  const result = applyMapCommands(blankMap({ width: 8, height: 8 }), [
    { type: "addObject", layer: "spawns", object: { id: "player", side: "player", x: 1, y: 1 } },
    {
      type: "addObject",
      layer: "items",
      object: { id: `supply-${type}`, type, count: 3, x: 2, y: 1 },
    },
  ]);
  assert.deepEqual(result.errors, []);
  return result.document;
}

test("every editor supply reaches its matching carried resource after the economy merge", () => {
  for (const type of Object.keys(ITEM_TYPES)) {
    const document = supplyMap(type),
      original = serializeMap(document);
    const battle = createMapPlaytest(document),
      before = carried(battle.units[0]);
    const next = actBattle(battle, { type: "loot", unitId: "player", groundId: `supply-${type}` });
    assert.equal(next.lastError, null, type);
    assert.deepEqual(
      carried(next.units[0]),
      { ...before, [type]: before[type] + 3 },
      `${type}: only the matching resource changes`,
    );
    const expectedInventory=structuredClone(battle.units[0].inventory);
    if(type==='ammo')expectedInventory['ammo:musket_75'].count+=3;
    assert.deepEqual(next.units[0].inventory,expectedInventory,"ammunition remains a physical stack; other supplies retain their own counts");
    assert.equal(next.groundItems.find((item) => item.id === `supply-${type}`).count, 0);
    assert.ok(
      actBattle(next, { type: "loot", unitId: "player", groundId: `supply-${type}` }).lastError,
      "a consumed supply cannot be collected twice",
    );
    assert.equal(
      serializeMap(document),
      original,
      "playtest looting leaves the authored map unchanged",
    );
  }
});

test("money remains inventory for treasury collection while authored supplies keep their type", () => {
  const amount = sectorCash("retiro"),
    cashId = "cash:retiro";
  let battle = createMapPlaytest(supplyMap());
  battle.groundItems.push({ id: cashId, type: "money", count: amount, x: 1, y: 2 });
  const before = carried(battle.units[0]);
  battle = actBattle(battle, { type: "loot", unitId: "player", groundId: cashId });
  assert.equal(battle.lastError, null);
  assert.deepEqual(
    carried(battle.units[0]),
    before,
    "pesos do not become boleadoras or other supplies",
  );
  assert.deepEqual(battle.units[0].inventory[cashId], { name: "Pesos", count: amount, weight: .01 });
  assert.equal(battle.groundItems.find((item) => item.id === cashId).count, 0);
  assert.equal(inventoryUsage(battle.units[0]).items.find(item=>item.item===`inventory:${cashId}`).slots,1);
  battle=validateBattleSnapshot(JSON.parse(JSON.stringify(battle)));
  battle = actBattle(battle, { type: "loot", unitId: "player", groundId: "supply-rations" });
  assert.equal(battle.lastError, null);
  assert.deepEqual(carried(battle.units[0]), { ...before, rations: before.rations + 3 });
  assert.deepEqual(
    battle.units[0].inventory[cashId],
    { name: "Pesos", count: amount, weight: .01 },
    "supply looting preserves the cash record",
  );
  const campaign = {
    pendingBattle: { sector: "retiro" },
    resources: { treasury: 1000 },
    operativeState: {},
    sectorStates: {},
    log: [],
    hour: 0,
  };
  collectSectorCash(campaign, battle);
  assert.equal(campaign.resources.treasury, 1000 + amount);
  assert.equal(battle.units[0].inventory[cashId], undefined);
  assert.equal(
    battle.units[0].rations,
    before.rations + 3,
    "treasury settlement does not consume supplies",
  );
  collectSectorCash(campaign, battle);
  assert.equal(campaign.resources.treasury, 1000 + amount, "the same pesos are credited once");
});

test("the merged scene draws one shared pickup marker per visible pile, including cash", async () => {
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { default: TacticalScene } = await import("../web/app/TacticalScene.tsx");
  const state = createMapPlaytest(supplyMap());
  state.units[0].facing=2;
  state.groundItems = [
    { id: "cash:retiro", type: "money", count: 100, x: 1, y: 2 },
    { id: "spent-cash", type: "money", count: 0, x: 2, y: 2 },
    ...Object.keys(ITEM_TYPES).map((type, index) => ({
      id: `supply-${type}`,
      type,
      count: 3,
      x: index + 2,
      y: 1,
    })),
  ];
  const markup = render(
    h(
      "svg",
      null,
      h(TacticalScene, {
        state,
        players: state.units,
        units: [],
        positions: {},
        poses: {},
        directions: {},
        reachable: [],
        sight: new Set(),
        revealed: new Set(),
        interactive: false,
        project: (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 }),
      }),
    ),
  );
  assert.equal((markup.match(/data-ground-equipment="true"/g)??[]).length,Object.keys(ITEM_TYPES).length+1,"each visible pile has one shared pickup marker; depleted cash has none");
  assert.equal((markup.match(/objeto\(s\)/g)??[]).length,Object.keys(ITEM_TYPES).length+1);
});

test("cash uses one finite pocket and retains its source through quantity and merge controls",()=>{
 const cash={item:'inventory:cash:retiro',name:'Pesos',count:110,weight:.01};
 const base={id:'carrier',hp:80,weapon:0,blade:0,rations:0,medkits:0,torches:0,boleadoras:0,ammo:0,inventory:{}};
 let unit=applyItemQuantity(base,cash);assert.equal(inventoryUsage(unit).used,1);
 const other={...cash,item:'inventory:cash:buenos_aires',count:90};unit=applyItemQuantity(unit,other);
 assert.equal(inventoryUsage(unit).used,2);assert.equal(equipmentStacksMerge(cash,other),false);assert.equal(equipmentStacksMerge(cash,{...cash,count:20}),true);
 const slots=inventoryUsage(unit).slots.filter(p=>p.entry);assert.equal(pocketMergeCount(unit,slots[0].id,slots[1].id),0);
 const full={...base,inventory:Object.fromEntries(Array.from({length:12},(_,i)=>[`letter-${i}`,{name:`Carta ${i}`,count:4,weight:.1}]))};
 assert.equal(inventoryUsage(full).free,0);const before=structuredClone(full);assert.throws(()=>applyItemQuantity(full,cash),/bolsillo|espacio/);assert.deepEqual(full,before);
});

test("only returned carriers settle cash; split sums settle once and clear held references",()=>{
 const amount=sectorCash('retiro'),key='cash:retiro';
 const make=()=>{const units=[40,amount-40].map((count,i)=>({id:String(i+1),side:'player',hp:80,inventory:{[key]:{name:'Pesos',count,weight:.01}},activeSlot:'item',activeItem:`inventory:${key}`,leftHandItem:`inventory:${key}`,pocketOrder:[{slotId:'small-1',item:`inventory:${key}`,index:0}]}));return {state:{pendingBattle:{sector:'retiro'},resources:{treasury:500},operativeState:Object.fromEntries(units.map(u=>[u.id,structuredClone(u)])),sectorStates:{},log:[],hour:0},snapshot:{units,groundItems:[{id:key,type:'money',count:0}],returnLedger:{entries:units.map(u=>({unitId:u.id,kind:'resident'}))}}};};
 for(const kind of ['captured','dispersed','dead']){const {state,snapshot}=make();snapshot.returnLedger.entries[0].kind=kind;collectSectorCash(state,snapshot);assert.equal(state.resources.treasury,500);assert.equal(snapshot.units[0].inventory[key].count,40);}
 const {state,snapshot}=make();snapshot.returnLedger.entries[0].kind='departed';collectSectorCash(state,snapshot);assert.equal(state.resources.treasury,500+amount);
 for(const u of [...snapshot.units,...Object.values(state.operativeState)]){assert.equal(u.inventory[key],undefined);assert.equal(u.activeSlot,'unarmed');assert.equal(u.activeItem,undefined);assert.equal(u.leftHandItem,null);assert.deepEqual(u.pocketOrder,[]);}
 collectSectorCash(state,snapshot);assert.equal(state.resources.treasury,500+amount);
});

test("sector cash spawns on clear ground beside its collector after furniture migration", () => {
  for (const sector of MAP_IDS.filter((id) => sectorCash(id) > 0)) {
    const state = enterSector({
      sector,
      squad: [{ id: "collector" }],
      enemies: [],
      exploration: true,
    });
    const cash = state.groundItems.find((item) => item.type === "money");
    assert.ok(cash, `${sector}: cash exists`);
    assert.equal(propBlocksAt(state, cash.x, cash.y), false, `${sector}: no furniture overlap`);
    assert.equal(
      state.tiles.find((tile) => tile.x === cash.x && tile.y === cash.y)?.blocked,
      false,
    );
    assert.ok(!state.units.some((unit) => unit.x === cash.x && unit.y === cash.y));
    const collector = state.units.find((unit) => unit.id === "collector");
    assert.equal(
      Math.abs(cash.x - collector.x) + Math.abs(cash.y - collector.y),
      1,
      `${sector}: cash remains within looting distance`,
    );
  }
});
