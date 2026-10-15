import assert from 'node:assert/strict';
import {fight} from './opening-driver.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';
import {openingRearFormation} from './opening-rear-medical-supply.mjs';

export function saltaHospitalBattleOptions(){
 let policy=null;
 return {
  admitBattle(initial){
   assert.equal(policy,null,'The hospital roles initialize once from this actual Native entry.');
   policy=coordinatedHospitalBattery(initial,{coordinatePhysicianHold:true});
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

export function saltaHospitalEncounterExecutor({campaign,encounterController}={},sector){
 if(encounterController!=null||sector!=='tucuman'||!campaign)return undefined;
 // Cover can be earned after Salta preparation starts. Read the actual
 // encounter response, not the earlier decision that triggered paid staging.
 return openingRearFormation(campaign,sector).allCovered?fightSaltaHospitalEncounter:undefined;
}
