import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,bladeFor,meleePreview,meleePointPreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {weaponRecord,weaponMetadata} from '../game/weapon-definition.js';
import {repairEquipment,spendRepairMaterials} from '../game/equipment-repair.js';
import {knifeThrowDamage,heldThrowingKnife} from '../game/thrown-knife.js';
import {seedCivilianHealth} from '../game/civilian-health.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const floor=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
const field=(condition=100,slot='blade',extra={},enemy={})=>{
 const gear=slot==='blade'?{weapon:1800,loaded:1,condition:63,weaponInstanceId:'retained-gun',blade:1813,bladeCondition:condition,bladeInstanceId:'owned-knife',activeSlot:'blade'}:{weapon:1813,loaded:0,condition,weaponInstanceId:'owned-knife'};
 const s=createBattle([{id:'p',x:1,y:3,...gear,...extra}],{width:12,height:8,seed:45,tiles:floor(),enemies:[{id:'e',x:2,y:3,weapon:1800,hp:100,morale:100,patrol:false,overwatch:false,...enemy},{id:'reserve',x:11,y:7,patrol:false,overwatch:false}]});
 s.units[1].ap=enemy.ap??0;return s;
};
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const act=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);assert.doesNotThrow(()=>restored(n));return n;};
const condition=(u,slot)=>u[slot==='blade'?'bladeCondition':'condition'];

for(const slot of ['primary','blade'])test(`${slot} loose blade scales actual contact damage and wears only its own finite item`,()=>{
 for(const [state,loss,after]of [[100,32,99],[85,32,84],[25,9,24],[10,4,10]]){
  const s=field(state,slot),before=structuredClone(s),record=weaponRecord(s.units[0],slot),n=act(s,{type:'melee',targetId:'e'});
  assert.equal(100-n.units[1].hp,loss);assert.equal(condition(n.units[0],slot),after);assert.equal(n.units[0].ap,92);
  assert.deepEqual(weaponRecord(n.units[0],slot),{...record,condition:after});
  if(slot==='blade')assert.deepEqual(weaponRecord(n.units[0]),weaponRecord(s.units[0]));
  assert.deepEqual(s,before);assert.deepEqual(act(restored(s),{type:'melee',targetId:'e'}),n);
 }
});

test('broken loose blades reject contact, empty swings and charges in previews and actual orders',()=>{
 for(const slot of ['primary','blade'])for(const state of [0,9]){
  const s=field(state,slot);assert.equal(bladeFor(s.units[0]).usable,false);
  assert.equal(meleePreview(s,s.units[0],s.units[1]).valid,false);assert.equal(meleePointPreview(s,s.units[0],{x:1,y:4}).valid,false);
  for(const a of [{type:'melee',targetId:'e'},{type:'meleePoint',x:1,y:4},{type:'charge',targetId:'e'}]){
   const n=actBattle(s,{unitId:'p',...a});assert.match(n.lastError,/reparación/);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);
  }
 }
});

test('a paid charge uses worn impact and records exactly one successful-contact wear point',()=>{
 for(const slot of ['primary','blade']){
  const s=field(25,slot,{}, {x:5}),n=act(s,{type:'charge',targetId:'e'});
  assert.equal(n.units[0].ap,0);assert.ok(n.units[0].lastMovePath.length>0);assert.ok(100-n.units[1].hp<32);
  assert.equal(condition(n.units[0],slot),24);assert.deepEqual(act(restored(s),{type:'charge',targetId:'e'}),n);
 }
});

test('a worn loose counterattack uses the same held slot and wear while a broken blade cannot defend',()=>{
 for(const slot of ['primary','blade'])for(const state of [25,0]){
  const defense=slot==='blade'?{weapon:1800,blade:1813,bladeCondition:state,bladeInstanceId:'enemy-blade',activeSlot:'blade'}:{weapon:1813,condition:state,weaponInstanceId:'enemy-blade'};
  const s=field(100,'blade',{}, {...defense,ap:100}),n=act(s,{type:'melee',targetId:'e'});
  assert.equal(condition(n.units[1],slot),state?24:0);assert.equal(n.units[0].hp,state?95:100);
  assert.equal(n.units[1].counterTurn,state?s.turn:0);assert.equal(100-n.units[1].hp,state?26:32);
 }
});

test('an empty paid swing has no contact wear, while intentional civilian contact does',()=>{
 const s=field(25),empty=act(s,{type:'meleePoint',x:1,y:4});assert.equal(empty.units[0].bladeCondition,25);assert.equal(empty.seed,s.seed);
 s.npcs.push(seedCivilianHealth({id:'civil',name:'Habitante',x:1,y:4},{hp:100,maxHp:100,energy:100}));
 const n=act(s,{type:'melee',targetId:'civil'});assert.equal(n.units[0].bladeCondition,24);assert.equal(n.npcs[0].hp,91);assert.equal(n.npcs[0].bleedSource.attackerId,'p');
});

test('authored blade impact scales without modifying the pinned definition',()=>{
 const definition={id:'worn-authored',name:'Facón conservado',template:1813,ap:9,damage:61,reach:1.5,weight:.6,price:41,art:'/art/weapon-1813.png'};
 const s=field(25,'blade',{bladeMetadata:weaponMetadata(definition)}),metadata=structuredClone(s.units[0].bladeMetadata),n=act(s,{type:'melee',targetId:'e'});
 assert.equal(100-n.units[1].hp,18);assert.equal(n.units[0].bladeCondition,24);assert.deepEqual(n.units[0].bladeMetadata,metadata);
});

test('worn identity survives finite repair, drop, paid pickup, equip and tactical saves once',()=>{
 let s=act(field(25),{type:'melee',targetId:'e'}),u=s.units[0];u.toolkitPoints=2;
 const used=repairEquipment(u,u,2);spendRepairMaterials(u,used);assert.equal(used,2);assert.equal(u.toolkitPoints,0);assert.equal(u.bladeCondition,26);
 const record=weaponRecord(u,'blade');s=act(s,{type:'drop',slot:'blade'});const ground=s.groundItems.find(g=>g.instanceId==='owned-knife');assert.ok(ground);assert.equal(ground.condition,26);
 s=act(restored(s),{type:'loot',groundId:ground.id});assert.equal(s.groundItems.find(g=>g.id===ground.id).count,0);
 const key=Object.keys(s.units[0].inventory).find(k=>s.units[0].inventory[k].instanceId==='owned-knife');assert.ok(key);
 s=act(restored(s),{type:'equipLoot',inventoryKey:key,slot:'blade'});assert.deepEqual(weaponRecord(s.units[0],'blade'),record);
 assert.equal(Object.values(s.units[0].inventory).filter(g=>g.instanceId==='owned-knife'&&g.count>0).length,0);assert.ok(actBattle(s,{type:'loot',unitId:'p',groundId:ground.id}).lastError);
});

test('thrown knives retain their separate condition impact and exact recovered condition',()=>{
 const s=field(25,'primary',{strength:100,marksmanship:100,dexterity:100,agility:100}, {x:4}),knife=heldThrowingKnife(s.units[0]);
 assert.equal(knifeThrowDamage(s.units[0],knife),20);const n=act(s,{type:'throwKnife',targetId:'e',aim:4});assert.equal(n.units[1].hp,80);
 const held=Object.values(n.units[1].inventory).find(g=>g.instanceId==='owned-knife');assert.equal(held.condition,25);assert.equal(n.units[0].weaponDropped,true);
});

test('legacy missing blade condition defaults to sound equipment and saves its actual contact wear',()=>{
 const s=field();delete s.units[0].bladeCondition;const n=act(restored(s),{type:'melee',targetId:'e'});assert.equal(n.units[1].hp,68);assert.equal(n.units[0].bladeCondition,99);
});

test('broken melee and charge controls agree with admission while the retained item can still be repaired',()=>{
 const s=field(0),controls=orderDescriptors(s,s.units[0],{target:s.units[1]});
 for(const id of ['melee','charge'])assert.equal(controls.find(c=>c.id===id).disabled,true,id);
 s.units[0].toolkitPoints=10;const used=repairEquipment(s.units[0],s.units[0],10);spendRepairMaterials(s.units[0],used);
 assert.equal(s.units[0].toolkitPoints,0);assert.equal(s.units[0].bladeCondition,10);assert.equal(meleePreview(s,s.units[0],s.units[1]).valid,true);
 assert.equal(weaponRecord(s.units[0],'blade').instanceId,'owned-knife');
});

test('a broken held blade cannot block the AI paid return to a useful owned firearm',()=>{
 for(const slot of ['primary','blade']){
  const gun={weapon:1805,count:1,weight:1.3,loaded:1,condition:100,instanceId:'enemy-pistol'};
  const gear=slot==='primary'?{weapon:1813,condition:0,weaponInstanceId:'enemy-blade',offHand:gun}:{weapon:1805,condition:100,loaded:1,weaponInstanceId:'enemy-pistol',blade:1813,bladeCondition:0,bladeInstanceId:'enemy-blade',activeSlot:'blade'};
  const s=field(100,'blade',{}, {...gear,ap:100}),enemy=s.units[1],before=structuredClone(s),choice=chooseEnemyAction(s,enemy);
  assert.deepEqual(choice,slot==='primary'?{type:'swapHands',unitId:'e'}:{type:'weapon',unitId:'e',slot:'primary'});assert.deepEqual(s,before);
  const n=endTurn(s);assert.equal(n.lastError,null);assert.ok(n.units[0].hp<100);assert.ok(n.units[1].ap<100);
  const record=slot==='primary'?n.units[1].offHand:weaponRecord(n.units[1],'blade');assert.equal(record.instanceId,'enemy-blade');assert.equal(record.condition,0);
  assert.deepEqual(endTurn(restored(s)),n);assert.doesNotThrow(()=>restored(n));
 }
});
