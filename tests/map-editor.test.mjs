import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MAP_LIBRARY } from "../game/map-library.js";
import { blankMap, validateMap, serializeMap, parseMap } from "../game/map-schema.js";
import { compileMap } from "../game/compile-map.js";
import {
  applyMapCommands,
  buildingTemplate,
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
} from "../game/map-commands.js";
import { createMapPlaytest } from "../game/map-playtest.js";
import { actBattle } from "../game/tactical.js";
const execute = (d, commands) => {
  const result = applyMapCommands(d, commands);
  assert.deepEqual(result.errors, []);
  return result.document;
};
const house = () =>
  execute(blankMap(), [
    { type: "addBuilding", building: { id: "house", x: 3, y: 3, width: 6, height: 6 } },
  ]);
test("all converted sectors preserve terrain, room membership, props and lighting", () => {
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/map-migration-hashes.json", import.meta.url)),
  );
  for (const [id, d] of Object.entries(MAP_LIBRARY)) {
    assert.deepEqual(validateMap(d).errors, []);
    const m = compileMap(d);
    // Exclude new visual metadata; keep the original gameplay geometry reference unchanged.
    // Normalise derived room ordering without changing room membership.
    const data = {
      tiles: m.tiles
        .map((t) => Object.fromEntries(Object.entries(t).sort()))
        .sort((a, b) => a.y - b.y || a.x - b.x),
      buildings: m.buildings.map(
        ({ walls, wallFinish, roofFinish, doorStyle, windowStyle, kind, ...b }) => ({
          ...b,
          rooms: b.rooms.map((r) => ({
            ...r,
            cells: [...r.cells].sort((a, b) => a.y - b.y || a.x - b.x),
          })),
        }),
      ),
      props: m.props,
      lights: m.lights,
      decor: m.decor,
    };
    assert.equal(createHash("sha256").update(JSON.stringify(data)).digest("hex"), expected[id], id);
  }
});
test("commands are atomic, reject stale revisions and preserve exported data", () => {
  const d = house(),
    before = JSON.stringify(d);
  const failed = applyMapCommands(d, [
    { type: "paintTerrain", terrain: "road", cells: [{ x: 0, y: 0 }] },
    { type: "moveObject", id: "house", x: 19, y: 15 },
  ]);
  assert.ok(failed.errors.length);
  assert.equal(failed.document, d);
  assert.equal(JSON.stringify(d), before);
  assert.ok(applyMapCommands(d, [], { expectedRevision: 0 }).errors.length);
  const next = execute(d, [{ type: "paintTerrain", terrain: "road", cells: [{ x: 0, y: 0 }] }]);
  assert.equal(next.terrain[0].type, "road");
  assert.equal(next.revision, d.revision + 1);
  assert.equal(serializeMap(parseMap(serializeMap(next))), serializeMap(next));
});
test("moving and rotating buildings carries walls, doors, rooms and contents together", () => {
  let d = execute(house(), [
    { type: "addObject", layer: "props", object: { id: "bed", type: "bed", x: 4, y: 4 } },
    { type: "addObject", layer: "props", object: { id: "chest", type: "chest", x: 7, y: 4 } },
    {
      type: "addObject",
      layer: "items",
      object: { id: "rations", type: "rations", count: 5, x: 7, y: 4, containerId: "chest" },
    },
  ]);
  const door = d.buildings[0].walls.find((w) => w.type === "door").doorId;
  d = execute(d, [{ type: "moveObject", id: "house", x: 9, y: 3 }]);
  assert.deepEqual([d.props[0].x, d.props[0].y], [10, 4]);
  assert.equal(d.items[0].containerId, "chest");
  const before = serializeMap({ ...d, revision: 0 });
  for (let i = 0; i < 4; i++) d = execute(d, [{ type: "rotateObject", id: "house" }]);
  assert.equal(serializeMap({ ...d, revision: 0 }), before);
  assert.equal(d.buildings[0].walls.find((w) => w.type === "door").doorId, door);
});
test("partitions recompute rooms and door openings reconnect routes", () => {
  let d = house();
  d = execute(
    d,
    Array.from({ length: 4 }, (_, i) => ({
      type: "setWall",
      buildingId: "house",
      x: 5,
      y: 4 + i,
      wallType: "wall",
    })),
  );
  assert.equal(compileMap(d).buildings[0].rooms.length, 2);
  d = execute(d, [{ type: "setWall", buildingId: "house", x: 5, y: 5, wallType: "door" }]);
  assert.equal(d.buildings[0].rooms.length, 2);
  d = execute(d, [{ type: "setDoor", id: "house:door:5:5", open: true }]);
  assert.equal(compileMap(d).tiles.find((t) => t.x === 5 && t.y === 5).blocked, false);
});
test("templates and duplicated buildings remap object and container IDs", () => {
  let d = execute(house(), [
    { type: "addObject", layer: "props", object: { id: "chest", type: "chest", x: 4, y: 4 } },
    {
      type: "addObject",
      layer: "items",
      object: { id: "food", type: "rations", count: 3, x: 4, y: 4, containerId: "chest" },
    },
  ]);
  const template = buildingTemplate(d, "house");
  d = execute(d, [{ type: "stampTemplate", id: "copy", template, x: 10, y: 3 }]);
  assert.ok(d.items.some((i) => i.id === "copy:food" && i.containerId === "copy:chest"));
  d = execute(d, [{ type: "deleteObject", id: "copy" }]);
  assert.ok(!d.props.some((p) => p.id.startsWith("copy:")));
  assert.equal(d.terrain.find((t) => t.x === 10 && t.y === 3).type, "grass");
});
test("undo and redo restore one complete transaction with monotonic revisions", () => {
  const original = blankMap();
  let h = createHistory(original);
  h = editHistory(h, [
    {
      type: "paintTerrain",
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      terrain: "road",
    },
  ]);
  assert.equal(h.past.length, 1);
  h = undoHistory(h);
  assert.equal(h.document.terrain[0].type, "grass");
  const revision = h.document.revision;
  h = redoHistory(h);
  assert.equal(h.document.terrain[1].type, "road");
  assert.ok(h.document.revision > revision);
});
test("playtests preserve the map and correctly loot authored ground supplies", () => {
  let d = execute(blankMap(), [
    { type: "addObject", layer: "spawns", object: { id: "player", side: "player", x: 1, y: 1 } },
    {
      type: "addObject",
      layer: "items",
      object: { id: "food", type: "rations", count: 3, x: 2, y: 1 },
    },
  ]);
  const before = serializeMap(d),
    battle = createMapPlaytest(d),
    count = battle.units[0].rations;
  const next = actBattle(battle, { type: "loot", unitId: "player", groundId: "food" });
  assert.equal(next.lastError, null);
  assert.equal(next.units[0].rations, count + 3);
  assert.equal(serializeMap(d), before);
});
test("malformed geometry, overlap and invalid references are rejected", () => {
  for (const mutate of [
    (d) => (d.width = 999),
    (d) => (d.schemaVersion = 42),
    (d) => (d.terrain[0].x = -1),
    (d) => (d.terrain[0].blocked = "no"),
    (d) =>
      d.props.push({
        id: "bad",
        x: 1,
        y: 1,
        type: "bed",
        footprint: { width: 1, height: NaN },
        blocksMovement: true,
      }),
  ]) {
    const d = blankMap();
    mutate(d);
    assert.equal(validateMap(d).valid, false);
  }
  assert.ok(
    applyMapCommands(house(), [{ type: "addBuilding", building: { id: "overlap", x: 4, y: 4 } }])
      .errors.length,
  );
});

test("pointer projection remains correct with zoom, pan and letterboxing, and rejects outside drops", async () => {
  const { isometricCell } = await import("../game/map-editor-tools.js");
  const box = { left: 100, top: 100, width: 600, height: 500 },
    origin = { x: 476, y: 80 },
    bounds = { width: 20, height: 16 };
  for (const zoom of [1, 2, 3]) {
    const camera = { x: 160, y: 100, width: 1056 / zoom, height: 664 / zoom },
      scale = Math.min(box.width / camera.width, box.height / camera.height);
    const world = { x: origin.x + (8 - 6) * 26, y: origin.y + (8 + 6) * 14 };
    const client = {
      x: box.left + (box.width - camera.width * scale) / 2 + (world.x - camera.x) * scale,
      y: box.top + (box.height - camera.height * scale) / 2 + (world.y - camera.y) * scale,
    };
    if (client.x <= box.left + box.width && client.y <= box.top + box.height)
      assert.deepEqual(isometricCell(client, box, camera, origin, bounds), { x: 8, y: 6 });
    assert.equal(isometricCell({ x: 99, y: 300 }, box, camera, origin, bounds), null);
  }
});
test("seeded generation and command batches are deterministic", async () => {
  const { seededTerrainCommands } = await import("../game/map-editor-tools.js");
  const d = blankMap();
  assert.deepEqual(
    seededTerrainCommands(d, { seed: 1810 }),
    seededTerrainCommands(d, { seed: 1810 }),
  );
  assert.notDeepEqual(
    seededTerrainCommands(d, { seed: 1810 }),
    seededTerrainCommands(d, { seed: 1811 }),
  );
  assert.deepEqual(validateMap(execute(d, seededTerrainCommands(d, { seed: 1810 }))).errors, []);
});
test("oversized geometry and invalid templates fail before allocating geometry", () => {
  const d = blankMap();
  assert.throws(() => blankMap({ width: 1000000 }));
  assert.ok(
    applyMapCommands(d, [
      {
        type: "addBuilding",
        building: { id: "huge", x: 0, y: 0, width: 1000000, height: 1000000 },
      },
    ]).errors.length,
  );
  assert.ok(
    applyMapCommands(d, [
      {
        type: "stampTemplate",
        id: "huge",
        x: 0,
        y: 0,
        template: {
          version: 1,
          building: { x: 0, y: 0, width: 1000000, height: 1000000, walls: [], rooms: [] },
        },
      },
    ]).errors.length,
  );
  assert.ok(
    applyMapCommands(house(), [
      { type: "setWall", buildingId: "house", x: 4, y: 4, wallType: "window" },
    ]).errors.length,
  );
});

test("group transforms preserve child identity and rotate a non-square building exactly", async () => {
  const { selectionRoots } = await import("../game/map-commands.js");
  let d = execute(blankMap(), [
    { type: "addBuilding", building: { id: "wide", x: 3, y: 3, width: 8, height: 5 } },
    { type: "addObject", layer: "props", object: { id: "bed", type: "bed", x: 4, y: 4 } },
  ]);
  assert.equal(selectionRoots(d, ["wide", "bed"]).length, 1);
  const before = serializeMap({ ...d, revision: 0 });
  for (let i = 0; i < 4; i++)
    d = execute(d, [{ type: "transformSelection", ids: ["wide", "bed"], rotate: true }]);
  assert.equal(serializeMap({ ...d, revision: 0 }), before);
  d = execute(d, [{ type: "transformSelection", ids: ["wide", "bed"], dx: 2, dy: 1 }]);
  assert.deepEqual([d.props[0].x, d.props[0].y], [6, 5]);
});
test("bundled building templates compile with walkable furnished interiors", async () => {
  const { BUILDING_TEMPLATES } = await import("../game/map-templates.js");
  for (const template of Object.values(BUILDING_TEMPLATES)) {
    const d = execute(blankMap(), [
      { type: "stampTemplate", id: "instance", template, x: 3, y: 3 },
    ]);
    assert.ok(d.props.length > 0);
    assert.equal(validateMap(d).valid, true);
  }
});
test("all building types keep room floors reachable from an exterior start", async () => {
  const { BUILDING_TEMPLATES } = await import("../game/map-templates.js");
  const { reachableMap } = await import("../game/compile-map.js");
  assert.equal(Object.keys(BUILDING_TEMPLATES).length, 12);
  for (const [id, template] of Object.entries(BUILDING_TEMPLATES)) {
    const d = execute(blankMap({ width: 32, height: 32 }), [
      { type: "stampTemplate", id, template, x: 3, y: 3 },
      { type: "addObject", layer: "spawns", object: { id: "entry", side: "player", x: 1, y: 1 } },
    ]);
    assert.equal(validateMap(d, { playable: true }).valid, true);
    const map = compileMap(d),
      reached = reachableMap(map, { x: 1, y: 1 });
    for (const b of map.buildings)
      for (const room of b.rooms)
        assert.ok(
          room.cells.some((c) => reached.has(`${c.x},${c.y}`)),
          `${id}: inaccessible room`,
        );
  }
});
test("appearance edits preserve geometry, opening IDs, door state and survive round trips", () => {
  let d = execute(blankMap(), [
    {
      type: "addBuilding",
      building: {
        id: "house",
        x: 3,
        y: 3,
        width: 6,
        height: 6,
        wallFinish: "ochre",
        roofFinish: "aged",
        doorStyle: "double",
        windowStyle: "lattice",
      },
    },
  ]);
  assert.equal(d.buildings[0].windowStyle, "lattice");
  const door = d.buildings[0].walls.find((w) => w.type === "door");
  d = execute(d, [{ type: "setDoor", id: door.doorId, open: true, locked: true }]);
  const before = compileMap(d).tiles;
  d = execute(d, [
    {
      type: "setObject",
      id: "house",
      values: {
        wallFinish: "brick",
        roofFinish: "aged",
        doorStyle: "double",
        windowStyle: "shutters",
      },
    },
    { type: "setOpeningStyle", buildingId: "house", x: door.x, y: door.y, style: "arched" },
  ]);
  assert.deepEqual(
    compileMap(d).tiles.map(({ style, ...t }) => t),
    before,
  );
  const saved = parseMap(serializeMap(d));
  assert.equal(saved.buildings[0].wallFinish, "brick");
  assert.equal(saved.buildings[0].walls.find((w) => w.doorId === door.doorId).style, "arched");
  const moved = execute(saved, [{ type: "rotateObject", id: "house" }]);
  const movedDoor = moved.buildings[0].walls.find((w) => w.doorId === door.doorId);
  assert.equal(movedDoor.style, "arched");
  assert.equal(movedDoor.open, true);
  assert.equal(movedDoor.locked, true);
  assert.ok(
    applyMapCommands(d, [{ type: "setObject", id: "house", values: { wallFinish: "plastic" } }])
      .errors.length,
  );
  assert.ok(
    applyMapCommands(d, [
      { type: "setOpeningStyle", buildingId: "house", x: door.x, y: door.y, style: "shutters" },
    ]).errors.length,
  );
});
