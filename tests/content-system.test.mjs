import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultContentPackage,
  validateContentPackage,
  parseContentPackage,
  encodeContentPackage,
  resolveContent,
} from "../game/content-package.js";
import {
  createContentSession,
  advanceContentSession,
  setContentPersonStatus,
  encodeContentSession,
  decodeContentSession,
} from "../game/content-placement.js";
import { createContentTestRange } from "../game/content-test-range.js";
import { WEAPONS, actBattle, weaponFor, actionCosts } from "../game/tactical.js";
const fixture = () => {
  const d = defaultContentPackage();
  d.characters = d.characters.slice(0, 3);
  d.placements = [
    {
      id: "first",
      character: d.characters[0].id,
      mode: "once",
      sectors: ["salta", "cordoba"],
      moveChance: 100,
      afterDeath: null,
      delayMin: 0,
      delayMax: 0,
    },
    {
      id: "roamer",
      character: d.characters[1].id,
      mode: "daily",
      sectors: ["salta", "cordoba"],
      moveChance: 100,
      afterDeath: null,
      delayMin: 0,
      delayMax: 0,
    },
    {
      id: "successor",
      character: d.characters[2].id,
      mode: "once",
      sectors: ["salta", "cordoba"],
      moveChance: 100,
      afterDeath: d.characters[0].id,
      delayMin: 60,
      delayMax: 120,
    },
  ];
  return d;
};
test("default package round trips and resolves without mutable shared definitions", () => {
  const d = defaultContentPackage();
  assert.deepEqual(validateContentPackage(d), []);
  assert.deepEqual(parseContentPackage(encodeContentPackage(d)), d);
  const a = resolveContent(d),
    b = resolveContent(d);
  assert.throws(() => (a.characters[0].name = "Changed"));
  assert.notEqual(a, b);
  d.characters[0].name = "Changed";
  assert.notEqual(b.characters[0].name, d.characters[0].name);
});
test("imports reject broken references, IDs, cycles, values, sectors and unsafe portraits", () => {
  for (const mutate of [
    (d) => (d.characters[0].weapon = "missing"),
    (d) => (d.characters[0].id = "__proto__"),
    (d) => (d.characters[0].attributes.maxHp = -1),
    (d) => (d.characters[0].portrait = "javascript:alert(1)"),
    (d) => (d.weapons[0].fireAP = NaN),
    (d) => (d.placements[0].sectors = ["missing"]),
    (d) => (d.placements[0].afterDeath = d.characters[2].id),
    (d) => d.characters.push({ ...d.characters[0] }),
  ]) {
    const d = fixture();
    mutate(d);
    assert.ok(validateContentPackage(d).length);
    assert.throws(() => parseContentPackage(JSON.stringify(d)));
  }
  assert.throws(() => parseContentPackage("x".repeat(2_000_001)));
  assert.throws(() => parseContentPackage("null"));
});
test("permanent placement is chosen once; daily moves only start at 04:00", () => {
  const s = createContentSession(fixture(), 3),
    early = advanceContentSession(s, 239);
  assert.equal(s.rng, early.rng);
  const morning = advanceContentSession(early, 240);
  assert.notEqual(morning.rng, early.rng);
  assert.equal(morning.people["person-0"].sector, s.people["person-0"].sector);
  assert.deepEqual(s, createContentSession(fixture(), 3));
  assert.deepEqual(advanceContentSession(morning, 240), {
    ...morning,
    history: [...morning.history, { type: "advance", minute: 240, loadedSector: null }],
  });
});
test("loaded, recruited and dead people do not roam; destination cannot be loaded", () => {
  const d = fixture();
  let s = createContentSession(d, 9);
  const at = s.people["person-1"].sector;
  let n = advanceContentSession(s, 240, at);
  assert.equal(n.people["person-1"].sector, at);
  assert.equal(n.rng, s.rng);
  n = advanceContentSession(s, 240, at === "salta" ? "cordoba" : "salta");
  assert.equal(n.people["person-1"].sector, at);
  for (const status of ["recruited", "dead"]) {
    const stopped = setContentPersonStatus(s, "person-1", status);
    n = advanceContentSession(stopped, 240);
    assert.equal(n.rng, stopped.rng);
    assert.equal(n.people["person-1"].sector, stopped.people["person-1"].sector);
  }
});
test("death queues a single delayed arrival; repeated death never rerolls", () => {
  let s = createContentSession(fixture(), 123);
  assert.equal(s.people["person-2"].appeared, false);
  s = setContentPersonStatus(s, "person-0", "dead");
  const event = s.events[0],
    rng = s.rng;
  assert.ok(event.at >= 60 && event.at <= 120);
  let repeated = setContentPersonStatus(s, "person-0", "dead");
  assert.deepEqual(repeated.events, s.events);
  assert.equal(repeated.rng, rng);
  assert.equal(advanceContentSession(s, event.at - 1).people["person-2"].appeared, false);
  const arrived = advanceContentSession(s, event.at);
  assert.equal(arrived.people["person-2"].appeared, true);
  assert.equal(arrived.events.length, 0);
  assert.equal(arrived.people["person-2"].hp, s.people["person-2"].hp);
});
test("a dead successor is never resurrected by a scheduled arrival", () => {
  let s = createContentSession(fixture());
  s = setContentPersonStatus(s, "person-0", "dead");
  s = setContentPersonStatus(s, "person-2", "dead");
  s = advanceContentSession(s, 200);
  assert.equal(s.people["person-2"].alive, false);
  assert.equal(s.people["person-2"].sector, null);
});
test("saved test reproduces choices and subsequent days without rerolling", () => {
  let s = createContentSession(fixture(), 125);
  s = advanceContentSession(s, 240);
  s = setContentPersonStatus(s, "person-0", "dead");
  const restored = decodeContentSession(encodeContentSession(s));
  assert.deepEqual(restored, s);
  assert.deepEqual(advanceContentSession(restored, 5000), advanceContentSession(s, 5000));
  assert.throws(() =>
    decodeContentSession(
      '{"format":"granaderos-content-test","version":1,"history":[{"type":"cheat"}]}',
    ),
  );
});
test("new authored firearm affects real AP, firing and reload without catalog contamination", () => {
  const d = fixture(),
    base = structuredClone(WEAPONS);
  const original = d.weapons.find((w) => w.id === d.characters[0].weapon);
  d.weapons.push({
    ...original,
    id: "test-carbine",
    name: "Carabina de prueba",
    damage: 85,
    fireAP: 23,
    readyAP: 4,
    reloadAP: 29,
  });
  d.characters[0].weapon = "test-carbine";
  let b = createContentTestRange(d, d.characters[0].id, 18130203);
  let u = b.units[0];
  assert.equal(weaponFor(u).damage, 85);
  assert.equal(actionCosts(b, u).fire, 23);
  const before = u.ap;
  b = actBattle(b, { type: "fire", unitId: u.id, targetId: "target" });
  assert.equal(b.lastError, null);
  assert.equal(b.units[0].ap, before - 23);
  assert.equal(b.units[0].loaded, 0);
  b = actBattle(b, { type: "reload", unitId: u.id });
  assert.equal(b.lastError, null);
  assert.equal(b.units[0].loaded, 1);
  assert.equal(b.units[0].ammo, 19);
  assert.deepEqual(WEAPONS, base);
  const other = createContentTestRange(fixture(), "person-0");
  assert.notEqual(weaponFor(other.units[0]).damage, 85);
});
test("daily same-sector outcomes and zero move chance are valid; long advances match daily steps", () => {
  const d = fixture();
  d.placements[1].sectors = ["salta"];
  let s = createContentSession(d, 4);
  assert.equal(advanceContentSession(s, 240).people["person-1"].sector, "salta");
  const long = advanceContentSession(s, 3120);
  for (const time of [240, 1680, 3120]) s = advanceContentSession(s, time);
  assert.deepEqual(long.people, s.people);
  assert.equal(long.rng, s.rng);
  d.placements[1].moveChance = 0;
  s = createContentSession(d, 4);
  assert.equal(
    advanceContentSession(s, 240).people["person-1"].sector,
    s.people["person-1"].sector,
  );
});
test("invalid replay commands and clock/seed limits fail without changing the source", () => {
  const d = fixture(),
    s = createContentSession(d, 1),
    copy = structuredClone(s);
  assert.throws(() => advanceContentSession(s, -1));
  assert.throws(() => advanceContentSession(s, 525601));
  assert.throws(() => advanceContentSession(s, 240, "missing"));
  assert.throws(() => createContentSession(d, -1));
  assert.throws(() => createContentTestRange(d, "person-0", NaN));
  assert.throws(() => setContentPersonStatus(s, "missing", "dead"));
  const saved = JSON.parse(encodeContentSession(s));
  saved.history = [{ type: "advance", minute: Infinity }];
  assert.throws(() => decodeContentSession(JSON.stringify(saved)));
  assert.deepEqual(s, copy);
});

test("placement ranges use real map sectors across distant regions", () => {
  const d = fixture();
  d.placements[1].sectors = ["mendoza", "buenos_aires", "jujuy"];
  assert.deepEqual(validateContentPackage(d), []);
  let s = createContentSession(d, 19);
  for (let day = 0; day < 20; day++) {
    s = advanceContentSession(s, 240 + day * 1440);
    assert.ok(d.placements[1].sectors.includes(s.people["person-1"].sector));
  }
  assert.deepEqual(decodeContentSession(encodeContentSession(s)), s);
  d.placements[1].sectors = ["salta--north"];
  assert.ok(validateContentPackage(d).length);
});

test("every visible map cell can be selected independently and replayed", async () => {
  const { CONTENT_CELLS, contentCellIds, toggleContentCell } =
    await import("../game/content-map.js");
  assert.equal(CONTENT_CELLS.length, 36 * 33);
  assert.equal(new Set(CONTENT_CELLS.map((c) => c.id)).size, 36 * 33);
  const outside = CONTENT_CELLS.find((c) => !c.district);
  const far = CONTENT_CELLS.at(-1);
  const d = fixture();
  d.placements[1].sectors = [outside.id, far.id];
  assert.deepEqual(validateContentPackage(d), []);
  let state = createContentSession(d, 1234);
  for (let day = 0; day < 5; day++) state = advanceContentSession(state, 240 + 1440 * day);
  assert.ok(d.placements[1].sectors.includes(state.people["person-1"].sector));
  assert.deepEqual(decodeContentSession(encodeContentSession(state)), state);
  assert.deepEqual(toggleContentCell([outside.id], far.id), [outside.id, far.id]);
  assert.deepEqual(toggleContentCell([outside.id, far.id], outside.id), [far.id]);
  assert.throws(() => toggleContentCell([], "cell-36-0"));
  assert.deepEqual(contentCellIds(["mendoza"]), ["cell-6-25"]);
  d.placements[1].sectors = ["cell-0-33"];
  assert.ok(validateContentPackage(d).length);
});
