import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedActBattle,hasFirearm,weaponFor,bladeFor,actionCosts,pointFirePreview,reloadPlan,reprimePlan,firearmShotOptions,shotChance,firearmMaintenancePreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {firearmServiceable,BROKEN_FIREARM_REASON} from '../game/firearm-serviceability.js';
import {pairedPistol} from '../game/paired-fire.js';
import {targetPreview,emptyGunPreview} from '../game/ja2-hud.js';
import {handRecord} from '../game/tactical-inventory.js';
import {ammunitionByType,addAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {weaponMetadata} from '../game/weapon-definition.js';
const other=patch=>({weapon:1806,count:1,weight:1.3,loaded:1,condition:100,instanceId:'owned-other',...patch});
const actor=s=>s.units.find(u=>u.id==='actor'),target=s=>s.units.find(u=>u.id==='target');
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
function field(patch={},ai=false,exploring=false){
 const own={id:'actor',x:2,y:3,facing:2,weapon:1805,weaponInstanceId:'owned-main',condition:0,loaded:1,ammo:2,medkits:0,patrol:false,overwatch:false,marksmanship:100,experienceLevel:1,...patch};
 const opponent={id:'target',x:exploring?28:8,y:3,facing:6,weapon:1813,loaded:0,ammo:0,hp:250,maxHp:250,medkits:0,patrol:false,overwatch:false,experienceLevel:1};
 const s=createBattle([ai?opponent:own],{width:30,height:8,seed:45,exploration:exploring,tiles:Array.from({length:240},(_,i)=>({x:i%30,y:Math.floor(i/30),type:'grass',blocked:false,cover:0})),enemies:[ai?own:opponent]});actor(s).ap=patch.ap??100;target(s).ap=0;assert.doesNotThrow(()=>restore(s));return s;
}
function reject(s,order){const before=structuredClone(s),n=actBattle(s,{unitId:'actor',...order});assert.equal(n.lastError,BROKEN_FIREARM_REASON);assert.deepEqual({...n,lastError:null,log:[]},{...s,lastError:null,log:[]});assert.deepEqual(s,before);assert.deepEqual(presentedActBattle(s,{unitId:'actor',...order}).state,n);assert.deepEqual(restore(n),n);return n;}

test('serviceability is separate from owned firearm classification and legacy condition',()=>{
 assert.equal(firearmServiceable(null),false);assert.equal(firearmServiceable({}),true);
 for(const condition of [1,.25,100])assert.equal(firearmServiceable({condition}),true);
 assert.equal(firearmServiceable({condition:0}),false);
 const s=field(),u=actor(s);assert.equal(hasFirearm(u),true);assert.ok(weaponFor(u).capacity>0);assert.equal(bladeFor(u).name,'Culata');assert.deepEqual(restore(s),s);
});

test('every zero-condition firearm rejects named and point discharge before any paid mutation',()=>{
 for(const exploring of [false,true])for(const weapon of [1800,1801,1802,1803,1804,1805,1806,1807,1808]){
  const s=field({weapon},false,exploring),u=actor(s),t=target(s),point={x:t.x,y:t.y};
  assert.equal(pointFirePreview(s,u,point).reason,BROKEN_FIREARM_REASON,`point ${weapon}`);assert.equal(targetPreview(s,u,t,{mode:'fire'}).reason,BROKEN_FIREARM_REASON,`target ${weapon}`);assert.deepEqual(firearmShotOptions(s,u,t),[]);assert.equal(shotChance(s,u,t),0);
  reject(s,{type:'fire',targetId:t.id});reject(s,{type:'firePoint',...point});reject(s,{type:'overwatch'});
 }
});

test('a broken primary cannot join or trigger its healthy other-hand discharge',()=>{
 const s=field({offHand:other()}),u=actor(s);assert.equal(pairedPistol(u),null);reject(s,{type:'fire',targetId:'target'});reject(s,{type:'firePoint',x:8,y:3});assert.equal(u.loaded,1);assert.equal(u.offHand.loaded,1);
});

test('broken single loading and repriming preserve rounds, partial work, faults and all supplies',()=>{
 for(const exploring of [false,true]){
  const empty=field({loaded:0,reloadProgress:.375},false,exploring),u=actor(empty);assert.equal(reloadPlan(u,empty).pa,0);assert.equal(reloadPlan(u,empty).reason,BROKEN_FIREARM_REASON);assert.equal(emptyGunPreview(empty,u).reason,BROKEN_FIREARM_REASON);reject(empty,{type:'reload'});
  const jammed=field({jammed:true},false,exploring);assert.deepEqual(reprimePlan(actor(jammed),jammed).hands,[]);assert.equal(reprimePlan(actor(jammed),jammed).reason,BROKEN_FIREARM_REASON);reject(jammed,{type:'reprime'});
 }
});

test('healthy secondary-only loading does not pay for the broken primary or borrow its ammunition family',()=>{
 for(const exploring of [false,true]){
  const definition={...defaultContentPackage().weapons.find(w=>w.template===1806),id:'owned-rifle-pistol',ammunitionFamily:'ammoRifle'};
  const s=field({loaded:0,reloadProgress:.375,jammed:true,ammo:2,offHand:other({loaded:0,...weaponMetadata(definition)})},false,exploring),u=actor(s);addAmmunition(u,weaponAmmoType(u.offHand),1);syncUnitAmmunition(u);
  const before=structuredClone(s),old=handRecord(u,'primary'),plan=reloadPlan(u,s);assert.deepEqual(plan.hands.map(h=>h.hand),['offhand']);assert.equal(plan.rounds,1);assert.equal(plan.totalPA,28);assert.equal(plan.reason,undefined);assert.equal(emptyGunPreview(s,u).valid,true);
  const n=actBattle(s,{type:'reload',unitId:u.id}),v=actor(n);assert.equal(n.lastError,null);assert.deepEqual(handRecord(v,'primary'),old);assert.equal(v.offHand.loaded,1);assert.equal(v.offHand.instanceId,u.offHand.instanceId);assert.equal(v.ap,exploring?u.ap:u.ap-28);assert.deepEqual(ammunitionByType(v),{pistol_69:2});assert.deepEqual(s,before);assert.deepEqual(n,actBattle(restore(s),{type:'reload',unitId:u.id}));
 }
});

test('healthy secondary-only repriming leaves a broken primary fault and charge exact',()=>{
 for(const exploring of [false,true]){
  const s=field({jammed:true,offHand:other({jammed:true})},false,exploring),u=actor(s),old=handRecord(u,'primary'),plan=reprimePlan(u,s),before=structuredClone(s);assert.deepEqual(plan.hands,['offhand']);assert.equal(plan.pa,15);assert.equal(plan.required,1);
  const n=actBattle(s,{type:'reprime',unitId:u.id}),v=actor(n);assert.equal(n.lastError,null);assert.deepEqual(handRecord(v,'primary'),old);assert.equal(v.offHand.jammed,false);assert.deepEqual({...v.offHand,jammed:true},u.offHand);assert.equal(v.ap,exploring?u.ap:u.ap-15);assert.deepEqual(ammunitionByType(v),ammunitionByType(u));assert.deepEqual(s,before);assert.deepEqual(n,actBattle(restore(s),{type:'reprime',unitId:u.id}));
 }
});

test('a positive condition admits one barrel, then its retained zero-condition charge waits for repair',()=>{
 for(const condition of [1,.25])for(const type of ['fire','firePoint']){
  const s=field({weapon:1808,condition,loaded:2,ammo:0}),u=actor(s),order=type==='fire'?{type,targetId:'target'}:{type,x:8,y:3},n=actBattle(s,{unitId:u.id,...order});assert.equal(n.lastError,null);assert.equal(actor(n).condition,0);assert.equal(actor(n).loaded,1);assert.equal(actor(n).ap,u.ap-actionCosts(s,u,target(s)).fire);assert.equal(actor(n).weaponReady,true);assert.deepEqual(restore(n),n);reject(n,order);
 }
});

test('both positive-condition guns finish the single admitted paired order before the next order is rejected',()=>{
 for(const type of ['fire','firePoint']){
  const s=field({condition:1,loaded:1,ammo:0,offHand:other({condition:1})}),u=actor(s),order=type==='fire'?{type,targetId:'target'}:{type,x:8,y:3};assert.ok(pairedPistol(u));const n=actBattle(s,{unitId:u.id,...order}),v=actor(n);assert.equal(n.lastError,null);assert.equal(v.loaded,0);assert.equal(v.offHand.loaded,0);assert.equal(v.condition,0);assert.equal(v.offHand.condition,0);assert.equal(v.ap,u.ap-actionCosts(s,u,target(s)).fire);assert.equal(v.weaponInstanceId,u.weaponInstanceId);assert.equal(v.offHand.instanceId,u.offHand.instanceId);assert.deepEqual(restore(n),n);reject(n,order);
 }
});

test('zero-condition gun ownership still supports paid repair, swap, drop and stock melee',()=>{
 const repair=field({toolkitPoints:30}),u=actor(repair),preview=firearmMaintenancePreview(repair,u),fixed=actBattle(repair,{type:'repair',unitId:u.id});assert.equal(preview.valid,true);assert.equal(fixed.lastError,null);assert.equal(actor(fixed).condition,30);assert.equal(actor(fixed).toolkitPoints,0);assert.equal(actor(fixed).loaded,u.loaded);assert.equal(actor(fixed).ap,u.ap-25);assert.deepEqual(restore(fixed),fixed);
 const swap=field({offHand:other()}),old=handRecord(actor(swap),'primary'),swapped=actBattle(swap,{type:'swapHands',unitId:'actor'});assert.equal(swapped.lastError,null);assert.deepEqual(actor(swapped).offHand,old);assert.equal(actor(swapped).ap,96);assert.equal(actor(swapped).loaded,1);assert.deepEqual(restore(swapped),swapped);
 const drop=field(),dropped=actBattle(drop,{type:'drop',unitId:'actor',item:'primary'});assert.equal(dropped.lastError,null);assert.equal(dropped.groundItems[0].condition,0);assert.equal(dropped.groundItems[0].loaded,1);assert.equal(dropped.groundItems[0].instanceId,'owned-main');assert.deepEqual(restore(dropped),dropped);
 const unload=field(),unloaded=actBattle(unload,{type:'unloadAmmunition',unitId:'actor'});assert.equal(unloaded.lastError,null);assert.equal(actor(unloaded).condition,0);assert.equal(actor(unloaded).loaded,0);assert.equal(actor(unloaded).weaponInstanceId,'owned-main');assert.deepEqual(ammunitionByType(actor(unloaded)),{pistol_69:3});assert.deepEqual(restore(unloaded),unloaded);
 const stock=field({weaponMode:'melee'});target(stock).x=3;const hit=actBattle(stock,{type:'melee',unitId:'actor',targetId:'target'});assert.equal(hit.lastError,null);assert.ok(target(hit).hp<250);assert.equal(actor(hit).condition,0);assert.equal(actor(hit).loaded,1);assert.deepEqual(restore(hit),hit);
});

test('AI uses its actual owned serviceability for backup and secondary-only maintenance',()=>{
 for(const [patch,order]of [[{offHand:other(),ap:12},'swapHands'],[{loaded:0,ammo:1,offHand:other({loaded:0}),ap:38},'reload'],[{jammed:true,ammo:0,offHand:other({jammed:true}),ap:25},'reprime']]){
  const s=field(patch,true),u=actor(s),before=structuredClone(s),old=handRecord(u,'primary');assert.equal(chooseEnemyAction(s,u).type,order);const n=endTurn(s),v=actor(n);assert.equal(n.lastError,null);assert.equal(v.weaponInstanceId,'owned-other');assert.equal(v.loaded,0);assert.equal(v.offHand.instanceId,'owned-main');assert.equal(v.offHand.condition,0);assert.equal(v.offHand.loaded,old.loaded);assert.equal(v.offHand.jammed,old.jammed);assert.equal(v.ap,0);assert.ok(target(n).hp<250);assert.equal(n.log.filter(l=>l.includes('prepara el arma de la otra mano')).length,1);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restore(s)));
 }
 const broken=field({ap:24,ammo:1},true);assert.equal(chooseEnemyAction(broken,actor(broken)).type,'move','the owned gun stock retains its paid approach');const n=endTurn(broken);assert.equal(actor(n).condition,0);assert.equal(actor(n).loaded,1);assert.deepEqual(ammunitionByType(actor(n)),ammunitionByType(actor(broken)));
});

test('AI threat planning does not inspect an observed opponent primary or secondary condition',()=>{
 const s=field({weapon:1813,loaded:0,ammo:0,condition:100,ap:24},true);Object.assign(target(s),{weapon:1805,loaded:1,condition:100,offHand:other(),weaponInstanceId:'opponent-main'});s.tiles.find(t=>t.x===5&&t.y===2).cover=30;const choice=chooseEnemyAction(s,actor(s));assert.ok(choice);
 for(const condition of [0,1,100])for(const secondary of [0,1,100]){const n=structuredClone(s);target(n).condition=condition;target(n).offHand.condition=secondary;assert.deepEqual(chooseEnemyAction(n,actor(n)),choice);assert.deepEqual(s,restore(s));}
});
