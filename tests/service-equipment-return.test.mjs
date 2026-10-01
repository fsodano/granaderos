import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign as freshCampaign,dispatchCampaign,rosterFor,recruitmentStatus} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {createBattle,actBattle} from '../game/tactical.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {readItemStack,equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {BODY_SLOTS} from '../game/outfits.js';
import {unitAmmunitionByType,stackAmmunitionByType,addAmmoCounts,syncCarriedAmmunition} from '../game/physical-ammunition.js';
import {validateEquipmentOwnership} from '../game/equipment.js';
import {serviceReturnSources,serviceReturnCacheBytes,consumeServiceReturn,MAX_SERVICE_RETURN_STACKS,MAX_SERVICE_RETURN_BYTES} from '../game/service-equipment-return.js';
import {contractQuote} from '../game/contracts.js';
import {defaultContentPackage} from '../game/content-package.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {encountersFor} from '../game/encounters.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {localPackage,readyLocal,hireLocal,localId,localNPC,visit as visitLocal,leave as leaveLocal,sync as syncLocal} from './local-contract-fixture.mjs';
import {woundedService} from './civilian-service-fixture.mjs';
import {refreshMilitaryCondition} from '../game/actor-condition.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const saved=s=>decodeSave(encodeSave(s)).campaign;
const hire=(s=initialCampaign(45),term='day')=>order(s,{type:'recruitCivic',id:110,term});
const personal=(s,id=110)=>sectorInventoryModel(s,s.operativeState[id].location??s.location,rosterFor(s),id).personal;
const rows=(s,site='retiro',id=110)=>serviceReturnSources(s,site).filter(row=>row.operativeId===id);
const reject=(s,a)=>{const before=structuredClone(s),n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual(s,before);assert.deepEqual({...n,lastError:null},{...s,lastError:null});return n;};
const packets=items=>items.map(item=>JSON.stringify(item)).sort();
const ammunition=stacks=>stacks.reduce((total,stack)=>addAmmoCounts(total,stackAmmunitionByType(stack)),{});
const groundStacks=s=>(s.sectorStates.retiro?.groundItems??[]).filter(item=>item.id.startsWith('service-return-')).map(({id,type,x,y,tacticalLevel,knownToPlayer,...stack})=>stack);
const take=(row,count=row.stack?.count??row.count,id=10,site='retiro')=>({type:'sectorInventory',sector:site,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
const repair=(row,count,id=10,site='retiro')=>({type:'sectorInventory',sector:site,operativeId:id,direction:'takeRepairPoints',sourceKey:row.key,expected:row.expected,count});

function compactVisit(s){
 s=order(s,{type:'visitSector'});const request=s.pendingBattle;
 const b=createBattle(request.squad.map((unit,i)=>({...unit,x:2,y:2+i})),{...request,width:12,height:10,tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[],props:[],npcs:request.npcs.map((npc,i)=>({...npc,x:10-i,y:8}))});
 return {s,b};
}
const leave=({s,b})=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
function rich(s=hire()){
 s.loadouts[110]={weapon:1800,blade:1811};
 Object.assign(s.operativeState[110],{weaponInstanceId:'retired-rifle',condition:61,carriedLoaded:0,carriedReloadProgress:.5,bladeInstanceId:'retired-knife',bladeCondition:47,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'retired-bayonet',condition:73}},inventory:{key:{kind:'tool',toolKey:'key',keyId:'granary',count:1,weight:.1,condition:83,instanceId:'retired-key',provenance:{owner:'Correo'}}}});
 return order(order(s,{type:'purchaseAmmunition',operativeId:110,family:'ammoMusket',quantity:6}),{type:'purchaseToolkits',operativeId:110,quantity:1});
}
function expectedGear(s,id=110){
 return unitGear(personal(s,id));
}
function unitGear(u){
 const selected=[...(u.equipmentCursor?['cursor']:[]),...(!u.weaponDropped&&u.weapon?['primary']:[]),...(u.blade?['blade']:[]),...(u.offHand?['offhand']:[]),...BODY_SLOTS.filter(slot=>u[slot]),...Object.keys(u.inventory??{}).map(key=>`inventory:${key}`),...['rations','medkits','boleadoras','torches'].filter(item=>u[item]>0)];
 return selected.map(item=>readItemStack(u,item,['primary','blade','offhand','cursor',...BODY_SLOTS].includes(item)?(item==='cursor'?u.equipmentCursor.stack.count:1):item.startsWith('inventory:')?u.inventory[item.slice(10)].count:u[item]));
}
function fullCache(s){
 s.serviceEquipmentReturns={version:1,nextId:2,entries:[{id:'service-return-1',siteId:'cordoba',sectorId:'cordoba',entryEdge:'S',entryAnchor:{x:10,y:15},operativeId:3,repairPoints:0,items:Array.from({length:MAX_SERVICE_RETURN_STACKS},(_,i)=>({selection:`stock-${i}`,stack:{item:'rations',count:1,weight:.5}}))}]};return s;
}
function fullGround(s,site='retiro'){
 s.sectorStates[site].groundItems=Array.from({length:2000},(_,i)=>({id:`occupied-${i}`,type:'item',item:'rations',count:1,weight:.5,x:1,y:1}));return s;
}
function empty(s,id=110){
 assert.equal(s.loadouts[id].weapon,0);assert.equal(s.loadouts[id].blade,0);assert.equal(s.operativeState[id].carriedLoaded,0);assert.equal(s.operativeState[id].carriedAmmo,0);assert.equal(s.operativeState[id].carriedReloadProgress,undefined);assert.equal(s.operativeState[id].equipmentCursor,undefined);assert.equal(s.operativeState[id].offHand,undefined);assert.deepEqual(s.operativeState[id].inventory,{});
 for(const key of ['weaponMetadata','contentWeapon','bladeMetadata','ammunitionChoice','weaponInstanceId','bladeInstanceId','activeTool','activeItem','activeSupply','leftHandItem'])assert.equal(s.operativeState[id][key],undefined,key);
 for(const key of ['rations','medkits','boleadoras','torches',...BODY_SLOTS])assert.ok(!s.operativeState[id][key],key);
 assert.equal(s.operativeState[id].toolkitPoints,0);
}

test('paid dismissal before the first visit preserves exact cursor, fitted gear and finite repair capacity in a local cache',()=>{
 let s=rich(),u=personal(s),ammo=unitAmmunitionByType(u),cash=s.resources.treasury;
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:110,direction:'arrange',kind:'cursor',cursorAction:'pickupEquipment',sourceId:'hand:right',expectedSource:equipmentFingerprint(u,'hand:right')});
 const cursor=structuredClone(s.operativeState[110].equipmentCursor.stack),expected=expectedGear(s);s=order(s,{type:'dismiss',id:110});empty(s);assert.equal(s.resources.treasury,cash);assert.equal(s.sectorStates.retiro,undefined);
 const returned=rows(s);assert.deepEqual(packets(returned.filter(r=>r.stack).map(r=>r.stack)),packets(expected));assert.deepEqual(ammunition(returned.map(r=>r.stack)),ammo);assert.deepEqual(returned.find(r=>r.stack?.instanceId==='retired-rifle').stack,cursor);assert.equal(returned.find(r=>r.kind==='repairPoints').repairPoints,100);assert.ok(returned.every(r=>r.placement===null));assert.ok(!returned.some(r=>r.stack?.toolKey==='toolkit'));
 assert.deepEqual(saved(s),s);const before=JSON.stringify(s);for(let i=0;i<3;i++)assert.deepEqual(rows(s),returned);assert.equal(JSON.stringify(s),before);
 const quote=contractQuote(s,rosterFor(s).find(o=>o.id===110),'week');s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.equal(s.resources.treasury,cash-quote.price);empty(s);assert.deepEqual(rows(s),returned);assert.deepEqual(saved(s),s);
});

test('dismissal after an accepted scene return deposits the actual load, wear, unfinished work and clothing once',()=>{
 let s=leave(compactVisit(rich())),expected=expectedGear(s),ammo=unitAmmunitionByType(personal(s)),point={x:2,y:5};
 s=order(s,{type:'dismiss',id:110});empty(s);const ground=groundStacks(s);assert.deepEqual(packets(ground),packets(expected));assert.deepEqual(ammunition(ground),ammo);
 assert.ok(s.sectorStates.retiro.groundItems.filter(item=>item.id.startsWith('service-return-')).every(item=>item.x===point.x&&item.y===point.y));assert.equal(rows(s).filter(row=>row.stack).length,0);assert.equal(rows(s)[0].repairPoints,100);assert.ok(ground.find(item=>item.instanceId==='retired-rifle').fittings.bayonet.instanceId==='retired-bayonet');assert.deepEqual(saved(s),s);
 const row=sectorInventoryModel(s,'retiro',rosterFor(s),10).entries.find(row=>JSON.parse(row.expected).instanceId==='retired-rifle');s=order(s,take(row));assert.equal(Object.values(s.operativeState[10].inventory).filter(item=>item.instanceId==='retired-rifle').length,1);reject(s,take(row));assert.deepEqual(saved(s),s);
});

test('held finite supplies, offhand loading and keys return without duplicating hand references',()=>{
 let s=hire();s.loadouts[110]={weapon:1805,blade:1811};Object.assign(s.operativeState[110],{carriedLoaded:1,activeSlot:'supply',activeSupply:'torches',leftHandItem:'rations',offHand:{weapon:1808,count:1,weight:1.2,loaded:2,condition:57,jammed:true,instanceId:'retired-offhand'},inventory:{ring:{kind:'tool',toolKey:'key',keyId:'warehouse',count:1,weight:.1,condition:86,instanceId:'retired-ring'}}});syncCarriedAmmunition(s.operativeState[110],1805);
 const expected=expectedGear(s),ammo=unitAmmunitionByType(personal(s));s=order(s,{type:'dismiss',id:110});empty(s);assert.deepEqual(packets(rows(s).map(row=>row.stack)),packets(expected));assert.deepEqual(ammunition(rows(s).map(row=>row.stack)),ammo);assert.equal(rows(s).filter(row=>row.stack.item==='torches').reduce((n,row)=>n+row.stack.count,0),2);assert.equal(rows(s).filter(row=>row.stack.item==='rations').reduce((n,row)=>n+row.stack.count,0),2);assert.deepEqual(saved(s),s);
});

test('hourly contract expiry advances at the notice boundary and keeps its unvisited return local until real access',()=>{
 let s=rich(),actual=expectedGear(s);s=order(s,{type:'wait',hours:24});assert.equal(s.hour,22);assert.ok(s.recruited.includes(110));assert.equal(rows(s).length,0);
 s=order(saved(s),{type:'wait',hours:8});assert.equal(s.hour,24);assert.ok(!s.recruited.includes(110));empty(s);assert.deepEqual(packets(rows(s).filter(row=>row.stack).map(row=>row.stack)),packets(actual));assert.ok(rows(s).every(row=>row.placement===null));
 const before=structuredClone(rows(s));s=leave(compactVisit(s));assert.ok(rows(s).every(row=>row.placement));assert.deepEqual(rows(s).map(({placement,x,y,tacticalLevel,...row})=>row),before.map(({placement,x,y,tacticalLevel,...row})=>row));assert.deepEqual(saved(s),s);
});

test('full ground and a full bounded cache retain one fixed former-carrier owner and block paid rehire until the last stack and repair point leave',()=>{
 let s=fullCache(fullGround(leave(compactVisit(rich())))),actual=expectedGear(s),ammo=unitAmmunitionByType(personal(s));s=order(s,{type:'dismiss',id:110});const marker=structuredClone(s.operativeState[110].serviceEquipmentReturn);assert.ok(marker);assert.equal(s.sectorStates.retiro.groundItems.length,2000);assert.equal(s.serviceEquipmentReturns.entries.length,1);assert.deepEqual(packets(rows(s).filter(row=>row.stack).map(row=>row.stack)),packets(actual));assert.deepEqual(ammunition(rows(s).map(row=>row.stack)),ammo);assert.deepEqual(saved(s),s);
 assert.equal(contractQuote(s,rosterFor(s).find(o=>o.id===110),'day').available,false);assert.equal(recruitmentStatus(s,110).available,false);reject(s,{type:'recruitCivic',id:110,term:'day'});
 const stale=rows(s).find(row=>row.stack?.item==='medkits');s=order(s,take(stale,1));assert.equal(s.operativeState[110].medkits,1);reject(s,take(stale,1));
 let reserve=rows(s).find(row=>row.kind==='repairPoints');s=order(s,repair(reserve,35));assert.equal(s.operativeState[110].toolkitPoints,65);reject(s,repair(reserve,1));reserve=rows(s).find(row=>row.kind==='repairPoints');s=order(s,repair(reserve,65));assert.ok(s.operativeState[110].serviceEquipmentReturn);reject(s,{type:'recruitCivic',id:110,term:'day'});
 // Collect each ordinary remaining stack through local actors. Leave the
 // primary until last to cover finishOwner after its current loadout changes.
 for(const original of rows(s).filter(row=>row.stack?.instanceId!=='retired-rifle')){
  const row=rows(s).find(row=>row.key===original.key);let collected=false;
  for(const id of [10,3,4]){const n=dispatchCampaign(s,take(row,row.stack.count,id));if(!n.lastError){s=n;collected=true;break;}}assert.ok(collected,original.key);
 }
 const last=rows(s)[0];assert.equal(last.stack.instanceId,'retired-rifle');s=order(s,take(last,1,4));assert.equal(s.operativeState[110].serviceEquipmentReturn,undefined);empty(s);assert.equal(rows(s).length,0);assert.equal(s.serviceEquipmentReturns.entries[0].items.length,1024);assert.equal(s.serviceEquipmentReturns.nextId,3);assert.equal(marker.siteId,'retiro');assert.deepEqual(saved(s),s);
 const cash=s.resources.treasury,quote=contractQuote(s,rosterFor(s).find(o=>o.id===110),'day');s=order(s,{type:'recruitCivic',id:110,term:'day'});assert.equal(s.resources.treasury,cash-quote.price);empty(s);assert.deepEqual(saved(s),s);
});

test('canonical UTF8 cache ceiling uses the bounded fallback without losing equipment or stopping time',()=>{
 let s=hire();const stack={item:'rations',count:1,weight:.5,note:''};s.serviceEquipmentReturns={version:1,nextId:2,entries:[{id:'service-return-1',siteId:'cordoba',sectorId:'cordoba',entryEdge:'S',entryAnchor:{x:10,y:15},operativeId:3,repairPoints:0,items:[{selection:'archive',stack}]}]};
 const overhead=serviceReturnCacheBytes(s);stack.note='ñ'.repeat(Math.floor((MAX_SERVICE_RETURN_BYTES-overhead-32)/2));assert.ok(serviceReturnCacheBytes(s)<=MAX_SERVICE_RETURN_BYTES);assert.ok(serviceReturnCacheBytes(s)>MAX_SERVICE_RETURN_BYTES-34);
 const bytes=serviceReturnCacheBytes(s);s=order(s,{type:'dismiss',id:110});assert.ok(s.operativeState[110].serviceEquipmentReturn);assert.equal(serviceReturnCacheBytes(s),bytes);assert.ok(rows(s).some(row=>row.stack?.item==='rations'));s=order(saved(s),{type:'wait',hours:1});assert.equal(s.hour,1);assert.equal(serviceReturnCacheBytes(s),bytes);assert.deepEqual(saved(s),s);
});

test('queued expiry returns only at a real arrival and leaves the individual owned horse at that sector',()=>{
 let s=rich();s=order(s,{type:'horseAction',order:{type:'acquire',name:'Correo'}});const horseId=s.horseState.horses.at(-1).id;s=order(s,{type:'horseAction',order:{type:'assign',horseId,operativeId:110}});
 s=order(s,{type:'wait',hours:20});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=order(s,{type:'wait',hours:10});s=order(s,{type:'wait',hours:10});assert.equal(s.hour,24);assert.ok(s.contracts[110].departurePending);assert.ok(s.recruited.includes(110));assert.equal(rows(s).length,0);reject(s,{type:'dismiss',id:110});
 s=order(saved(s),{type:'wait',hours:10});assert.equal(s.hour,32);assert.ok(!s.recruited.includes(110));assert.equal(s.operativeState[110].location,'buenos_aires');assert.equal(rows(s).length,0);assert.ok(rows(s,'buenos_aires').length>0);const horse=s.horseState.horses.find(h=>h.id===horseId);assert.equal(horse.location,'buenos_aires');assert.equal(horse.assignedTo,null);assert.equal(horse.returned,false);assert.equal(horse.custody??null,null);assert.ok(!rows(s,'buenos_aires').some(row=>row.stack?.kind==='horse'));assert.deepEqual(saved(s),s);
});

test('deferred tactical expiry waits for the accepted report and returns the actual publicly reloaded weapon and spent reserve',()=>{
 let s=order(rich(),{type:'wait',hours:20}),b;({s,b}=compactVisit(s));b=actBattle(b,{type:'reload',unitId:'110'});assert.equal(b.lastError,null,b.lastError);assert.equal(b.units.find(u=>u.id==='110').loaded,1);
 for(let i=0;i<36;i++){b=actBattle(b,{type:'rest',unitId:'110'});assert.equal(b.lastError,null,b.lastError);}
 const actual=unitGear(b.units.find(u=>u.id==='110')),ammo=unitAmmunitionByType(b.units.find(u=>u.id==='110'));s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:b.elapsedSeconds,sectorState:b});b.syncedSeconds=b.elapsedSeconds;
 assert.ok(s.hour>=24);assert.ok(s.contracts[110].departurePending);assert.ok(s.recruited.includes(110));assert.equal(rows(s).length,0);s=leave({s,b});empty(s);assert.ok(!s.recruited.includes(110));assert.deepEqual(packets(groundStacks(s)),packets(actual));assert.deepEqual(ammunition(groundStacks(s)),ammo);assert.equal(groundStacks(s).find(item=>item.instanceId==='retired-rifle').loaded,1);assert.equal(groundStacks(s).find(item=>item.instanceId==='retired-rifle').reloadProgress,undefined);assert.deepEqual(saved(s),s);
});

test('a staged expired contract enters a newly friendly target peacefully and returns gear at that actual arrival',()=>{
 let s=order(rich(),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'wait',hours:8});s=order(s,{type:'attack',sector:'san_nicolas',queue:true});
 while(s.squads[0].journey?.status!=='ready')s=order(s,{type:'wait',hours:12});assert.ok(s.contracts[110].departurePending);assert.ok(s.recruited.includes(110));assert.equal(rows(s).length,0);assert.equal(s.operativeState[110].location,'buenos_aires');
 // Prepared world-control change isolates this arrival branch. It is not a
 // campaign-victory claim; staging, expiry and settlement use public orders.
 s.sectors.san_nicolas.owner='patriot';const r=s.operativeState[110],actual=unitGear({...rosterFor(s).find(op=>op.id===110),...r,loaded:r.carriedLoaded??0,reloadProgress:r.carriedReloadProgress}),cash=s.resources.treasury;
 s=order(saved(s),{type:'beginAssault',sector:'san_nicolas'});assert.equal(s.pendingBattle,null);assert.equal(s.location,'san_nicolas');assert.equal(s.operativeState[110].location,'san_nicolas');assert.ok(!s.recruited.includes(110));empty(s);assert.equal(s.resources.treasury,cash);assert.equal(rows(s,'buenos_aires').length,0);assert.deepEqual(packets(rows(s,'san_nicolas').filter(row=>row.stack).map(row=>row.stack)),packets(actual));assert.deepEqual(saved(s),s);
});

test('ordinary dismissal keeps mount custody independent, including a leased mount that returns at its own due time',()=>{
 for(const type of ['acquire','hire']){
  let s=hire();s=order(s,{type:'horseAction',order:{type,name:'Retorno'}});const id=s.horseState.horses.at(-1).id;s=order(s,{type:'horseAction',order:{type:'assign',horseId:id,operativeId:110}});const before=structuredClone(s.horseState.horses.find(h=>h.id===id));s=order(s,{type:'dismiss',id:110});assert.deepEqual(s.horseState.horses.find(h=>h.id===id),{...before,assignedTo:null});assert.deepEqual(saved(s),s);
  if(type==='hire'){while(s.hour<before.hireUntil)s=order(s,{type:'wait',hours:Math.min(72,before.hireUntil-s.hour)});assert.equal(s.horseState.horses.find(h=>h.id===id).returned,true);assert.equal(s.horseState.horses.find(h=>h.id===id).location,'retiro');}
 }
});

test('the fixed fallback keeps property through actual civilian daily movement, zero-supply projection and a later civilian death',()=>{
 const content=localPackage();Object.assign(content.placements.find(p=>p.character==='alma-contract'),{mode:'daily',sectors:['cell-27-27','cell-26-27'],selection:'alternate'});
 let p=hireLocal(readyLocal(undefined,content),'week'),s=leaveLocal(p),id=localId(s),site=s.operativeState[id].location;
 s.operativeState[id].inventory={custodyKey:{kind:'tool',toolKey:'key',keyId:'granary',count:1,weight:.1,condition:93,instanceId:'moving-return-key'}};s=fullCache(fullGround(s,site));const torches=s.operativeState[id].torches;s=order(s,{type:'dismiss',id});const marker=structuredClone(s.operativeState[id].serviceEquipmentReturn),original=serviceReturnSources(s,site);assert.ok(marker);
 s=order(saved(s),{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});const moved=s.contentPresence.people['alma-contract'].sector;assert.notEqual(moved,site);assert.deepEqual(s.operativeState[id].serviceEquipmentReturn,marker);assert.deepEqual(serviceReturnSources(s,site),original);
 const npc=encountersFor(s,moved).find(n=>n.operativeId===id);assert.equal(npc.civilianSupplies.torches,0);assert.equal(npc.civilianWeapons.primary,null);assert.equal(npc.civilianWeapons.blade,null);assert.equal(s.operativeState[id].torches,torches);
 s=order(s,{type:'travel',sector:moved});p=visitLocal(s);applyCivilianHarm(p.battle,localNPC(p.battle),{damage:1000,intentional:false});p=syncLocal(p);s=leaveLocal(p);assert.equal(s.operativeState[id].alive,false);assert.deepEqual(s.operativeState[id].serviceEquipmentReturn,marker);assert.equal(s.operativeState[id].torches,torches);assert.deepEqual(serviceReturnSources(s,site),original);assert.doesNotThrow(()=>validateEquipmentOwnership(s,rosterFor(s)));s=saved(s);assert.deepEqual(saved(s),s);
 s=order(s,{type:'travel',sector:site});const key=serviceReturnSources(s,site).find(row=>row.stack?.instanceId==='moving-return-key');assert.ok(key);s=order(s,take(key,1,110,site));assert.equal(Object.values(s.operativeState[110].inventory).filter(item=>item.instanceId==='moving-return-key').length,1);reject(s,take(key,1,110,site));s=saved(s);assert.deepEqual(saved(s),s);
});

test('a dismissed wounded fallback advances the real civilian wound without overwriting its finite military supplies',()=>{
 let s=fullCache(woundedService()),id=localId(s),site=s.operativeState[id].location,before=structuredClone(s.operativeState[id]);s=order(s,{type:'dismiss',id});assert.ok(s.operativeState[id].serviceEquipmentReturn);s=order(saved(s),{type:'wait',hours:1});assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].torches,before.torches);assert.equal(s.operativeState[id].rations,before.rations);assert.equal(s.operativeState[id].medkits,before.medkits);assert.ok(serviceReturnSources(s,site).some(row=>row.stack?.item==='torches'));assert.deepEqual(saved(s),s);
});

test('authored firearm definitions remain on their exact returned stacks and cannot survive a zero equipped host',()=>{
 const d=defaultContentPackage(),raw={id:'retirement-pistol',template:1808,name:'Pistola del correo',damage:24,fireAP:18,readyAP:5,aimAP:0,reloadAP:54,range:14,capacity:3,weight:1.7,price:91,art:'/art/custom-pistol.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:19,range:20,pattern:'single'}]};d.weapons.push(raw);Object.assign(d.characters.find(c=>c.id==='person-110'),{weapon:raw.id,arrivalHours:0});
 let s=order(freshCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});Object.assign(s.operativeState[110],{carriedLoaded:2,carriedReloadProgress:.5,ammunitionChoice:'ammoRifle',weaponInstanceId:'authored-retirement',condition:61,jammed:true});syncCarriedAmmunition(s.operativeState[110],1808);const original=readItemStack(personal(s),'primary');assert.deepEqual(original.contentWeapon,compileWeaponDefinition(raw));s=order(s,{type:'dismiss',id:110});empty(s);assert.equal(rosterFor(s).find(o=>o.id===110).contentWeapon,undefined);assert.equal(rosterFor(s).find(o=>o.id===110).weaponMetadata,undefined);assert.deepEqual(rows(saved(s)).find(row=>row.stack?.instanceId==='authored-retirement').stack,original);
 const wire=JSON.parse(encodeSave(s));assert.equal(wire.campaign.serviceEquipmentReturns.entries[0].items.find(item=>item.stack.instanceId==='authored-retirement').stack.contentWeapon.definitionRef,raw.id);assert.deepEqual(saved(s),s);
});

test('save admission rejects malformed, duplicate, oversized, conflicting and reused service-return owners',()=>{
 const base=order(rich(),{type:'dismiss',id:110});for(const corrupt of [
  s=>s.serviceEquipmentReturns=null,s=>s.serviceEquipmentReturns.version=2,s=>s.serviceEquipmentReturns.nextId=1,s=>s.serviceEquipmentReturns.entries[0].items=null,
  s=>s.serviceEquipmentReturns.entries[0].siteId='atlantis',s=>s.serviceEquipmentReturns.entries[0].sectorId='cordoba',s=>s.serviceEquipmentReturns.entries[0].point={x:-1,y:3},s=>s.serviceEquipmentReturns.entries[0].operativeId=9999,
  s=>s.serviceEquipmentReturns.entries.push(structuredClone(s.serviceEquipmentReturns.entries[0])),s=>s.serviceEquipmentReturns.entries[0].items.push(structuredClone(s.serviceEquipmentReturns.entries[0].items[0])),
  s=>s.serviceEquipmentReturns.entries[0].items[0].selection='repairPoints',s=>s.serviceEquipmentReturns.entries[0].items[0].stack.count=0,s=>s.serviceEquipmentReturns.entries[0].items[0].stack={item:'ammo',count:1,weight:.04},s=>s.serviceEquipmentReturns.entries[0].repairPoints=100001,
  s=>s.operativeState[10].inventory={duplicate:{...s.serviceEquipmentReturns.entries[0].items.find(item=>item.stack.instanceId==='retired-rifle').stack}},
 ]){const s=structuredClone(base);corrupt(s);assert.throws(()=>saved(s),corrupt.toString());}
 const ground=order(leave(compactVisit(rich())),{type:'dismiss',id:110}),rewound=structuredClone(ground);rewound.serviceEquipmentReturns.entries=[];rewound.serviceEquipmentReturns.nextId=1;assert.throws(()=>saved(rewound),/secuencia/);
 const fallback=order(fullCache(hire()),{type:'dismiss',id:110});for(const corrupt of [s=>s.recruited.push(110),s=>s.contracts[110]={kind:'paid',term:'day',started:0,expiresAt:24,paid:10},s=>s.operativeState[110].serviceEquipmentReturn.siteId='atlantis']){const s=structuredClone(fallback);corrupt(s);assert.throws(()=>saved(s));}assert.deepEqual(saved(fallback),fallback);
 const row=rows(base)[0],copy=structuredClone(base);assert.throws(()=>consumeServiceReturn(copy,row.key,'stale',1));assert.deepEqual(copy,base);assert.throws(()=>consumeServiceReturn(copy,row.key,row.expected,row.stack.count+1));assert.deepEqual(copy,base);
});

test('a prepared accepted military casualty keeps its physical body and does not enter ordinary return storage on dismissal',()=>{
 let {s,b}=compactVisit(rich());const soldier=b.units.find(u=>u.id==='110');Object.assign(soldier,{hp:0,unconscious:false,bandaged:0,bleeding:0});refreshMilitaryCondition(soldier);s=leave({s,b});assert.equal(s.operativeState[110].alive,false);const body=structuredClone(s.sectorStates.retiro.units.find(u=>u.id==='110'));s=order(s,{type:'dismiss',id:110});assert.equal(rows(s).length,0);assert.deepEqual(s.sectorStates.retiro.units.find(u=>u.id==='110'),body);assert.equal(s.operativeState[110].serviceEquipmentReturn,undefined);assert.deepEqual(saved(s),s);
});
