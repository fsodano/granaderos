import {WEAPONS} from './data.js';
import {handLayout} from './hand-layout.js';
import {readItemStack,itemStackDescriptor} from './tactical-inventory.js';
import {fittingLabel} from './weapon-fittings.js';

const supplyIcons={ammo:'ammo',priming:'priming',flints:'flints',rations:'rations',medkits:'medical',boleadoras:'boleadoras',torches:'torch'};
// The roster reads only the two physical hands. It does not plan actions or
// inspect the pack for an alternative weapon when a hand is empty or blocked.
export function rosterHands(unit){
 const hands=handLayout(unit);
 return ['right','left'].map(side=>{
  const item=hands[side],blocked=side==='left'&&hands.twoHanded,hand=side==='right'?'Mano principal':'Segunda mano';
  if(!item)return {side,item:null,blocked,label:blocked?'Ocupada por el arma':'Vacía',description:`${hand}: ${blocked?'ocupada por el arma de dos manos':'vacía'}.`,weapon:null,icon:blocked?'blocked':'empty',closeCombat:false,attached:false,attachments:[]};
  const stack=readItemStack(unit,item,1),descriptor=itemStackDescriptor(stack),weapon=stack.weapon??null,firearm=WEAPONS[weapon]?.type==='firearm';
  const closeCombat=side==='right'&&weapon!==null&&(firearm?unit.weaponMode==='melee':weapon>=1809&&weapon<=1813);
  const attachments=weapon===null?[]:Object.values(stack.fittings??{}).filter(Boolean).map(fitting=>({label:fitting.fittingPattern?fittingLabel(fitting.fittingPattern):WEAPONS[fitting.weapon]?.name??'Accesorio',condition:fitting.condition}));
  const status=[`${hand}: ${descriptor.label}`];
  if(firearm)status.push(stack.jammed?'Cazoleta sin cebar':`${stack.loaded??0} carga(s)`,side==='right'?`${unit.ammo??0} cartuchos de reserva`:'',side==='right'?(closeCombat?'Combate cercano activo':'Disparo activo'):'');
  else if(closeCombat)status.push('Combate cercano activo');
  if(stack.condition!==undefined)status.push(`Estado ${stack.condition}%`);
  if(attachments.length)status.push(...attachments.map(fitting=>`Accesorio fijado: ${fitting.label}${fitting.condition===0?' (roto)':fitting.condition!==undefined?` (${fitting.condition}%)`:''}`));
  const icon=weapon!==null?'weapon':supplyIcons[item]??(stack.itemType==='tool'||stack.kind==='tool'?stack.toolKey:stack.kind==='outfit'?'outfit':'item');
  return {side,item,blocked:false,label:descriptor.label,description:`${status.filter(Boolean).join('. ')}.`,weapon,icon,closeCombat,attached:attachments.length>0,attachments,...(firearm?{loaded:stack.loaded??0}:{}),...(stack.condition!==undefined?{condition:stack.condition}:{})};
 });
}
