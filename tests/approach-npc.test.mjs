import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable,canSee,climbPreview} from '../game/tactical.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {dialogueApproach,dialogueAvailability} from '../game/npc-dialogue.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {approachNPC} from './approach-npc.mjs';

const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const person={id:'301',name:'Declared visitor',hp:49,maxHp:88,bleeding:0,energy:99,weapon:1800,loaded:1,ammo:5,condition:92,medkits:2,facing:2};
const resident=(x,y,activity)=>({id:'resident',name:'Declared resident',x,y,hp:82,maxHp:82,energy:100,dialogue:'special',ai:{cycle:0,homeId:null,activity,wait:100}});
const actor=battle=>battle.units.find(unit=>unit.id==='301'),npc=battle=>battle.npcs.find(person=>person.id==='resident');
const finite=unit=>Object.fromEntries(['hp','maxHp','bleeding','bandaged','weapon','weaponMetadata','blade','bladeMetadata','loaded','ammo','condition','medkits','inventory','headwear','outfit','legwear','rations','torches','boleadoras'].map(key=>[key,unit[key]]));
const native=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,JSON.stringify(action));return next;};

// Declared portable geometry only. No earned campaign, troop placement or
// character condition is changed to manufacture this stacked-cell premise.
test('a visitor beside a ground NPC on a different level must pay for the actual descent before conversation',()=>{
 const upperSurfaces=[{id:'declared-platform',x:3,y:3,tacticalLevel:1,type:'floor',kind:'platform',elevation:3,blocked:false,cover:0}];
 const climbLinks=[{id:'declared-west-access',kind:'climb',from:{x:2,y:3,tacticalLevel:0},to:{x:3,y:3,tacticalLevel:1}}];
 const start=validateBattleSnapshot(createBattle([{...person,x:3,y:3,tacticalLevel:1}],{id:'declared-stacked-conversation',width:8,height:8,tiles:tiles(8,8),upperSurfaces,climbLinks,npcs:[resident(4,3,'working')],exploration:true,enemies:[]})),before=structuredClone(start);
 assert.equal(Math.abs(actor(start).x-npc(start).x)+Math.abs(actor(start).y-npc(start).y),1);
 assert.equal(sameSurface(actor(start),npc(start)),false);assert.equal(dialogueAvailability(start,actor(start),npc(start)).code,'level');
 const route=dialogueApproach(getReachable(start,actor(start)),npc(start));assert.ok(route);assert.equal(route.path.filter(step=>step.kind==='climb').length,1);
 assert.deepEqual(spacePoint(route.path[0]),{x:2,y:3,tacticalLevel:0});
 const descent=climbPreview(start,actor(start),{linkId:'declared-west-access'});assert.equal(descent.valid,true);assert.equal(descent.pa,15);assert.equal(descent.seconds,4);
 let replay=structuredClone(start);
 for(const step of route.path)replay=native(replay,{type:'move',unitId:'301',...step});
 const reached=approachNPC(start,'301','resident');assert.deepEqual(reached,replay,'The approach is exactly the same paid native climb and ground route.');
 assert.equal(sameSurface(actor(reached),npc(reached)),true);assert.equal(canSee(reached,actor(reached),npc(reached)),true);assert.equal(dialogueAvailability(reached,actor(reached),npc(reached)).reason,null);
 assert.ok(reached.elapsedSeconds>=descent.seconds);assert.ok(actor(reached).energy<=actor(start).energy-descent.energy);assert.deepEqual(finite(actor(reached)),finite(actor(start)));
 assert.equal(reached.seed,start.seed);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(reached))),reached);assert.deepEqual(start,before);
});

function nearResident(activity){
 return validateBattleSnapshot(createBattle([{...person,x:2,y:2}],{id:'declared-roaming-conversation',width:8,height:8,tiles:tiles(8,8),npcs:[resident(4,2,activity)],artillery:[{id:'declared-finite-gun',type:'bronze4',side:'player',x:7,y:1,loaded:true,ammo:2}],exploration:true,enemies:[]}));
}
test('only a roaming exploration approach uses the actual finite running order, with native time, energy and snapshot replay',()=>{
 for(const activity of ['roaming','working']){
  const start=nearResident(activity),before=structuredClone(start),route=dialogueApproach(getReachable(start,actor(start)),npc(start));assert.equal(route.path.length,1);
  const action={type:'move',unitId:'301',...route.path[0],...(activity==='roaming'?{movement:'run'}:{})};
  const expected=native(start,action),reached=approachNPC(start,'301','resident');assert.deepEqual(reached,expected,'No direct position, posture, energy or clock assignment replaces the real order.');
  assert.ok(reached.elapsedSeconds>start.elapsedSeconds);assert.ok(actor(reached).energy<actor(start).energy);assert.equal(actor(reached).movementMode,activity==='roaming'?'run':'walk');
  assert.deepEqual(finite(actor(reached)),finite(actor(start)));assert.deepEqual(reached.artillery,start.artillery);assert.equal(reached.seed,start.seed);
  assert.equal(dialogueAvailability(reached,actor(reached),npc(reached),{visible:canSee(reached,actor(reached),npc(reached))}).reason,null);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));assert.deepEqual(approachNPC(restored,'301','resident'),reached);assert.deepEqual(start,before);
  if(activity==='roaming'){
   const walking=native(start,{type:'move',unitId:'301',...route.path[0]});assert.ok(reached.elapsedSeconds<walking.elapsedSeconds);assert.ok(actor(reached).energy<actor(walking).energy,'Running pays more native energy than walking.');
  }
 }
});
