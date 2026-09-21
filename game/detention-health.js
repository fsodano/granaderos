import {validateDetainedPrisoner} from './detention.js';
import {civilianRestoredHp} from './civilian-health.js';
import {validateCivilianWounds,civilianIncidents} from './civilian-harm.js';
import {CRITICAL_HEALTH,isUnconscious} from './tactical-condition.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
// Planning only: the caller must acknowledge hpRestored atomically with these
// medical fields, and settle custody separately if alive becomes false.
// acknowledged is a trusted campaign receipt, never a tactical payload.
export function planDetentionHealth(operativeId,record,npc,acknowledged=0){
 validateDetainedPrisoner(npc);validateCivilianWounds(npc);
 const d=npc.detention;
 need(d&&d.operativeId===operativeId&&record?.captured&&record.capturedAt===d.capturedAt&&record.capturedSector===d.sector,'El parte no corresponde al cautiverio actual.');
 need(npc.maxHp===record.maxHp&&Number.isFinite(record.hp)&&record.hp>=0&&record.hp<=record.maxHp,'La salud del prisionero no corresponde a su hoja de servicio.');
 need(Number.isFinite(npc.energy)&&npc.energy>=0&&npc.energy<=100,'La energía del prisionero no es válida.');
 need(!(record.bleeding>0||record.bandaged>0)||npc.civilianWoundVersion===1,'El parte perdió las heridas del prisionero.');
 const restored=civilianRestoredHp(npc);
 need(Number.isFinite(acknowledged)&&acknowledged>=0&&restored>=acknowledged,'El parte perdió una estabilización del prisionero.');
 need(npc.hp<=record.hp+restored-acknowledged&&npc.hp<=Math.max(record.hp,Math.min(CRITICAL_HEALTH,record.maxHp)),'La salud del prisionero aumentó sin una estabilización nueva.');
 need(record.hp>0&&record.alive!==false||npc.hp===0,'Un prisionero fallecido no puede volver al servicio.');
 if(npc.hp===0)need(civilianIncidents(npc).some(event=>event.kind==='death'),'Falta el registro de la muerte del prisionero.');
 // Do not round fractional damage upward: that would create health at each
 // repeated report. Energy recovery is settled by its own campaign system.
 const hp=npc.hp,energy=Math.min(record.energy??100,npc.energy);
 const bleeding=hp>0?(npc.bleeding??0):0;
 const bandaged=Math.min(npc.bandaged??record.bandaged??0,record.maxHp-hp);
 return {health:{hp,energy,bleeding,bandaged,alive:hp>0,unconscious:isUnconscious({hp,energy}),recoveryHours:0},hpRestored:restored};
}
