// A carried toolkit is a finite large-pocket item. The old numeric reserve is
// retained for saved campaigns and service-return custody, without issuing it.
export const REPAIR_KIT_WEIGHT=2;
export const REPAIR_KIT_POINTS=100;
export const isRepairKit=value=>value?.kind==='repair-kit';
export function validateRepairReserve(record){
 const points=record.toolkitPoints;
 if(points!==undefined&&(!Number.isSafeInteger(points)||points<0||points>100000))throw Error('La reserva de reparación no es válida.');
 return points??0;
}
// Old numeric reserves have no tactical pickup or transfer order. Their
// last accepted deployment record is the upper bound; maintenance spends them.
export function validateRepairReserveContext(request,battle){
 for(const issued of request.squad??[]){
  const unit=battle.units?.find(u=>u.side==='player'&&String(u.id)===String(issued.id));
  const maximum=validateRepairReserve(issued),remaining=validateRepairReserve(unit??{});
  if(!unit||remaining>maximum||maximum>0&&unit.toolkitPoints===undefined)throw Error('Los materiales de reparación no corresponden al despliegue.');
 }
}
export function retainRepairReserves(request,battle){
 validateRepairReserveContext(request,battle);
 request.squad=(request.squad??[]).map(issued=>{
  const unit=battle.units.find(u=>u.side==='player'&&String(u.id)===String(issued.id));
  return issued.toolkitPoints===undefined&&unit.toolkitPoints===undefined?issued:{...issued,toolkitPoints:validateRepairReserve(unit)};
 });
}
export function validateRepairKit(value){
 if(!isRepairKit(value)){
  if(value?.repairPoints!==undefined)throw Error('Los puntos de reparación necesitan un juego de herramientas.');
  return false;
 }
 if(value.count!==1||value.weight!==REPAIR_KIT_WEIGHT||!Number.isSafeInteger(value.repairPoints)||value.repairPoints<1||value.repairPoints>REPAIR_KIT_POINTS||['weapon','loaded','reloadProgress','ammoType','grenadeType','toolKey','itemType','outfit','fittings','fittingPattern','jammed'].some(key=>value[key]!==undefined))throw Error('El juego de herramientas no es válido.');
 return true;
}
export function repairMaterialPoints(record){
 let points=validateRepairReserve(record);
 for(const item of Object.values(record.inventory??{}))if(isRepairKit(item)&&item.count>0){validateRepairKit(item);points+=item.repairPoints;}
 return points;
}
