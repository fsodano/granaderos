import assert from 'node:assert/strict';
import {fight} from './opening-driver.mjs';
import {coordinatedHospitalBattery} from './coordinated-hospital-battery.mjs';

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

export function saltaHospitalEncounterExecutor({allCovered=false,encounterController}={},sector){
 return allCovered&&encounterController==null&&sector==='tucuman'?fightSaltaHospitalEncounter:undefined;
}
