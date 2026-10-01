// Body slots retain exact garment records; legacy outfit/poncho means torso.
export const OUTFIT_CHANGE_AP=8;
export const PONCHO_PRICE=20;
export const PONCHO_STOCK_CAP=6;
export const PONCHO_DAILY_RESTOCK=1;
export const BODY_SLOTS=Object.freeze(['headwear','outfit','legwear']);
export const OUTFITS=Object.freeze({poncho:Object.freeze({name:'Poncho de lana',weight:2,slot:'outfit'}),hat:Object.freeze({name:'Sombrero de fieltro',weight:.3,slot:'headwear'}),trousers:Object.freeze({name:'Pantalón de campaña',weight:.7,slot:'legwear'})});
export const outfitSlot=value=>OUTFITS[value?.outfit]?.slot??null;
export function makeOutfit(kind='poncho',condition=100){const spec=Object.hasOwn(OUTFITS,kind)&&OUTFITS[kind];if(!spec)throw Error('La vestimenta no existe.');return {kind:'outfit',outfit:kind,count:1,weight:spec.weight,condition};}
export function validateOutfit(value,{worn=false,slot=null}={}){
 if(value==null)return;
 const spec=typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(OUTFITS,value.outfit)&&OUTFITS[value.outfit];
 if(!spec||slot&&spec.slot!==slot||value.kind!=='outfit'||!Number.isSafeInteger(value.count)||value.count<0||value.count>1000000||worn&&value.count!==1||value.weight!==spec.weight||!Number.isFinite(value.condition)||value.condition<0||value.condition>100||['weapon','loaded','reloadProgress','jammed','fittings','fittingPattern','toolKey','itemType'].some(key=>value[key]!==undefined))throw Error('La vestimenta no es válida.');
 if(value.instanceId!==undefined&&(typeof value.instanceId!=='string'||!value.instanceId.length||value.instanceId.length>100||/[<>\x00-\x1f]/.test(value.instanceId)||value.count>1||['__proto__','prototype','constructor'].includes(value.instanceId)))throw Error('La identidad de la vestimenta no es válida.');
}
export function wornOutfit(unit,slot='outfit'){if(!BODY_SLOTS.includes(slot))throw Error('La ranura de vestimenta no existe.');const outfit=slot==='outfit'&&unit.outfit===undefined?(unit.poncho?makeOutfit():null):unit[slot]??null;validateOutfit(outfit,{worn:true,slot});return outfit;}
export const wornBodyItems=unit=>BODY_SLOTS.filter(slot=>wornOutfit(unit,slot));
export function normalizeOutfit(unit){for(const slot of BODY_SLOTS)unit[slot]=structuredClone(wornOutfit(unit,slot));delete unit.poncho;return unit;}
export const hasPoncho=unit=>{const outfit=wornOutfit(unit);return outfit?.outfit==='poncho'&&outfit.condition>0;};
// The recruit's personal clothing is issued once with their service equipment.
// A saved empty slot is deliberate and must not be refilled on rehire or entry.
export function issueInitialOutfit(campaign,id){const record=campaign.operativeState[id];if(record.outfit!==undefined)return;record.headwear??=makeOutfit('hat');record.legwear??=makeOutfit('trousers');record.outfit=makeOutfit();}
