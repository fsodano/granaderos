import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultProfile} from '../game/recruitment.js';
import {createBattle,actBattle,carriedWeight} from '../game/tactical.js';
import {equipmentFingerprint,equipmentEndpoint,inventoryUsage,readItemStack} from '../game/tactical-inventory.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {DEFAULT_AMMUNITION_MARKET} from '../game/ammunition-market-rules.js';
const issuedMarketStock=Object.values(DEFAULT_AMMUNITION_MARKET.families).reduce((sum,f)=>sum+f.initial,0);
const stockAmmo=s=>[...Object.values(s.ammunitionShops).map(shop=>shop.stock),...Object.values(s.ammunitionStores)].reduce((sum,stock)=>sum+Object.values(stock).reduce((n,count)=>n+count,0),0);
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const personal=(s,id=110)=>sectorInventoryModel(s,'retiro',rosterFor(s),id).personal;
const actor=(b,id=110)=>b.units.find(u=>u.id===String(id));
const pocket=(u,item)=>{const slot=inventoryUsage(u).slots.find(p=>p.entry?.item===item);assert.ok(slot,`A physical pocket must contain ${item}`);return slot.id;};
const stackAt=(u,id)=>{const endpoint=equipmentEndpoint(u,id);assert.ok(endpoint.item);return readItemStack(u,endpoint.item,1);};
const total=s=>stockAmmo(s)+s.recruited.reduce((n,id)=>n+Object.values(unitAmmunitionByType(personal(s,id))).reduce((a,b)=>a+b,0),0);
function action(s,type,options={},id=110){
 const u=personal(s,id);
 return {type:'sectorInventory',sector:'retiro',operativeId:id,direction:'arrange',kind:'cursor',cursorAction:type,
  expectedSource:equipmentFingerprint(u,['pickupEquipment','dragEquipment'].includes(type)?options.sourceId:'cursor'),
  ...(options.destinationId?{expectedDestination:equipmentFingerprint(u,options.destinationId)}:{}),...options};
}
function unchangedEconomy(before,after){
 for(const key of ['resources','hour','secondOfHour','seed','merchants','contracts','equipmentShipments'])assert.deepEqual(after[key],before[key],key);
}
function arrange(s,type,options={},id=110){const next=order(s,action(s,type,options,id));unchangedEconomy(s,next);return next;}
function reject(s,a){const before=structuredClone(s),next=dispatchCampaign(s,a);assert.ok(next.lastError);assert.deepEqual(s,before);assert.deepEqual({...next,lastError:null},{...s,lastError:null});return next;}
function hire(){const start=initialCampaign(8);assert.deepEqual(start.recruited,[]);const s=order(start,{type:'recruitCivic',id:110,term:'week'});assert.ok(s.resources.treasury<start.resources.treasury);return s;}
function visit(s){
 s=order(s,{type:'visitSector'});
 const request=s.pendingBattle,b=createBattle(request.squad.map((u,i)=>({...u,x:2+i,y:2})),{...request,width:12,height:10,
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[],props:[],npcs:request.npcs.map((npc,i)=>({...npc,x:10-i,y:8}))});
 return {s,b};
}
function leave(s,b){const synced=syncBattleTime(s,b);assert.equal(synced.error,null);return order(synced.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:synced.battle,survivors:synced.battle.units.filter(u=>u.side==='player')});}
function suppliedOfficer(){
 let {s,b}=visit(hire());
 b=act(b,{type:'drop',unitId:'110',item:'inventory:ammo:musket_75',count:3});s=leave(s,b);
 s=order(s,{type:'createOfficer',name:'Elena Aguirre',answers:{origin:'estancia',doctrine:'cavalry_commander',crisis:'rally',specialty:'rider',temperament:'steady'},profile:{...defaultProfile(),classId:'soldado'}});
 assert.equal(s.operativeState[1000].carriedLoaded,undefined);
 const row=sectorInventoryModel(s,'retiro',rosterFor(s),1000).entries.find(entry=>JSON.parse(entry.expected).ammoType==='musket_75');assert.ok(row?.reachable);
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'take',sourceKey:row.key,expected:row.expected,count:3});
 assert.equal(total(s),issuedMarketStock);return s;
}

test('a new officer loads three recovered cursor cartridges into an unissued gun and keeps the exact remainder through saves and deployment',()=>{
 let s=suppliedOfficer();const id=1000,sourceId=pocket(personal(s,id),'inventory:ammo:musket_75'),weight=carriedWeight(personal(s,id));
 s=arrange(s,'pickupEquipment',{sourceId,count:3},id);s=save(s);
 const before=structuredClone(personal(s,id)),cursor=before.equipmentCursor;
 s=arrange(s,'placeEquipment',{destinationId:'hand:right'},id);
 assert.equal(s.operativeState[id].carriedLoaded,1);assert.equal(s.operativeState[id].carriedAmmo,1);
 assert.deepEqual(ammunitionByType(s.operativeState[id]),{});
 assert.deepEqual(personal(s,id).equipmentCursor,{...cursor,stack:{...cursor.stack,count:2}});
 assert.equal(personal(s,id).weapon,before.weapon);assert.equal(personal(s,id).condition,before.condition);
 assert.equal(personal(s,id).priming,undefined);assert.ok(Math.abs(carriedWeight(personal(s,id))-weight)<1e-9);assert.equal(total(s),issuedMarketStock);
 assert.match(s.log[0].text,/recarga Brown Bess con 1 cartucho/);assert.doesNotMatch(s.log[0].text,/ordena su equipo/);
 s=save(s);assert.equal(personal(s,id).loaded,1);assert.equal(personal(s,id).equipmentCursor.stack.count,2);
 const full=action(s,'placeEquipment',{destinationId:'hand:right'},id);assert.match(reject(s,full).lastError,/ya está cargada/);
 s=arrange(s,'returnEquipmentCursor',{},id);assert.deepEqual(ammunitionByType(personal(s,id)),{musket_75:2});
 s=order(save(s),{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 assert.equal(actor(b,id).loaded,1);assert.deepEqual(unitAmmunitionByType(actor(b,id)),{musket_75:10});
 ({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));s=leave(s,b);assert.equal(total(s),issuedMarketStock);assert.equal(personal(s,id).loaded,1);assert.deepEqual(save(s),s);
});

function partlyLoadedPistol(){
 let s=hire();s=order(s,{type:'purchaseEquipment',item:1808});s=order(s,{type:'equip',operativeId:110,itemId:1808,slot:'weapon'});
 let b;({s,b}=visit(s));assert.equal(actor(b).loaded,2);
 b=act(b,{type:'firePoint',unitId:'110',x:5,y:2});assert.equal(actor(b).loaded,1);assert.equal(actor(b).jammed,false);
 s=leave(s,b);assert.equal(personal(s).loaded,1);assert.equal(total(s),issuedMarketStock-1);return s;
}

test('a paid double-barrel pistol loads in either hand or its pocket without changing its physical state or consuming the general reserve',()=>{
 for(const hostId of ['hand:right','hand:left','large-4']){
  let s=partlyLoadedPistol();
  if(hostId!=='hand:right'){s=arrange(s,'pickupEquipment',{sourceId:'hand:right'});s=arrange(s,'placeEquipment',{destinationId:hostId});if(personal(s).equipmentCursor)s=arrange(s,'returnEquipmentCursor');}
  const u=personal(s),gun=stackAt(u,hostId),hands=['hand:right','hand:left'].map(id=>equipmentEndpoint(u,id)),weight=carriedWeight(u),sourceId=pocket(u,'inventory:ammo:pistol_69');
  s=arrange(s,'pickupEquipment',{sourceId,count:5});const before=personal(s),remainingInventory=structuredClone(before.inventory),cursor=before.equipmentCursor;
  s=arrange(save(s),'placeEquipment',{destinationId:hostId});const loaded=stackAt(personal(s),hostId);
  assert.deepEqual(loaded,{...gun,loaded:2});assert.equal(personal(s).equipmentCursor.stack.count,4);
  assert.deepEqual(personal(s).equipmentCursor,{...cursor,stack:{...cursor.stack,count:4}});
  for(const [key,record]of Object.entries(remainingInventory))if(record.kind==='ammunition')assert.deepEqual(personal(s).inventory[key],record);
  assert.deepEqual(['hand:right','hand:left'].map(id=>equipmentEndpoint(personal(s),id).item),hands.map(hand=>hand.item));
  assert.equal(personal(s).priming,undefined);assert.ok(Math.abs(carriedWeight(personal(s))-weight)<1e-9);assert.equal(total(s),issuedMarketStock-1);
  s=save(s);assert.equal(stackAt(personal(s),hostId).loaded,2);assert.equal(personal(s).equipmentCursor.stack.count,4);
  s=arrange(s,'returnEquipmentCursor');s=order(save(s),{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);
  assert.equal(stackAt(actor(b),hostId).loaded,2);({campaign:s,battle:b}=decodeSave(encodeSave(s,b)));s=leave(s,b);
  assert.equal(stackAt(personal(s),hostId).loaded,2);assert.equal(total(s),issuedMarketStock-1);assert.deepEqual(save(s),s);
 }
});

test('campaign cursor loading rejects stale and incompatible destinations atomically, including drag orders',()=>{
 let s=suppliedOfficer();const id=1000,sourceId=pocket(personal(s,id),'inventory:ammo:musket_75');
 for(const patch of [{expectedSource:'stale'},{expectedDestination:'stale'},{count:4}])reject(s,{...action(s,'dragEquipment',{sourceId,destinationId:'hand:right',count:3},id),...patch});
 s=arrange(s,'dragEquipment',{sourceId,destinationId:'hand:right',count:3},id);assert.equal(personal(s,id).loaded,1);assert.equal(personal(s,id).equipmentCursor.stack.count,2);
 s=arrange(s,'returnEquipmentCursor',{},id);s=order(s,{type:'purchaseEquipment',item:1805});s=order(s,{type:'equip',operativeId:id,itemId:1805,slot:'weapon'});
 s=arrange(s,'pickupEquipment',{sourceId:pocket(personal(s,id),'inventory:ammo:musket_75'),count:2},id);
 assert.match(reject(s,action(s,'placeEquipment',{destinationId:'hand:right'},id)).lastError,/no es compatible/);
 assert.equal(personal(s,id).weapon,1805);assert.equal(personal(s,id).loaded,0);assert.equal(personal(s,id).equipmentCursor.stack.count,2);assert.deepEqual(save(s),s);
});

test('saved unfinished loading belongs to the gun and completing it removes progress without losing cursor cartridges',()=>{
 let s=partlyLoadedPistol();
 // This saved-work fixture adds no gun or ammunition. The physical pistol has
 // one loaded barrel and half of the next loading action already completed.
 s.operativeState[110].carriedReloadProgress=.5;s=save(s);
 const sourceId=pocket(personal(s),'inventory:ammo:pistol_69');s=arrange(s,'pickupEquipment',{sourceId,count:2});
 s=arrange(save(s),'placeEquipment',{destinationId:'hand:right'});
 assert.equal(s.operativeState[110].carriedLoaded,2);assert.equal(s.operativeState[110].carriedReloadProgress,undefined);
 assert.equal(personal(s).reloadProgress,undefined);assert.equal(personal(s).equipmentCursor.stack.count,1);assert.equal(total(s),issuedMarketStock-1);
 s=arrange(save(s),'returnEquipmentCursor');s=order(save(s),{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 assert.equal(actor(b).loaded,2);assert.equal(actor(b).reloadProgress,undefined);assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));
});
