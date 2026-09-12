// One general clothing slot. Weight, condition and change cost are period-game tuning.
export const OUTFIT_CHANGE_AP=8;
export const OUTFITS=Object.freeze({poncho:Object.freeze({name:'Poncho de lana',weight:2})});
export function makeOutfit(kind='poncho',condition=100){const spec=Object.hasOwn(OUTFITS,kind)&&OUTFITS[kind];if(!spec)throw Error('La vestimenta no existe.');return {kind:'outfit',outfit:kind,count:1,weight:spec.weight,condition};}
export function validateOutfit(value,{worn=false}={}){
 if(value==null)return;
 const spec=typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(OUTFITS,value.outfit)&&OUTFITS[value.outfit];
 if(!spec||value.kind!=='outfit'||!Number.isSafeInteger(value.count)||value.count<0||value.count>1000000||worn&&value.count!==1||value.weight!==spec.weight||!Number.isFinite(value.condition)||value.condition<0||value.condition>100||['weapon','loaded','reloadProgress','jammed','fittings','fittingPattern','toolKey','itemType'].some(key=>value[key]!==undefined))throw Error('La vestimenta no es válida.');
 if(value.instanceId!==undefined&&(typeof value.instanceId!=='string'||!value.instanceId.length||value.instanceId.length>100||/[<>\x00-\x1f]/.test(value.instanceId)||value.count>1||['__proto__','prototype','constructor'].includes(value.instanceId)))throw Error('La identidad de la vestimenta no es válida.');
}
export function wornOutfit(unit){const outfit=unit.outfit===undefined?(unit.poncho?makeOutfit():null):unit.outfit;validateOutfit(outfit,{worn:true});return outfit;}
export function normalizeOutfit(unit){unit.outfit=structuredClone(wornOutfit(unit));delete unit.poncho;return unit;}
export const hasPoncho=unit=>{const outfit=wornOutfit(unit);return outfit?.outfit==='poncho'&&outfit.condition>0;};
// Initial service equipment is drawn once, not recreated at each deployment.
export function issueInitialOutfit(campaign,id){const record=campaign.operativeState[id];if(record.outfit!==undefined)return;if((campaign.resources.ponchos??0)>0){record.outfit=makeOutfit();campaign.resources.ponchos--;}else record.outfit=null;}
