import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave,encodeSave} from '../game/save.js';

export function recoverRescueForce(start,{report=()=>{}}={}){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[],startHour=campaign.hour;
 const dead=campaign.recruited.filter(id=>!campaign.operativeState[id].alive),patients=[115,105,147],doctors=[122,109];
 const order=action=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});};
 const renew=buffer=>{for(const id of [...campaign.recruited]){const r=campaign.operativeState[id],contract=campaign.contracts[id];if(r.alive&&!r.captured&&contract?.expiresAt!==null&&contract?.expiresAt-campaign.hour<=buffer){const cash=campaign.resources.treasury;order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.ok(campaign.resources.treasury<cash);}}};
 const model=id=>sectorInventoryModel(campaign,'tucuman',rosterFor(campaign),id);
 let recovered=0,donated=0;
 const gather=(id,limit=1000000)=>{
  let taken=0;
  for(const row of model(id).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits')){
   const count=Math.min(row.count,limit-taken);if(!count)break;
   order({type:'sectorInventory',sector:'tucuman',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});taken+=count;
  }
  return taken;
 };
 assert.equal(campaign.location,'tucuman');assert.equal(campaign.hour,127);assert.equal(campaign.pendingBattle,null);
 for(const operativeId of [106,109,145,115,105,123].filter(id=>campaign.operativeState[id].alive))order({type:'assignCare',operativeId,assignment:'rest'});
 recovered+=gather(122);
 const firstPatientHp=campaign.operativeState[115].hp,initialDressings=campaign.operativeState[122].medkits;
 assert.ok(initialDressings>0,'the doctor needs actual carried or recovered supplies');
 order({type:'assignCare',operativeId:115,assignment:'patient'});order({type:'assignCare',operativeId:122,assignment:'doctor'});
 order({type:'createSquad',name:'Correo sanitario',ids:[147]});order({type:'assignCare',operativeId:147,assignment:'active'});
 renew(13);order({type:'travel',sector:'cordoba'});assert.equal(campaign.location,'cordoba');assert.equal(campaign.hour,startHour+12);assert.equal(campaign.pendingEncounter,null);
 assert.ok(campaign.operativeState[115].hp>firstPatientHp,'the available supplies improve the first patient while the courier travels');assert.ok(campaign.operativeState[122].medkits<initialDressings,'the initial treatment consumes actual carried or recovered dressings');
 order({type:'assignCare',operativeId:122,assignment:'rest'});
 for(const item of ['torches','boleadoras'])order({type:'sectorInventory',sector:'cordoba',operativeId:147,direction:'drop',item,count:campaign.operativeState[147][item]});
 const stock=campaign.merchants.cordoba.supplies.medkits,cash=campaign.resources.treasury,carried=campaign.operativeState[147].medkits;
 for(const quantity of [20,10])order({type:'purchaseMedicalSupplies',operativeId:147,quantity});
 assert.equal(campaign.merchants.cordoba.supplies.medkits,stock-30);assert.equal(campaign.operativeState[147].medkits,carried+30);assert.equal(cash-campaign.resources.treasury,900);
 renew(13);order({type:'travel',sector:'tucuman'});assert.equal(campaign.location,'tucuman');assert.equal(campaign.hour,startHour+24);assert.equal(campaign.pendingEncounter,null);
 order({type:'sectorInventory',sector:'tucuman',operativeId:147,direction:'drop',item:'medkits',count:30});
 assert.equal(gather(122,15),15);assert.equal(gather(109,15),15);
 for(const operativeId of patients.filter(id=>id!==109))order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 report({event:'medicalCourierReturned',hour:campaign.hour,boughtDressings:30,cost:900,recoveredDressings:recovered});
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
 const recovery={startHour,endHour:campaign.hour,boughtDressings:30,cost:900,recoveredDressings:recovered,donatedDressings:donated};report({event:'rescueRecoveryComplete',...recovery});return {campaign,events,recovery};
}
