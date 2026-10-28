import assert from 'node:assert/strict';
import {fight} from './opening-driver.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {openingRearFormation} from './opening-rear-medical-supply.mjs';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {contractExpiresSeconds} from '../packages/game/contracts.js';

const localServing=(campaign,id,sector)=>{
 const body=campaign.operativeState[id],contract=campaign.contracts[id],expiry=contractExpiresSeconds(contract),now=campaign.hour*3600+(campaign.secondOfHour??0);
 return campaign.recruited.includes(id)&&body?.alive&&!body.captured&&contract&&!contract.departurePending&&(expiry===null||expiry>now)&&!operativeInTransit(campaign,id)&&operativeLocation(campaign,id)===sector;
};

// Native defense preparation changes duties to active. Preserve only the
// actual friendly working doctors immediately before that existing response.
export function saltaHospitalClinicalDoctorIds(campaign,sector){
 return campaign.recruited.filter(id=>localServing(campaign,id,sector)&&campaign.operativeState[id].assignment==='doctor');
}

export function saltaHospitalBattleOptions({preferredPhysicianIds=[]}={}){
 const preferred=[...preferredPhysicianIds];
 let policy=null;
 return {
  admitBattle(initial){
   assert.equal(policy,null,'The hospital roles initialize once from this actual Native entry.');
   policy=coordinatedHospitalBattery(initial,{coordinatePhysicianHold:true,preferredPhysicianIds:preferred});
   return initial;
  },
  controller(battle,unit){
   assert.ok(policy,'The actual entry must initialize hospital roles before control.');
   return policy.controller(battle,unit);
  },
 };
}

function fightSaltaHospitalEncounter(request,previous,options){
 // fight owns the unchanged entry. Its existing callback supplies the real
 // initial body; original execution and replay each receive their own roles.
 return fight(request,previous,{...options,...saltaHospitalBattleOptions()});
}

export function saltaHospitalEncounterExecutor({campaign,encounterController,preferredPhysicianIds=[]}={},sector){
 if(encounterController!=null||sector!=='tucuman'||!campaign)return undefined;
 // Cover can be earned after Salta preparation starts. Read the actual
 // encounter response, not the earlier decision that triggered paid staging.
 if(!openingRearFormation(campaign,sector).allCovered)return undefined;
 const preferred=preferredPhysicianIds.filter(id=>localServing(campaign,Number(id),sector));
 if(!preferred.length)return fightSaltaHospitalEncounter;
 return function fightSaltaClinicalHospitalEncounter(request,previous,options){
  return fight(request,previous,{...options,...saltaHospitalBattleOptions({preferredPhysicianIds:preferred})});
 };
}
