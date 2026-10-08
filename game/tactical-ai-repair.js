import {hasFirearm,firearmMaintenancePreview} from './tactical.js';
import {isRepairKit,validateRepairKit} from './repair-materials.js';

// Restore one owned broken loaded primary through the ordinary paid repair.
// Public orders and militia autonomy retain their existing authority guards.
export function chooseOwnedFirearmRepair(state,unit){
  if(unit?.side!=='enemy'||!hasFirearm(unit)||unit.condition!==0||!(unit.loaded>0)||unit.jammed)return null;
  try{
    if(!Object.values(unit.inventory??{}).some(item=>isRepairKit(item)&&validateRepairKit(item)))return null;
    // Between-turn scoring projects only this enemy's existing action window.
    // The actual repair still checks the live phase, source and paid budget.
    const preview=firearmMaintenancePreview({...state,phase:'enemy'},unit);
    return preview.valid&&preview.gain>0?preview.action:null;
  }catch{return null;}
}
