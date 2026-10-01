import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {doctorRate,careAssignmentReason} from '../game/medical-care.js';
import {order,saved} from './local-contract-fixture.mjs';

// Existing workshop purchases and doctor/patient/rest orders only. Select both
// roles from current survivors; no fixed doctor, free kit or restored casualty.
export function prepareLocalOpening(s,{buyWeapons=true}={}){
 const returnSector=s.location;
 s=order(s,{type:'travel',sector:'retiro'});
 const care={hours:0,dressingsBought:0,dressingCost:0,weaponCost:0,workshopCost:0};
 for(const id of s.squad){
  if(buyWeapons){const before=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:'firearm-1801',quantity:1});care.weaponCost+=before-s.resources.treasury;
  const gun=s.armoryItems.find(i=>i.itemMetadata?.contentWeapon?.template===1801);assert.ok(gun);s=order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:gun.id});}
  for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:id});if(!n.lastError){assert.ok(n.resources.treasury<s.resources.treasury);care.workshopCost+=s.resources.treasury-n.resources.treasury;s=n;}}
 }
 while(true){
  const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),patient=roster.filter(o=>s.operativeState[o.id].hp<o.maxHp||s.operativeState[o.id].bleeding).sort((a,b)=>a.medical-b.medical)[0];if(!patient)break;
  assert.ok(care.hours<48,'recovery must use bounded, paid campaign care');
  const doctor=roster.filter(o=>o.id!==patient.id&&o.medical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&(s.operativeState[o.id].energy??100)>10).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living local doctor is required');
  for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
  // Marching and medical work can put the selected doctor to sleep. Let that
  // actual recovery finish before assigning care; do not wake an exhausted actor.
  for(let hour=0;s.operativeState[doctor.id].asleep&&hour<72;hour++)s=advanceCampaignHours(s,1);
  assert.equal(s.operativeState[doctor.id].asleep,false,'The doctor must finish actual sleep before working.');
  if(!s.operativeState[doctor.id].medkits){const quantity=Math.min(20,Math.ceil((patient.maxHp-s.operativeState[patient.id].hp)/doctorRate(doctor,s))+Number(s.operativeState[patient.id].bleeding>0)),before=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:doctor.id,quantity});care.dressingsBought+=quantity;care.dressingCost+=before-s.resources.treasury;}
  assert.equal(careAssignmentReason(s,doctor,'doctor'),'');s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
  const stock=s.operativeState[doctor.id].medkits;s=saved({campaign:advanceCampaignHours(s,1)}).campaign;assert.equal(s.operativeState[doctor.id].medkits,stock-1);care.hours++;
 }
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'rest'});s=order(s,{type:'wait',hours:6});
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});s=order(s,{type:'travel',sector:returnSector});
 // Recover at the actual destination; the return march spends fatigue and energy.
 for(const id of s.squad)if(s.operativeState[id].fatigue>0||s.operativeState[id].energy<100)s=order(s,{type:'setSleep',operativeId:id,asleep:true});
 for(let hour=0;s.squad.some(id=>s.operativeState[id].asleep)&&hour<72;hour++)s=advanceCampaignHours(s,1);
 assert.ok(s.squad.every(id=>!s.operativeState[id].asleep),'The squad must complete actual sleep before the next operation.');
 assert.equal(care.dressingCost,care.dressingsBought*10);assert.equal(care.weaponCost,buyWeapons?s.squad.length*230:0);
 for(const o of rosterFor(s).filter(o=>s.squad.includes(o.id))){assert.equal(s.operativeState[o.id].hp,o.maxHp);assert.equal(s.operativeState[o.id].energy,100);}
 return {campaign:saved({campaign:s}).campaign,care};
}
