import {DEFAULT_CHARACTER_SUPPLIES} from './character-supplies.js';
import {isUnconscious} from './actor-condition.js';

export const CIVILIAN_SUPPLY_FIELDS=Object.keys(DEFAULT_CHARACTER_SUPPLIES);
const limit=key=>key==='medkits'?1000000:100000;
export function civilianSuppliesFor(record){return {version:1,...Object.fromEntries(CIVILIAN_SUPPLY_FIELDS.map(k=>[k,record?(record[k]??DEFAULT_CHARACTER_SUPPLIES[k]):0]))};}
export function validCivilianSupplies(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===7&&value.version===1&&CIVILIAN_SUPPLY_FIELDS.every(k=>Object.hasOwn(value,k)&&Number.isSafeInteger(value[k])&&value[k]>=0&&value[k]<=limit(k));}

// The service sheet owns these six finite quantities. A civilian scene is a
// projection of the same holder, never a fresh starting allocation.
export function civilianSupplyLoot(npc,collector,{item='all',count}={}){
 const no=reason=>({valid:false,reason,amounts:{}}),stock=npc?.civilianSupplies;
 if(!validCivilianSupplies(stock))return no('Este habitante no tiene suministros disponibles para recoger.');
 if(npc.departure)return no('El habitante ya no está en el sector.');
 if(npc.hp>0&&!isUnconscious(npc))return no('Solo puedes registrar un cuerpo o una persona inconsciente.');
 if(item!=='all'&&!CIVILIAN_SUPPLY_FIELDS.includes(item))return no('Elegí un suministro personal del habitante.');
 if(count!==undefined&&(!Number.isSafeInteger(count)||count<1))return no('La cantidad debe ser un número entero positivo.');
 const fields=item==='all'?CIVILIAN_SUPPLY_FIELDS:[item],amounts=Object.fromEntries(fields.map(k=>[k,Math.min(stock[k],count??Infinity,Math.max(0,limit(k)-(collector[k]??0)))]).filter(([,n])=>n>0));
 if(!Object.keys(amounts).length)return no(fields.some(k=>stock[k]>0)?'No cabe otro suministro de ese tipo.':'No quedan suministros que recoger.');
 return {valid:true,reason:null,amounts};
}
