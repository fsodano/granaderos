import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts,transferPreview,canSee} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {fittingItemIds,heldItemIds} from '../game/weapon-fittings.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const socket=(id='socket-main',condition=63)=>({weapon:1811,fittingPattern:'india_socket',instanceId:id,condition});
const gear={weapon:1800,weaponInstanceId:'gun-main',condition:41,loaded:1,jammed:true,ammo:9,blade:1811,bladeCondition:63,bladeInstanceId:'socket-main',bladeFittingPattern:'india_socket'};
const empty={weapon:0,blade:0,loaded:0,ammo:0,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0};
function field(first={},second={},enemies=[{id:'guard',x:18,y:7,weapon:0,loaded:0,ammo:0,overwatch:false}]) {
  const s=createBattle([{id:'p',x:1,y:3,...empty,...gear,...first},{id:'q',x:2,y:3,activeSlot:'unarmed',...empty,...second}],{
    id:'fitting-transactions',width:20,height:9,seed:45,
    tiles:Array.from({length:180},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies,
  });
  for(const u of s.units.filter(u=>u.side==='player'))u.ap=100;
  return s;
}
const unit=(s,id='p')=>s.units.find(u=>u.id===id);
const stored=(u,id)=>Object.entries(u.inventory).find(([,r])=>r?.instanceId===id);
function inventoryRecords(s){return [...s.units.flatMap(u=>Object.values(u.inventory??{}).filter(r=>r&&typeof r==='object'&&r.count>0)),...s.groundItems.filter(r=>r.count>0),...s.droppedWeapons.filter(r=>!r.taken).map(r=>({...r,count:1}))];}
function ledger(s) {
  const records=inventoryRecords(s),ids=[...s.units.flatMap(heldItemIds),...records.flatMap(fittingItemIds)];
  return {ids,rounds:s.units.reduce((sum,u)=>sum+u.ammo+(u.weaponDropped?0:u.loaded),0)+records.reduce((sum,r)=>sum+(r.count??1)*(r.loaded??0)+(r.item==='ammo'?r.count:0),0)};
}
function conserved(s,rounds=10,host='gun-main',blade='socket-main') {
  assert.doesNotThrow(()=>validateBattleSnapshot(s));const current=ledger(s);
  assert.equal(current.ids.filter(id=>id===host).length,1,'one host owner');
  assert.equal(current.ids.filter(id=>id===blade).length,1,'one bayonet owner');assert.equal(current.rounds,rounds,'one charge and finite loose cartridges');
}
function order(s,a){const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);assert.doesNotThrow(()=>validateBattleSnapshot(next));return next;}
function reject(s,a){const next=actBattle(s,{unitId:'p',...a});assert.ok(next.lastError);for(const key of ['units','groundItems','droppedWeapons','seed','elapsedSeconds'])assert.deepEqual(next[key],s[key],key);}
function checkAssembly(record){assert.equal(record.weapon,1800);assert.equal(record.instanceId,'gun-main');assert.equal(record.loaded,1);assert.equal(record.jammed,true);assert.equal(record.condition,41);assert.deepEqual(record.fittings.bayonet,socket());}

test('giving an assembled gun, removing its fitting and passing it back conserve both item identities',()=>{
  let s=order(field(),{type:'fitBayonet',item:'blade'});conserved(s);
  const seed=s.seed,ap=unit(s).ap;
  s=order(s,{type:'transfer',targetId:'q',item:'primary'});assert.equal(unit(s).ap,ap-4);assert.equal(s.seed,seed);assert.equal(unit(s).activeSlot,'unarmed');assert.deepEqual(unit(s).weaponFittings,{});
  checkAssembly(stored(unit(s,'q'),'gun-main')[1]);conserved(s);
  s=order(s,{type:'equipLoot',unitId:'q',inventoryKey:stored(unit(s,'q'),'gun-main')[0]});conserved(s);
  s=order(s,{type:'removeBayonet',unitId:'q',destination:'inventory'});
  const [key,loose]=stored(unit(s,'q'),'socket-main');assert.equal(loose.condition,63);assert.equal(loose.fittingPattern,'india_socket');
  s=order(s,{type:'transfer',unitId:'q',targetId:'p',item:`inventory:${key}`});conserved(s);
  assert.equal(unit(s,'q').loaded,1);assert.equal(unit(s,'q').jammed,true);assert.equal(unit(s,'q').condition,41);assert.deepEqual(unit(s,'q').weaponFittings,{});
  s=order(s,{type:'drop',item:`inventory:${stored(unit(s),'socket-main')[0]}`});conserved(s);
  s=order(s,{type:'loot',unitId:'q',groundId:s.groundItems[0].id});conserved(s);
  s=order(s,{type:'fitBayonet',unitId:'q',item:`inventory:${stored(unit(s,'q'),'socket-main')[0]}`});conserved(s);
  assert.deepEqual(unit(s,'q').weaponFittings.bayonet,socket());assert.equal(s.groundItems[0].count,0);
  reject(s,{type:'loot',unitId:'q',groundId:s.groundItems[0].id});
});

test('a failed catch drops the exact loaded jammed assembly and permits one pickup after save',()=>{
  let s=order(field({dexterity:0},{x:5,dexterity:0,energy:20}),{type:'fitBayonet',item:'blade'});
  const ap=unit(s).ap,catchAP=unit(s,'q').ap;
  assert.equal(transferPreview(s,unit(s),unit(s,'q'),'primary').chance,5);
  s=order(s,{type:'transfer',targetId:'q',item:'primary'});assert.equal(unit(s).ap,ap-8);assert.equal(unit(s,'q').ap,catchAP);
  const g=s.groundItems[0];assert.deepEqual([g.x,g.y,g.count],[5,3,1]);checkAssembly(g);conserved(s);
  const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),a={type:'loot',unitId:'q',groundId:g.id};
  assert.deepEqual(actBattle(saved,a),actBattle(s,a));s=order(saved,a);checkAssembly(stored(unit(s,'q'),'gun-main')[1]);conserved(s);
  reject(s,a);
});

test('partial corpse loot retains the attached blade until the actual firearm is taken',()=>{
  const corpse={id:'corpse',x:1,y:4,hp:0,maxHp:100,weapon:1800,weaponInstanceId:'gun-main',condition:41,loaded:1,ammo:9,jammed:true,weaponFittings:{bayonet:socket()},overwatch:false};
  let s=field({...empty,weaponInstanceId:undefined,bladeInstanceId:undefined,bladeFittingPattern:null,activeSlot:'unarmed'},{},[corpse,{id:'guard',x:18,y:7,weapon:0,loaded:0,ammo:0,overwatch:false}]);
  s=order(s,{type:'loot',targetId:'corpse',item:'ammo',count:3});assert.equal(unit(s,'corpse').ammo,6);assert.deepEqual(unit(s,'corpse').weaponFittings.bayonet,socket());conserved(s);
  s=order(s,{type:'loot',targetId:'corpse',item:'weapon'});assert.deepEqual(unit(s,'corpse').weaponFittings,{});assert.equal(unit(s,'corpse').weaponDropped,true);assert.equal(unit(s,'corpse').loaded,0);checkAssembly(stored(unit(s),'gun-main')[1]);conserved(s);
  reject(s,{type:'loot',targetId:'corpse',item:'weapon'});
  s=order(s,{type:'transfer',targetId:'q',item:`inventory:${stored(unit(s),'gun-main')[0]}`});conserved(s);
  checkAssembly(stored(unit(s,'q'),'gun-main')[1]);assert.equal(unit(s,'corpse').ammo,6);
});

test('a real rout drops the complete fixed gun and its pickup cannot duplicate the routed owner',()=>{
  const defender={weaponMetadata:{name:'Fusil del cuartel',originNote:'recuperado'},id:'defender',x:2,y:3,morale:16,weapon:1800,weaponInstanceId:'gun-main',condition:41,loaded:1,ammo:9,jammed:true,weaponFittings:{bayonet:socket()},overwatch:false};
  let s=field({...empty,weapon:1809,weaponInstanceId:undefined,bladeInstanceId:undefined,bladeFittingPattern:null,activeSlot:'primary'},{x:1,y:4},[defender,{id:'guard',x:18,y:7,weapon:0,loaded:0,ammo:0,overwatch:false}]);
  s=order(s,{type:'melee',targetId:'defender'});assert.equal(unit(s,'defender').routed,true);assert.equal(s.droppedWeapons.length,1);
  const drop=s.droppedWeapons[0];assert.deepEqual(drop.weaponMetadata,defender.weaponMetadata);assert.equal(unit(s,'defender').weaponMetadata,undefined);checkAssembly(drop);assert.equal(drop.weight,4);assert.equal(unit(s,'defender').weaponInstanceId,undefined);assert.deepEqual(unit(s,'defender').weaponFittings,{});conserved(s);
  s=order(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{type:'loot',unitId:'q',dropIndex:0});assert.equal(s.droppedWeapons[0].taken,true);checkAssembly(stored(unit(s,'q'),'gun-main')[1]);assert.equal(stored(unit(s,'q'),'gun-main')[1].name,defender.weaponMetadata.name);assert.equal(stored(unit(s,'q'),'gun-main')[1].originNote,'recuperado');conserved(s);
  reject(s,{type:'loot',unitId:'q',dropIndex:0});
});

test('capacity rejection preserves a fitted giver, charge, condition, AP and RNG',()=>{
  let s=order(field({}, {inventory:{bulk:{count:48,weight:1}}}),{type:'fitBayonet',item:'blade'});
  assert.equal(transferPreview(s,unit(s),unit(s,'q'),'primary').valid,false);
  reject(s,{type:'transfer',targetId:'q',item:'primary'});conserved(s);
});

test('the ordinary enemy turn pays 12 AP to fit and then 16 AP for a separate thrust',()=>{
  const enemy={id:'e',x:3,y:3,...gear,ammo:0,priming:0,flints:0,medkits:0,overwatch:false};
  const s=field({...empty,weaponInstanceId:undefined,bladeInstanceId:undefined,bladeFittingPattern:null},{x:1,y:7},[enemy]);
  unit(s).ap=0;unit(s,'q').ap=0;unit(s,'e').ap=28;
  assert.deepEqual(chooseEnemyAction(s,unit(s,'e')),{type:'fitBayonet',unitId:'e',item:'blade'});
  const n=endTurn(s),e=unit(n,'e');assert.equal(n.phase,'player');assert.equal(n.turn,2);assert.equal(e.ap,0);
  assert.equal(e.blade,undefined);assert.equal(e.weaponFittings.bayonet.instanceId,'socket-main');assert.equal(e.weaponFittings.bayonet.condition,62);assert.equal(e.loaded,1);assert.equal(e.jammed,true);assert.equal(e.condition,41);
  assert.ok(unit(n).hp<unit(s).hp);assert.equal(n.log.filter(t=>t.includes('fija la bayoneta')).length,1);assert.equal(n.log.filter(t=>t.includes('hiere a')).length,1);assert.ok(!n.log.some(t=>t.includes('ejecuta una carga')));conserved(n,1);
});

test('fitting during a real hearing interruption preserves the suspended enemy budget through JSON resume',()=>{
  const listener={...gear,x:4,y:0,facing:0,agility:100,experienceLevel:10,weaponInstanceId:'listener-gun',bladeInstanceId:'listener-bayonet'};
  const enemy={id:'e',x:4,y:3,agility:40,experienceLevel:1,...gear,ammo:0,priming:0,flints:0,medkits:0,overwatch:false};
  let s=field(listener,{x:2,y:3,agility:0,experienceLevel:1},[enemy]);unit(s,'q').ap=0;unit(s,'e').ap=28;unit(s).ap=32;
  assert.equal(canSee(s,unit(s),unit(s,'e')),false);
  s=endTurn(s);assert.equal(s.phase,'interrupt');assert.deepEqual(s.interrupt.unitIds,['p']);assert.equal(unit(s,'e').ap,16);assert.equal(unit(s,'q').hp,100);
  assert.equal(unit(s,'e').weaponFittings.bayonet.condition,63);assert.equal(unit(s).lastHeardNoise.kind,'reload');assert.equal(s.enemyTurn.actionsTaken,1);
  const action={type:'fitBayonet',unitId:'p',item:'blade'},resumed=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(actBattle(resumed,action),actBattle(s,action));s=order(resumed,action);assert.equal(unit(s).ap,32-actionCosts(s,unit(s)).fitBayonet);assert.equal(unit(s,'e').ap,16);assert.equal(s.phase,'interrupt');assert.equal(s.elapsedSeconds,6);
  const final=endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s))));assert.deepEqual(final,endTurn(s));assert.equal(final.turn,2);assert.equal(final.elapsedSeconds,6);assert.equal(unit(final,'e').ap,0);assert.equal(unit(final,'e').weaponFittings.bayonet.condition,62);assert.equal(unit(final).weaponFittings.bayonet.condition,63);assert.equal(final.enemyTurn,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(final));
});
