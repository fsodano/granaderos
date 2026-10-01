import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Keep the actual Jujuy survivors at their hospital. A paid physical courier
// purchases the still-unused high-pass battery and delivers finite dressings.
export function prepareSurvivorHumahuaca(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.location,'jujuy');assert.equal(c.sectors.jujuy.owner,'patriot');
 const living=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),roster=rosterFor(c);
 const reserve=[...living].sort((a,b)=>c.operativeState[a].morale-c.operativeState[b].morale||a-b)[0];
 const operators=living.filter(id=>id!==reserve).sort((a,b)=>roster.find(op=>op.id===b).marksmanship-roster.find(op=>op.id===a).marksmanship);
 const light=operators[1];
 const field=[...operators.filter(id=>id!==light),light,reserve];
 assert.ok(field.length>=5&&field.length<=6,'the battery needs four actual living crew members and one rear reserve');
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const doctor=rosterFor(c).filter(op=>field.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20).sort((a,b)=>b.medical-a.medical)[0]?.id;
 assert.ok(doctor,'actual wounded survivors require a stable local doctor');
 const events=[];let gatheredDressings=0;
 const order=a=>{
  if(a.type==='wait'){
   if(patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp)&&c.operativeState[doctor].medkits<2)gather(doctor,i=>i.item==='medkits',8,()=>c.operativeState[doctor].medkits);
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
 if(patients.length)gather(doctor,i=>i.item==='medkits',8,()=>c.operativeState[doctor].medkits);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':operativeId===doctor&&patients.length?'doctor':'rest'});
 const front=c.activeSquadId;
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 order({type:'createSquad',name:'Socorro del paso',ids:[57],sector:'cordoba'});const courier=c.activeSquadId;
 for(const item of ['field8','swivel']){
  for(let h=0;h<48&&!c.merchants.cordoba.stock[item];h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
  const stock=c.merchants.cordoba.stock[item];order({type:'purchaseEquipment',item});assert.equal(c.merchants.cordoba.stock[item],stock-1);
 }
 const medical= Math.min(8,c.merchants.cordoba.supplies.medkits);
 if(medical)order({type:'purchaseMedicalSupplies',operativeId:57,quantity:medical});
 order({type:'configureArtillery',types:[]});order({type:'assignCare',operativeId:57,assignment:'active'});
 order({type:'travel',sector:'jujuy',queue:true,mode:'posta'});
 for(let h=0;h<80&&(c.squads.find(q=>q.id===courier).journey||field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp));h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.location,'jujuy');assert.ok(field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding));
 if(medical){const before=c.operativeState[57].medkits;order({type:'sectorInventory',sector:'jujuy',operativeId:57,direction:'drop',item:'medkits',count:medical});assert.equal(c.operativeState[57].medkits,before-medical);}
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});order({type:'selectSquad',id:front});
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
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const battle=enterSector(c.pendingBattle,c.sectorStates.humahuaca);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 report({event:'survivorHumahuacaReady',hour:c.hour,treasury:c.resources.treasury,field,patients,doctor,reserve,light,gatheredDressings,events});return c;
}
