import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,getReachable,planLoot,actionCosts} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseSupplySharingAction} from '../game/tactical-ai-sharing.js';
import {chooseScavengingAction} from '../game/tactical-ai-scavenging.js';
import {AMMUNITION_TYPES,availableAmmunition} from '../game/ammunition-types.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';

const cartridges=(ammoType,count,extra={})=>({kind:'ammunition',ammoType,count,name:AMMUNITION_TYPES[ammoType].name,weight:.04,...extra});
function field(donor={},receiver={}){
 const s=createBattle([{id:'p',x:1,y:1,ammo:0,inventory:{}}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0})),enemies:[
  {id:'donor',x:12,y:3,facing:2,weapon:1800,loaded:1,ammo:0,inventory:{},medical:0,medkits:0,priming:20,patrol:false,...donor},
  {id:'receiver',x:13,y:3,facing:2,weapon:1800,loaded:0,ammo:0,inventory:{},medical:0,medkits:0,priming:20,patrol:false,...receiver},
 ]});
 s.units[0].ap=0;s.units[1].ap=donor.ap??4;s.units[2].ap=receiver.ap??0;return s;
}
const owner=s=>s.units.find(u=>u.id==='donor');
const ally=s=>s.units.find(u=>u.id==='receiver');
const share=s=>chooseSupplySharingAction({...s,phase:'enemy'},owner(s),[],()=>getReachable(s,owner(s)));
const scavenge=s=>chooseScavengingAction({...s,phase:'enemy'},owner(s),[],()=>getReachable(s,owner(s)));

test('maintenance uses matching inventory cartridges regardless of the scalar display projection',()=>{
 for(const [type,display,wantsReload] of [['musket_75',0,true],['pistol_69',999,false],['rifle_62',999,false]]){
  const s=field({loaded:0,ap:100,inventory:{reserve:cartridges(type,2)}});owner(s).ammo=display;const before=structuredClone(s);
  assert.equal(chooseEnemyAction(s,owner(s))?.type==='reload',wantsReload);assert.deepEqual(s,before);
 }
});

test('different pistols can reload from the same finite compatible family',()=>{
 const s=field({weapon:1805,loaded:0,ap:100,offHand:{weapon:1808,loaded:0,count:1,condition:100,weight:1.3},inventory:{other:cartridges('pistol_69',2)}});
 owner(s).ammo=999;assert.equal(chooseEnemyAction(s,owner(s))?.type,'reload');
 delete owner(s).inventory.other;owner(s).inventory.wrong=cartridges('rifle_62',2);assert.notEqual(chooseEnemyAction(s,owner(s))?.type,'reload');
});

test('sharing picks an exact compatible endpoint and preserves both pistol reload reserves',()=>{
 const s=field({weapon:1805,loaded:0,offHand:{weapon:1808,loaded:0,count:1,condition:100,weight:1.3},inventory:{own:cartridges('pistol_69',1),matching:cartridges('pistol_69',2),wrong:cartridges('rifle_62',20)}},{weapon:1808});
 owner(s).ammo=999;ally(s).ammo=999;assert.equal(share(s),null,'Both of the second pistol’s charges are reserved.');
 owner(s).inventory.matching.count=3;const before=structuredClone(s);
 assert.deepEqual(share(s),{type:'transfer',unitId:'donor',targetId:'receiver',item:'inventory:matching',count:1});assert.deepEqual(s,before);
 ally(s).inventory.received=cartridges('pistol_69',1);ally(s).ammo=0;assert.equal(share(s),null,'Matching physical stock removes demand even with a stale zero display.');
});

test('a real enemy handover preserves exact finite typed stack metadata',()=>{
 const stack=cartridges('musket_75',1,{name:'Cartucho marcado',instanceId:'marked-cartridge',batch:'arsenal-A'});
 const s=field({inventory:{marked:stack,wrong:cartridges('rifle_62',4)}}),before=structuredClone(s);
 assert.equal(share(s).item,'inventory:marked');const n=endTurn(s);
 assert.equal(n.lastError,null);assert.equal(owner(n).ap,0);assert.equal(availableAmmunition(owner(n),1800),0);assert.equal(availableAmmunition(owner(n),1802),4);assert.equal(availableAmmunition(ally(n),1800),1);
 assert.deepEqual(Object.values(ally(n).inventory).find(r=>r.instanceId==='marked-cartridge'),stack);assert.equal(owner(n).inventory.marked,undefined);assert.deepEqual(s,before);
});

test('received compatible cartridges fund a separate paid reload',()=>{
 const s=field({inventory:{reserve:cartridges('musket_75',2)}});ally(s).ap=actionCosts(s,setTestAmmunition(structuredClone(ally(s)),1)).reload;
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(availableAmmunition(owner(n),1800),1);assert.equal(availableAmmunition(ally(n),1800),0);assert.equal(ally(n).loaded,1);assert.equal(ally(n).ap,0);
});

test('ground scavenging ignores incompatible rounds and recovers matching metadata without guessing a legacy type',()=>{
 const s=field({loaded:0,ap:8});ally(s).x=15;
 const ground=(id,stack)=>({id,type:'item',item:'inventory:rounds',x:13,y:3,...stack});
 s.groundItems=[ground('wrong',cartridges('rifle_62',12)),{id:'old',type:'item',item:'ammo',x:13,y:3,count:12,weight:.04},ground('right',cartridges('musket_75',7,{name:'Cartuchos secos',batch:'B'}))];
 owner(s).ammo=999;const before=structuredClone(s),choice=scavenge(s);assert.deepEqual(choice,{type:'loot',unitId:'donor',groundId:'right',count:7});
 const plan=planLoot(s,owner(s),choice);assert.equal(availableAmmunition(plan.receiver,1800),7);assert.equal(Object.values(plan.receiver.inventory).find(r=>r.ammoType==='musket_75').batch,'B');assert.equal(plan.remaining,0);assert.deepEqual(s,before);
 s.groundItems=s.groundItems.slice(0,2);assert.equal(scavenge(s),null);
});

test('an observed nearby body supplies only an exact compatible inventory stack',()=>{
 const s=field({loaded:0,ap:8});Object.assign(ally(s),{hp:0,loaded:0,weaponDropped:true,ammo:999,inventory:{wrong:cartridges('pistol_69',9),marked:cartridges('musket_75',1,{instanceId:'body-round',name:'Cartucho del depósito',batch:'C'})}});
 const before=structuredClone(s),choice=scavenge(s);assert.deepEqual(choice,{type:'loot',unitId:'donor',targetId:'receiver',item:'inventory:marked',count:1});
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(availableAmmunition(owner(n),1800),1);assert.equal(availableAmmunition(ally(n),1800),0);assert.equal(availableAmmunition(ally(n),1805),9);assert.equal(Object.values(owner(n).inventory).find(r=>r.instanceId==='body-round').batch,'C');assert.deepEqual(s,before);
});

test('distant bodies and living allies do not expose private typed inventory for scavenging',()=>{
 for(const patch of [{hp:0,x:15},{hp:10,unconscious:true,x:13}]){
  const s=field({loaded:0,ap:8});Object.assign(ally(s),patch);Object.defineProperty(ally(s),'inventory',{get(){throw Error('Private body inventory was inspected');}});
  assert.equal(scavenge(s),null);
 }
});

test('incompatible reserves do not suppress an actual owned loaded spare',()=>{
 const s=field({loaded:0,ap:6,inventory:{wrong:cartridges('pistol_69',7),pistol:{weapon:1806,count:1,loaded:1,weight:1.3,condition:83,instanceId:'ready-spare'}}});owner(s).ammo=999;
 assert.deepEqual(chooseEnemyAction(s,owner(s)),{type:'equipLoot',unitId:'donor',inventoryKey:'pistol'});
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(owner(n).weapon,1806);assert.equal(owner(n).loaded,1);assert.equal(owner(n).weaponInstanceId,'ready-spare');assert.equal(availableAmmunition(owner(n),'pistol_69'),7);assert.equal(availableAmmunition(owner(n),1806),7);
});
