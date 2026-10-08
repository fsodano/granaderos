import {hasFirearm,firearmMaintenancePreview} from './tactical.js';
import {isRepairKit,validateRepairKit} from './repair-materials.js';

// Restore one owned broken loaded primary through the ordinary paid repair.
// Manual orders keep their existing guards. Militia need a live queue context.
export function chooseOwnedFirearmRepair(state,unit,autonomousContext=null){
  const militia=unit?.side==='player'&&unit.militia;
  if(unit?.side!=='enemy'&&!militia||!hasFirearm(unit)||unit.condition!==0||!(unit.loaded>0)||unit.jammed)return null;
  try{
    if(!Object.values(unit.inventory??{}).some(item=>isRepairKit(item)&&validateRepairKit(item)))return null;
    // Between-turn scoring projects only this enemy's existing action window.
    // The actual repair still checks the live phase, source and paid budget.
    const preview=militia?firearmMaintenancePreview(state,unit,autonomousContext):firearmMaintenancePreview({...state,phase:'enemy'},unit);
    return preview.valid&&preview.gain>0?preview.action:null;
  }catch{return null;}
}
