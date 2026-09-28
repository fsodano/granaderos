export const CRITICAL_HEALTH=15;
export const isUnconscious=unit=>unit.hp>0&&(unit.hp<CRITICAL_HEALTH||(unit.energy??100)<=0);
// Exhaustion can recover during a turn. Critical health requires treatment.
export const fieldCapable=unit=>unit.hp>=CRITICAL_HEALTH&&!unit.routed;
export function refreshMilitaryCondition(unit){
  unit.unconscious=isUnconscious(unit);
  if(unit.hp<=0||unit.unconscious||unit.knockedDown||unit.routed||unit.weaponDropped)lowerWeapon(unit);
  if(unit.hp<=0||unit.unconscious){unit.ap=0;unit.maxAP=0;unit.mounted=false;unit.braced=false;unit.overwatch=false;}
  if(unit.hp<=0)unit.bleeding=0;
  return unit;
}
import {lowerWeapon} from './weapon-readiness.js';
