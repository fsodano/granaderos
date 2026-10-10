import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as markup} from '../web/node_modules/react-dom/server.node.js';
import {buildBuilding as makeBuilding} from '../game/buildings.js';
import {createBattle,canSee} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {createSceneTerrainCache} from '../game/scene-terrain.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {presentWorld}=await import('../web/lib/three/presentation.ts');
const {createSectorWorld}=await import('../web/lib/three/sector-world.ts');
const {Scene}=await import('../web/node_modules/three/build/three.module.js');
const T=1.2360585147470482,project=(x,y)=>({x:(x-y)*26,y:(x+y)*14}),digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const privateIds=['private-door','private-wall','private-window'];
function shell(size=10){
 const built=makeBuilding({id:'closed-shell',x:3,y:3,width:5,height:5,doors:[]}),inside=[
  {id:'private-door',doorId:'inside-door',buildingId:'closed-shell',x:5,y:5,axis:'y',type:'door',open:false,locked:false,blocked:true,blocksSight:true,cover:0},
  {id:'private-wall',buildingId:'closed-shell',x:6,y:5,axis:'y',type:'wall',blocked:true,blocksSight:true,cover:40},
  {id:'private-window',buildingId:'closed-shell',x:5,y:6,axis:'x',type:'window',blocked:true,blocksSight:false,cover:25},
 ];
 built.building.walls.push(...inside.map(edge=>({...edge})));const floors=new Map(built.tiles.map(tile=>[`${tile.x},${tile.y}`,tile])),tiles=Array.from({length:size*size},(_,n)=>{const x=n%size,y=Math.floor(n/size);return floors.get(`${x},${y}`)??{x,y,type:'grass',blocked:false,cover:0};});
 return createBattle([{id:'observer',x:0,y:5}],{width:size,height:size,exploration:true,enemies:[],tiles,buildings:[built.building],wallEdges:[...built.wallEdges,...inside]});
}
function changed(state){
 const next=structuredClone(state);for(const id of privateIds){const edge=next.wallEdges.find(edge=>edge.id===id);if(edge.type==='door')Object.assign(edge,{open:true,locked:true,broken:true,structureDamage:65,blocked:false,blocksSight:false,trap:{type:'needle',armed:true},contents:[{item:'inventory:private',count:1}]});else Object.assign(edge,{type:'rubble',destroyed:true,structureDamage:100,blocked:false,blocksSight:false,cover:15});}return next;
}
const privateEdges=state=>state.wallEdges.filter(edge=>privateIds.includes(edge.id));
const input=(state,terrain=createSceneTerrainCache()(state))=>presentWorld(state,terrain,state.units.filter(actor=>actor.side==='player'),new Set(),[],0);
function svg(state,actors=false){return markup(h('svg',null,h(TacticalScene,{state,players:state.units.filter(actor=>actor.side==='player'),units:actors?state.units:[],positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project,interactive:false})));}
function assertHidden(state,ids=privateIds){for(const edge of state.wallEdges.filter(edge=>ids.includes(edge.id)))assert.equal(canSee(state,state.units[0],edge),false,edge.id+' remains unobserved');}

test('SVG closed shells conceal unobserved opening, damage and breach changes',()=>{
 const state=shell(),next=changed(state),before=JSON.stringify(state);assertHidden(state);assertHidden(next);assert.deepEqual(playerKnownBattle(next),playerKnownBattle(state));
 assert.equal(digest(svg(next)),digest(svg(state)),'SVG geometry must remain identical while all changed edges are unseen');assert.equal(JSON.stringify(state),before);
});

test('Three closed shells conceal unobserved opening, damage and breach records',()=>{
 const state=shell(),next=changed(state),before=JSON.stringify(state);assertHidden(state);assertHidden(next);
 assert.equal(digest(input(next).terrain.wallEdges),digest(input(state).terrain.wallEdges),'unseen live edge flags must not cross the Three presentation boundary');assert.equal(JSON.stringify(state),before);
});

test('unobserved owned geometry retains explicit authored height and cover metadata',()=>{
 const state=shell(),authored=state.buildings[0].walls.find(edge=>edge.id==='private-window'),live=state.wallEdges.find(edge=>edge.id===authored.id);Object.assign(authored,{obstacleHeight:1.7,cover:65,blocksSight:true});Object.assign(live,{obstacleHeight:1.7,cover:65,blocksSight:true});const next=changed(state);delete next.wallEdges.find(edge=>edge.id===authored.id).obstacleHeight;
 assertHidden(state,[authored.id]);assertHidden(next,[authored.id]);const before=input(state).terrain.wallEdges.find(edge=>edge.id===authored.id),after=input(next).terrain.wallEdges.find(edge=>edge.id===authored.id);assert.deepEqual(after,before);assert.equal(after.type,'window');assert.equal(after.obstacleHeight,1.7);assert.equal(after.cover,65);assert.equal(after.blocksSight,true);
});

test('SVG actor silhouettes use the same unobserved wall geometry as the facade',()=>{
 const state=shell(),wall={id:'hidden-back-wall',x:6,y:7,axis:'x',type:'wall',buildingId:'closed-shell',blocked:true,blocksSight:true,cover:40};state.wallEdges=state.wallEdges.filter(edge=>!privateIds.includes(edge.id));state.buildings[0].walls=state.buildings[0].walls.filter(edge=>!privateIds.includes(edge.id));state.wallEdges.push(wall);state.buildings[0].walls.push({...wall});Object.assign(state.units[0],{x:4,y:4,facing:0});
 const next=structuredClone(state);Object.assign(next.wallEdges.find(edge=>edge.id===wall.id),{type:'rubble',destroyed:true,structureDamage:100,blocked:false,blocksSight:false});assertHidden(state,[wall.id]);assertHidden(next,[wall.id]);
 const before=svg(state,true),after=svg(next,true);assert.match(before,/data-known-actor-silhouette="observer"/);assert.equal(digest(after),digest(before),'an unseen breach cannot change a visible actor silhouette');
});

test('unobserved standalone window rubble keeps the same opaque SVG and Three geometry',()=>{
 const state=shell(30),window={id:'standalone-window',x:24,y:22,axis:'x',type:'window',obstacleHeight:3.7,material:'wood',style:'arched',blocked:true,blocksSight:false,cover:25};state.wallEdges.push(window);const next=structuredClone(state),rubble=next.wallEdges.find(edge=>edge.id===window.id);Object.assign(rubble,{type:'rubble',destroyed:true,structureDamage:100,blocked:false,blocksSight:false,cover:15});delete rubble.obstacleHeight;
 assertHidden(state,[window.id]);assertHidden(next,[window.id]);assert.equal(digest(svg(next)),digest(svg(state)),'standalone hidden window destruction cannot change SVG art');
 const before=input(state).terrain.wallEdges.find(edge=>edge.id===window.id),after=input(next).terrain.wallEdges.find(edge=>edge.id===window.id);assert.deepEqual(after,before);assert.equal(before.type,'wall');assert.equal(before.obstacleHeight,2.5,'unobserved unauthored height remains stable');
});

test('observed opening and breached edges reach presentation exactly without mutating simulation',()=>{
 const state=shell(),next=changed(state);state.units[0].x=4;state.units[0].y=5;next.units[0].x=4;next.units[0].y=5;const before=JSON.stringify(next),world=input(next);
 for(const edge of privateEdges(next)){assert.equal(canSee(next,next.units[0],edge),true);assert.equal(world.terrain.wallEdges.find(record=>record.id===edge.id),edge,'observed edges retain the exact live record');}
 assert.notEqual(digest(svg(next)),digest(svg(state)),'observed changes must appear in SVG');assert.equal(JSON.stringify(next),before);
});

test('edge observation changes rebuild Three wall geometry even when raw terrain is retained',()=>{
 const state=shell(),next=changed(state),cache=createSceneTerrainCache(),scene=new Scene(),world=createSectorWorld(scene,{tileMetres:T,assetUrl:path=>path});
 try{
  world.update(input(state,cache(state)));const first=scene.getObjectByName('building:closed-shell');world.update(input(next,cache(next)));assert.equal(scene.getObjectByName('building:closed-shell')===first,true,'unobserved changes retain the same wall mesh');
  const moved=structuredClone(next);moved.units[0].x=4;moved.units[0].y=5;assert.equal(cache(moved),cache(next),'actor movement alone retains raw terrain');world.update(input(moved,cache(moved)));const seen=scene.getObjectByName('building:closed-shell');assert.notEqual(seen,first);assert.equal(seen.getObjectByName('door:inside-door').userData.open,true);assert.equal(seen.getObjectByName('door:inside-door').userData.broken,true);
 }finally{world.dispose();}
});

test('inactive player observers cannot disclose live edge state',()=>{
 for(const flags of [{hp:0},{unconscious:true},{routed:true},{surrendered:true},{fled:true},{departure:{edge:'west',destination:'other'}}]){
  const state=changed(shell());state.units[0].x=4;state.units[0].y=5;Object.assign(state.units[0],flags);const edge=input(state).terrain.wallEdges.find(edge=>edge.id==='private-door');assert.equal(edge.open,false,JSON.stringify(flags));assert.equal(edge.broken,undefined);assert.equal(edge.structureDamage,undefined);assert.equal(edge.destroyed,undefined);assert.equal(edge.trap,undefined);assert.equal(edge.contents,undefined);
 }
});

test('upper edge state follows actual shared sight and preserves its physical level',()=>{
 const state=shell(30),upper={id:'upper-door',doorId:'upper-door',x:24,y:22,axis:'x',tacticalLevel:1,elevation:4.3,obstacleHeight:3.7,type:'door',open:true,broken:true,structureDamage:65,blocked:false,blocksSight:false};state.wallEdges.push(upper);state.upperSurfaces=[{id:'upper-platform',x:24,y:21,tacticalLevel:1,elevation:4.3,type:'floor',kind:'floor',blocked:false,cover:0}];assertHidden(state,[upper.id]);
 const hidden=input(state).terrain.wallEdges.find(edge=>edge.id===upper.id);assert.equal(hidden.type,'wall');assert.equal(hidden.tacticalLevel,1);assert.equal(hidden.elevation,4.3);assert.equal(hidden.open,undefined);
 state.units.push({...state.units[0],id:'upper-observer',x:24,y:21,tacticalLevel:1});assert.equal(canSee(state,state.units[1],upper),true);assert.equal(input(state).terrain.wallEdges.find(edge=>edge.id===upper.id),upper);
});

test('no-actor catalogue inputs retain explicitly requested static opening geometry',()=>{
 const state=changed(shell());state.units=[];const before=JSON.stringify(state),world=input(state);assert.equal(world.terrain.wallEdges,state.wallEdges);assert.equal(world.terrain.wallEdges.find(edge=>edge.id==='private-door').open,true);assert.match(svg(state),/data-wall-edge="private-door"/);assert.equal(JSON.stringify(state),before);
});
