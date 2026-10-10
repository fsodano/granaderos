import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,firearmShotOptions,firearmFlightPreview,teamCanSee} from '../game/tactical.js';
import {pairedPistol,secondaryPistolView} from '../game/paired-fire.js';
import {localSanLorenzoOrder,localSanLorenzoFireSafe} from './local-san-lorenzo-driver.mjs';

// Declared geometry and finite equipment are isolated selection inputs.
// These cases are not earned campaign wounds, supplies, casualties or victories.
// No selected order is applied and no tactical turn or saved replay is run.
// The existing controller still makes its immutable native legality probes.
function lane({actor={},friends=[],npcs=[],sector={}}={}){
 const width=22,height=12;
 return createBattle([{id:'shooter',x:2,y:3,facing:2,weapon:1802,loaded:1,ammo:2,
  condition:100,stance:'prone',movementMode:'prone',marksmanship:100,dexterity:100,
  agility:100,strength:85,experienceLevel:1,...actor},...friends],{
  width,height,seed:45,hour:12,
  tiles:Array.from({length:width*height},(_,index)=>({x:index%width,y:Math.floor(index/width),type:'grass',blocked:false,blocksSight:false,cover:0})),
  enemies:[{id:'target',x:8,y:3,hp:100,stance:'standing',weapon:1800,loaded:0,ammo:0,morale:100,patrol:false,overwatch:false}],
  npcs,...sector,
 });
}
const actor=b=>b.units.find(unit=>unit.id==='shooter');
const target=b=>b.units.find(unit=>unit.id==='target');
const friendlyRisk=shot=>Boolean(shot.interveningFriendly||shot.shots?.some(hand=>hand.interveningFriendly));
const hasCivilian=flight=>flight.victimKind==='npc'||Boolean(flight.bodyImpacts?.some(impact=>impact.victimKind==='npc'));
const paired={weapon:1805,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:100,
 jammed:false,ammunitionChoice:'ammoShot',instanceId:'declared-second'}};
const fire={type:'fire',unitId:'shooter',targetId:'target',aim:4,hitLocation:'torso'};
function selectedForecast(b,action){
 if(action?.type!=='fire')return null;
 const t=b.units.find(unit=>unit.id===action.targetId);
 return firearmShotOptions(b,actor(b),t,action.aim??0).find(shot=>shot.aim===(action.aim??0)&&shot.hitLocation===(action.hitLocation??'torso'));
}
function assertSelectedSafe(b,action,{avoidCivilians=false}={}){
 if(action?.type!=='fire')return;
 const shot=selectedForecast(b,action);assert.ok(shot);assert.equal(friendlyRisk(shot),false);
 if(avoidCivilians){
  const u=actor(b),t=b.units.find(unit=>unit.id===action.targetId),second=pairedPistol(u);
  for(const view of [u,...(second?[secondaryPistolView(u,second)]:[])]){
   assert.equal(hasCivilian(firearmFlightPreview(b,view,t,action.hitLocation??'torso')),false);
  }
 }
}

test('ranked admitted shots cannot fire through a known friendly body',()=>{
 const b=lane({friends:[{id:'friend',x:5,y:3,weapon:1800,stance:'standing'}]}),before=structuredClone(b),u=actor(b);
 assert.ok(firearmShotOptions(b,u,target(b),4).some(shot=>shot.chance>=25&&friendlyRisk(shot)));
 const selected=localSanLorenzoOrder(b,u);assertSelectedSafe(b,selected);assert.deepEqual(b,before);
});

test('a paired offhand cone cannot bypass the friendly body check',()=>{
 const b=lane({actor:paired,friends:[{id:'friend',x:6,y:4,weapon:1800,stance:'standing'}]}),before=structuredClone(b),u=actor(b);
 const shots=firearmShotOptions(b,u,target(b),4);
 assert.ok(shots.some(shot=>shot.chance>=25&&!shot.interveningFriendly&&shot.shots?.some(hand=>hand.hand==='offhand'&&hand.interveningFriendly)),
  'the declared side body is a public offhand risk while the primary ray is clear');
 assert.equal(localSanLorenzoFireSafe(b,u,fire),false);
 assertSelectedSafe(b,localSanLorenzoOrder(b,u));assert.deepEqual(b,before);
});

test('explicit civilian avoidance rejects typed civilian impacts without confusing matching actor IDs',()=>{
 const b=lane({npcs:[{id:'target',name:'Civil distinto',x:5,y:3,hp:100,stance:'standing'}]}),before=structuredClone(b),u=actor(b);
 assert.equal(teamCanSee(b,'player',b.npcs[0]),true);
 assert.ok(hasCivilian(firearmFlightPreview(b,u,target(b),'torso')));
 assert.equal(localSanLorenzoFireSafe(b,u,fire),true);
 assert.equal(localSanLorenzoFireSafe(b,u,fire,{avoidCivilians:false}),true);
 assert.equal(localSanLorenzoFireSafe(b,u,fire,{avoidCivilians:true}),false);
 const ordinary=localSanLorenzoOrder(b,u,{avoidCivilians:false});assert.equal(ordinary?.type,'fire');
 const guarded=localSanLorenzoOrder(b,u,{avoidCivilians:true});assertSelectedSafe(b,guarded,{avoidCivilians:true});
 assert.deepEqual(b,before);
});

test('visible civilians on an actual paired offhand cone are checked separately from the primary ray',()=>{
 const b=lane({actor:paired,npcs:[{id:'civil',name:'Civil al costado',x:6,y:4,hp:100,stance:'standing'}]}),before=structuredClone(b),u=actor(b),second=pairedPistol(u);
 assert.ok(second);assert.equal(hasCivilian(firearmFlightPreview(b,u,target(b),'torso')),false);
 assert.equal(hasCivilian(firearmFlightPreview(b,secondaryPistolView(u,second),target(b),'torso')),true);
 assert.equal(localSanLorenzoFireSafe(b,u,fire,{avoidCivilians:false}),true);
 assert.equal(localSanLorenzoFireSafe(b,u,fire,{avoidCivilians:true}),false);
 assertSelectedSafe(b,localSanLorenzoOrder(b,u,{avoidCivilians:true}),{avoidCivilians:true});assert.deepEqual(b,before);
});

test('the shared final fire boundary rejects unsafe fallback-shaped orders without adding a chance threshold',()=>{
 const b=lane({npcs:[{id:'civil',name:'Civil visible',x:5,y:3,hp:100,stance:'standing'}]}),before=structuredClone(b),u=actor(b);
 // This tests the shared acceptance boundary with a declared fire order.
 // It does not claim that a particular automatic controller selected this order.
 assert.equal(localSanLorenzoFireSafe(b,u,fire,{avoidCivilians:true}),false);
 assert.equal(localSanLorenzoFireSafe(b,u,{type:'reload',unitId:u.id},{avoidCivilians:true}),true);
 assert.equal(localSanLorenzoFireSafe(b,u,{type:'move',unitId:u.id,x:3,y:2},{avoidCivilians:true}),true);
 assert.deepEqual(b,before);
});

test('an unrevealed interior civilian does not redirect a public clear shot',()=>{
 const empty=lane(),hidden=lane({npcs:[{id:'private',name:'Dato privado',x:5,y:3,hp:100,stance:'standing',roomId:'unrevealed'}]}),emptyBefore=structuredClone(empty),hiddenBefore=structuredClone(hidden);
 assert.deepEqual(firearmFlightPreview(hidden,actor(hidden),target(hidden),'torso'),firearmFlightPreview(empty,actor(empty),target(empty),'torso'));
 assert.equal(localSanLorenzoFireSafe(hidden,actor(hidden),fire,{avoidCivilians:true}),true);
 const clear=localSanLorenzoOrder(empty,actor(empty),{avoidCivilians:true});assert.equal(clear?.type,'fire');
 assert.deepEqual(localSanLorenzoOrder(hidden,actor(hidden),{avoidCivilians:true}),clear);
 assert.deepEqual(empty,emptyBefore);assert.deepEqual(hidden,hiddenBefore);
});

test('dead departed and roof-height civilians cannot create a false ray refusal',()=>{
 const empty=lane(),emptyBefore=structuredClone(empty),clear=localSanLorenzoOrder(empty,actor(empty),{avoidCivilians:true});
 assert.equal(clear?.type,'fire');
 const roof={id:'civil-roof',x:5,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0};
 for(const setup of [
  {npcs:[{id:'dead',x:5,y:3,hp:0,stance:'standing'}]},
  {npcs:[{id:'departed',x:5,y:3,hp:100,stance:'standing',departure:{edge:'E'}}]},
  {npcs:[{id:'roof',x:5,y:3,hp:100,stance:'standing',tacticalLevel:1}],sector:{upperSurfaces:[roof]}},
 ]){
  const b=lane(setup),before=structuredClone(b);
  assert.equal(hasCivilian(firearmFlightPreview(b,actor(b),target(b),'torso')),false);
  assert.equal(localSanLorenzoFireSafe(b,actor(b),fire,{avoidCivilians:true}),true);
  assert.deepEqual(localSanLorenzoOrder(b,actor(b),{avoidCivilians:true}),clear);assert.deepEqual(b,before);
 }
 assert.deepEqual(empty,emptyBefore);
});

test('explicit avoidance preserves the original clear-shot choice and every input field',()=>{
 const b=lane(),before=structuredClone(b),u=actor(b);
 const ordinary=localSanLorenzoOrder(b,u),explicit=localSanLorenzoOrder(b,u,{avoidCivilians:true});
 assert.equal(ordinary?.type,'fire');assert.deepEqual(explicit,ordinary);assertSelectedSafe(b,explicit,{avoidCivilians:true});
 assert.deepEqual(b,before);
});
