import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {blankMap} from '../game/map-schema.js';
import {applyMapCommands} from '../game/map-commands.js';
import {compileMap} from '../game/compile-map.js';
import {BUILDING_TYPES} from '../game/building-types.js';
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});
function edit(doc,commands){const result=applyMapCommands(doc,commands);assert.deepEqual(result.errors,[]);return result.document;}
function fixture(){return edit(blankMap({width:18,height:18}),[{type:'addBuilding',building:{id:'custom',x:2,y:2,width:7,height:6,kind:'church',architecture:'church'}}]);}
function markup(doc){return render(h('svg',null,buildBuildingObjects({state:compileMap(doc),revealed:new Set(),project,light:()=>1}).map(o=>h('g',{key:o.key},o.node))));}

test('editor appearances modify the enlarged textured building without changing its collision plan',()=>{
 const doc=fixture(),before=compileMap(doc),base=markup(doc);
 const changed=edit(doc,[{type:'setObject',id:'custom',values:{wallFinish:'brick',roofFinish:'aged',doorStyle:'panelled',windowStyle:'lattice'}}]);
 const html=markup(changed),after=compileMap(changed);
 assert.match(base,/data-building-silhouette="church"/);assert.match(html,/data-building-silhouette="church"/);
 assert.match(html,/data-wall-finish="brick"/);assert.match(html,/architecture-finish-brick/);
 assert.match(html,/data-opening-style="panelled"/);assert.match(html,/data-roof-finish="aged"/);
 assert.match(html,/saturate\(\.55\) brightness\(\.84\)/);
 assert.ok(html.includes(`data-wall-height="${BUILDING_TYPES.church.height}"`));
 assert.notEqual(html,base);assert.deepEqual(after.tiles,before.tiles);assert.deepEqual(after.buildings[0].rooms,before.buildings[0].rooms);
 const wall=doc.buildings[0].walls.find(w=>w.type==='door');
 const individual=edit(changed,[{type:'setOpeningStyle',buildingId:'custom',x:wall.x,y:wall.y,style:'arched'}]);
 assert.match(markup(individual),/data-opening-style="arched"/);
 const straw=edit(changed,[{type:'setObject',id:'custom',values:{roofFinish:'thatch'}}]);
 assert.match(markup(straw),/fill="url\(#building-thatch\)"/);
});

test('changing a campaign building type removes the previous silhouette and preserves finish choices',()=>{
 let doc=edit(fixture(),[{type:'setObject',id:'custom',values:{wallFinish:'stone',kind:'farmhouse'}}]);
 assert.equal(doc.buildings[0].architecture,'farmhouse');assert.equal(doc.buildings[0].roof,'thatch');
 assert.match(markup(doc),/data-building-silhouette="farmhouse"/);assert.doesNotMatch(markup(doc),/data-building-silhouette="church"/);
 doc=edit(doc,[{type:'setObject',id:'custom',values:{kind:'palace'}}]);
 assert.equal(doc.buildings[0].architecture,undefined);assert.equal(doc.buildings[0].wallFinish,'stone');
 assert.match(markup(doc),/data-building-kind="palace"/);assert.doesNotMatch(markup(doc),/data-building-silhouette="farmhouse"/);
});
