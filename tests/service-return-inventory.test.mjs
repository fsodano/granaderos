import {withLegacyRepairReserve} from './custody-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor,initialCampaign as freshCampaign} from '../game/campaign.js';
import {createBattle} from '../game/tactical.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {serviceReturnSources,MAX_SERVICE_RETURN_STACKS} from '../game/service-equipment-return.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {stackAmmunitionByType,unitAmmunitionByType} from '../game/physical-ammunition.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';

const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const model=(s,id=10,site='retiro')=>sectorInventoryModel(s,site,rosterFor(s),id);
const take=(row,count=1,id=10,site='retiro')=>({type:'sectorInventory',sector:site,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
const repair=(row,count=1,id=10,site='retiro')=>({...take(row,count,id,site),direction:'takeRepairPoints'});
const reject=(s,action)=>{const before=structuredClone(s),next=dispatchCampaign(s,action);assert.ok(next.lastError);assert.deepEqual(s,before);assert.deepEqual({...next,lastError:null},{...s,lastError:null});};
const returnRows=s=>model(s).entries.filter(row=>row.kind==='serviceReturn');

function prepared({full=true,unvisited=false,overflow=false,content=null,extraStack=null}={}){
 let s=content?freshCampaign(45,content):initialCampaign(45);
 if(content){s.recruited=[3,4,10];s.squad=[3,4,10];s.squads[0].members=[3,4,10];s.contracts=Object.fromEntries(s.recruited.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));}
 s.loadouts[4]={weapon:1800};
 delete s.operativeState[4].weaponMetadata;
 if(extraStack){const {item,...record}=extraStack;s.operativeState[4].inventory??={};s.operativeState[4].inventory.authored=record;}
 Object.assign(s.operativeState[4],{weaponInstanceId:'service-musket',condition:62,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'service-bayonet',condition:47}}});
 s=withLegacyRepairReserve(s,4);
 if(!unvisited){
  s=order(s,{type:'visitSector'});const request=s.pendingBattle;
  const tiles=Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false}));
  const b=createBattle(request.squad.map((unit,i)=>({...unit,x:2,y:2+i})),{...request,width:12,height:10,tiles,enemies:[],props:[],npcs:request.npcs.map((npc,i)=>({...npc,x:10-i,y:8}))});
  s=order(s,{type:'leaveSector',battleId:request.id,sectorState:b,survivors:b.units.filter(unit=>unit.side==='player')});
  // Exercise the real scene limit without displacing existing equipment.
  if(full)s.sectorStates.retiro.groundItems=Array.from({length:2000},(_,i)=>({id:`occupied-${i}`,type:'item',item:'rations',count:1,weight:.5,x:1,y:1}));
 }
 if(overflow){
  // A full validated background cache forces the one former-carrier fallback.
  s.serviceEquipmentReturns={version:1,nextId:2,entries:[{id:'service-return-1',siteId:'cordoba',sectorId:'cordoba',operativeId:3,entryEdge:'S',entryAnchor:{x:10,y:15},repairPoints:0,items:Array.from({length:MAX_SERVICE_RETURN_STACKS},(_,i)=>({selection:`stock-${i}`,stack:{item:'rations',count:1,weight:.5}}))}]};
 }
 return order(s,{type:'dismiss',id:4});
}

test('cached service equipment uses normal map collection and keeps fitted loaded identities exactly once',()=>{
 let s=save(prepared()),row=returnRows(s).find(row=>JSON.parse(row.expected).instanceId==='service-musket');
 assert.ok(row?.reachable);const exact=JSON.parse(row.expected),before=structuredClone(s.sectorStates.retiro.groundItems);
 assert.equal(exact.loaded,1);assert.equal(exact.condition,62);assert.equal(exact.fittings.bayonet.instanceId,'service-bayonet');
 s=order(s,take(row));const received=Object.values(s.operativeState[10].inventory).find(item=>item.instanceId==='service-musket');
 const {item,...record}=exact;assert.deepEqual(received,record);assert.deepEqual(s.sectorStates.retiro.groundItems,before);
 assert.ok(!returnRows(s).some(item=>item.key===row.key));reject(s,take(row));s=save(s);
 assert.equal(Object.values(s.operativeState[10].inventory).filter(item=>item.instanceId==='service-musket').length,1);
 assert.equal(s.operativeState[4].carriedLoaded,0);assert.equal(s.loadouts[4].weapon,0);
});

test('partial returned supplies and typed cartridges debit only their exact source and conserve cartridges',()=>{
 let s=prepared();const dressings=returnRows(s).find(row=>JSON.parse(row.expected).item==='medkits'),before=s.operativeState[10].medkits;
 assert.equal(dressings.count,2);s=order(s,take(dressings));assert.equal(s.operativeState[10].medkits,before+1);
 assert.equal(returnRows(s).find(row=>row.key===dressings.key).count,1);reject(s,take(dressings));
 const row=returnRows(s).find(row=>JSON.parse(row.expected).kind==='ammunition'),stack=JSON.parse(row.expected),count=Math.min(3,row.count);
 const owned=unitAmmunitionByType(model(s).personal),source=stackAmmunitionByType(stack);
 s=order(s,take(row,count));const remaining=returnRows(s).find(item=>item.key===row.key),next=unitAmmunitionByType(model(s).personal),loose=remaining?stackAmmunitionByType(JSON.parse(remaining.expected)):{};
 for(const type of Object.keys(source))assert.equal((next[type]??0)+(loose[type]??0),(owned[type]??0)+source[type]);
 assert.deepEqual(save(s),s);
});

test('former-carrier fallback uses the same source and partial collection then empties each physical owner',()=>{
 let s=save(prepared({overflow:true}));assert.ok(s.operativeState[4].serviceEquipmentReturn);
 const rows=returnRows(s),medkits=rows.find(row=>JSON.parse(row.expected).item==='medkits');
 s=order(s,take(medkits));assert.equal(s.operativeState[4].medkits,1);assert.equal(returnRows(s).find(row=>row.key===medkits.key).count,1);reject(s,take(medkits));
 // Use actual local recipients with enough remaining pockets for each transfer.
 for(const original of rows){
  const row=returnRows(s).find(row=>row.key===original.key);if(!row)continue;
  let accepted=false;
  for(const id of [10,3]){const result=dispatchCampaign(s,take(row,row.count,id));if(!result.lastError){s=result;accepted=true;break;}}
  assert.ok(accepted,row.label);
 }
 const reserve=model(s).repairReserves[0];s=order(s,repair(reserve,reserve.repairPoints));
 assert.equal(s.operativeState[4].serviceEquipmentReturn,undefined);assert.equal(s.operativeState[4].carriedLoaded,0);assert.equal(s.loadouts[4].weapon,0);assert.deepEqual(s.operativeState[4].inventory,{});
 assert.equal(serviceReturnSources(s,'retiro').length,0);assert.deepEqual(save(s),s);
});

test('returned authored weapon definitions, partial reload and selected typed load survive map collection and save',()=>{
 const authored={id:'pistola-del-correo',template:1808,name:'Pistola del correo',damage:24,fireAP:18,readyAP:5,aimAP:0,reloadAP:54,range:14,capacity:3,weight:1.7,price:91,art:'/art/custom-pistol.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:19,range:20,pattern:'single'}]},definition=compileWeaponDefinition(authored),content=defaultContentPackage();content.weapons.push(authored);
 const stack={item:'weapon',weapon:1808,count:1,weight:1.7,loaded:2,reloadProgress:.5,ammunitionChoice:'ammoRifle',condition:61,jammed:true,instanceId:'returned-authored-gun',contentWeapon:definition,provenance:{owner:'Correo'}};
 let s=save(prepared({content,extraStack:stack}));
 const row=returnRows(s).find(row=>JSON.parse(row.expected).instanceId===stack.instanceId);assert.ok(row.reachable);s=order(s,take(row));
 const {item,...exact}=stack;assert.deepEqual(Object.values(s.operativeState[10].inventory).find(item=>item.instanceId===stack.instanceId),exact);assert.deepEqual(save(s),s);reject(s,take(row));
});

test('changed rows, excess quantities and full recipient packs reject atomically for cached and fallback owners',()=>{
 for(const overflow of [false,true]){
  const base=prepared({overflow}),row=returnRows(base).find(row=>JSON.parse(row.expected).item==='medkits');
  reject(base,{...take(row),expected:'stale'});reject(base,take(row,row.count+1));
  for(const count of [0,-1,1.5,Infinity])reject(base,take(row,count));
  const full=structuredClone(base);full.operativeState[10].inventory={bulky:{count:7,weight:4}};reject(full,take(row));
  const missing=structuredClone(base);missing.serviceEquipmentReturns.entries=missing.serviceEquipmentReturns.entries.filter(entry=>entry.siteId!=='retiro');delete missing.operativeState[4].serviceEquipmentReturn;reject(missing,take(row));
 }
});

test('cached and fallback collection retain local, awake, conscious, controlled and encounter guards',()=>{
 for(const overflow of [false,true]){
  const base=prepared({overflow}),row=returnRows(base)[0],reserve=model(base).repairReserves[0];
  for(const change of [s=>s.operativeState[10].asleep=true,s=>s.operativeState[10].hp=9,s=>s.operativeState[10].unconscious=true,s=>s.operativeState[10].energy=0,s=>s.operativeState[10].routed=true,s=>s.operativeState[10].captured=true,s=>s.squads[0].location='ensenada',s=>s.squads[0].journey={status:'moving'},s=>s.sectors.retiro.owner='royalist',s=>s.pendingEncounter={sector:'retiro'},s=>s.pendingBattle={id:'pending'},s=>s.sectorStates.retiro.sectorCleared=false]){
   const s=structuredClone(base);change(s);reject(s,take(row));reject(s,repair(reserve));
  }
 }
});

test('returned caches remain known in unvisited sites but cannot be collected without actual scene access',()=>{
 const s=prepared({unvisited:true}),row=returnRows(s)[0],reserve=model(s).repairReserves[0],before=structuredClone(s);
 assert.equal(row.reachable,false);assert.equal(row.x,undefined);assert.equal(reserve.reachable,false);reject(s,take(row));reject(s,repair(reserve));
 const known=playerKnownCampaign(s).sectors.find(sector=>sector.id==='retiro');assert.ok(known.equipment.length>0);assert.equal(known.repairReserves[0].repairPoints,100);
 assert.doesNotMatch(JSON.stringify(known),/expected|operativeId|entryAnchor|returnLedger|serviceEquipmentReturns/);assert.deepEqual(s,before);assert.deepEqual(save(s),s);
});

test('cached mission sites stay separate and no open path or matching floor means no remote collection',()=>{
 const base=prepared(),entry=base.serviceEquipmentReturns.entries.find(entry=>entry.siteId==='retiro');
 entry.siteId='yatasto';entry.sectorId='tucuman';delete entry.point;
 const sites=sectorInventorySites(base,'tucuman');assert.ok(sites.some(site=>site.id==='yatasto'&&site.count>0));assert.ok(!sectorInventorySites(base,'retiro').some(site=>site.id==='yatasto'));
 assert.equal(model(base,10,'yatasto').entries[0].reachable,false);assert.deepEqual(save(base),base);
 for(const elevated of [false,true]){
  const s=prepared(),marker=s.serviceEquipmentReturns.entries.find(entry=>entry.siteId==='retiro');marker.point={x:8,y:3,...(elevated?{tacticalLevel:1}:{})};
  if(elevated)s.sectorStates.retiro.upperSurfaces=[{id:'isolated-roof',x:8,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0}];
  else for(const tile of s.sectorStates.retiro.tiles.filter(tile=>tile.x===4)){tile.blocked=true;tile.blocksSight=true;tile.type='wall';}
  const row=returnRows(s)[0],reserve=model(s).repairReserves[0];assert.equal(row.reachable,false);assert.equal(reserve.reachable,false);reject(s,take(row));reject(s,repair(reserve));
 }
});

test('repair reserves transfer finite points partially, reject stale/full requests and never create toolkit stacks',()=>{
 for(const overflow of [false,true]){
  let s=prepared({overflow}),row=model(s).repairReserves[0],before=s.operativeState[10].toolkitPoints,inventory=structuredClone(s.operativeState[10].inventory);
  assert.equal(row.repairPoints,100);assert.equal(row.reachable,true);
  s=order(s,repair(row,35));assert.equal(s.operativeState[10].toolkitPoints,before+35);assert.equal(model(s).repairReserves[0].repairPoints,65);assert.deepEqual(s.operativeState[10].inventory,inventory);reject(s,repair(row));
  row=model(s).repairReserves[0];for(const count of [0,-1,1.5,66,100001])reject(s,repair(row,count));
  const full=structuredClone(s);full.operativeState[10].toolkitPoints=99990;reject(full,repair(row,11));
  s=order(full,repair(row,10));assert.equal(s.operativeState[10].toolkitPoints,100000);assert.equal(model(s).repairReserves[0].repairPoints,55);assert.equal(model(s).repairReserves[0].capacity,0);
  const remaining=model(s,3).repairReserves[0];s=order(s,repair(remaining,55,3));assert.equal(model(s).repairReserves.length,0);reject(s,repair(remaining));assert.deepEqual(save(s),s);
 }
});
