import test from "node:test";
import assert from "node:assert/strict";
import { BUILDING_TEMPLATES } from "../game/map-templates.js";
import { blankMap, serializeMap, validateMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
import { compileMap, reachableMap } from "../game/compile-map.js";
import { wallEdgeCells, wallEdgeCenter, wallEdgeEndpoints } from '../game/wall-geometry.js';
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
  "deposito",
  "estancia",
];
const key = ({ x, y }) => `${x},${y}`;
const perimeterEdge = (w,b) => w.axis==='x' ? w.y===b.y || w.y===b.y+b.height : w.x===b.x || w.x===b.x+b.width;
const pointWalls = (b,p) => b.walls.filter(w=>{
 const [a,c]=wallEdgeEndpoints(w);
 return w.axis==='x' ? Math.abs(p.y-a.y)<1e-8 && p.x>=a.x-1e-8 && p.x<=c.x+1e-8 : Math.abs(p.x-a.x)<1e-8 && p.y>=a.y-1e-8 && p.y<=c.y+1e-8;
}).sort((a,c)=>Math.hypot(wallEdgeCenter(a).x-p.x,wallEdgeCenter(a).y-p.y)-Math.hypot(wallEdgeCenter(c).x-p.x,wallEdgeCenter(c).y-p.y)||(a.type==='wall'?-1:c.type==='wall'?1:0));
const pointWall=(b,p)=>pointWalls(b,p)[0];
const pointsCenter = points => ({x:points.reduce((v,p)=>v+p.x,0)/points.length,y:points.reduce((v,p)=>v+p.y,0)/points.length});
// Historical support coordinates named perimeter cells. Convert each side to a
// canonical edge without turning that cell into a collision obstacle.
const formerPerimeterEdge = (b,x,y) => y===b.y ? {x,y,axis:'x'} : y===b.y+b.height-1 ? {x,y:y+1,axis:'x'} : x===b.x ? {x,y,axis:'y'} : {x:x+1,y,axis:'y'};
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

test("the fourteen architecture templates have distinct footprints and usable furnished layouts", () => {
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
        walls: b.walls.map(({ x, y, axis, type }) => [x, y, axis, type]).sort(),
        props: props.map(({ x, y, type, footprint }) => [x, y, type, footprint]).sort(),
      }),
    );
    assert.ok(props.length >= 3, `${name}: furnished interior`);
  }
  assert.equal(footprints.size, names.length, "each footprint is distinct");
  assert.equal(layouts.size, names.length, "layouts do not differ only by names or materials");
  assert.equal(kinds.size, names.length, "each building has an architectural role");
});

test("depot and farmhouse add distinct work and domestic rooms with clear facade supports", () => {
  const requirements = {
    deposito: {
      previous: "almacen",
      rooms: [
        ["Sala de mercaderías", ["barrels", "chest", "hay"]],
        ["Contaduría", ["table", "chest"]],
        ["Depósito seguro", ["chest", "barrels"]],
      ],
      doors: [
        [4, 9],
        [8, 9],
      ],
      supports: [
        [0, 9],
        [2, 9],
        [6, 9],
        [10, 9],
        [12, 9],
      ],
    },
    estancia: {
      previous: "casa",
      rooms: [
        ["Dormitorio familiar", ["bed", "chest"]],
        ["Despensa", ["barrels", "chest", "table"]],
        ["Sala familiar", ["table", "bench", "chest", "barrels"]],
      ],
      doors: [[5, 7]],
      supports: [
        [0, 7],
        [3, 7],
        [7, 7],
        [10, 7],
        [10, 0],
        [10, 3],
        [0, 1],
        [10, 1],
      ],
    },
  };
  for (const [name, requirement] of Object.entries(requirements)) {
    const map = compileMap(fixture(name)),
      b = map.buildings[0];
    assert.equal(b.rooms.length, requirement.rooms.length, `${name}: separate functional rooms`);
    assert.ok(
      b.rooms.length > BUILDING_TEMPLATES[requirement.previous].building.rooms.length,
      `${name}: adds a different plan without replacing the smaller template`,
    );
    for (const [roomName, types] of requirement.rooms) {
      const room = b.rooms.find((r) => r.name === roomName);
      assert.ok(room, `${name}: ${roomName}`);
      const furnished = new Set(map.props.filter((p) => p.roomId === room.id).map((p) => p.type));
      for (const type of types) assert.ok(furnished.has(type), `${roomName}: ${type}`);
    }
    const template = BUILDING_TEMPLATES[name].building;
    const entrances = template.walls.filter(
      (w) => w.type === "door" && w.axis==="x" && w.y === template.height,
    );
    assert.deepEqual(entrances.map(({ x, y }) => [x, y]).sort(), requirement.doors.map(([x,y])=>[x,y+1]));
    assert.ok(
      entrances.every((w) => !w.open && !w.locked),
      "loading and household doors start closed and unlocked",
    );
    for (const [x, y] of requirement.supports)
      assert.equal(
        pointWall(template,wallEdgeCenter(formerPerimeterEdge(template,x,y)))?.type,
        "wall",
        `${name}: structural detail stays on a solid perimeter edge ${x},${y}`,
      );
  }
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
      front = template.building.height,
      entrance = template.building.walls.find((w) => w.type === "door");
    assert.equal(entrance.x, Math.floor(template.building.width / 2));
    assert.equal(entrance.y, front, "primary entrance is on the perimeter");
    assert.equal(entrance.open, false, "entrance starts closed");
    for (const x of name === "palacio" ? [4, 6, 8, 10] : [0, 4, 8, 11])
      assert.equal(
        template.building.walls.find((w) => w.x === x && w.y === front)?.type,
        "wall",
        `${name}: facade support ${x},${front} has a solid wall edge`,
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
    const supportEdits=(document,offsets,style)=>{
      const b=document.buildings[0],frame=entranceFrame(b),edges=new Map();
      for(const offset of offsets){const u=Math.max(0,Math.min(frame.width,Math.round(frame.doorU+offset)));for(const edge of pointWalls(b,frame.at(u,0)).filter(edge=>edge.type==='wall'))edges.set(edge.id,edge);}
      return apply(document,[...edges.values()].map(({x,y,axis,id},i)=>({type:'setWall',buildingId:name,x,y,axis,wallType:style??(i%2?'door':'window'),doorId:`${id}:edited-door`})));
    };
    const edited=supportEdits(original,name==='palacio'?[-3,-1,1,3]:[-2,2]);
    const tiny = apply(blankMap({ width: 12, height: 12 }), [
      { type: "addBuilding", building: { id: name, kind, x: 3, y: 3, width: 3, height: 3 } },
    ]);
    for (const [caseName, first] of [
      ["authored", original],
      ["edited", edited],
      ["minimum", tiny],
      [
        "corner-door",
        apply(tiny, [{ type: "setWall", buildingId: name, x: 3, y: 6, axis: "x", wallType: "door" }]),
      ],
      ...(name === "palacio"
        ? [
            "left-only",
            "right-only",
          ].map((label) => [
            label,
            supportEdits(original,label==='left-only'?[1,3]:[-3,-1],'window'),
          ])
        : []),
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
            pointWall(b,at)?.type,
            "wall",
            `${name}: column is supported by a solid edge`,
          );
        }
        if (caseName === "authored" && ["south", "east"].includes(frame.side))
          assert.equal(columns.length, supportX.length, "authored facade has all intended columns");
        if (["minimum", "corner-door"].includes(caseName)) {
          const sides = new Set(
            [...markup.matchAll(/data-upper-window="([^:]+):/g)].map((m) => m[1]),
          );
          assert.equal(
            sides.size,
            2,
            "tiny shells keep upper windows on both visible facades, including corner entrance cadence",
          );
        }
        if (caseName === "edited") {
          assert.equal(columns.length, 0, `${name} ${rotation*90}° edited doors and windows remain unobstructed: ${columns}`);
          assert.ok(
            !markup.includes(
              `data-architectural-volume="${kind === "townhall" ? "townhall-clock-pediment" : "palace-portico-pediment"}"`,
            ),
            "unsupported pediment is omitted",
          );
        }
        if (["left-only", "right-only"].includes(caseName)) {
          const frontVisible = ["south", "east"].includes(frame.side);
          assert.equal(
            columns.length,
            frontVisible ? 2 : 0,
            "surviving one-sided support pair still renders",
          );
          assert.ok(
            !markup.includes('data-upper-balcony="palace"'),
            "one-sided support pair cannot carry the central balcony",
          );
          assert.ok(
            !markup.includes('data-upper-window="front:balcony"'),
            "unsupported upper balcony doorway is omitted",
          );
          if (frontVisible)
            assert.ok(
              markup.includes(`data-upper-window="front:${Math.round(frame.doorU)}"`),
              "ordinary upper window fills the unsupported central bay",
            );
        }
        document = apply(document, [{ type: "rotateObject", id: name }]);
      }
    }
  }
});

test("depot and farmhouse details stay on solid wall edges after rotation and opening edits", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { buildingDetails } = await import("../web/app/TacticalBuildingDetails.tsx");
  const { ArchitectureVolume } = await import("../web/app/TacticalBuildingVolumes.tsx");
  const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
  function volumes(node, result = []) {
    if (Array.isArray(node)) node.forEach((child) => volumes(child, result));
    else if (node && typeof node === "object") {
      if (node.type === ArchitectureVolume) result.push(node.props);
      volumes(node.props?.children, result);
    }
    return result;
  }
  for (const [name, kind] of [
    ["deposito", "depot"],
    ["estancia", "farmhouse"],
  ]) {
    const original = fixture(name),
      b = original.buildings[0];
    const perimeter = b.walls.filter(
      (w) =>
        w.type === "wall" &&
        perimeterEdge(w,b),
    );
    const cases = [
      ["authored", original],
      [
        "minimum",
        apply(blankMap({ width: 12, height: 12 }), [
          { type: "addBuilding", building: { id: name, kind, x: 3, y: 3, width: 3, height: 3 } },
        ]),
      ],
      ...["door", "window"].map((wallType) => [
        wallType,
        apply(original, [
          ...original.props.map((p) => ({ type: "deleteObject", id: p.id })),
          ...perimeter.map(({ x, y, axis }) => ({ type: "setWall", buildingId: name, x, y, axis, wallType, doorId:`${name}:edited:${axis}:${x}:${y}` })),
        ]),
      ]),
    ];
    for (const [caseName, first] of cases) {
      let document = first;
      for (let turn = 0; turn < 4; turn++) {
        const building = compileMap(document).buildings[0];
        const objects = buildingDetails(building, new Set(), project);
        const nodes = objects.map((o) => o.node),
          solids = volumes(nodes);
        const markup = render(h("svg", null, ...nodes));
        assert.ok(
          !/NaN|Infinity/.test(markup),
          `${name} ${caseName} ${turn * 90}°: finite geometry`,
        );
        for (const volume of solids.filter((v) => (v.bottom ?? 0) === 0)) {
          const center=pointsCenter(volume.points),nearby=building.walls.map(edge=>{const [a,c]=wallEdgeEndpoints(edge),p=edge.axis==='x'?{x:Math.max(a.x,Math.min(c.x,center.x)),y:a.y}:{x:a.x,y:Math.max(a.y,Math.min(c.y,center.y))};return {edge,p,distance:Math.hypot(p.x-center.x,p.y-center.y)};}).sort((a,b)=>a.distance-b.distance);
          assert.ok(nearby[0].distance<=.45,`${volume.label}: shallow support remains beside the wall`);
          assert.equal(pointWall(building,nearby[0].p)?.type,'wall',`${name} ${caseName} ${turn*90}°: ${volume.label} bears on a solid edge`);
          const xs=volume.points.map(p=>p.x),ys=volume.points.map(p=>p.y);
          assert.ok(Math.max(...xs)-Math.min(...xs)<1&&Math.max(...ys)-Math.min(...ys)<1,`${volume.label}: support has a compact footprint`);
        }
        if (["door", "window"].includes(caseName)) {
          assert.equal(
            solids.length,
            0,
            `${name} ${caseName} ${turn*90}° unsupported details disappear: ${solids.map(v=>v.label)}`,
          );
          assert.ok(
            !markup.includes('-canopy"'),
            "canopy disappears when no solid supports remain",
          );
        }
        if (caseName === "authored") {
          if (kind === "farmhouse") {
            const chimneys = solids.filter((v) => /^farmhouse-chimney-\d+$/.test(v.label ?? ""));
            assert.equal(
              chimneys.length,
              2,
              `${turn * 90}°: paired domestic chimneys remain present`,
            );
            for (const chimney of chimneys) {
              assert.equal(pointWall(building,pointsCenter(chimney.points))?.type,'wall','chimney bears on a solid wall edge');
            }
          }
          if (turn === 0) {
            assert.ok(
              markup.includes(
                kind === "depot" ? "depot-loading-canopy" : "farmhouse-gallery-canopy",
              ),
              "authored facade includes its canopy",
            );
            assert.ok(
              markup.includes(kind === "depot" ? "depot-loft-hoist" : "farmhouse-return-canopy"),
              "authored facade retains its distinctive detail",
            );
          }
          assert.deepEqual(
            buildingDetails(building, new Set(building.rooms.map((r) => r.id)), project),
            [],
            "details cut away with the interior",
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
      if (name === 'iglesia') {
        const b=map.buildings[0], corners=[[b.x-.5,b.y-.5],[b.x+b.width-.5,b.y-.5],[b.x-.5,b.y+b.height-.5],[b.x+b.width-.5,b.y+b.height-.5]];
        assert.ok(corners.some(([x,y])=>b.walls.filter(w=>w.type==='wall'&&wallEdgeEndpoints(w).some(p=>p.x===x&&p.y===y)).length===2),`${rotation*90}° tower has two incident solid perimeter edges`);
        assert.equal(map.tiles.filter(t=>t.buildingId===b.id).length,b.width*b.height,'the tower leaves the full floor footprint usable');
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

test("civic upper storeys preserve the ground-floor map through every reveal and rotation", async () => {
  const { register } = await import("node:module");
  register("./tactical-render-loader.mjs", import.meta.url);
  const { createElement: h } = await import("../web/node_modules/react/index.js");
  const { renderToStaticMarkup: render } =
    await import("../web/node_modules/react-dom/server.node.js");
  const { buildBuildingObjects } = await import("../web/app/TacticalBuildings.tsx");
  const { getBuildingProfile, getBuildingRenderProfile, entranceFrame } =
    await import("../game/building-profile.js");
  const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
  for (const [name, fullHeight, groundHeight] of [
    ["ayuntamiento", 118, 66],
    ["palacio", 124, 70],
  ]) {
    let document = fixture(name);
    const authored = serializeMap(document),
      originalIds = identities(document);
    for (let rotation = 0; rotation < 4; rotation++) {
      const state = compileMap(document),
        building = state.buildings[0];
      const beforeMap = JSON.stringify(state),
        beforeSource = serializeMap(document);
      const beforeRoutes = [...reachableMap(state, { x: 1, y: 1 })].sort();
      const profile = getBuildingProfile(building);
      assert.equal(profile.wallHeight, fullHeight);
      assert.equal(profile.groundFloorHeight, groundHeight);
      assert.equal(profile.floors, 2);
      assert.ok(
        !Object.hasOwn(building, "floors"),
        "storey count belongs to rendering, not map geometry",
      );
      assert.ok(
        !state.props.some((p) => /stairs|staircase/.test(p.type)),
        "upper storey adds no route or stairs",
      );
      const cases = [
        ["exterior", new Set()],
        ...building.rooms.map((room) => [`partial ${room.name}`, new Set([room.id])]),
        ["interior", new Set(building.rooms.map((room) => room.id))],
      ];
      for (const [mode, revealed] of cases) {
        const visibleProfile = getBuildingRenderProfile(building, revealed);
        const height = revealed.size ? groundHeight : fullHeight;
        assert.equal(visibleProfile.wallHeight, height);
        assert.equal(visibleProfile.floors, revealed.size ? 1 : 2);
        const objects = buildBuildingObjects({ state, project, light: () => 1, revealed });
        const markup = render(h("svg", null, ...objects.map((o) => o.node)));
        assert.ok(
          !/NaN|Infinity/.test(markup),
          `${name} ${rotation * 90}° ${mode}: finite geometry`,
        );
        let wallCount = 0,
          internalCount = 0;
        for (const object of objects) {
          const edgeId=object.node.props?.['data-wall-edge'];
          if (!edgeId) continue;
          const edge=state.wallEdges.find(w=>w.id===edgeId), {x,y}=edge;
          const perimeter = perimeterEdge(edge,building);
          const cut = object.node.props["data-cutaway"];
          const expectedHeight = cut ? 9 : perimeter ? height : groundHeight;
          assert.equal(
            object.node.props["data-wall-height"],
            expectedHeight,
            `${name} ${rotation * 90}° ${mode}: ${perimeter ? "exterior" : "partition"} ${x},${y}`,
          );
          assert.equal(
            object.node.props["data-visible-storeys"],
            !cut && perimeter && !revealed.size ? 2 : 1,
          );
          wallCount++;
          if (!perimeter) internalCount++;
        }
        assert.ok(
          wallCount > 0 && internalCount > 0,
          "actual outer walls and internal partitions were checked",
        );
        const roofHeights = [...markup.matchAll(/data-roof-base-height="([\d.]+)"/g)].map((m) =>
          Number(m[1]),
        );
        if (mode === "interior")
          assert.equal(roofHeights.length, 0, "full revelation removes all roof cover");
        else {
          assert.ok(roofHeights.length > 0, "unrevealed rooms retain their roof cover");
          assert.ok(
            roofHeights.every((z) => z === height + 1),
            "roof cover joins the effective wall height",
          );
        }
        if (revealed.size) {
          assert.ok(
            !objects.some((o) => o.key.startsWith("architecture-detail")),
            "upper windows and facade details cut away on partial and full reveal",
          );
          assert.ok(
            !/data-upper-storey|data-upper-window|data-storey-band|data-upper-balcony/.test(markup),
            "no upper facade remains over a revealed ground room",
          );
        } else {
          assert.match(
            markup,
            new RegExp(`data-upper-storey="${building.kind}"`),
            "exterior contains a distinct upper-storey group",
          );
          const windowSides = new Set(
            [...markup.matchAll(/data-upper-window="([^:]+):/g)].map((m) => m[1]),
          );
          const bandSides = new Set(
            [...markup.matchAll(/data-storey-band="([^\"]+)"/g)].map((m) => m[1]),
          );
          assert.equal(
            windowSides.size,
            2,
            "both visible facades have upper windows in every rotation",
          );
          assert.deepEqual(
            windowSides,
            bandSides,
            "storey bands follow the visible window facades",
          );
          const frontVisible = ["south", "east"].includes(entranceFrame(building).side);
          assert.equal(
            markup.includes('data-upper-balcony="palace"'),
            name === "palacio" && frontVisible,
            "palace balcony follows the front facade and camera orientation",
          );
        }
        assert.equal(
          JSON.stringify(state),
          beforeMap,
          "rendering preserves rooms, tiles, doors and furniture",
        );
        assert.equal(
          serializeMap(document),
          beforeSource,
          "rendering leaves the authoring document unchanged",
        );
        assert.deepEqual(
          [...reachableMap(state, { x: 1, y: 1 })].sort(),
          beforeRoutes,
          "rendering does not add or remove walking routes",
        );
      }
      assert.deepEqual(identities(document), originalIds, "visual storeys add no map identities");
      document = apply(document, [{ type: "rotateObject", id: name }]);
    }
    assert.equal(
      serializeMap({ ...document, revision: 0 }),
      serializeMap({ ...JSON.parse(authored), revision: 0 }),
      "four rotations retain the original single playable floor",
    );
  }
  for (const name of names.filter((id) => !["ayuntamiento", "palacio"].includes(id))) {
    const profile = getBuildingProfile(BUILDING_TEMPLATES[name].building);
    assert.equal(profile.floors, 1, `${name}: existing single-storey profile`);
    assert.equal(profile.groundFloorHeight, profile.wallHeight);
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

test('revealing either incident room lowers partitions and front edges while keeping rear edges and routes', async()=>{
 const {register}=await import('node:module');register('./tactical-render-loader.mjs',import.meta.url);
 const {createElement:h}=await import('../web/node_modules/react/index.js');
 const {renderToStaticMarkup:render}=await import('../web/node_modules/react-dom/server.node.js');
 const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
 for(const name of ['iglesia','cabildo']){
  let document=fixture(name);
  for(let rotation=0;rotation<4;rotation++){
   const state=compileMap(document),b=state.buildings[0],before=JSON.stringify(state),routes=[...reachableMap(state,{x:1,y:1})].sort();
   for(const room of b.rooms){
    const roomCells=new Set(room.cells.map(key)),objects=buildBuildingObjects({state,project:(x,y)=>({x:(x-y)*26,y:(x+y)*14}),light:()=>1,revealed:new Set([room.id])});
    let lowered=0,rear=0;
    for(const object of objects){
     const id=object.node.props?.['data-wall-edge'];if(!id)continue;
     const edge=state.wallEdges.find(w=>w.id===id);if(edge.buildingId!==b.id)continue;
     const perimeter=perimeterEdge(edge,b),front=edge.axis==='x'?edge.y===b.y+b.height:edge.x===b.x+b.width;
     const incident=wallEdgeCells(edge).some(c=>roomCells.has(key(c)));
     const expected=incident&&(front||!perimeter);
     assert.equal(object.node.props['data-cutaway'],expected,`${name} ${rotation*90}° ${room.id}: ${id}`);
     if(!perimeter&&incident)lowered++;
     if(perimeter&&!front){rear++;assert.match(render(h('svg',null,object.node)),/data-cutaway="false"/);}
    }
    assert.ok(lowered>0,`${name}: partition touches ${room.id}`);assert.ok(rear>0,'rear shell stays full height');
   }
   assert.equal(JSON.stringify(state),before,'rendering preserves edge state and floor membership');
   assert.deepEqual([...reachableMap(state,{x:1,y:1})].sort(),routes,'rendering preserves routes');
   document=apply(document,[{type:'rotateObject',id:name}]);
  }
 }
});
