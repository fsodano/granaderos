import {isUnconscious} from './tactical-condition.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const health=value=>Number.isFinite(value)&&value>=0&&value<=100;
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=120&&!/[<>\x00-\x1f]/u.test(value);
const fields=['sequence','kind','attackerId','side','militia','intentional','hpBefore','hpAfter'];

// Two lifetime facts, not an event for every damage tick: the first direct
// player wound, then death. Their sequence survives sector reentry. Legacy
// injuries have no attributed receipt and never gain retrospective blame.
export function civilianIncidents(npc){
 if(npc?.civilianHarm===undefined)return [];
 const record=npc.civilianHarm;
 need(object(record)&&record.version===1&&Object.keys(record).every(key=>['version','incidents'].includes(key))&&Array.isArray(record.incidents)&&record.incidents.length>=1&&record.incidents.length<=2,'El registro de daños civiles no es válido.');
 const kinds=new Set();
 for(const [index,event]of record.incidents.entries()){
  need(object(event)&&Object.keys(event).length===fields.length&&fields.every(key=>Object.hasOwn(event,key))&&event.sequence===index+1&&['wounded','death'].includes(event.kind)&&!kinds.has(event.kind),'La secuencia de daños civiles no es válida.');
  need(['player','enemy','unknown'].includes(event.side)&&typeof event.militia==='boolean'&&typeof event.intentional==='boolean'&&(event.side==='unknown'?event.attackerId===null&&!event.militia&&!event.intentional:identity(event.attackerId))&&(!event.militia||event.side==='player'),'El responsable del daño civil no es válido.');
  need(health(event.hpBefore)&&health(event.hpAfter)&&event.hpBefore>event.hpAfter,'La herida civil no es válida.');
  if(event.kind==='wounded')need(index===0&&event.side==='player'&&!event.militia&&event.hpAfter>0,'La atribución de la herida civil no es válida.');
  else need(index===record.incidents.length-1&&event.hpAfter===0&&(npc.hp??100)===0,'La muerte civil no coincide con el estado del habitante.');
  kinds.add(event.kind);
 }
 need((npc.hp??100)>0||record.incidents.at(-1).kind==='death','Falta el registro de la muerte del habitante.');
 return record.incidents;
}

export const civilianWoundedByPlayer=npc=>civilianIncidents(npc).some(event=>event.kind==='wounded');

// Caller resolves trajectory, body region and cover first. This path never
// creates soldier equipment, combat XP, AP, morale routs or militia credit.
export function applyCivilianHarm(state,npc,{source=null,damage=0,breathLoss=0,knockedDown=false,intentional=false}={}){
 const incidents=civilianIncidents(npc);
 if(!npc||(npc.hp??100)<=0||npc.departure||npc.fled)return npc;
 need(Number.isFinite(damage)&&damage>=0&&Number.isFinite(breathLoss)&&breathLoss>=0,'El impacto civil no es válido.');
 const before=npc.hp??100,loss=Math.min(before,Math.round(damage));
 npc.hp=before-loss;npc.energy=Math.max(0,(npc.energy??100)-Math.round(breathLoss));
 npc.unconscious=isUnconscious(npc);
 if(knockedDown)npc.knockedDown=true;
 if(npc.hp===0||npc.unconscious||knockedDown){npc.stance='prone';npc.movementMode='prone';npc.mounted=false;}
 if(!loss)return npc;
 const actor=source&&state.units?.find(unit=>unit.id===source.id),side=['player','enemy'].includes(actor?.side)?actor.side:'unknown';
 const origin={attackerId:side==='unknown'?null:String(actor.id),side,militia:side==='player'&&Boolean(actor.militia),intentional:side!=='unknown'&&Boolean(intentional),hpBefore:before,hpAfter:npc.hp};
 const kind=npc.hp===0?'death':side==='player'&&!origin.militia&&!incidents.some(event=>event.kind==='wounded')?'wounded':null;
 if(kind){npc.civilianHarm??={version:1,incidents:[]};npc.civilianHarm.incidents.push({sequence:incidents.length+1,kind,...origin});}
 return npc;
}
