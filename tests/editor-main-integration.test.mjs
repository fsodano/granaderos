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

const resources = ["ammo", "priming", "flints", "rations", "boleadoras", "medkits", "torches"];
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
    assert.deepEqual(
      next.units[0].inventory,
      battle.units[0].inventory,
      "supplies do not become treasury inventory",
    );
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
  assert.deepEqual(battle.units[0].inventory[cashId], { count: amount, weight: 0 });
  assert.equal(battle.groundItems.find((item) => item.id === cashId).count, 0);
  battle = actBattle(battle, { type: "loot", unitId: "player", groundId: "supply-rations" });
  assert.equal(battle.lastError, null);
  assert.deepEqual(carried(battle.units[0]), { ...before, rations: before.rations + 3 });
  assert.deepEqual(
    battle.units[0].inventory[cashId],
    { count: amount, weight: 0 },
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

test("the merged scene draws cash once as a coin and ordinary editor items as bags", async () => {
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { default: TacticalScene } = await import("../web/app/TacticalScene.tsx");
  const state = createMapPlaytest(supplyMap());
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
  assert.equal((markup.match(/>\$<\/text>/g) ?? []).length, 1, "cash keeps one coin label");
  assert.equal((markup.match(/<title>100 pesos · Recoger<\/title>/g) ?? []).length, 1);
  const bags = [...markup.matchAll(/data-ground-item="([^\"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(
    bags.sort(),
    Object.keys(ITEM_TYPES)
      .map((type) => `supply-${type}`)
      .sort(),
    "each supply has one bag, and neither live nor spent money gets a duplicate bag",
  );
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
