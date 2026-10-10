import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,movementStepCost,environmentTargetAt,environmentPreview,environmentUsePreview,canSee,artilleryShotTrace} from '../game/tactical.js';
import {canWalkBetween} from '../game/tactical-space.js';
import {wallEdgeId,wallEdgeCells} from '../game/wall-geometry.js';
import {npcRoutes,runCivilianPhase} from '../game/npc-ai.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {visibleHover,targetPreview,isMovementGround,nearbyEnvironmentModel} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const wall=(extra={})=>({id:'divider',x:5,y:4,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,...extra});
function field(edges=[wall()],extra={}){
  const width=12,height=10,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
  return createBattle([{id:'p',x:4,y:4,facing:2}],{width,height,tiles,wallEdges:edges,enemies:[],exploration:true,...extra});
}
test('both incident cells support occupancy and a route goes around one blocked edge',()=>{
  const s=field(),u=s.units[0],to={x:5,y:4};
  assert.equal(s.tiles.find(t=>t.x===4&&t.y===4).blocked,false);
  assert.equal(s.tiles.find(t=>t.x===5&&t.y===4).blocked,false);
  assert.equal(movementStepCost(s,u,u,to),Infinity);assert.equal(canWalkBetween(s,u,to),false);
  const route=getReachable(s,u).find(t=>t.x===5&&t.y===4);assert.ok(route);assert.ok(route.path.length>1);
  const next=actBattle(s,{type:'move',unitId:'p',...to});assert.equal(next.lastError,null);assert.deepEqual([next.units[0].x,next.units[0].y],[5,4]);
  assert.equal(next.wallEdges[0].destroyed,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(next));
});
test('door commands operate on the edge while both adjacent cells stay free',()=>{
  let s=field([wall({type:'door',doorId:'leaf',cover:0,open:false,locked:false})],{npcs:[{id:'resident',x:5,y:4}]});
  const edge=s.wallEdges[0],point={...edge,wallEdgeId:wallEdgeId(edge)},ref=environmentTargetAt(s,point);
  assert.equal(environmentTargetAt(s,{x:5,y:4}),null,'a floor click does not choose an edge');
  assert.equal(ref.kind,'door');assert.equal(ref.id,'leaf');assert.equal(canSee(s,s.units[0],ref),true);
  assert.equal(environmentPreview(s,s.units[0],ref,'open').valid,true);
  assert.equal(isMovementGround(s,s.units[0],point),false);
  assert.equal(targetPreview(s,s.units[0],point).attackType,'environment');
  assert.equal(nearbyEnvironmentModel(s,s.units[0]).targets.some(t=>t.id==='leaf'),true);
  s=actBattle(s,{type:'door',unitId:'p',doorId:'leaf',open:true});assert.equal(s.lastError,null);
  assert.ok(Number.isFinite(movementStepCost(s,s.units[0],s.units[0],{x:5,y:4})));
  s=actBattle(s,{type:'door',unitId:'p',doorId:'leaf',open:false});assert.equal(s.lastError,null,'cell-center occupants do not occupy the door plane');
  assert.equal(s.wallEdges[0].open,false);assert.ok(s.tiles.every(t=>!t.blocked));
});
test('an approach to an edge ends on a supported incident cell',()=>{
  const s=field([wall({type:'door',doorId:'leaf',cover:0,open:false,locked:false})]);s.units[0].x=1;
  const ref=environmentTargetAt(s,{...s.wallEdges[0],wallEdgeId:'divider'}),preview=environmentUsePreview(s,s.units[0],ref,'open');
  assert.equal(preview.valid,true,preview.reason);assert.ok(preview.movePa>0);
  assert.ok(wallEdgeCells(s.wallEdges[0]).some(cell=>cell.x===preview.destination.x&&cell.y===preview.destination.y));
});
test('civilian routes cross usable doors and reject locked leaves without crossing walls',()=>{
  const edges=Array.from({length:10},(_,y)=>wall({id:`divider-${y}`,y,...(y===4?{type:'door',doorId:'leaf',cover:0,open:false,locked:false}:{})}));
  const s=field(edges,{npcs:[{id:'resident',x:4,y:5}]});s.units[0].x=1;
  const n=s.npcs[0],leaf=s.wallEdges.find(e=>e.type==='door');
  assert.equal(npcRoutes(s,n).records.has('6,5'),true);
  leaf.locked=true;assert.equal(npcRoutes(s,n).records.has('6,5'),false);
  leaf.locked=false;n.ai={cycle:0,homeId:null,activity:'working',wait:0,destination:{x:6,y:5}};
  for(let i=0;i<10&&n.x!==6;i++){s.elapsedSeconds+=6;runCivilianPhase(s);}
  assert.equal(leaf.open,true);assert.deepEqual([n.x,n.y],[6,5]);
});
test('solid cannon shots meet each thin edge once in physical order',()=>{
  const edges=[wall({id:'first',x:3,y:2,material:'wood'}),wall({id:'second',x:6,y:3,material:'stone'})],s=field(edges);
  const trace=artilleryShotTrace(s,s.units[0],{x:1,y:1,type:'bronze4'},{x:9,y:5});
  assert.equal(trace.events.filter(e=>e.edgeId==='first').length,1);
  assert.equal(trace.events.find(e=>e.edgeId==='first').type,'breach');
  assert.equal(trace.events.filter(e=>e.edgeId==='second').length,1);
  assert.equal(trace.events.find(e=>e.edgeId==='second').type,'stop');
  assert.ok(s.wallEdges.every(e=>!e.destroyed),'the forecast cannot damage walls');
});
test('public state reports only observed edges and retains precise environment IDs',()=>{
  const s=field([wall({type:'door',doorId:'leaf',cover:0,open:false,locked:false}),wall({id:'hidden',x:9,y:4})]);
  const known=playerKnownBattle(s);assert.ok(known.wallEdges.some(e=>e.id==='divider'));
  assert.equal(known.wallEdges.some(e=>e.id==='hidden'),false);
  assert.equal(known.environment.find(e=>e.id==='leaf').wallEdgeId,'divider');
});
