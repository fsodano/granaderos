import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';

export function recoverRescueForce(start,{patients,report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[],startHour=campaign.hour;
 assert.ok(patients?.length,'recover the actual released prisoners');
 const dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive),roster=rosterFor(campaign);
 const local=roster.filter(op=>{const r=campaign.operativeState[op.id];return campaign.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='tucuman'&&r.hp>=15&&!patients.includes(op.id);});
 const doctors=local.filter(op=>op.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,2).map(op=>op.id);assert.equal(doctors.length,2,'two actual doctors provide recovery');
 const courier=local.filter(op=>!doctors.includes(op.id)&&campaign.operativeState[op.id].energy>10).sort((a,b)=>a.medical-b.medical)[0]?.id;assert.ok(courier,'a living local reserve carries the supplies');
 const [firstDoctor,secondDoctor]=doctors,firstPatient=patients[0];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const renew=buffer=>{for(const id of [...campaign.recruited]){const r=campaign.operativeState[id],contract=campaign.contracts[id];if(r.alive&&!r.captured&&contract?.expiresAt!==null&&contract?.expiresAt-campaign.hour<=buffer){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.ok(campaign.resources.treasury<cash);}}};
 const model=id=>sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),id);
 let recovered=0,donated=0;
 const gather=(id,limit=1000000)=>{
  let taken=0;
  for(const row of model(id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){
   let count=Math.min(row.count,limit-taken);if(!count)break;
   const stack=JSON.parse(row.expected),actor=model(id).personal;
   while(count){try{applyItemQuantity(actor,{...stack,count});break;}catch(error){assert.match(error.message,/espacio en el inventario/);count--;}}
   if(!count)continue;
   order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});taken+=count;
   assert.equal(model(id).entries.find(entry=>entry.key===row.key)?.count??0,row.count-count);
  }
  return taken;
 };
 assert.equal(campaign.location,'tucuman');assert.equal(campaign.pendingBattle,null);
 for(const operativeId of [...local.map(op=>op.id),...patients])order({type:'assignCare',operativeId,assignment:'rest'});
 recovered+=gather(firstDoctor);
 const firstPatientHp=campaign.operativeState[firstPatient].hp,initialDressings=campaign.operativeState[firstDoctor].medkits;
 assert.ok(initialDressings>0,'the doctor needs actual carried or recovered supplies');
 order({type:'assignCare',operativeId:firstPatient,assignment:'patient'});order({type:'assignCare',operativeId:firstDoctor,assignment:'doctor'});
 order({type:'createSquad',name:'Correo sanitario',ids:[courier]});order({type:'assignCare',operativeId:courier,assignment:'active'});
 renew(13);order({type:'travel',sector:'cordoba'});assert.equal(campaign.location,'cordoba');assert.equal(campaign.hour,startHour+12);assert.equal(campaign.pendingEncounter,null);
 assert.ok(campaign.operativeState[firstPatient].hp>firstPatientHp,'the available supplies improve the first patient while the courier travels');assert.ok(campaign.operativeState[firstDoctor].medkits<initialDressings,'the initial treatment consumes actual carried or recovered dressings');
 order({type:'assignCare',operativeId:firstDoctor,assignment:'rest'});
 for(const item of ['torches','boleadoras']){const count=campaign.operativeState[courier][item];if(count)order({type:'sectorInventory',sector:'cordoba',operativeId:courier,direction:'drop',item,count});}
 const stock=campaign.merchants.cordoba.supplies.medkits,cash=campaign.resources.treasury,carried=campaign.operativeState[courier].medkits;
 const boughtDressings=Math.min(12,stock);assert.ok(boughtDressings>0);order({type:'purchaseMedicalSupplies',operativeId:courier,quantity:boughtDressings});
 assert.equal(campaign.merchants.cordoba.supplies.medkits,stock-boughtDressings);assert.equal(campaign.operativeState[courier].medkits,carried+boughtDressings);assert.equal(cash-campaign.resources.treasury,boughtDressings*30);
 renew(13);order({type:'travel',sector:'tucuman'});assert.equal(campaign.location,'tucuman');assert.equal(campaign.hour,startHour+24);assert.equal(campaign.pendingEncounter,null);
 order({type:'sectorInventory',sector:'tucuman',operativeId:courier,direction:'drop',item:'medkits',count:boughtDressings});
 const firstShare=Math.ceil(boughtDressings/2),secondShare=boughtDressings-firstShare;assert.equal(gather(firstDoctor,firstShare),firstShare);assert.equal(gather(secondDoctor,secondShare),secondShare);
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 report({event:'medicalCourierReturned',hour:campaign.hour,boughtDressings,cost:boughtDressings*30,recoveredDressings:recovered});
 for(let i=0;patients.some(id=>campaign.operativeState[id].hp<campaign.operativeState[id].maxHp)&&i<80;i++){
  assert.equal(campaign.pendingEncounter,null,'resolve an actual encounter before continuing treatment');renew(2);
  for(const id of doctors)if(campaign.operativeState[id].medkits===0){
   let count=gather(id);
   if(!count){const donor=rosterFor(campaign).find(op=>!doctors.includes(op.id)&&model(op.id).operativeId===op.id&&!model(op.id).reason&&campaign.operativeState[op.id].medkits>0);
    assert.ok(donor,'treatment needs an available finite dressing source');const quantity=campaign.operativeState[donor.id].medkits;
    order({type:'sectorInventory',sector:'tucuman',operativeId:donor.id,direction:'drop',item:'medkits',count:quantity});donated+=quantity;count=gather(id);
   }
   assert.ok(count);
  }
  order({type:'wait',hours:1});
 }
 for(const id of patients)assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);
 for(const operativeId of [...patients,...doctors])order({type:'assignCare',operativeId,assignment:'rest'});
 const restUntil=campaign.hour+6;for(let i=0;campaign.hour<restUntil&&i<20;i++){renew(2);order({type:'wait',hours:1});}assert.equal(campaign.hour,restUntil);
 for(const id of dead)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of patients){assert.equal(campaign.operativeState[id].bleeding,0);assert.equal(campaign.operativeState[id].captured,false);assert.ok(campaign.recruited.includes(id));}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 const recovery={startHour,endHour:campaign.hour,patients,doctors,courier,boughtDressings,cost:boughtDressings*30,recoveredDressings:recovered,donatedDressings:donated};report({event:'rescueRecoveryComplete',...recovery});return {campaign,events,recovery};
}
