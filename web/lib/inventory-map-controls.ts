import {inventoryMapPreview,canSee,visibleRooms} from '../../game/tactical.js';
import {tacticalLevel,sameCell,spaceKey} from '../../game/tactical-space.js';
import {isInteriorVisible} from '../../game/tactical-visibility.js';
import type {EquipmentInteraction,EquipmentSource} from './equipment-interaction';

export type InventoryMapIntent='auto'|'ground';
export type InventoryMapOverride={target:string;intent:InventoryMapIntent}|null;
export const inventoryIntentAt=(override:InventoryMapOverride,point:any):InventoryMapIntent=>point&&override?.target===spaceKey(point)?override.intent:'auto';
export const toggleInventoryDestination=(override:InventoryMapOverride,point:any):InventoryMapOverride=>({target:spaceKey(point),intent:inventoryIntentAt(override,point)==='auto'?'ground':'auto'});
export const retainInventoryDestination=(override:InventoryMapOverride,point:any):InventoryMapOverride=>point&&override?.target===spaceKey(point)?override:null;
export function selectedItemMapPreview(battle:any,unit:any,picked:EquipmentSource|null,point:any,intent:InventoryMapIntent='auto'):any{
 if(!picked||!unit||!point)return null;
 if(picked.unitId!==String(unit.id))return {valid:false,reason:'Seleccioná el objeto de este combatiente.',pa:0};
 // Surface and scenery IDs are not recipient IDs. Resolve only a public
 // person on the clicked cell, including when an upper floor has its own ID.
 const target=point.id&&[...(battle.units??[]),...(battle.npcs??[])].find(person=>person.id===point.id&&sameCell(person,point)&&(person.side==='player'||isInteriorVisible(battle,person,new Set([...battle.revealedRooms??[],...visibleRooms(battle)]))&&battle.units?.some((observer:any)=>observer.side==='player'&&canSee(battle,observer,person))));
 const action={type:'inventoryMap',sourceId:picked.sourceId,expectedSource:picked.expectedSource,count:picked.count,intent,x:point.x,y:point.y,tacticalLevel:tacticalLevel(point),...(target?{targetId:target.id}:{})};
 const preview=inventoryMapPreview(battle,unit,action);
 const actionLabel=('actionLabel' in preview?preview.actionLabel:'Colocar objeto')+(preview.valid&&preview.kind==='throw'&&preview.action?.targetId?` · ${preview.chance}% de atrapar`:'');
 const relayNote=preview.route.length>2?`${preview.route.map((step:any)=>step.name).join(' → ')}${battle.mode==='exploration'?'':` · ${preview.totalPA} PA en total`}`:null;
 return {...preview,name:`${picked.label} · ${picked.count}`,actionLabel,coverNote:relayNote,remaining:Math.max(0,(unit.ap??0)-preview.pa),action:preview.action??action};
}

// Return true whenever the item cursor owns the click, including a refusal.
// A failed placement must never fall through to movement, treatment or combat.
export function placeSelectedItemOnMap(store:EquipmentInteraction,battle:any,unit:any,point:any,intent:InventoryMapIntent,busy:boolean,onOrder:(action:any)=>any){
 const picked=store.getSnapshot().selection;if(!picked)return false;
 if(busy){store.report('Esperá a que termine la orden.');return true;}
 const preview=selectedItemMapPreview(battle,unit,picked,point,intent);
 if(!preview?.valid){store.report(preview?.reason??'Elegí un destino válido.');return true;}
 const accepted=onOrder(preview.action);
 if(accepted&& !accepted.lastError){if(store.getSnapshot().selection===picked)store.cancel();}
 else store.report(accepted?.lastError??'La orden no se pudo completar. El objeto sigue en su lugar.');
 return true;
}
