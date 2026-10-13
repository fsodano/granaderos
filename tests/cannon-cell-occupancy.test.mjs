import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,movementStepCost,artilleryContact,artilleryCrewPlan,artilleryCosts,teamCanSee} from '../game/tactical.js';
import {movementStep} from '../game/movement-step.js';
import {runBattleJob} from '../game/battle-job.js';
import {beginSectorDeployment,sectorDeploymentModel} from '../game/sector-deployment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spaceKey,tacticalLevel} from '../game/tactical-space.js';
import {ARTILLERY_OCCUPANCY_VERSION} from '../game/artillery-occupancy.js';
import {automaticOrder,searchOrder} from '../game/autonomous-orders.js';
import {npcRoutes} from '../game/npc-ai.js';
import {detentionManifest,placeDetainedPrisoners} from '../game/detention.js';
import {FINITE_ARTILLERY_ARSENALS,revealFiniteArsenal} from '../game/finite-artillery-arsenals.js';

// Declared small tactical arenas. These are structural mechanics checks, not
// campaign acquisition, historical victories or earned save fixtures.
const grid=(width=16,height=10)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const unit=(b,id='p')=>b.units.find(u=>u.id===id);
const point=p=>({x:p.x,y:p.y,tacticalLevel:tacticalLevel(p)});
function arena({squad=[{id:'p',x:1,y:2}],gun={x:4,y:2},...sector}={}){
 return createBattle(squad,{width:16,height:10,tiles:grid(),exploration:true,deferContact:true,enemies:[],seed:45,artillery:[{id:'gun',type:'swivel',side:'player',loaded:true,ammo:3,...gun}],...sector});
}
function refused(before,next){
 assert.ok(next.lastError);assert.deepEqual({...next,lastError:before.lastError,log:before.log},before,'refusal preserves all physical state, AP, energy, clock and RNG');
}
function routesAvoidGun(b,routes){
 for(const route of routes){assert.equal(b.artillery.some(g=>sameCell(g,route)),false);for(const step of route.path??[])assert.equal(b.artillery.some(g=>sameCell(g,step)),false);}
}

test('public walk previews and every planned step exclude the known cannon cell',()=>{
 const b=arena(),before=structuredClone(b),direct=getReachable(b,unit(b)),worker=runBattleJob({kind:'reachable-preview',battle:b,action:{unitId:'p'}});
 assert.ok(direct.some(p=>p.x===8&&p.y===2));routesAvoidGun(b,direct);routesAvoidGun(b,worker);
 assert.deepEqual(worker,direct);assert.equal(direct.some(p=>sameCell(p,b.artillery[0])),false);assert.deepEqual(b,before);
});

test('direct cannon-cell entry refuses without spending a cartridge, AP, energy, time or RNG',()=>{
 const b=arena(),before=structuredClone(b),gun=b.artillery[0];
 refused(b,actBattle(b,{type:'move',unitId:'p',x:gun.x,y:gun.y}));
 const step=movementStep(b,{type:'move',unitId:'p',x:gun.x,y:gun.y});assert.equal(step.status,'stopped');assert.equal(step.continuation,null);refused(b,step.state);
 assert.deepEqual(b,before);
});

test('a real cannon drag invalidates a previously admitted movement continuation atomically',()=>{
 const b=arena({squad:[{id:'p',x:1,y:2},{id:'q',x:3,y:4}],gun:{x:3,y:3}}),before=structuredClone(b),request={type:'move',unitId:'p',x:8,y:2};
 const first=movementStep(b,request);assert.equal(first.status,'moving');assert.deepEqual(point(unit(first.state)),{x:2,y:2,tacticalLevel:0});assert.deepEqual(point(first.continuation[0]),{x:3,y:2,tacticalLevel:0});
 const moved=actBattle(first.state,{type:'artilleryMove',unitId:'q',artilleryId:'gun',x:3,y:2});assert.equal(moved.lastError,null);
 assert.deepEqual(point(moved.artillery[0]),{x:3,y:2,tacticalLevel:0});assert.ok(moved.elapsedSeconds>first.state.elapsedSeconds);
 const reference=structuredClone(moved),stopped=movementStep(moved,request,first.continuation);assert.equal(stopped.status,'stopped');refused(reference,stopped.state);
 assert.deepEqual(moved,reference);assert.deepEqual(b,before);
});

test('an unseen opposing gun stays private in the worker preview but stops actual movement at its physical cell',()=>{
 const b=arena({squad:[{id:'p',x:1,y:2,facing:6}],gun:{x:6,y:2,side:'enemy'}}),before=structuredClone(b),gun=b.artillery[0],request={type:'move',unitId:'p',x:9,y:2};
 assert.equal(teamCanSee(b,'player',gun),false,'the declared opposing piece is behind the observer');
 const preview=runBattleJob({kind:'reachable-preview',battle:b,action:{unitId:'p'}}),without=structuredClone(b);without.artillery=[];
 assert.deepEqual(preview,runBattleJob({kind:'reachable-preview',battle:without,action:{unitId:'p'}}),'a preview cannot disclose a hidden physical blocker');
 assert.ok(preview.find(p=>p.x===9&&p.y===2).path.some(p=>sameCell(p,gun)));
 const next=actBattle(b,request);assert.equal(next.lastError,null);assert.deepEqual(point(unit(next)),{x:5,y:2,tacticalLevel:0});
 assert.deepEqual(unit(next).lastMovePath.map(point),[2,3,4,5].map(x=>({x,y:2,tacticalLevel:0})),'execution stops instead of choosing a secret detour');
 assert.ok(next.elapsedSeconds>b.elapsedSeconds);assert.ok(unit(next).energy<unit(b).energy);assert.deepEqual(next.artillery,b.artillery);
 for(const key of ['hp','loaded','ammo','inventory'])assert.deepEqual(unit(next)[key],unit(b)[key]);assert.equal(next.seed,b.seed);assert.deepEqual(b,before);
});

test('known guns block diagonal corner cutting while movementStepCost remains geometry-only',()=>{
 const b=arena({squad:[{id:'p',x:1,y:1}],gun:{x:2,y:1}}),before=structuredClone(b),destination={x:2,y:2};
 const geometric=movementStepCost(b,unit(b),unit(b),destination);assert.ok(Number.isFinite(geometric));
 const route=getReachable(b,unit(b)).find(p=>sameCell(p,destination));assert.ok(route);assert.ok(route.cost>geometric);routesAvoidGun(b,[route]);
 const stopped=movementStep(b,{type:'move',unitId:'p',...destination},[destination]);assert.equal(stopped.status,'stopped');refused(b,stopped.state);assert.deepEqual(b,before);
});

test('fresh placement and committed arrival deployment keep living people off the real gun cell at no movement cost',()=>{
 const squad=[{id:'p',x:0,y:4,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:4}}],b=arena({squad,gun:{x:0,y:4}}),gun=structuredClone(b.artillery[0]);
 assert.equal(b.artilleryOccupancyVersion,ARTILLERY_OCCUPANCY_VERSION);assert.equal(sameCell(unit(b),gun),false);assert.ok(Math.hypot(unit(b).x-gun.x,unit(b).y-gun.y)<=1.5);
 assert.equal(beginSectorDeployment(b,{squad}),true);const before=structuredClone(b),placed=actBattle(b,{type:'placeDeployment',unitIds:['p'],x:0,y:4});assert.equal(placed.lastError,null);assert.deepEqual(placed.units,b.units);
 assert.deepEqual(sectorDeploymentModel(placed).units.map(u=>u.id),['p']);
 const committed=actBattle(placed,{type:'confirmDeployment'});assert.equal(committed.lastError,null);assert.equal(sameCell(unit(committed),gun),false);assert.equal(unit(committed).x,0);
 assert.deepEqual(committed.artillery,[gun]);assert.equal(committed.elapsedSeconds,0);assert.equal(committed.seed,b.seed);assert.equal(unit(committed).ap,unit(b).ap);assert.equal(unit(committed).energy,unit(b).energy);assert.deepEqual(b,before);
 assert.doesNotThrow(()=>validateBattleSnapshot(committed));
});

test('all cannon work refuses a deliberately malformed current-version legacy shared-cell record',()=>{
 for(const type of ['artillery','artilleryReload','artilleryPivot','artilleryMove']){
  const b=arena({squad:[{id:'p',x:2,y:2}],gun:{x:2,y:3,loaded:type!=='artilleryReload'}});
  // Deliberately malformed raw input for refusal. This is not admitted as a save
  // and is never a positive current gameplay fixture.
  Object.assign(unit(b),point(b.artillery[0]));const before=structuredClone(b);
  assert.ok(artilleryCrewPlan(b,unit(b),b.artillery[0],artilleryCosts(b,unit(b),b.artillery[0]).fire).reason);
  refused(b,actBattle(b,{type,unitId:'p',artilleryId:'gun',x:type==='artilleryMove'?3:9,y:3}));assert.deepEqual(b,before);
 }
});

test('drag rejects a live outside body and another gun, but permits the selected crew to vacate a destination together',()=>{
 const b=arena({squad:[{id:'20',x:2,y:2},{id:'21',x:3,y:3},{id:'22',x:1,y:2}],gun:{type:'bronze4',x:2,y:3}}),request={type:'artilleryMove',unitId:'20',artilleryId:'gun',x:3,y:3};
 const crew=artilleryCrewPlan(b,unit(b,'20'),b.artillery[0],artilleryCosts(b,unit(b,'20'),b.artillery[0]).move);assert.equal(crew.reason,null);assert.deepEqual(crew.crew,['20','21']);
 for(const obstacle of ['npc','gun']){
  const blocked=structuredClone(b);if(obstacle==='npc')blocked.npcs.push({id:'outside',x:4,y:3,hp:100});else blocked.artillery.push({...blocked.artillery[0],id:'other',x:4,y:3});
  const before=structuredClone(blocked);refused(blocked,actBattle(blocked,request));assert.deepEqual(blocked,before);
 }
 const before=structuredClone(b),next=actBattle(b,request);assert.equal(next.lastError,null);assert.deepEqual(point(next.artillery[0]),{x:3,y:3,tacticalLevel:0});
 assert.deepEqual(point(unit(next,'20')),{x:3,y:2,tacticalLevel:0});assert.deepEqual(point(unit(next,'21')),{x:4,y:3,tacticalLevel:0});assert.deepEqual(unit(next,'22'),unit(b,'22'));
 for(const id of crew.crew)assert.equal(unit(next,id).ap,unit(b,id).ap-artilleryCosts(b,unit(b,'20'),b.artillery[0]).move);
 assert.equal(new Set([next.artillery[0],...next.units].map(spaceKey)).size,4);assert.deepEqual({...next.artillery[0],x:2,y:3},b.artillery[0]);assert.deepEqual(b,before);
});

test('a roof cell above a ground gun is a distinct legal surface and cannot supply ground cannon crew',()=>{
 const upperSurfaces=[3,4,5].map(x=>({id:`roof-${x}`,x,y:4,tacticalLevel:1,type:'floor',kind:'roof',blocked:false,cover:20,elevation:3}));
 const b=arena({squad:[{id:'p',x:3,y:4,tacticalLevel:1}],gun:{x:4,y:4},upperSurfaces}),before=structuredClone(b),route=getReachable(b,unit(b)).find(p=>p.x===4&&p.y===4&&tacticalLevel(p)===1);assert.ok(route);
 const next=actBattle(b,{type:'move',unitId:'p',x:4,y:4,tacticalLevel:1});assert.equal(next.lastError,null);assert.equal(sameCell(unit(next),next.artillery[0]),false);assert.equal(artilleryContact(next,unit(next),next.artillery[0]),false);
 assert.deepEqual(next.artillery,b.artillery);assert.doesNotThrow(()=>validateBattleSnapshot(next));assert.deepEqual(b,before);
});

test('civilian routes reserve gun cells',()=>{
 const b=arena({npcs:[{id:'civilian',name:'Vecino',x:1,y:5}]}),before=structuredClone(b),npc=b.npcs[0],routes=npcRoutes(b,npc);
assert.equal([...routes.records.values()].some(p=>sameCell(p,b.artillery[0])),false);
 for(const row of routes.records.values())for(const step of row.path)assert.equal(sameCell(step,b.artillery[0]),false);assert.deepEqual(b,before);
});

test('detention placement reserves a gun cell even when it is the captive retained coordinate',()=>{
 const b=arena({sector:'tucuman'}),before=structuredClone(b),manifest=detentionManifest({operativeState:{112:{captured:true,alive:true,capturedSector:'tucuman',capturedAt:18,hp:60,maxHp:64,energy:100,bleeding:0,bandaged:4}}},[{id:112,name:'Prisionero',maxHp:64}],'tucuman');
 Object.assign(manifest[0],point(b.artillery[0]));const original=structuredClone(manifest),next=placeDetainedPrisoners(b,manifest),prisoner=next.npcs[0];
 assert.equal(sameCell(prisoner,b.artillery[0]),false);for(const [key,value]of Object.entries(manifest[0]))if(!['x','y'].includes(key))assert.deepEqual(prisoner[key],value);assert.equal(prisoner.stance,'standing');assert.equal(prisoner.movementMode,'walk');assert.deepEqual(next.artillery,b.artillery);assert.deepEqual(next.units,b.units);assert.deepEqual(manifest,original);assert.deepEqual(b,before);
});

test('finite arsenal placement reserves a live civilian without changing the finite original gun records',()=>{
 const source=structuredClone(FINITE_ARTILLERY_ARSENALS.cordoba),b=arena({sector:'cordoba',artillery:[],npcs:[{id:'civilian',name:'Vecino',x:4,y:4}],props:[{id:source.chest,type:'chest',x:4,y:4,open:true,knownToPlayer:true,locked:false,blocksMovement:false}]});
 b.finiteArtilleryArsenal=source;const before=structuredClone(b),pieces=revealFiniteArsenal(b);assert.equal(pieces.length,source.pieces.length);
 assert.deepEqual(pieces.map(({x,y,...record})=>record),source.pieces);for(const piece of pieces)assert.equal(sameCell(piece,b.npcs[0]),false);
 assert.equal(new Set(pieces.map(spaceKey)).size,pieces.length);assert.deepEqual(b.npcs,before.npcs);assert.deepEqual(b.units,before.units);assert.equal(b.elapsedSeconds,before.elapsedSeconds);assert.equal(b.seed,before.seed);
});


test('automatic and public search proposals do not disclose an unseen opposing gun moved onto their baseline route',()=>{
 const b=arena({squad:[{id:'p',x:1,y:2,facing:6,medical:0}],gun:{x:12,y:8,side:'enemy'}}),before=structuredClone(b),search=searchOrder(b,unit(b)),automatic=automaticOrder(b,unit(b));
 assert.equal(search?.type,'move');assert.ok(automatic);assert.equal(teamCanSee(b,'player',b.artillery[0]),false);
 const path=runBattleJob({kind:'reachable-preview',battle:b,action:{unitId:'p'}}).find(p=>sameCell(p,search));assert.ok(path?.path.length);
 const index=path.path.findIndex(p=>Math.hypot(p.x-unit(b).x,p.y-unit(b).y)>2);assert.ok(index>0,'the hidden route obstruction is outside peripheral sight');
 const moved=structuredClone(b);Object.assign(moved.artillery[0],point(path.path[index]));assert.equal(teamCanSee(moved,'player',moved.artillery[0]),false);
 assert.deepEqual(searchOrder(moved,unit(moved)),search);assert.deepEqual(automaticOrder(moved,unit(moved)),automatic);
 const next=actBattle(moved,{type:'move',unitId:'p',x:search.x,y:search.y,...(search.tacticalLevel===undefined?{}:{tacticalLevel:search.tacticalLevel})});assert.equal(next.lastError,null);assert.deepEqual(point(unit(next)),point(path.path[index-1]));assert.equal(sameCell(unit(next),moved.artillery[0]),false);assert.deepEqual(next.artillery,moved.artillery);assert.ok(next.elapsedSeconds>moved.elapsedSeconds);
 assert.deepEqual(b,before);
});
