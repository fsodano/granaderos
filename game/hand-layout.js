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
 const right=weapons.includes(slot)?slot:slot==='medical'&&unit.medkits>0?'medkits':slot==='supply'&&unit[unit.activeSupply]>0?unit.activeSupply:slot==='tool'&&(typeof tool==='number'?tool:tool?.count)>0?unit.activeTool:null;
 const required=right&&weapons.includes(right)?handsRequired(id(right)):1;
 const left=slot==='unarmed'||required===2?null:['offhand','blade','primary'].find(item=>weapons.includes(item)&&item!==right&&handsRequired(id(item))===1)??null;
 const held=[right,left].filter(Boolean);
 return {right,left,twoHanded:Boolean(right&&required===2),stowed:weapons.filter(item=>!held.includes(item)),held};
}
