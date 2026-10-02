import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {equipmentCatalog,equipmentKey} from '../game/equipment-catalog.js';
import {recoverFreshPort} from './fresh-coastal-route.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {decodeSave,encodeSave} from '../game/save.js';
import {depotSelection} from '../game/artillery-depots.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {doctorRate} from '../game/medical-care.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable,artilleryContact,artilleryReloadPreview,artilleryCrewPlan} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
// Recover the real capital survivors and pay for the remaining living relief.
// The commander stays at the hospital while the field column returns north.
export function prepareCreatedNorthernRelief(start,{report=()=>{}}={}){
 let c=recoverFreshPort(start,{hospital:'cordoba',fieldIds:start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured)});
 const retained=[...c.recruited.filter(id=>c.operativeState[id].alive)],field=retained.filter(id=>id!==57);
 const order=a=>{
  if(a.type==='wait')for(const id of retained){const q=c.contracts[id];if(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;}}
  const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
 };
 report({stage:'care',hour:c.hour,treasury:c.resources.treasury,field,campaign:c});
 for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'rest'});
 // Batch ordinary wait orders up to the next income or retention boundary.
 // Each internal hour still runs the game clock and can stop for encounters.
 for(let elapsed=0,orders=0;elapsed<24000&&orders<3000&&c.resources.treasury<60000;orders++){
  assert.equal(c.pendingEncounter,null);
  const untilExpiry=Math.min(...retained.map(id=>c.contracts[id]?.expiresAt==null?Infinity:c.contracts[id].expiresAt-c.hour-1));
  const hours=Math.max(1,Math.min(24-c.hour%24,untilExpiry));
  const before=c.hour;order({type:'wait',hours});
  if(c.hour===before)assert.ok(c.assignmentAttention.notice||c.contractAttention.notice||c.logisticsNotice,'a paused wait must expose a real notice for acknowledgement');
  elapsed+=c.hour-before;
 }
 assert.ok(c.resources.treasury>=60000);report({stage:'funded',hour:c.hour,treasury:c.resources.treasury,campaign:c});
 for(const id of [143,147]){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);order({type:'recruitCivic',id,term:'day',destination:'cordoba'});retained.push(id);field.push(id);}
 for(let h=0;h<24&&field.some(id=>!c.recruited.includes(id));h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<600&&field.some(id=>c.operativeState[id].morale<65);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(field.every(id=>c.operativeState[id].morale>=65));
 report({stage:'rested',hour:c.hour,treasury:c.resources.treasury,field,campaign:c});
 order({type:'createSquad',name:'Última columna del Norte',ids:field,sector:'cordoba'});
 const rifle=equipmentKey(equipmentCatalog(c).find(i=>i.id===1801));
 for(const operativeId of field){
  const op=rosterFor(c).find(o=>o.id===operativeId);
  if(c.operativeState[operativeId].weaponDropped||![1800,1801,1802].includes(op.weapon)){
   for(let h=0;h<48&&!c.merchants.cordoba.stock[rifle];h++)order({type:'wait',hours:1});
   order({type:'purchaseEquipment',item:rifle});order({type:'equip',operativeId,slot:'weapon',itemId:rifle});
  }
 }
 c=supplyRouteAmmunition(c,field,{target:16}).campaign;
 for(const operativeId of field)if(c.operativeState[operativeId].medkits<10)order({type:'purchaseMedicalSupplies',operativeId,quantity:10-c.operativeState[operativeId].medkits});
 order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let n=0;n<2;n++){
  for(let h=0;h<48&&!c.merchants.cordoba.stock.bronze4;h++)order({type:'wait',hours:1});
  order({type:'purchaseEquipment',item:'bronze4'});
 }
 for(let h=0;h<48&&(c.hour%24!==6||field.some(id=>c.operativeState[id].fatigue>0||c.operativeState[id].energy<100));h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'configureArtillery',types:['bronze4','bronze4']});
 c=prepareFinalAssault(c,{staging:'cordoba',target:'tucuman',fieldIds:field});
 assert.equal(c.operativeState[57].location,'cordoba');
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}

// Keep the hospital command in Córdoba while the actual field doctors treat
// the wounded northern survivors. A real courier brings finite shop stock;
// the patients do not lose the road while making a long return journey.
export function prepareCreatedSaltaReturn(start,{report=()=>{},retainedIds=null}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.location,'tucuman');
 const retained=c.recruited.filter(id=>{
  const r=c.operativeState[id];return r.alive&&!r.captured&&(!retainedIds||retainedIds.includes(id));
 });
 if(retainedIds)assert.deepEqual([...retained].sort((a,b)=>a-b),[...retainedIds].sort((a,b)=>a-b),'every selected current survivor must actually be serving');
 const forward=retained.filter(id=>c.operativeState[id].location==='tucuman');
 const rear=retained.filter(id=>c.operativeState[id].location==='cordoba');
 assert.ok(forward.length&&rear.includes(57));
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of retained){
   let q=c.contracts[id];
   while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){
    order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];
   }
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);
  assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  events.push({action:a,hour:c.hour,cost:before-c.resources.treasury});
 };
 const roster=rosterFor(c),patients=forward.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const doctors=forward.filter(id=>!patients.includes(id)&&c.operativeState[id].medkits>0&&roster.find(o=>o.id===id).medical>=20);
 assert.ok(!patients.length||doctors.length,'the forward survivors require a living equipped doctor');
 for(const operativeId of forward)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':doctors.includes(operativeId)?'doctor':'rest'});
 order({type:'createSquad',ids:rear,sector:'cordoba',name:'Socorro al frente'});
 c=supplyRouteAmmunition(c,rear,{target:24}).campaign;
 const lightStock=c.armory.swivel??0;
 for(let n=lightStock;n<3;n++){
  for(let h=0;h<48&&!c.merchants.cordoba.stock.swivel;h++)order({type:'wait',hours:1});
  order({type:'purchaseEquipment',item:'swivel'});
 }
 for(const operativeId of rear)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);
 order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});
 const incoming=c.activeSquadId;
 const ready=()=>!c.squads.find(q=>q.id===incoming).journey&&retained.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp);
 for(let h=0;h<48&&!ready();h++){
  assert.equal(c.pendingEncounter,null);
  if(!c.squads.find(q=>q.id===incoming).journey){
   for(const operativeId of rear.filter(id=>id!==57&&roster.find(o=>o.id===id).medical>=20&&c.operativeState[id].medkits>0)){
    if(c.operativeState[operativeId].assignment!=='doctor')order({type:'assignCare',operativeId,assignment:'doctor'});
   }
  }
  order({type:'wait',hours:1});
 }
 assert.ok(ready(),'the real couriers and patients must finish bounded recovery');
 order({type:'createSquad',ids:retained,sector:'tucuman',name:'Columna recuperada'});
 for(const operativeId of retained)order({type:'assignCare',operativeId,assignment:'active'});
 c=finishReloadsBeforeMarch(c);
 order({type:'configureArtillery',types:['swivel','swivel','swivel']});
 c=prepareFinalAssault(c,{staging:'tucuman',target:'salta'});
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdSaltaReturnReady',hour:c.hour,treasury:c.resources.treasury,field:retained,patients,doctors,rear,events});
 return c;
}

// Forward the physical Salta battery through a friendly depot. Every piece
// retains its identity and reserve, and every arrival waits for the game clock.
export function prepareCreatedJujuyReturn(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const origin='salta',rear='tucuman',field=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.equal(c.location,origin);assert.equal(field.length,c.squad.length);
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of field){
   let q=c.contracts[id];
   while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  events.push({action:a,hour:c.hour,cost:before-c.resources.treasury});
 };
 if(!c.routes.carts)order({type:'transport',mode:'carts'});
 const guns=c.sectorStates[origin].artillery.filter(g=>g.side==='player'&&g.type==='swivel').slice(-3);
 assert.equal(guns.length,3);
 for(const gun of guns){
  while(c.sectorStates[origin].artillery.find(g=>g.id===gun.id).ammo<6)order({type:'resupplyArtillery',sector:origin,artilleryId:gun.id});
  order({type:'transportArtillery',source:'field',sector:origin,artilleryId:gun.id,to:rear,mode:'carts'});
 }
 const arrive=target=>{
  order({type:'travel',sector:target,queue:true,mode:'posta'});
  const squad=c.activeSquadId;
  for(let h=0;h<48&&(c.squads.find(q=>q.id===squad).journey||c.artilleryTransfers.length);h++){
   assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
  }
  assert.equal(c.location,target);assert.equal(c.squads.find(q=>q.id===squad).journey,undefined);assert.equal(c.artilleryTransfers.length,0);
 };
 order({type:'configureArtillery',types:[]});arrive(rear);
 for(const gun of guns)order({type:'transportArtillery',source:'depot',sector:rear,artilleryId:gun.id,to:origin,mode:'carts'});
 arrive(origin);order({type:'configureArtillery',types:guns.map(depotSelection)});
 c=prepareFinalAssault(c,{staging:origin,target:'jujuy'});
 assert.deepEqual(c.pendingBattle.artillery.map(g=>g.id),guns.map(g=>g.id));
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdJujuyReturnReady',hour:c.hour,treasury:c.resources.treasury,field,guns:guns.map(g=>g.id),events});
 return c;
}

// Let the next actual northern column reach a supplied friendly Salta. Its
// battle remains separate from the authored Jujuy guards further up the road.
export function prepareCreatedSaltaDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.location,'salta');
 const field=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);
 assert.equal(field.length,c.squad.length);
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of field){
   let q=c.contracts[id];
   while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  events.push({action:a,hour:c.hour,cost:before-c.resources.treasury});
 };
 while(c.sectors.salta.fort<3)order({type:'fortify',sector:'salta'});
 const guns=c.sectorStates.salta.artillery.filter(g=>g.side==='player');assert.ok(guns.length);
 for(const gun of guns)while(c.sectorStates.salta.artillery.find(g=>g.id===gun.id).ammo<6)order({type:'resupplyArtillery',sector:'salta',artilleryId:gun.id});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 let active=false;
 for(let h=0;h<150&&!c.pendingEncounter;h++){
  if(!active&&c.enemyGroups.some(g=>g.status==='marching'&&g.target==='salta'&&g.arrivalAt-c.hour<=1)){
   for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});active=true;
  }
  order({type:'wait',hours:1});
 }
 assert.equal(c.pendingEncounter?.sector,'salta');assert.ok(active);
 const groupId=c.pendingEncounter.groupId;
 order({type:'respondToEncounter',groupId,choice:'tactical'});
 assert.equal(c.pendingBattle.defenseGroupId,groupId);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdSaltaDefenseReady',hour:c.hour,treasury:c.resources.treasury,field,groupId,guns:guns.map(g=>g.id),events});
 return c;
}

// Treat only actual wounded survivors, consuming their carried dressings.
// Prepare a night arrival through ordinary rest before the physical gun trip.
export function recoverCreatedSaltaDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;assert.equal(c.location,'salta');
 const field=[...c.squad],roster=rosterFor(c),patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const doctors=field.filter(id=>!patients.includes(id)&&c.operativeState[id].medkits>0&&roster.find(o=>o.id===id).medical>=20)
  .sort((a,b)=>roster.find(o=>o.id===b).medical-roster.find(o=>o.id===a).medical).slice(0,2);
 assert.ok(!patients.length||doctors.length);
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of field){
   let q=c.contracts[id];
   while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  events.push({action:a,hour:c.hour,cost:before-c.resources.treasury});
 };
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':doctors.includes(operativeId)?'doctor':'rest'});
 const medicalBefore=doctors.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),healthy=()=>field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp);
 for(let h=0;h<48&&!healthy();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(healthy(),'the actual defense survivors must finish local treatment');
 const medicalUsed=medicalBefore-doctors.reduce((sum,id)=>sum+c.operativeState[id].medkits,0);
 assert.ok(!patients.length||medicalUsed>0);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const rested=()=>field.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep);
 for(let h=0;h<48&&!rested();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(rested());
 // Two real 18-hour cart legs and the six-hour posta assault determine the
 // arrival clock. Waiting here retains the same physical deployment route.
 for(let h=0;h<24&&(c.hour+42)%24>5&&(c.hour+42)%24<20;h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdSaltaDefenseRecovered',hour:c.hour,treasury:c.resources.treasury,field,patients,doctors,medicalUsed,events});
 return c;
}

// Recover the actual Jujuy survivors from the finite stores left on that map.
// Every dressing, cartridge and loaded rifle is taken through the inventory
// model; replacing a worn gun preserves it in the operative's carried pack.
export function recoverCreatedJujuy(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;assert.equal(c.location,'jujuy');
 const field=[...c.squad],roster=rosterFor(c),patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);
 const doctor=field.filter(id=>!patients.includes(id)).sort((a,b)=>roster.find(o=>o.id===b).medical-roster.find(o=>o.id===a).medical)[0];
 assert.ok(doctor!==undefined);
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of field){
   let q=c.contracts[id];
   while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=decodeSave(encodeSave(n)).campaign;
  events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:before-c.resources.treasury});
 };
 const inventory=id=>sectorInventoryModel(c,'jujuy',rosterFor(c),id);
 const gather=(id,test,target,current)=>{
  for(let step=0;step<100&&current()<target;step++){
   const row=inventory(id).entries.find(row=>row.reachable&&test(JSON.parse(row.expected)));
   assert.ok(row,'the cleared map must contain the actual finite supplies');
   const count=Math.min(row.count,target-current());
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   assert.equal(inventory(id).entries.find(next=>next.key===row.key)?.count??0,row.count-count);
  }
  assert.ok(current()>=target);
 };
 const rate=doctorRate(roster.find(o=>o.id===doctor),c),needed=patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/rate)+Number(c.operativeState[id].bleeding>0),0)+Number(patients.length>0);
 gather(doctor,item=>item.item==='medkits',needed,()=>c.operativeState[doctor].medkits);
 const medicalBefore=c.operativeState[doctor].medkits;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':operativeId===doctor&&patients.length?'doctor':'rest'});
 const healthy=()=>field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp);
 for(let h=0;h<48&&!healthy();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(healthy());
 const medicalUsed=medicalBefore-c.operativeState[doctor].medkits;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const rested=()=>field.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep);
 for(let h=0;h<24&&!rested();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(rested());
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 // Preserve the medic's actually carried loaded long gun before salvaging
 // cartridges. The previous pistol uses a different ammunition family.
 for(const id of field.filter(id=>id!==57)){
  if(![1800,1801,1802].includes(rosterFor(c).find(o=>o.id===id).weapon)){
   const gun=inventory(id).carried.find(row=>row.inventoryKey&&[1800,1801,1802].includes(JSON.parse(row.expected).weapon));
   assert.ok(gun?.equip.some(option=>option.slot==='primary'&&option.valid));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  }
  const ammunition=()=>{
   const u=carriedAmmunition(rosterFor(c).find(o=>o.id===id),c.operativeState[id]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));
  };
  gather(id,item=>item.kind==='ammunition'&&item.ammoType==='musket_75',24,ammunition);
 }
 c=finishReloadsBeforeMarch(c);
 for(const gun of c.sectorStates.jujuy.artillery.filter(g=>g.side==='player'))if(gun.ammo<6)order({type:'supplyArtillery',sector:'jujuy',artilleryId:gun.id,count:6-gun.ammo});
 for(const id of field){
  const row=inventory(id).entries.find(row=>{
   const item=JSON.parse(row.expected);return row.reachable&&item.weapon===1801&&item.loaded===1&&item.condition===100;
  });
  assert.ok(row,'a real full-condition loaded rifle must remain in the cleared map');
  const keys=new Set(inventory(id).carried.map(row=>row.inventoryKey).filter(Boolean));
  order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  const gun=inventory(id).carried.find(row=>row.inventoryKey&&!keys.has(row.inventoryKey)&&JSON.parse(row.expected).weapon===1801&&JSON.parse(row.expected).condition===100);
  assert.ok(gun?.equip.some(option=>option.slot==='primary'&&option.valid));
  order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  gather(id,item=>item.item==='medkits',2,()=>c.operativeState[id].medkits);
 }
 const command=field.find(id=>id===57);
 if(command!==undefined){
  const ammunition=()=>{
   const u=carriedAmmunition(rosterFor(c).find(o=>o.id===command),c.operativeState[command]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));
  };
  gather(command,item=>item.kind==='ammunition'&&item.ammoType==='musket_75',24,ammunition);
 }
 c=finishReloadsBeforeMarch(c);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdJujuyRecovered',hour:c.hour,treasury:c.resources.treasury,field,patients,doctor,medicalUsed,events});
 return c;
}

// A real courier brings unused high-pass pieces while the field force holds
// Jujuy. Preload the actual local guns and leave their crews beside them before
// the invading column arrives; retained soldiers cannot use arrival placement.
export function prepareCreatedJujuyDefense(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign,battle=null;assert.equal(c.location,'jujuy');
 const field=[...c.squad],events=[],visitOrders=[],order=a=>{
  if(a.type==='wait')for(const id of field){
   let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}
  }
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);
  if(n.pendingBattle&&!battle)battle=enterSector(n.pendingBattle,n.sectorStates[n.pendingBattle.sector]);
  if(!n.pendingBattle)battle=null;
  const pair=decodeSave(encodeSave(n,battle));c=pair.campaign;battle=pair.battle;
  events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:before-c.resources.treasury});
 };
 while(c.sectors.jujuy.fort<3)order({type:'fortify',sector:'jujuy'});
 const physical=c.sectorStates.jujuy.artillery.filter(g=>g.side==='player');assert.equal(physical.length,3);
 for(const gun of physical)if(gun.ammo<6)order({type:'supplyArtillery',sector:'jujuy',artilleryId:gun.id,count:6-gun.ammo});
 const initialCharges=new Map(c.sectorStates.jujuy.artillery.filter(g=>g.side==='player').map(g=>[g.id,{loaded:g.loaded,ammo:g.ammo}]));
 assert.ok(field.includes(57));
 order({type:'createSquad',ids:field.filter(id=>id!==57),sector:'jujuy',name:'Defensa de Jujuy'});
 for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
 order({type:'createSquad',ids:[57],sector:'jujuy',name:'Correo de artillería'});const courier=c.activeSquadId;
 order({type:'configureArtillery',types:[]});
 const travel=sector=>{
  order({type:'travel',sector,queue:true,mode:'posta'});
  for(let h=0;h<80&&c.squads.find(q=>q.id===courier).journey;h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  assert.equal(c.location,sector);assert.equal(c.pendingEncounter,null);
 };
 travel('cordoba');
 for(const item of ['field8','swivel']){
  const stock=c.merchants.cordoba.stock[item];assert.ok(stock>0,'the courier buys only actual finite stock');
  order({type:'purchaseEquipment',item});assert.equal(c.merchants.cordoba.stock[item],stock-1);
 }
 const unused={field8:c.armory.field8,swivel:c.armory.swivel};travel('jujuy');
 order({type:'createSquad',ids:field,sector:'jujuy',name:'Columna del norte'});order({type:'configureArtillery',types:[]});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'visitSector'});assert.equal(battle.mode,'exploration');
 const act=a=>{const n=actBattle(battle,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);battle=n;visitOrders.push(a);};
 const walk=(id,destination,ready)=>{
  for(let step=0;step<40;step++){
   const unit=battle.units.find(u=>u.id===String(id));if(ready(unit))return;
   const distance=p=>Math.hypot(p.x-destination.x,p.y-destination.y);
   const point=getReachable(battle,unit).filter(p=>p.cost>0&&(p.tacticalLevel??0)===0).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
   assert.ok(point&&distance(point)<distance(unit),'the crew must use a legal route toward its actual friendly gun');
   act({type:'move',unitId:unit.id,x:point.x,y:point.y,tacticalLevel:0});
  }
  assert.fail('bounded crew preparation must reach the real battery');
 };
 const soldiers=rosterFor(c).filter(o=>field.includes(o.id)&&o.id!==57);
 const medic=soldiers.filter(o=>o.medical>=60).sort((a,b)=>a.marksmanship-b.marksmanship||a.id-b.id)[0];assert.ok(medic);
 for(const [id,point]of [[57,{x:battle.width-3,y:Math.floor(battle.height*.5)+3}],[medic.id,{x:Math.floor(battle.width*.8125),y:Math.floor(battle.height*.5)+3}]]){
  walk(id,point,u=>Math.hypot(u.x-point.x,u.y-point.y)<=2.5);
 }
 const crews=soldiers.filter(o=>o.id!==medic.id).sort((a,b)=>a.medical-b.medical||b.marksmanship-a.marksmanship);assert.equal(crews.length,physical.length);
 for(const [index,gun]of physical.entries()){
  const id=crews[index].id;walk(id,gun,u=>artilleryContact(battle,u,gun));let unit=battle.units.find(u=>u.id===String(id));
  if(unit.stance==='prone')act({type:'stance',unitId:unit.id,stance:'crouched'});
  unit=battle.units.find(u=>u.id===String(id));const actual=battle.artillery.find(g=>g.id===gun.id),before=structuredClone(actual);assert.equal(artilleryCrewPlan(battle,unit,actual,1,true).reason,null);
  if(!actual.loaded){assert.equal(artilleryReloadPreview(battle,unit,actual).valid,true);act({type:'artilleryReload',unitId:unit.id,artilleryId:gun.id});}
  const after=battle.artillery.find(g=>g.id===gun.id);assert.equal(after.loaded,true);assert.equal(after.ammo,before.ammo-Number(!before.loaded));assert.equal(Number(after.loaded)+after.ammo,Number(before.loaded)+before.ammo);
  const metadata=g=>Object.fromEntries(Object.entries(g).filter(([key])=>!['loaded','ammo','reloadProgress'].includes(key)));assert.deepEqual(metadata(after),metadata(before));if(before.loaded)assert.deepEqual(after,before);
 }
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));c=restored.campaign;battle=restored.battle;
 const visitSeconds=battle.elapsedSeconds;
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 let active=false;
 for(let h=0;h<150&&!c.pendingEncounter;h++){
  if(!active&&c.enemyGroups.some(g=>g.status==='marching'&&g.target==='jujuy'&&g.arrivalAt-c.hour<=1)){
   for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});active=true;
  }
  order({type:'wait',hours:1});
 }
 assert.equal(c.pendingEncounter?.sector,'jujuy');assert.ok(active);const groupId=c.pendingEncounter.groupId;
 order({type:'respondToEncounter',groupId,choice:'tactical'});
 assert.ok(c.pendingBattle.artillery.every(g=>g.loaded&&g.ammo===initialCharges.get(g.id).ammo-Number(!initialCharges.get(g.id).loaded)));
 assert.deepEqual({field8:c.armory.field8,swivel:c.armory.swivel},unused);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdJujuyDefenseReady',hour:c.hour,treasury:c.resources.treasury,field,groupId,unused,events,visitOrders,visitSeconds});
 return c;
}

// Pool the actual remaining dressings for one qualified local doctor. Recover
// fresh enemy rifles and compatible rounds before issuing the still-unused
// courier battery; the three mountain field guns remain in Jujuy.
export function prepareCreatedHumahuacaReturn(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;assert.equal(c.location,'jujuy');
 const field=[...c.squad],roster=rosterFor(c),patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const doctor=roster.filter(o=>field.includes(o.id)&&!patients.includes(o.id)&&o.medical>=20).sort((a,b)=>b.medical-a.medical||a.marksmanship-b.marksmanship)[0];assert.ok(doctor);
 const reserve=roster.filter(o=>field.includes(o.id)&&o.id!==doctor.id&&c.operativeState[o.id].medkits>=2).sort((a,b)=>b.marksmanship-a.marksmanship)[0];
 const events=[],order=a=>{
  if(a.type==='wait')for(const id of field){let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}}
  const before=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=decodeSave(encodeSave(n)).campaign;
  events.push({action:a,hour:c.hour,second:c.secondOfHour,cost:before-c.resources.treasury});
 };
 const inventory=id=>sectorInventoryModel(c,'jujuy',rosterFor(c),id),gather=(id,test,target,current)=>{
  for(let step=0;step<80&&current()<target;step++){
   const row=inventory(id).entries.find(row=>row.reachable&&test(JSON.parse(row.expected)));assert.ok(row,'an actual finite reachable supply must remain');
   const count=Math.min(row.count,target-current());order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   assert.equal(inventory(id).entries.find(next=>next.key===row.key)?.count??0,row.count-count);
  }
  assert.ok(current()>=target);
 };
 const rate=doctorRate(doctor,c),needed=patients.reduce((sum,id)=>sum+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/rate)+Number(c.operativeState[id].bleeding>0),0);
 for(const id of field.filter(id=>id!==doctor.id)){
  const count=c.operativeState[id].medkits-(id===reserve?.id?2:0);
  if(count>0)order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'drop',item:'medkits',count});
 }
 gather(doctor.id,item=>item.item==='medkits',needed,()=>c.operativeState[doctor.id].medkits);
 const medicalBefore=c.operativeState[doctor.id].medkits,careStart=c.hour;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':operativeId===doctor.id&&patients.length?'doctor':'rest'});
 const healthy=()=>field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding);
 for(let h=0;h<48&&!healthy();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(healthy(),'the actual survivors must finish finite local treatment');
 const careHours=c.hour-careStart,medicalUsed=medicalBefore-c.operativeState[doctor.id].medkits;
 assert.ok(!patients.length||medicalUsed>0);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const rested=()=>field.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep);
 for(let h=0;h<24&&!rested();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.ok(rested());
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 for(const id of field){
  if(rosterFor(c).find(o=>o.id===id).weapon!==1801||c.operativeState[id].condition<100){
   const row=inventory(id).entries.find(row=>{const item=JSON.parse(row.expected);return row.reachable&&item.weapon===1801&&item.loaded===1&&item.condition===100;});
   assert.ok(row,'a real full-condition loaded rifle must remain');
   const keys=new Set(inventory(id).carried.map(row=>row.inventoryKey).filter(Boolean));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   const gun=inventory(id).carried.find(row=>row.inventoryKey&&!keys.has(row.inventoryKey)&&JSON.parse(row.expected).weapon===1801&&JSON.parse(row.expected).condition===100);assert.ok(gun?.equip.some(option=>option.slot==='primary'&&option.valid));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  }
  const ammunition=()=>{const u=carriedAmmunition(rosterFor(c).find(o=>o.id===id),c.operativeState[id]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));};
  gather(id,item=>item.kind==='ammunition'&&item.ammoType==='musket_75',24,ammunition);
 }
 c=finishReloadsBeforeMarch(c);
 assert.ok(c.armory.field8>0&&c.armory.swivel>0);order({type:'configureArtillery',types:['field8','swivel']});
 report({event:'createdHumahuacaRecovered',hour:c.hour,treasury:c.resources.treasury,field,patients,doctor:doctor.id,careHours,medicalUsed,events});
 // Ordinary rest selects a noon arrival for the six-hour high-pass journey.
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<24&&(c.hour+6)%24!==12;h++)order({type:'wait',hours:1});
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});
 c=prepareFinalAssault(c,{staging:'jujuy',target:'humahuaca'});
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 report({event:'createdHumahuacaReturnReady',hour:c.hour,treasury:c.resources.treasury,field,events});
 return c;
}

// Stop the actual high-pass survivors' bleeding before any march. Cleared-map
// dressings and ordinary nearby first aid stabilize critical bodies without
// replacing their wounds with an invented healthy field force.
export function stabilizeCreatedHighPass(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;assert.equal(c.location,'humahuaca');
 const field=[...c.squad],roster=rosterFor(c),doctor=roster.filter(o=>field.includes(o.id)&&c.operativeState[o.id].hp>=15&&!c.operativeState[o.id].bleeding&&o.medical>=20).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor);
 const events=[],orders=[],order=a=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;events.push({action:a,hour:c.hour,second:c.secondOfHour});};
 const before=structuredClone(c);
 for(let step=0;step<50;step++){
  const row=sectorInventoryModel(c,'humahuaca',rosterFor(c),doctor.id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');if(!row)break;
  order({type:'sectorInventory',sector:'humahuaca',operativeId:doctor.id,direction:'take',sourceKey:row.key,expected:row.expected,count:row.count});
 }
 const medicalBefore=c.operativeState[doctor.id].medkits;assert.ok(medicalBefore);
 order({type:'visitSector'});let battle=enterSector(c.pendingBattle,c.sectorStates.humahuaca);
 const act=a=>{
  const n=actBattle(battle,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);orders.push(a);
  const pair=syncBattleTime(c,n);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));c=restored.campaign;battle=restored.battle;
 };
 act({type:'weapon',unitId:String(doctor.id),slot:'medical'});
 const patients=field.filter(id=>id!==doctor.id).sort((a,b)=>before.operativeState[a].hp-before.operativeState[b].hp);
 for(const id of patients)for(let stroke=0;stroke<8;stroke++){
  const patient=battle.units.find(u=>u.id===String(id)),medic=battle.units.find(u=>u.id===String(doctor.id));assert.ok(patient.hp>0);
  if(patient.hp>=15&&!patient.bleeding)break;
  if(Math.hypot(medic.x-patient.x,medic.y-patient.y)>1.5){
   const point=getReachable(battle,medic).filter(p=>Math.hypot(p.x-patient.x,p.y-patient.y)<=1.5&&(p.tacticalLevel??0)===(patient.tacticalLevel??0)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(point);
   act({type:'move',unitId:medic.id,x:point.x,y:point.y,tacticalLevel:point.tacticalLevel??0});
  }
  act({type:'heal',unitId:medic.id,targetId:patient.id});
 }
 assert.ok(battle.units.filter(u=>u.side==='player'&&field.includes(Number(u.id))).every(u=>u.hp>=15&&!u.bleeding));
 order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(c.resources.treasury,before.resources.treasury);
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 c=decodeSave(encodeSave(c)).campaign;
 report({event:'createdHighPassStabilized',hour:c.hour,treasury:c.resources.treasury,field,doctor:doctor.id,medicalUsed:medicalBefore-c.operativeState[doctor.id].medkits,events,orders});
 return c;
}
