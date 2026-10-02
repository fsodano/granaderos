import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {doctorRate,medicalSupplyQuote} from '../game/medical-care.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Keep the actual Jujuy survivors at their hospital. A paid physical courier
// purchases the still-unused high-pass battery and delivers finite dressings.
export function prepareSurvivorHumahuaca(start,{report=()=>{},useOwnedBattery=false,medicalQuantity=8,earlyDelivery=false,preferSteadyHeavyCrew=false}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.location,'jujuy');assert.equal(c.sectors.jujuy.owner,'patriot');
 const living=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),roster=rosterFor(c);
 const reserve=[...living].sort((a,b)=>c.operativeState[a].morale-c.operativeState[b].morale||a-b)[0];
 const operators=living.filter(id=>id!==reserve).sort((a,b)=>roster.find(op=>op.id===b).marksmanship-roster.find(op=>op.id===a).marksmanship);
 // A routed helper stops a three-person gun. The recovery route keeps the
 // three steadiest actual operators together and gives the remaining soldier
 // the independent light piece; other routes retain their existing roles.
 const light=preferSteadyHeavyCrew?[...operators].sort((a,b)=>c.operativeState[a].morale-c.operativeState[b].morale||roster.find(op=>op.id===a).marksmanship-roster.find(op=>op.id===b).marksmanship||a-b)[0]:operators[1];
 const field=[...operators.filter(id=>id!==light),light,reserve];
 assert.ok(field.length>=5&&field.length<=6,'the battery needs four actual living crew members and one rear reserve');
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const doctor=rosterFor(c).filter(op=>field.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0]?.id;
 assert.ok(doctor,'actual wounded survivors require a stable local doctor');
 const events=[];let gatheredDressings=0;
 const order=a=>{
  if(a.type==='wait'){
   if(patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp)){
    if(earlyDelivery){
     const available=inventory(doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
     if(c.operativeState[doctor].medkits<2&&available)gather(doctor,i=>i.item==='medkits',Math.min(8,c.operativeState[doctor].medkits+available),()=>c.operativeState[doctor].medkits);
     const assignment=c.operativeState[doctor].medkits?'doctor':'rest';
     if(c.operativeState[doctor].assignment!==assignment)order({type:'assignCare',operativeId:doctor,assignment});
    }else if(c.operativeState[doctor].medkits<2)gather(doctor,i=>i.item==='medkits',8,()=>c.operativeState[doctor].medkits);
   }
   for(const id of field){let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}}
  }
  const cash=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;
  events.push({action:a,hour:c.hour,cost:cash-c.resources.treasury});
 };
 const inventory=id=>sectorInventoryModel(c,'jujuy',rosterFor(c),id);
 const gather=(id,test,target,current)=>{
  for(let step=0;step<100&&current()<target;step++){
   const row=inventory(id).entries.find(row=>row.reachable&&test(JSON.parse(row.expected)));
   assert.ok(row,'the cleared map retains the actual finite reachable supplies');
   const count=Math.min(row.count,target-current());order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   assert.equal(inventory(id).entries.find(r=>r.key===row.key)?.count??0,row.count-count);
   if(test({item:'medkits'}))gatheredDressings+=count;
  }
  assert.ok(current()>=target);
 };
 if(patients.length){
  const available=inventory(doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
  const target=earlyDelivery?Math.min(8,c.operativeState[doctor].medkits+available):8;
  if(target)gather(doctor,i=>i.item==='medkits',target,()=>c.operativeState[doctor].medkits);
 }
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':operativeId===doctor&&patients.length&&(!earlyDelivery||c.operativeState[doctor].medkits)?'doctor':'rest'});
 const front=c.activeSquadId;
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 order({type:'createSquad',name:'Socorro del paso',ids:[57],sector:'cordoba'});const courier=c.activeSquadId;
 for(const item of ['field8','swivel']){
  if(useOwnedBattery){assert.equal(c.armory[item],1,'the unused owned high-pass piece remains under actual custody');continue;}
  for(let h=0;h<48&&!c.merchants.cordoba.stock[item];h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  const stock=c.merchants.cordoba.stock[item];order({type:'purchaseEquipment',item});assert.equal(c.merchants.cordoba.stock[item],stock-1);
 }
 assert.ok(Number.isInteger(medicalQuantity)&&medicalQuantity>=0&&medicalQuantity<=20);
 const medical=earlyDelivery?medicalQuantity:Math.min(medicalQuantity,c.merchants.cordoba.supplies.medkits);
 if(earlyDelivery){
  const rate=doctorRate(rosterFor(c).find(op=>op.id===doctor),c),careDemand=patients.reduce((n,id)=>n+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/rate),0),carriedKits=field.reduce((n,id)=>n+c.operativeState[id].medkits,0),reachableKits=inventory(doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
  assert.ok(medical<=c.merchants.cordoba.supplies.medkits,'the exact finite shipment is in the actual supplier stock');
  assert.ok(carriedKits+reachableKits+medical>=careDemand+2*field.length,'quoted finite custody covers care and two retained dressings each');
  report({event:'survivorHumahuacaFiniteMedicalQuote',doctor,rate,careDemand,retainedKits:2*field.length,carriedKits,reachableKits,quantity:medical,merchantStock:c.merchants.cordoba.supplies.medkits});
 }
 if(medical){
  const before={cash:c.resources.treasury,stock:c.merchants.cordoba.supplies.medkits,kits:c.operativeState[57].medkits},quote=medicalSupplyQuote(c,rosterFor(c).find(op=>op.id===57),medical,isSupplied(c,c.location));assert.equal(quote.available,true);
  order({type:'purchaseMedicalSupplies',operativeId:57,quantity:medical});assert.equal(c.resources.treasury,before.cash-quote.cost);assert.equal(c.merchants.cordoba.supplies.medkits,before.stock-medical);assert.equal(c.operativeState[57].medkits,before.kits+medical);
 }
 order({type:'configureArtillery',types:[]});order({type:'assignCare',operativeId:57,assignment:'active'});
 order({type:'travel',sector:'jujuy',queue:true,mode:'posta'});
 for(let h=0;h<80&&(c.squads.find(q=>q.id===courier).journey||!earlyDelivery&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.location,'jujuy');assert.ok(!c.squads.find(q=>q.id===courier).journey);
 if(!earlyDelivery)assert.ok(field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding));
 if(medical){
  const before=c.operativeState[57].medkits,keys=new Set(inventory(doctor).entries.map(row=>row.key)),cash=c.resources.treasury,hour=c.hour,second=c.secondOfHour;
  order({type:'sectorInventory',sector:'jujuy',operativeId:57,direction:'drop',item:'medkits',count:medical});assert.equal(c.operativeState[57].medkits,before-medical);
  if(earlyDelivery){const row=inventory(doctor).entries.find(row=>!keys.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count===medical);assert.ok(row,'the local doctor can reach the exact physically delivered shipment');assert.equal(c.resources.treasury,cash);assert.equal(c.hour,hour);assert.equal(c.secondOfHour,second);report({event:'survivorHumahuacaFiniteMedicalDelivery',quantity:medical,sourceKey:row.key,expected:row.expected,hour,second,treasury:cash});}
 }
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});order({type:'selectSquad',id:front});
 if(earlyDelivery){
  for(let h=0;h<80&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  assert.ok(field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding),'actual finite dressings complete care after the courier delivery');
 }
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const ready=()=>!c.squads.find(q=>q.id===courier).journey&&field.every(id=>!c.operativeState[id].fatigue&&c.operativeState[id].energy===100&&!c.operativeState[id].asleep)&&(c.hour+6)%24===12;
 for(let h=0;h<48&&!ready();h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.ok(ready());
 for(const id of field){
  const op=rosterFor(c).find(o=>o.id===id);
  if(c.operativeState[id].weaponDropped||![1800,1801].includes(op.weapon)||c.operativeState[id].condition<95){
   const row=inventory(id).entries.find(r=>{const i=JSON.parse(r.expected);return r.reachable&&[1800,1801].includes(i.weapon)&&i.loaded===1&&i.condition===100&&!i.jammed;});assert.ok(row);
   const weapon=JSON.parse(row.expected).weapon,keys=new Set(inventory(id).carried.map(r=>r.inventoryKey));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   const gun=inventory(id).carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&JSON.parse(r.expected).weapon===weapon);assert.ok(gun);
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  }
  if(rosterFor(c).find(o=>o.id===id).ammunitionChoice==='ammoShot'){if(c.operativeState[id].carriedLoaded)order({type:'unloadAmmunition',operativeId:id});order({type:'selectAmmunitionLoad',operativeId:id,family:'ammoMusket'});}
  const rounds=()=>{const u=carriedAmmunition(rosterFor(c).find(o=>o.id===id),c.operativeState[id]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));};
  gather(id,i=>i.kind==='ammunition'&&i.ammoType==='musket_75',16,rounds);
  gather(id,i=>i.item==='medkits',2,()=>c.operativeState[id].medkits);
  order({type:'assignCare',operativeId:id,assignment:'active'});
 }
 c=finishReloadsBeforeMarch(c);order({type:'configureArtillery',types:['field8','swivel']});
 c=prepareFinalAssault(c,{staging:'jujuy',target:'humahuaca',fieldIds:field});
 if(useOwnedBattery)for(const item of ['field8','swivel'])assert.equal(c.armory[item],0,'the actual assault consumes exactly the selected owned piece');
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const battle=enterSector(c.pendingBattle,c.sectorStates.humahuaca);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 report({event:'survivorHumahuacaReady',hour:c.hour,treasury:c.resources.treasury,field,patients,doctor,reserve,light,gatheredDressings,events});return c;
}
