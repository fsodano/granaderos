import {WEAPONS} from './data.js';
// Item ownership stays in existing records. These references say which records
// occupy hands and which must take real pocket space instead.
export function handsRequired(weaponId){
 const id=typeof weaponId==='object'?weaponId?.id:weaponId;
 return WEAPONS[id]?.type==='firearm'&&![1805,1806,1808].includes(id)?2:1;
}
export function handLayout(unit){
 const weapons=[...(!unit.weaponDropped&&unit.weapon?['primary']:[]),...(unit.blade?['blade']:[]),...(unit.offHand?['offhand']:[])];
 const id=item=>item==='primary'?unit.weapon:item==='blade'?unit.blade:unit.offHand?.weapon;
 const slot=unit.activeSlot??'primary',tool=unit.inventory?.[unit.activeTool?.replace(/^inventory:/,'')];
 const heldObject=unit.activeItem?.startsWith('inventory:')?unit.inventory?.[unit.activeItem.slice(10)]:unit[unit.activeItem];
 const right=slot==='item'&&(typeof heldObject==='number'?heldObject:heldObject?.count)>0?unit.activeItem:weapons.includes(slot)?slot:slot==='medical'&&unit.medkits>0?'medkits':slot==='supply'&&unit[unit.activeSupply]>0?unit.activeSupply:slot==='tool'&&(typeof tool==='number'?tool:tool?.count)>0?unit.activeTool:null;
 const required=right&&weapons.includes(right)?handsRequired(id(right)):1;
 const chosen=unit.leftHandItem,record=typeof chosen==='string'&&chosen.startsWith('inventory:')?unit.inventory?.[chosen.slice(10)]:null;
 const chosenCount=chosen==='primary'?(!unit.weaponDropped&&unit.weapon?1:0):chosen==='blade'?(unit.blade?1:0):chosen==='offhand'?(unit.offHand?1:0):record?(typeof record==='number'?record:record.count):unit[chosen];
 const left=required===2?null:chosen!==undefined?(chosen&&chosenCount>(chosen===right?1:0)?chosen:null):slot==='unarmed'?null:['offhand','blade','primary'].find(item=>weapons.includes(item)&&item!==right&&handsRequired(id(item))===1)??null;
 const held=[right,left].filter(Boolean);
 return {right,left,twoHanded:Boolean(right&&required===2),stowed:weapons.filter(item=>!held.includes(item)),held};
}

// Selecting an item for use moves it from the second hand to the main hand.
export function selectMainHand(unit,selection){
 const next={...unit,...selection};
 if(selection.activeSlot!=='item')delete next.activeItem;
 if(next.leftHandItem&&(handLayout(next).right===next.leftHandItem||handLayout(next).twoHanded))next.leftHandItem=null;
 if(selection.activeSlot==='unarmed'&&next.leftHandItem!==undefined)next.leftHandItem=null;
 return next;
}
