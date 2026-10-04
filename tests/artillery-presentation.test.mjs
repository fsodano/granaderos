import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,presentedEndTurn,endTurn,teamCanSee,artilleryCosts,ARTILLERY} from '../game/tactical.js';
import {captureBattlePresentation,recordBattleFrame,withBattleShotHand} from '../game/battle-presentation.js';
import {battleFrameDuration,battleFrameFocus,battleFramePose,artilleryFlightDuration} from '../game/battle-playback.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {artilleryField} from './artillery-autonomy-fixture.mjs';
const unit=(s,id)=>s.units.find(u=>u.id===String(id));
const order={type:'artillery',unitId:20,artilleryId:'gun',x:14,y:3,mode:'solid'};
function field(type='bronze4',extra={}){
 const tiles=Array.from({length:32*9},(_,n)=>({x:n%32,y:Math.floor(n/32),type:'grass',blocked:false,cover:0}));
 return createBattle([{id:20,x:1,y:2,facing:2},{id:21,x:2,y:2,facing:2},{id:22,x:1,y:3,facing:2}],{width:32,height:9,tiles,seed:45,enemies:[{id:'target',x:7,y:3,hp:200,maxHp:200,morale:100,patrol:false,overwatch:false},{id:'reserve',x:29,y:7,morale:100,patrol:false,overwatch:false}],artillery:[{id:'gun',type,x:2,y:3,side:'player',facing:0,loaded:true,ammo:4}],...extra});
}
const visuals=result=>result.frames.filter(frame=>frame.artilleryVisual);

test('each artillery family records one shot and real consequence without changing crew, RNG or saved outcomes',()=>{
 for(const type of Object.keys(ARTILLERY)){
  const state=field(type),before=structuredClone(state),result=presentedActBattle(state,order),expected=actBattle(state,order),flight=result.frames.find(frame=>frame.type==='projectile'),impact=result.frames.find(frame=>frame.type==='impact');
  assert.deepEqual(result.state,expected);assert.deepEqual(state,before);assert.equal(result.state.lastError,null,type);
  assert.equal(visuals(result).filter(frame=>frame.type==='projectile').length,1);assert.ok(impact);assert.equal(flight.state.artillery[0].loaded,false);assert.equal(unit(flight.state,'target').hp,200);assert.ok(unit(impact.state,'target').hp<200);
  const cost=artilleryCosts(state,unit(state,20),state.artillery[0]).fire;
  for(const id of [20,21,22].slice(0,ARTILLERY[type].crew)){assert.equal(unit(result.state,id).ap,unit(state,id).ap-cost);assert.deepEqual([unit(result.state,id).x,unit(result.state,id).y],[unit(state,id).x,unit(state,id).y]);}
  assert.equal(result.state.artillery[0].ammo,4);assert.equal(result.state.artillery[0].loaded,false);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(result.state))),result.state);
  const crewIds=['20','21','22'].slice(0,ARTILLERY[type].crew);for(const frame of result.frames.filter(frame=>frame.action==='artillery'))assert.deepEqual(frame.crewIds,crewIds);assert.equal(result.frames.some(frame=>frame.type==='crew'),false);
  assert.equal(flight.artilleryVisual.source.height,.65);assert.equal(flight.artilleryVisual.cannonId,'gun');assert.equal(flight.artilleryVisual.displayHeight,'ground-relative');assert.ok(flight.artilleryVisual.points.length>1);assert.equal(flight.artilleryVisual.impacts.length,0);
  assert.equal(impact.artilleryVisual.impacts[0].outcome,'hit');assert.equal(impact.artilleryVisual.impacts[0].victimId,undefined);assert.equal(impact.artilleryVisual.impacts[0].damage,undefined);
  assert.equal(battleFrameDuration(flight),artilleryFlightDuration(flight.artilleryVisual));assert.equal(battleFrameDuration(impact),900);assert.ok(result.frames.at(-1).artilleryComplete);assert.equal(battleFrameDuration(result.frames.at(-1)),0);assert.equal(battleFramePose(result.frames.at(-1)),'idle');
  assert.ok(battleFrameFocus(flight).x>unit(state,20).x);assert.equal(result.state.artilleryVisual,undefined);
 }
});

test('artillery breaches use actual changed terrain and its material, while display height remains ground relative',()=>{
 const state=field('field8');for(const tile of state.tiles)tile.elevation=1.7;
 for(const [x,material]of [[4,'adobe'],[5,'stone']])Object.assign(state.tiles.find(tile=>tile.x===x&&tile.y===3),{type:'wall',blocked:true,blocksSight:false,material});
 const result=presentedActBattle(state,order),flight=visuals(result)[0],impact=visuals(result)[1];assert.deepEqual(result.state,actBattle(state,order));assert.equal(flight.artilleryVisual.source.height,2.35);assert.ok(flight.artilleryVisual.points.every(point=>Math.abs(point.height-2.35)<1e-10));
 for(const x of [4,5])assert.equal(result.state.tiles.find(tile=>tile.x===x&&tile.y===3).type,'rubble');
 assert.deepEqual(impact.artilleryVisual.impacts.filter(point=>point.outcome==='cover').map(point=>[point.x,point.material]),[[4,'adobe'],[5,'stone']]);assert.equal(flight.state.tiles.find(tile=>tile.x===4&&tile.y===3).type,'wall');
});

test('canister admits actual impacts without any pellet or cannonball path',()=>{
 const state=field(),action={...order,mode:'canister',x:7},result=presentedActBattle(state,action);assert.deepEqual(result.state,actBattle(state,action));
 for(const frame of visuals(result)){assert.equal(frame.artilleryVisual.canister,true);assert.equal(frame.artilleryVisual.points,undefined);assert.equal(frame.artilleryVisual.impact,undefined);assert.equal(frame.artilleryVisual.destination,undefined);}
 assert.ok(result.frames.find(frame=>frame.type==='impact').artilleryVisual.impacts.length>0);assert.equal(result.state.artillery[0].loaded,false);
});

test('changing concealed bodies cannot change the public cannon path, endpoint, duration or contact cues',()=>{
 const make=x=>{const state=field('swivel');state.units=state.units.filter(body=>body.side==='player'||body.id==='reserve');for(const tile of state.tiles)if(tile.y===3&&tile.x>=4&&tile.x<=15)Object.assign(tile,{type:'forest',cover:100,concealment:100});state.npcs=x===null?[]:[{id:'reserve',name:'Civil secreto',x,y:3,hp:100,stance:'prone'}];return state;};
 const states=[make(null),make(12),make(14)],results=states.map(state=>presentedActBattle(state,order));
 for(const [index,state]of states.entries()){assert.deepEqual(results[index].state,actBattle(state,order));if(state.npcs.length){assert.equal(teamCanSee(state,'player',state.npcs[0]),false);assert.ok(results[index].state.npcs[0].hp<100);}}
 const publicRecord=result=>visuals(result).map(frame=>({type:frame.type,visual:frame.artilleryVisual,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)}));
 assert.deepEqual(publicRecord(results[1]),publicRecord(results[0]));assert.deepEqual(publicRecord(results[2]),publicRecord(results[0]));
 for(const result of results)for(const frame of visuals(result)){assert.equal(frame.artilleryVisual.impacts.length,0);assert.equal(JSON.stringify(frame.artilleryVisual).includes('Civil secreto'),false);assert.equal(frame.artilleryVisual.cells,undefined);assert.equal(frame.artilleryVisual.damage,undefined);}
});

test('the public trace stops at an observed fortification without executing another shot',()=>{
 const state=field('swivel'),wall=state.tiles.find(tile=>tile.x===5&&tile.y===3);Object.assign(wall,{type:'wall',blocked:true,blocksSight:false,material:'stone'});
 const result=presentedActBattle(state,order),flight=result.frames.find(frame=>frame.type==='projectile'),impact=result.frames.find(frame=>frame.type==='impact');assert.deepEqual(result.state,actBattle(state,order));assert.equal(flight.artilleryVisual.points.at(-1).x,5);assert.equal(flight.artilleryVisual.points.at(-1).y,3);assert.deepEqual(impact.artilleryVisual.impacts.map(point=>[point.x,point.outcome,point.material]),[[5,'cover','stone']]);
 assert.equal(result.state.tiles.find(tile=>tile.x===5&&tile.y===3).blocked,true);assert.equal(unit(result.state,'target').hp,200);assert.equal(result.state.artillery[0].ammo,4);assert.equal(result.state.artillery[0].loaded,false);
 for(const member of [20])assert.equal(unit(result.state,member).ap,100-artilleryCosts(state,unit(state,member),state.artillery[0]).fire);
});

test('the recorder clips an issued display line at visibility and strips hidden contact identifiers',()=>{
 const state=field(),raw={source:{x:2,y:3,height:.65},destination:{x:14,y:3,height:.65},cannonId:'gun',discharge:true,impacts:[{x:8,y:3,height:.65,outcome:'hit',victimId:'secret',victimKind:'npc'},{x:12,y:3,height:.65,outcome:'cover',material:'stone'}]};
 const result=captureBattlePresentation(state,()=>{recordBattleFrame(state,{type:'projectile',action:'artillery',unitId:'20',artilleryVisual:raw});return state;},(_state,point)=>point.side==='player'||point.x<=5),visual=visuals(result)[0].artilleryVisual;
 assert.ok(visual.points.every(point=>Math.round(point.x)<=5));assert.equal(visual.impacts.length,0);assert.equal(visual.destination,undefined);assert.equal(visual.points.at(-1).height,.65);assert.equal(visual.durationMs,420);
 const hiddenGun=captureBattlePresentation(state,()=>{recordBattleFrame(state,{type:'projectile',action:'artillery',unitId:'20',artilleryVisual:raw});return state;},(_state,point)=>point.side==='player');assert.equal(hiddenGun.frames[0].artilleryVisual,undefined);assert.equal(hiddenGun.frames[0].cannonId,undefined);
});

test('unknown enemy artillery can disclose a known injury without a cannon source or display ray',()=>{
 const state=field(),raw={source:{x:29,y:7,height:.65},destination:{x:1,y:2,height:.65},cannonId:'secret-gun',canister:true,impacts:[{x:1,y:2,height:.65,outcome:'hit',victimId:'20'}]};
 const result=captureBattlePresentation(state,()=>{const next=structuredClone(state);unit(next,20).hp-=5;recordBattleFrame(next,{type:'impact',action:'artillery',unitId:'reserve',artilleryVisual:raw});return next;},(_state,body)=>body.side==='player');
 assert.equal(result.frames.length,1);assert.equal(result.frames[0].unitId,null);assert.equal(result.frames[0].artilleryVisual,undefined);assert.equal(result.frames[0].impacts[0].unitId,'20');assert.equal(battleFrameFocus(result.frames[0]).x,1);
 const actual=artilleryField({side:'enemy'}),shown=presentedEndTurn(actual);assert.deepEqual(shown.state,endTurn(actual));
});

test('paired discharge identity is per hand and remains constant through a continuation and its impact',()=>{
 const state=field(),visual={source:{x:2,y:3,height:1.4},impact:{x:6,y:3,height:1.1},destination:{x:6,y:3,height:1.1},outcome:'cover'},result=captureBattlePresentation(state,()=>{
  for(const hand of ['primary','offhand'])withBattleShotHand(hand,()=>{recordBattleFrame(state,{type:'projectile',unitId:'20',action:'fire',shotVisual:visual});recordBattleFrame(state,{type:'impact',unitId:'20',action:'fire',shotVisual:visual});recordBattleFrame(state,{type:'projectile',unitId:'20',action:'fire',shotVisual:{...visual,discharge:false}});});return state;
 },()=>true),shots=result.frames.map(frame=>frame.shotVisual);
 assert.deepEqual(shots.map(shot=>shot.shotHand),['primary','primary','primary','offhand','offhand','offhand']);assert.deepEqual(shots.map(shot=>shot.shotId),['20:1','20:1','20:1','20:2','20:2','20:2']);assert.ok(result.frames.every(frame=>frame.shotId===frame.shotVisual.shotId&&frame.shotHand===frame.shotVisual.shotHand));
});

test('reload, pivot and movement enrich only existing frames with their actually assigned crew',()=>{
 for(const type of ['artilleryReload','artilleryPivot','artilleryMove']){
  const state=field('field8');if(type==='artilleryReload')state.artillery[0].loaded=false;
  const action={type,unitId:20,artilleryId:'gun',x:type==='artilleryMove'?3:12,y:3},result=presentedActBattle(state,action);assert.deepEqual(result.state,actBattle(state,action));assert.equal(result.state.lastError,null,type);assert.deepEqual(result.frames.map(frame=>frame.type),['prepare','result']);
  assert.ok(result.frames.every(frame=>frame.action===type));assert.ok(result.frames.every(frame=>JSON.stringify(frame.crewIds)===JSON.stringify(['20','21','22'])));
 }
 const state=field('field8');unit(state,21).stance='prone';const denied=presentedActBattle(state,order);assert.deepEqual(denied.state,actBattle(state,order));assert.ok(denied.state.lastError);assert.ok(denied.frames.every(frame=>frame.crewIds===undefined));
});

test('crew metadata admits each member in that frame, deduplicates IDs and cannot reveal a later-visible helper early',()=>{
 const state=field(),result=captureBattlePresentation(state,()=>{
  const next=structuredClone(state);recordBattleFrame(next,{type:'prepare',unitId:'target',action:'artilleryMove'});unit(next,'reserve').x=8;
  recordBattleFrame(next,{type:'crew',unitId:'target',action:'artilleryMove',crewIds:['target','reserve','reserve','missing','20']});recordBattleFrame(next,{type:'result',unitId:'target',action:'artilleryMove'});return next;
 },(_state,body)=>body.side==='player'||body.x<10);
 assert.equal(result.frames.length,2);assert.deepEqual(result.frames[0].crewIds,['target']);assert.deepEqual(result.frames[1].crewIds,['target','reserve']);assert.equal(result.frames[0].state.units.find(unit=>unit.id==='reserve').x,29);assert.ok(result.frames.every(frame=>frame.type!=='crew'));
});
