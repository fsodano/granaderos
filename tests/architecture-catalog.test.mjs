import test from "node:test";
import assert from "node:assert/strict";
import { BUILDING_TEMPLATES } from "../game/map-templates.js";
import { blankMap, serializeMap, validateMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
import { compileMap, reachableMap } from "../game/compile-map.js";
import { propBlocksAt, propCells } from "../game/props.js";

const names = [
  "posta",
  "barraca",
  "casa",
  "capilla",
  "iglesia",
  "cabildo",
  "pulperia",
  "almacen",
  "herreria",
  "caballeriza",
  "ayuntamiento",
  "palacio",
];
const key = ({ x, y }) => `${x},${y}`;
function apply(document, commands) {
  const result = applyMapCommands(document, commands);
  assert.deepEqual(result.errors, []);
  return result.document;
}
function fixture(name) {
  return apply(blankMap({ id: `architecture-${name}`, width: 32, height: 32 }), [
    { type: "stampTemplate", id: name, template: BUILDING_TEMPLATES[name], x: 3, y: 3 },
    {
      type: "addObject",
      layer: "spawns",
      object: { id: "review-player", side: "player", x: 1, y: 1 },
    },
  ]);
}
function identities(document) {
  return [
    ...document.buildings.flatMap((b) => [
      b.id,
      ...b.rooms.map((r) => r.id),
      ...b.walls.filter((w) => w.doorId).map((w) => w.doorId),
    ]),
    ...["features", "props", "items", "spawns", "exits", "lights"].flatMap((layer) =>
      document[layer].map((o) => o.id),
    ),
  ].sort();
}

test("the twelve architecture templates have distinct footprints and usable furnished layouts", () => {
  assert.deepEqual(Object.keys(BUILDING_TEMPLATES).sort(), [...names].sort());
  const footprints = new Set(),
    layouts = new Set(),
    kinds = new Set();
  for (const name of names) {
    const { building: b, props } = BUILDING_TEMPLATES[name];
    footprints.add(`${b.width}x${b.height}`);
    kinds.add(b.kind);
    // Compare only functional geometry and furniture, without names, IDs or paint.
    layouts.add(
      JSON.stringify({
        width: b.width,
        height: b.height,
        walls: b.walls.map(({ x, y, type }) => [x, y, type]).sort(),
        props: props.map(({ x, y, type, footprint }) => [x, y, type, footprint]).sort(),
      }),
    );
    assert.ok(props.length >= 3, `${name}: furnished interior`);
  }
  assert.equal(footprints.size, names.length, "each footprint is distinct");
  assert.equal(layouts.size, names.length, "layouts do not differ only by names or materials");
  assert.equal(kinds.size, names.length, "each building has an architectural role");
});

test("town hall and palace have separate functional rooms and a clear perimeter entrance", () => {
  const requirements = {
    ayuntamiento: [
      ["Secretaría municipal", ["table", "chest"]],
      ["Archivo municipal", ["table", "chest"]],
      ["Sala del concejo", ["table", "bench"]],
    ],
    palacio: [
      ["Cámara del gobernador", ["bed", "chest"]],
      ["Despacho privado", ["table", "chest"]],
      ["Cámara de huéspedes", ["bed", "chest"]],
      ["Salón de recepción", ["table", "bench", "chest"]],
    ],
  };
  for (const [name, rooms] of Object.entries(requirements)) {
    const map = compileMap(fixture(name)),
      b = map.buildings[0];
    assert.equal(b.rooms.length, rooms.length, `${name}: separate rooms for each use`);
    assert.notEqual(
      b.rooms.length,
      BUILDING_TEMPLATES.cabildo.building.rooms.length,
      "new civic layouts differ from the existing cabildo",
    );
    for (const [roomName, types] of rooms) {
      const room = b.rooms.find((r) => r.name === roomName);
      assert.ok(room, roomName);
      const furnished = new Set(map.props.filter((p) => p.roomId === room.id).map((p) => p.type));
      for (const type of types) assert.ok(furnished.has(type), `${roomName}: ${type}`);
    }
    const template = BUILDING_TEMPLATES[name],
      front = template.building.height - 1,
      entrance = template.building.walls.find((w) => w.type === "door");
    assert.equal(entrance.x, Math.floor(template.building.width / 2));
    assert.equal(entrance.y, front, "primary entrance is on the perimeter");
    assert.equal(entrance.open, false, "entrance starts closed");
    for (const x of name === "palacio" ? [4, 6, 8, 10] : [0, 4, 8, 11])
      assert.equal(
        template.building.walls.find((w) => w.x === x && w.y === front)?.type,
        "wall",
        `${name}: facade support ${x},${front} occupies a solid wall cell`,
      );
  }
});

test("formal civic details stay finite on tiny shells and leave edited openings clear", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { buildingDetails } = await import("../web/app/TacticalBuildingDetails.tsx");
  const { entranceFrame } = await import("../game/building-profile.js");
  const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
  for (const [name, kind, prefix, supportX] of [
    ["ayuntamiento", "townhall", "townhall-entrance-column", [4, 8]],
    ["palacio", "palace", "palace-portico-column", [4, 6, 8, 10]],
  ]) {
    const original = fixture(name);
    const edited = apply(
      original,
      supportX.map((x, i) => ({
        type: "setWall",
        buildingId: name,
        x: x + 3,
        y: BUILDING_TEMPLATES[name].building.height + 2,
        wallType: i % 2 ? "door" : "window",
      })),
    );
    const tiny = apply(blankMap({ width: 12, height: 12 }), [
      { type: "addBuilding", building: { id: name, kind, x: 3, y: 3, width: 3, height: 3 } },
    ]);
    for (const [caseName, first] of [
      ["authored", original],
      ["edited", edited],
      ["minimum", tiny],
    ]) {
      let document = first;
      for (let rotation = 0; rotation < 4; rotation++) {
        const b = compileMap(document).buildings[0],
          frame = entranceFrame(b),
          markup = render(
            h("svg", null, ...buildingDetails(b, new Set(), project).map((o) => o.node)),
          );
        assert.ok(
          !/NaN|Infinity/.test(markup),
          `${name} ${caseName} ${rotation * 90}° has finite geometry`,
        );
        const columns = [
          ...markup.matchAll(new RegExp(`data-architectural-volume="${prefix}-shaft-(\\d+)"`, "g")),
        ].map((m) => Number(m[1]));
        for (const u of columns) {
          const at = frame.at(u, 0);
          assert.equal(
            b.walls.find((w) => w.x === at.x && w.y === at.y)?.type,
            "wall",
            `${name}: column is supported by a solid cell`,
          );
        }
        if (caseName === "authored" && ["south", "east"].includes(frame.side))
          assert.equal(columns.length, supportX.length, "authored facade has all intended columns");
        if (caseName === "edited") {
          assert.equal(columns.length, 0, "edited doors and windows remain unobstructed");
          assert.ok(
            !markup.includes(
              `data-architectural-volume="${kind === "townhall" ? "townhall-clock-pediment" : "palace-portico-pediment"}"`,
            ),
            "unsupported pediment is omitted",
          );
        }
        document = apply(document, [{ type: "rotateObject", id: name }]);
      }
    }
  }
});

for (const name of names) {
  test(`${name}: all four rotations preserve walking routes, closed doors and object identity`, () => {
    let document = fixture(name);
    const original = serializeMap({ ...document, revision: 0 }),
      ids = identities(document);
    const roomSizes = compileMap(document)
      .buildings[0].rooms.map((r) => r.cells.length)
      .sort((a, b) => a - b);
    for (let rotation = 0; rotation < 4; rotation++) {
      assert.deepEqual(
        validateMap(document, { playable: true }).errors,
        [],
        `${rotation * 90}° map validation`,
      );
      const map = compileMap(document),
        open = reachableMap(map, { x: 1, y: 1 }),
        closed = reachableMap(map, { x: 1, y: 1 }, { openDoors: false });
      if (name === "iglesia") {
        const b = map.buildings[0],
          solid = new Set(b.walls.filter((w) => w.type === "wall").map(key));
        // The tower must stand over a reserved structural corner, never over a route.
        const corners = [
          [b.x, b.y],
          [b.x + b.width - 2, b.y],
          [b.x, b.y + b.height - 2],
          [b.x + b.width - 2, b.y + b.height - 2],
        ];
        assert.ok(
          corners.some(([x, y]) =>
            [
              [x, y],
              [x + 1, y],
              [x, y + 1],
              [x + 1, y + 1],
            ].every(([x, y]) => solid.has(key({ x, y }))),
          ),
          `${rotation * 90}° tower has a solid two-by-two foundation`,
        );
      }
      assert.deepEqual(
        map.buildings[0].rooms.map((r) => r.cells.length).sort((a, b) => a - b),
        roomSizes,
      );
      for (const room of map.buildings[0].rooms) {
        const free = room.cells.filter((c) => !propBlocksAt(map, c.x, c.y));
        assert.ok(free.length, `${room.id}: walking space`);
        for (const cell of free) {
          assert.ok(
            open.has(key(cell)),
            `${rotation * 90}° ${room.id}: outside route to ${key(cell)}`,
          );
          assert.ok(
            !closed.has(key(cell)),
            `${rotation * 90}° ${room.id}: closed entrance blocks ${key(cell)}`,
          );
        }
      }
      for (const prop of map.props) {
        assert.ok(
          propCells(prop).some((c) =>
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => open.has(key({ x: c.x + dx, y: c.y + dy }))),
          ),
          `${rotation * 90}° ${prop.id}: reachable use side`,
        );
      }
      assert.deepEqual(identities(document), ids, `${rotation * 90}° stable IDs`);
      document = apply(document, [{ type: "rotateObject", id: name }]);
    }
    assert.equal(
      serializeMap({ ...document, revision: 0 }),
      original,
      "four rotations restore exact geometry",
    );
    document = apply(document, [{ type: "moveObject", id: name, x: 15, y: 13 }]);
    assert.deepEqual(identities(document), ids, "moving preserves IDs");
    document = apply(document, [{ type: "moveObject", id: name, x: 3, y: 3 }]);
    assert.equal(
      serializeMap({ ...document, revision: 0 }),
      original,
      "round-trip move restores exact geometry",
    );
  });
}

test("repeated catalog stamps create independent buildings, doors, rooms and contents", () => {
  for (const name of names) {
    let document = fixture(name);
    document = apply(document, [
      {
        type: "stampTemplate",
        id: `second-${name}`,
        template: BUILDING_TEMPLATES[name],
        x: 17,
        y: 17,
      },
    ]);
    const ids = identities(document);
    assert.equal(new Set(ids).size, ids.length, `${name}: unique references`);
    const second = structuredClone(document.buildings[1]);
    const secondProps = structuredClone(
      document.props.filter((p) => p.id.startsWith(`second-${name}:`)),
    );
    document = apply(document, [
      { type: "rotateObject", id: name },
      { type: "deleteObject", id: name },
    ]);
    assert.deepEqual(document.buildings, [second], `${name}: deleting original retains copy`);
    assert.deepEqual(
      document.props,
      secondProps,
      `${name}: deleting original retains copied contents`,
    );
  }
});

test("church, chapel and chimneys retain their raised volumes in all rotations", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { buildBuildingObjects } = await import("../web/app/TacticalBuildings.tsx");
  const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
  for (const [name, volume] of [
    ["iglesia", "square-bell-tower"],
    ["capilla", "chapel-bellgable-body"],
    ["casa", "domestic-chimney"],
    ["herreria", "forge-chimney"],
  ]) {
    let document = fixture(name),
      rearViews = 0;
    for (let rotation = 0; rotation < 4; rotation++) {
      const state = compileMap(document),
        objects = buildBuildingObjects({ state, project, light: () => 1, revealed: new Set() });
      const markup = render(h("svg", null, ...objects.map((o) => o.node)));
      assert.match(
        markup,
        new RegExp(`data-architectural-volume="${volume}"`),
        `${name} ${rotation * 90}° raised silhouette`,
      );
      assert.ok(!/NaN|Infinity/.test(markup), `${name} ${rotation * 90}° finite coordinates`);
      const rear = objects.find((o) => o.key === `architecture-detail-back-${name}`);
      if (rear && ["iglesia", "capilla"].includes(name)) {
        rearViews++;
        assert.match(render(h("svg", null, rear.node)), /data-architecture-rear=/);
        assert.ok(
          rear.depth < objects.find((o) => o.key.startsWith("architecture-roof")).depth,
          "rear silhouette is placed behind the roof",
        );
      }
      const revealed = new Set(state.buildings[0].rooms.map((r) => r.id));
      const inside = buildBuildingObjects({ state, project, light: () => 1, revealed });
      assert.ok(
        !inside.some((o) => o.key.startsWith("architecture-detail")),
        "revelation removes tall details from the usable interior",
      );
      document = apply(document, [{ type: "rotateObject", id: name }]);
    }
    if (["iglesia", "capilla"].includes(name))
      assert.equal(rearViews, 2, `${name}: both back orientations retain the facade silhouette`);
  }
});

test("revealing either side of a partition lowers it without changing rear walls or collision", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { buildBuildingObjects } = await import("../web/app/TacticalBuildings.tsx");
  let diagonalJunctionChecks = 0;
  for (const name of ["iglesia", "cabildo"]) {
    let document = fixture(name);
    // Cabildo's partition ends on the exterior at local (4, 6). Both room
    // floors touch it diagonally; the partition fills its cardinal neighbour.
    let junction = { x: 7, y: 9 };
    let towerCorner = { x: 3, y: 14 };
    for (let rotation = 0; rotation < 4; rotation++) {
      const state = compileMap(document),
        b = state.buildings[0],
        before = JSON.stringify(state);
      const walls = new Map(
        state.tiles
          .filter((t) => ["wall", "window", "door"].includes(t.type))
          .map((t) => [key(t), t]),
      );
      for (const room of b.rooms) {
        const objects = buildBuildingObjects({
          state,
          project: (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 }),
          light: () => 1,
          revealed: new Set([room.id]),
        });
        let lowered = 0,
          fullRear = 0;
        for (const object of objects) {
          const match = /^architecture-(\d+)-(\d+)-([xy])$/.exec(object.key);
          if (!match) continue;
          const t = walls.get(`${match[1]},${match[2]}`),
            axis = match[3],
            markup = render(h("svg", null, object.node));
          if (
            name === "cabildo" &&
            t.x === junction.x &&
            t.y === junction.y &&
            ((axis === "x" && t.y === b.y + b.height - 1) ||
              (axis === "y" && t.x === b.x + b.width - 1))
          ) {
            assert.ok(
              !room.cells.some((c) => Math.abs(c.x - t.x) + Math.abs(c.y - t.y) === 1),
              "the regression case has no direct floor neighbour",
            );
            assert.ok(
              room.cells.some((c) => Math.abs(c.x - t.x) === 1 && Math.abs(c.y - t.y) === 1),
              "the floor touches the junction diagonally",
            );
            assert.match(
              markup,
              /data-cutaway="true"/,
              `${rotation * 90}° ${room.id}: exterior partition junction lowers`,
            );
            diagonalJunctionChecks++;
          }
          if (
            t.x > b.x &&
            t.x < b.x + b.width - 1 &&
            t.y > b.y &&
            t.y < b.y + b.height - 1 &&
            room.cells.some((c) => Math.abs(c.x - t.x) + Math.abs(c.y - t.y) === 1)
          ) {
            lowered++;
            assert.match(
              markup,
              /data-cutaway="true"/,
              `${name} ${rotation * 90}° ${room.id}: partition ${key(t)}`,
            );
          }
          if ((axis === "x" && t.y === b.y) || (axis === "y" && t.x === b.x)) {
            fullRear++;
            assert.match(
              markup,
              /data-cutaway="false"/,
              `${name} ${rotation * 90}°: rear exterior ${key(t)}`,
            );
          }
        }
        assert.ok(lowered > 0, `${name}: test covers a partition beside ${room.id}`);
        assert.ok(fullRear > 0, "test covers the rear shell");
      }
      if (name === "iglesia") {
        // The outer corner of the solid2x2 tower base has no adjacent room cell.
        assert.ok(
          !b.rooms.some((r) =>
            r.cells.some(
              (c) => Math.abs(c.x - towerCorner.x) <= 1 && Math.abs(c.y - towerCorner.y) <= 1,
            ),
          ),
        );
        const objects = buildBuildingObjects({
          state,
          project: (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 }),
          light: () => 1,
          revealed: new Set(b.rooms.map((r) => r.id)),
        });
        for (const axis of ["x", "y"]) {
          const object = objects.find(
            (o) => o.key === `architecture-${towerCorner.x}-${towerCorner.y}-${axis}`,
          );
          assert.ok(object, "the tower corner has both exterior faces");
          const front =
            axis === "x"
              ? towerCorner.y === b.y + b.height - 1
              : towerCorner.x === b.x + b.width - 1;
          assert.match(
            render(h("svg", null, object.node)),
            front ? /data-cutaway="true"/ : /data-cutaway="false"/,
            `${rotation * 90}° complete reveal lowers the solid front corner while retaining rear walls`,
          );
        }
      }
      assert.equal(
        JSON.stringify(state),
        before,
        "rendering preserves wall tiles, room cells and door state",
      );
      junction = { x: b.x + b.height - 1 - (junction.y - b.y), y: b.y + (junction.x - b.x) };
      towerCorner = {
        x: b.x + b.height - 1 - (towerCorner.y - b.y),
        y: b.y + (towerCorner.x - b.x),
      };
      document = apply(document, [{ type: "rotateObject", id: name }]);
    }
  }
  assert.equal(
    diagonalJunctionChecks,
    4,
    "both rooms and both front-facing junction orientations are covered",
  );
});
