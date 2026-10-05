import {fieldPractice,fieldPracticeChance} from './skill-training.js';
import {CRITICAL_HEALTH} from './actor-condition.js';
import {firearmPassesNear} from './firearm-near-passage.js';
export {NEAR_MISS_DISTANCE,NEAR_MISS_HEIGHT_MARGIN} from './firearm-near-passage.js';

const completed=new WeakSet();
const capable=unit=>unit?.hp>=CRITICAL_HEALTH&&(unit.energy??100)>0&&!['unconscious','knockedDown','routed','bound','captured','entangled','surrendered','departure','fled'].some(key=>unit[key]);
const hitsTarget=(flight,target)=>[...(flight.bodyImpacts??[]),...(flight.victimId!=null?[flight]:[])].some(hit=>(hit.victimKind??'unit')==='unit'&&String(hit.victimId)===String(target.id));
// Called only by the paid directed single-ball resolution, after physical
// effects. Forecasts, point fire and presentation frames never call this.
// Only the intended player may learn; the physical stop can remain hidden.
export function practiceFirearmNearMiss(state,{attacker,target,weapon,flight,hit,discharged,damagedBodies,source=attacker}={}){
 if(discharged!==true||hit!==false||!flight||completed.has(flight)||!state.units?.includes(source)||!state.units.includes(target))return 0;
 if(source.side!=='enemy'||attacker?.side!=='enemy'||target.side!=='player'||!capable(target)||attacker.jammed)return 0;
 if(!(damagedBodies instanceof Set)||damagedBodies.has(`unit:${target.id}`)||hitsTarget(flight,target))return 0;
 if(!weapon||![weapon.fireAP,weapon.range,weapon.capacity].every(value=>Number.isFinite(value)&&value>0)||weapon.loadPattern!==undefined&&weapon.loadPattern!=='single'||(weapon.template??weapon.id)===1807&&!weapon.loadPattern)return 0;
 if((target.trainedStats?.agility??0)>=10||!fieldPracticeChance(target,'agility'))return 0;
 if(!firearmPassesNear(state,attacker,target,flight))return 0;
 completed.add(flight);
 return fieldPractice(target,'agility',1);
}
