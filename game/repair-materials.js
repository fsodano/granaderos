// A carried toolkit is a finite large-pocket item. The old numeric reserve is
// retained for saved campaigns and service-return custody, without issuing it.
export const REPAIR_KIT_WEIGHT=2;
export const REPAIR_KIT_POINTS=100;
export const isRepairKit=value=>value?.kind==='repair-kit';
export function validateRepairKit(value){
 if(!isRepairKit(value)){
  if(value?.repairPoints!==undefined)throw Error('Los puntos de reparación necesitan un juego de herramientas.');
  return false;
 }
 if(value.count!==1||value.weight!==REPAIR_KIT_WEIGHT||!Number.isSafeInteger(value.repairPoints)||value.repairPoints<1||value.repairPoints>REPAIR_KIT_POINTS||['weapon','loaded','reloadProgress','ammoType','grenadeType','toolKey','itemType','outfit','fittings','fittingPattern','jammed'].some(key=>value[key]!==undefined))throw Error('El juego de herramientas no es válido.');
 return true;
}
export function repairMaterialPoints(record){
 let points=record.toolkitPoints??0;
 for(const item of Object.values(record.inventory??{}))if(isRepairKit(item)&&item.count>0){validateRepairKit(item);points+=item.repairPoints;}
 return points;
}
