import {atHand} from './tactical-planning-space.js';
import {canSee,hasLineOfSight,actionCosts,lootPreview,planLoot,planReadyMainHand,medicalUsePreview} from './tactical.js';
import {criticalFirstAidNeeded} from './first-aid.js';

const present=unit=>unit.hp>0&&!unit.departure&&!unit.fled&&!unit.routed&&!unit.surrendered;
const dressing=ground=>ground.type==='medkits'||ground.type==='item'&&ground.item==='medkits';
const compareId=(a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0;

// Recover one finite dressing only for care already possible at this position.
// The ordinary queue rechecks preparation and treatment after the paid pickup.
export function chooseGroundDressingRecovery(state,unit){
  if(!unit||state.status!=='active'||!present(unit)||unit.unconscious||unit.knockedDown||unit.entangled||
      !(unit.medical>0)||unit.medkits!==0)return null;
  const costs=actionCosts(state,unit),prepare=unit.activeSlot==='medical'?0:costs.weapon;
  if(unit.ap<costs.loot+prepare+costs.heal)return null;
  const patients=state.units.filter(patient=>patient.side===unit.side&&present(patient)&&
    (patient.bleeding>0||criticalFirstAidNeeded(patient))&&atHand(unit,patient)&&hasLineOfSight(state,unit,patient)&&
    (patient.id===unit.id||canSee(state,unit,patient)));
  if(!patients.length)return null;
  // Enemy decisions also inspect between-turn snapshots. Execution still uses
  // the live phase, queue and unchanged ordinary pickup/medical guards.
  const ownTurn=unit.side==='enemy'?{...state,phase:'enemy'}:state;
  const sources=(state.groundItems??[]).filter(ground=>dressing(ground)&&Number.isSafeInteger(ground.count)&&ground.count>0&&!ground.heldBy&&!ground.containerId&&
    atHand(unit,ground)&&canSee(state,unit,ground)).sort(compareId);
  for(const source of sources){
    const action={type:'loot',unitId:unit.id,groundId:source.id,count:1};
    if(!lootPreview(ownTurn,unit,action).valid)continue;
    try{
      const {receiver}=planLoot(ownTurn,unit,action);
      const ready=prepare?planReadyMainHand(receiver,'medkits'):receiver;
      ready.ap=unit.ap-costs.loot-prepare;
      if(patients.some(patient=>medicalUsePreview(ownTurn,ready,patient).allowed))return action;
    }catch{/* Full pockets or an invalid current source cannot supply this care. */}
  }
  return null;
}
