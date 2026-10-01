import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,carriedWeight} from '../game/tactical.js';
import {fittingFromItem,fittingToItem,validateFitting} from '../game/weapon-fittings.js';
import {planFitBayonet,planRemoveBayonet,handRecord,validateItemStack,validateEquipmentCursor,inventoryUsage} from '../game/tactical-inventory.js';
import {repairEquipment} from '../game/equipment-repair.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {planEquipmentCursorReturn} from '../game/equipment-cursor.js';
import {POCKETS} from '../game/inventory-pockets.js';

const legacy={weapon:1811,fittingPattern:'india_socket',instanceId:'bayonet',condition:73};
const details={name:'Bayoneta de familia',proof:{mark:'B-17',origin:['Retiro',1812],inspected:true,annotation:null},engraving:'Cabral'};
const loose=(extra={})=>({item:'weapon',count:1,weight:.5,loaded:0,jammed:false,...legacy,...structuredClone(details),...extra});
function battle(extra={},sector={}) {
 const s=createBattle([{id:'p',name:'Portador',x:1,y:3,weapon:1800,weaponInstanceId:'gun',condition:66,loaded:1,jammed:true,blade:0,ammo:0,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,...extra}],{
  id:'fitting-metadata',width:12,height:8,seed:127,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'e',x:3,y:3,weapon:1800,morale:100,overwatch:false},{id:'reserve',x:10,y:7,overwatch:false}],...sector,
 });
 s.units[0].ap=100;return s;
}
const order=(s,a)=>{const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,next.lastError);return next;};
const saved=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const metadataOnly=stack=>{const {item,count,weight,loaded,jammed,weapon,condition,instanceId,fittingPattern,...metadata}=stack;return metadata;};

test('canonical legacy fittings remain four fields and retain their original loose weight',()=>{
 const stack={item:'weapon',count:1,weight:.5,loaded:0,jammed:false,...legacy};
 assert.deepEqual(fittingFromItem(stack,1800),legacy);
 assert.deepEqual(fittingToItem(legacy),stack);
 assert.equal(validateFitting(legacy,1800),true);
 assert.equal(validateFitting({...legacy,metadata:{weight:.5}},1800),true);
});

test('shared fitting conversions preserve custom JSON data independently of their input',()=>{
 const original=loose(),before=structuredClone(original),fitting=fittingFromItem(original,1800);
 assert.deepEqual(fitting,{...legacy,metadata:details});assert.deepEqual(original,before);
 original.proof.origin[0]='changed';assert.equal(fitting.metadata.proof.origin[0],'Retiro');
 const detached=fittingToItem(fitting);assert.deepEqual(detached,before);validateItemStack(detached);
 detached.proof.mark='changed';assert.equal(fitting.metadata.proof.mark,'B-17');
 assert.deepEqual(fittingToItem(JSON.parse(JSON.stringify(fitting))),before);
});

test('legacy hand and pack fitting routes retain exact custom data, host contents and weight through JSON',()=>{
 for(const source of ['blade','inventory:socket'])for(const destination of ['blade','inventory']) {
  const extra=source==='blade'?{blade:1811,bladeCondition:73,bladeInstanceId:'bayonet',bladeFittingPattern:'india_socket',bladeMetadata:structuredClone(details)}:{inventory:{socket:loose()}};
  let s=battle(extra),u=s.units[0],weight=carriedWeight(u),before=structuredClone(u);
  const preview=planFitBayonet(u,source);assert.deepEqual(u,before);assert.deepEqual(preview.fitting.metadata,details);
  s=order(saved(s),{type:'fitBayonet',item:source});assert.equal(s.units[0].ap,88);assert.equal(carriedWeight(s.units[0]),weight);
  assert.deepEqual(s.units[0].weaponFittings.bayonet.metadata,details);
  s=order(saved(s),{type:'removeBayonet',destination});u=s.units[0];assert.equal(u.ap,80);assert.equal(carriedWeight(u),weight);
  const detached=destination==='blade'?handRecord(u,'blade'):Object.values(u.inventory).find(item=>item.instanceId==='bayonet');
  assert.deepEqual(metadataOnly(detached),details);assert.equal(detached.condition,73);assert.equal(detached.weight,.5);
  assert.equal(u.weaponInstanceId,'gun');assert.equal(u.loaded,1);assert.equal(u.condition,66);assert.equal(u.jammed,true);
  assert.deepEqual(saved(s),s);
 }
});

test('actual bayonet thrust and finite repair change only live condition before exact detachment',()=>{
 let s=order(battle({inventory:{socket:loose()}}),{type:'fitBayonet',item:'inventory:socket'});
 s=order(order(s,{type:'weaponMode',mode:'melee'}),{type:'useItem',targetId:'e'});
 const worn=s.units[0].weaponFittings.bayonet;assert.equal(worn.condition,72);assert.deepEqual(worn.metadata,details);
 assert.equal(s.units[0].condition,66);assert.equal(s.units[0].loaded,1);
 // Isolate the already worn item in the ordinary repair queue. The finite
 // budget must update that fitting rather than a copy of its old condition.
 const record={inventory:{host:{item:'weapon',count:1,weapon:1800,weight:4,condition:100,loaded:1,jammed:false,fittings:{bayonet:structuredClone(worn)}}}};
 assert.equal(repairEquipment(record,{},5),5);
 const repaired=record.inventory.host.fittings.bayonet,detached=fittingToItem(repaired);
 assert.equal(detached.condition,77);assert.deepEqual(metadataOnly(detached),details);assert.equal(detached.instanceId,'bayonet');
 assert.equal(record.inventory.host.condition,100);assert.equal(record.inventory.host.loaded,1);
 assert.deepEqual(fittingToItem(JSON.parse(JSON.stringify(repaired))),detached);
});

test('completed legacy fit and removal lower a raised gun while rejected actions preserve readiness and custody',()=>{
 let s=battle({inventory:{socket:loose()},weaponReady:true});
 const insufficient=structuredClone(s);insufficient.units[0].ap=11;
 const rejected=actBattle(insufficient,{unitId:'p',type:'fitBayonet',item:'inventory:socket'});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.units,insufficient.units);assert.equal(rejected.elapsedSeconds,insufficient.elapsedSeconds);
 assert.equal(planFitBayonet(s.units[0],'inventory:socket').unit.weaponReady,undefined);
 s=order(s,{type:'fitBayonet',item:'inventory:socket'});assert.equal(s.units[0].weaponReady,undefined);
 s.units[0].weaponReady=true;
 assert.equal(planRemoveBayonet(s.units[0],'inventory').unit.weaponReady,undefined);
 s=order(s,{type:'removeBayonet',destination:'inventory'});assert.equal(s.units[0].weaponReady,undefined);
});

test('metadata cannot override canonical fields or conceal nested equipment ownership',()=>{
 const forbidden=['instanceId','weaponInstanceId','bladeInstanceId','fittings','weaponFittings','fittingPattern','weaponFittingPattern','bladeFittingPattern','equipmentCursor','inventory','offHand','weaponMetadata','bladeMetadata'];
 for(const key of forbidden)for(const metadata of [{[key]:'hidden'},{proof:{[key]:'hidden'}},{proof:[{[key]:'hidden'}]}]) {
  assert.throws(()=>validateFitting({...legacy,metadata},1800),key);
  assert.throws(()=>fittingToItem({...legacy,metadata}),key);
 }
 for(const key of ['item','count','weapon','loaded','condition','jammed','reloadProgress'])assert.throws(()=>validateFitting({...legacy,metadata:{[key]:0}},1800),key);
 for(const weight of [0,1,null,NaN,Infinity,'0.5']) {
  assert.throws(()=>validateFitting({...legacy,metadata:{weight}},1800));
  assert.throws(()=>fittingFromItem(loose({weight}),1800));
 }
 for(const extra of [{extra:true},{metadata:null},{metadata:[]},{metadata:{proof:undefined}},{metadata:{proof:Infinity}},{metadata:{proof:()=>0}},{metadata:{proof:new Date()}}])assert.throws(()=>validateFitting({...legacy,...extra},1800));
 const cyclic={};cyclic.self=cyclic;assert.throws(()=>validateFitting({...legacy,metadata:cyclic},1800));
 const prototypeKey=JSON.parse('{"proof":{"__proto__":{"instanceId":"hidden"}}}');assert.throws(()=>validateFitting({...legacy,metadata:prototypeKey},1800));
 assert.throws(()=>fittingFromItem(loose({proof:{instanceId:'hidden'}}),1800));
});

test('battle saves preserve custom fittings but reject their malformed metadata at each custody location',()=>{
 const fitted=order(battle({inventory:{socket:loose()}}),{type:'fitBayonet',item:'inventory:socket'});
 for(const location of ['held','pack','ground','cursor']) {
  const s=structuredClone(fitted),fitting=structuredClone(s.units[0].weaponFittings.bayonet);
  if(location!=='held') {
   s.units[0].weaponFittings={};
   const host={item:'weapon',count:1,weapon:1800,weight:4,loaded:0,condition:100,jammed:false,fittings:{bayonet:fitting}};
   if(location==='pack')s.units[0].inventory.host=host;
   if(location==='ground')s.groundItems.push({...host,id:'ground-host',type:'item',x:1,y:3});
   if(location==='cursor')s.units[0].equipmentCursor={sourceId:'large-1',stack:host};
  }
  assert.deepEqual(saved(s),s);
  const host=location==='held'?s.units[0].weaponFittings.bayonet:location==='pack'?s.units[0].inventory.host.fittings.bayonet:location==='ground'?s.groundItems[0].fittings.bayonet:s.units[0].equipmentCursor.stack.fittings.bayonet;
  host.metadata.proof.instanceId='concealed';assert.throws(()=>saved(s),location);
 }
});

test('detached-fitting source hints admit only actual weapon-capable physical slots and keep identity checks',()=>{
 for(const sourceId of ['hand:right','hand:left',...POCKETS.map(p=>p.id)]) {
  const s=battle({}, {exploration:true,enemies:[]});s.units[0].equipmentCursor={sourceId:`attachment:${sourceId}`,stack:loose()};
  assert.equal(validateEquipmentCursor(s.units[0]),true);assert.deepEqual(saved(s),s);
 }
 for(const sourceId of ['attachment:outfit','attachment:cursor','attachment:large-5','attachment:small-9','attachment:attachment:hand:right','attachment:','attachment:primary']) {
  const u=battle().units[0];u.equipmentCursor={sourceId,stack:loose()};assert.throws(()=>validateEquipmentCursor(u),sourceId);
 }
 const duplicated=battle({inventory:{socket:loose()}}).units[0];duplicated.equipmentCursor={sourceId:'attachment:hand:right',stack:loose()};assert.throws(()=>validateEquipmentCursor(duplicated),/duplicada/);
});

test('cancelling a detached fitting uses a real pocket or ground and cannot remount it for free',()=>{
 for(const full of [false,true]) {
  const inventory=full?Object.fromEntries(POCKETS.map(p=>[p.id,{name:p.id,instanceId:p.id,count:1,weight:p.size==='large'?3:0}])):{};
  const u=battle({inventory,equipmentCursor:{sourceId:'attachment:hand:right',stack:loose()}},{exploration:true,enemies:[]}).units[0],before=structuredClone(u),weight=carriedWeight(u);
  if(full)assert.equal(inventoryUsage(u).free,0);
  const returned=planEquipmentCursorReturn(u);assert.deepEqual(u,before);assert.deepEqual(returned.unit.weaponFittings,{});assert.equal(returned.unit.weaponInstanceId,'gun');assert.equal(returned.unit.equipmentCursor,undefined);
  const item=full?returned.dropped:Object.values(returned.unit.inventory).find(r=>r.instanceId==='bayonet');
  assert.deepEqual(metadataOnly(item),details);assert.equal(item.instanceId,'bayonet');assert.equal(item.weight,.5);
  assert.equal(carriedWeight(returned.unit)+(full?.5:0),weight);
 }
});
