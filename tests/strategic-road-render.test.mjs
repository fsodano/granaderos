import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from '../game/campaign.js';
import {ROAD_CELLS,ROAD_SEGMENTS,WORLD_CELLS,roadEdgesForCell,worldCell} from '../game/world-cells.js';
import {MAP_TILE_SIZE} from '../game/strategic-map.js';
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const noop=()=>{};
function map(t){
 const state=initialCampaign(),before=structuredClone(state);
 const dom=new JSDOM(render(h(StrategicMap,{state,selected:state.location,onSelect:noop,dispatch:noop})));
 t.after(()=>dom.window.close());assert.deepEqual(state,before);return dom.window.document;
}

test('visible roads follow each traversable shared edge through the physical cell centers',t=>{
 const doc=map(t),roads=[...doc.querySelectorAll('[data-road="true"]')];
 assert.equal(roads.length,ROAD_SEGMENTS.length);
 const expected=new Set(ROAD_SEGMENTS.map(({from,to})=>`${from}|${to}`));
 for(const path of roads){
  const from=path.getAttribute('data-road-from'),to=path.getAttribute('data-road-to');
  assert.ok(expected.delete(`${from}|${to}`),'each physical road segment appears exactly once');
  const a=worldCell(from),b=worldCell(to);assert.ok(a.land&&b.land);
  assert.equal(Math.abs(a.col-b.col)+Math.abs(a.row-b.row),1,'a road cannot skip a cell or cross a diagonal');
  const points=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.deepEqual(points,[a.x+MAP_TILE_SIZE/2,a.y+MAP_TILE_SIZE/2,b.x+MAP_TILE_SIZE/2,b.y+MAP_TILE_SIZE/2]);
 }
 assert.equal(expected.size,0);
});

test('road directions remain accessible and road paint leaves cell selection above the district fills',t=>{
 const doc=map(t),cells=[...doc.querySelectorAll('[data-map-cell]')];assert.equal(cells.length,WORLD_CELLS.length);
 const roads=doc.querySelector('.atlas-roads'),fills=doc.querySelector('.atlas-district-fills');
 assert.ok(fills.compareDocumentPosition(roads)&4,'roads remain visible above opaque city district fills');
 assert.equal(roads.getAttribute('pointer-events'),'none');
 const marked=new Set();
 for(const cell of cells){
  const id=cell.getAttribute('data-map-cell'),isRoad=ROAD_CELLS.has(id),label=cell.getAttribute('aria-label');
  assert.equal(cell.getAttribute('role'),'button');assert.ok(roads.compareDocumentPosition(cell)&4,'all cells keep their input surface above roads');
  assert.equal(cell.getAttribute('data-road-cell'),String(isRoad));assert.equal(cell.querySelector('title').textContent,label);
  if(isRoad){
   marked.add(id);assert.match(label,/Camino conectado al (norte|este|sur|oeste)/);
   assert.equal(cell.getAttribute('data-road-edges'),roadEdgesForCell(id).join(''));
  }else{assert.doesNotMatch(label,/Camino conectado/);assert.equal(cell.getAttribute('data-road-edges'),null);}
 }
 assert.deepEqual(marked,ROAD_CELLS);
 assert.equal(doc.querySelectorAll('[data-map-cell][aria-pressed="true"][tabindex="0"]').length,1);
 const help=doc.querySelector('.atlas-note .atlas-route-help');assert.ok(help,'the route help is available inside the command screen disclosure');
 assert.match(help.textContent,/menor tiempo/);assert.match(help.textContent,/caminos conectados son más rápidos/);
 assert.match(help.textContent,/misma ciudad: 1 h/);assert.match(help.textContent,/escalas para rodear patrullas conocidas/);
});
