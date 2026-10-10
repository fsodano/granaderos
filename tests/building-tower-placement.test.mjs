import {wallEdgeEndpoints} from '../game/wall-geometry.js';
import { register } from "node:module";
register("./tactical-render-loader.mjs", import.meta.url);
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup as render } from "../web/node_modules/react-dom/server.node.js";
import { blankMap } from "../game/map-schema.js";
import { applyMapCommands } from "../game/map-commands.js";
import { entranceFrame } from "../game/building-profile.js";
import { compileMap } from "../game/compile-map.js";
const { buildingDetails } = await import("../web/app/TacticalBuildingDetails.tsx");
const project = (x, y) => ({ x: (x - y) * 26, y: (x + y) * 14 });
function edit(document, commands) {
  const result = applyMapCommands(document, commands);
  assert.deepEqual(result.errors, []);
  return result.document;
}
function fixture(width = 3, height = 3) {
  return edit(blankMap({ width: 24, height: 24 }), [
    { type: "addBuilding", building: { id: "church", kind: "church", x: 3, y: 3, width, height } },
  ]);
}
function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  return node?.props ? [node, ...descendants(node.props.children)] : [];
}
function tower(document) {
  const b = compileMap(document).buildings[0],
    before = JSON.stringify(document);
  const detail = buildingDetails(b, new Set(), project);
  assert.ok(!/NaN|Infinity/.test(detail.map((o) => render(o.node)).join("")));
  assert.equal(JSON.stringify(document), before, "rendering does not change authored tiles");
  return detail
    .flatMap((o) => descendants(o.node))
    .find((node) => node.props.label === "square-bell-tower");
}
function cornerEdges(document,point){return document.buildings[0].walls.filter(edge=>wallEdgeEndpoints(edge).some(p=>Math.abs(p.x-point.x)<1e-8&&Math.abs(p.y-point.y)<1e-8));}
function editCorner(document,point,wallType){return cornerEdges(document,point).map(edge=>({type:"setWall",buildingId:"church",x:edge.x,y:edge.y,axis:edge.axis,wallType,...(wallType==="door"?{doorId:`${edge.id}:door`}:{})}));}
function assertSolidFoundation(document,node){
 assert.ok(node,"two incident wall edges support a tower");
 const xs=node.props.points.map(p=>p.x),ys=node.props.points.map(p=>p.y),f=entranceFrame(document.buildings[0]);
 const corners=[f.at(0,0),f.at(f.width,0)];
 assert.ok(corners.some(c=>c.x>=Math.min(...xs)&&c.x<=Math.max(...xs)&&c.y>=Math.min(...ys)&&c.y<=Math.max(...ys)&&cornerEdges(document,c).length===2&&cornerEdges(document,c).every(w=>w.type==="wall")),"the tower has a complete supported corner");
 const map=compileMap(document);assert.ok(map.tiles.filter(t=>t.buildingId==='church').every(t=>t.type==='floor'&&!t.blocked),'edge supports do not occupy floor cells');
}

test("a minimum-size church uses an edge-supported corner through all rotations", () => {
  let document = fixture();
  for (let turn = 0; turn < 4; turn++) {
    const node = tower(document);
    assertSolidFoundation(document, node);
    assert.ok(
      Math.abs(
        Math.max(...node.props.points.map((p) => p.x)) -
          Math.min(...node.props.points.map((p) => p.x)) -
          0.8,
      ) < 1e-8,
    );
    document = edit(document, [{ type: "rotateObject", id: "church" }]);
  }
});

test("a corner door or window moves the fallback tower onto the other solid corner", () => {
  for (const wallType of ["door", "window"]) {
    let document = fixture(5, 5);
    const f = entranceFrame(document.buildings[0]),
      occupiedCorner = f.at(f.width, 0),
      other = f.at(0, 0);
    document = edit(document, editCorner(document,occupiedCorner,wallType));
    const node = tower(document);
    assertSolidFoundation(document, node);
    assert.ok(
      node.props.points.every(
        (p) => Math.abs(p.x - other.x) <= 0.401 && Math.abs(p.y - other.y) <= 0.401,
      ),
    );
    for (let turn = 0; turn < 4; turn++) {
      assertSolidFoundation(document, tower(document));
      document = edit(document, [{ type: "rotateObject", id: "church" }]);
    }
  }
});

test("a church with no solid front corner omits its tower and retains both openings", () => {
  let document = fixture();
  const f = entranceFrame(document.buildings[0]);
  const corners = [f.at(0, 0), f.at(f.width, 0)];
  document = edit(
    document,
    corners.flatMap((p,i)=>editCorner(document,p,i?"door":"window")),
  );
  const before = JSON.stringify(document);
  assert.equal(tower(document), undefined);
  assert.equal(JSON.stringify(document), before);
  for(const p of corners)assert.ok(cornerEdges(document,p).every(w=>["door","window"].includes(w.type)));
});
