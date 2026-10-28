import {WEAPONS} from './data.js';

export const SPRITE_EQUIPMENT = Object.freeze(['long-gun','short-gun','blade','unarmed']);
const pistols = new Set([1805,1806,1808]);

// Only the selected main-hand item controls the action silhouette. A carried
// pistol or blade must not replace the item actually selected for use.
export function spriteEquipment(unit){
 const slot=unit.activeSlot??'primary';
 if(!['primary','blade','offhand'].includes(slot))return 'unarmed';
 if(slot==='primary'&&unit.weaponDropped)return 'unarmed';
 const held=slot==='blade'?unit.blade:slot==='offhand'?unit.offHand?.weapon:unit.weapon;
 const id=Number(typeof held==='object'?held?.id:held);
 const item=WEAPONS[id]??(typeof held==='object'?held:undefined);
 if(item?.type==='firearm'||item?.capacity>0){
  return pistols.has(id)||item?.hands===1?'short-gun':'long-gun';
 }
 return item?.type==='blade'||(id>=1809&&id<=1813)?'blade':'unarmed';
}

export function spriteUsesEquipmentVariant(unit){
 return unit.hp>0&&!unit.unconscious&&(unit.mounted||!['prone'].includes(unit.stance)&&unit.movementMode!=='prone');
}
