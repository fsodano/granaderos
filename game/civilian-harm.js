import {isUnconscious} from './tactical-condition.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const health=value=>Number.isFinite(value)&&value>=0&&value<=100;
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=120&&!/[<>\x00-\x1f]/u.test(value);
const fields=['sequence','kind','attackerId','side','militia','intentional','hpBefore','hpAfter'];
const originFields=['attackerId','side','militia','intentional'];
const unknownOrigin=()=>({attackerId:null,side:'unknown',militia:false,intentional:false});

export const civilianBandaged=npc=>npc.bandaged??((npc.bleeding??0)>0?0:Math.max(0,100-(npc.hp??100)));
export function validateCivilianWounds(npc,state){
 const hp=npc.hp??100,bleeding=npc.bleeding??0;
 need(health(hp),'La salud civil no es válida.');
 if(npc.civilianWoundVersion!==undefined)need(npc.civilianWoundVersion===1,'La versión de las heridas civiles no es válida.');
 if(['bleeding','bandaged','bleedSource'].some(key=>npc[key]!==undefined))need(npc.civilianWoundVersion===1,'Falta la versión de las heridas civiles.');
 if(npc.civilianWoundVersion===1&&hp===0)need(civilianIncidents(npc).some(event=>event.kind==='death'),'Falta el registro de la muerte del habitante.');
 need(Number.isInteger(bleeding)&&bleeding>=0&&bleeding<=10&&(hp>0||bleeding===0),'La hemorragia civil no es válida.');
 if(bleeding>0)need(npc.civilianWoundVersion===1&&npc.bleedSource!==undefined,'Falta el origen de la hemorragia civil.');
 if(npc.bandaged!==undefined)need(health(npc.bandaged)&&npc.bandaged<=100-hp,'Las vendas del habitante no son válidas.');
 if(npc.bleedSource!==undefined){
  const source=npc.bleedSource;
  need(bleeding>0&&object(source)&&Object.keys(source).length===originFields.length&&originFields.every(key=>Object.hasOwn(source,key)),'El origen de la hemorragia civil no es válido.');
  need(['player','enemy','unknown'].includes(source.side)&&typeof source.militia==='boolean'&&typeof source.intentional==='boolean'&&
   (source.side==='unknown'?source.attackerId===null&&!source.militia&&!source.intentional:identity(source.attackerId))&&(!source.militia||source.side==='player'),'El responsable de la hemorragia civil no es válido.');
  if(source.side==='player'&&!source.militia)need(civilianWoundedByPlayer(npc),'Falta el registro de la herida causada al habitante.');
  // A source can be absent after sector reentry. A present actor must still
  // agree with the saved origin; a supplied object cannot impersonate a side.
  const actor=state?.units?.find(unit=>String(unit.id)===source.attackerId);
  if(actor)need(actor.side===source.side&&(source.side==='player'&&Boolean(actor.militia))===source.militia,'El responsable de la hemorragia no coincide con el combatiente.');
 }
 return npc;
}

function refreshCivilianCondition(npc){
 npc.unconscious=isUnconscious(npc);
 if(npc.hp===0||npc.unconscious||npc.knockedDown){npc.stance='prone';npc.movementMode='prone';npc.mounted=false;}
 if(npc.hp===0){npc.bleeding=0;delete npc.bleedSource;}
}
function recordIncident(npc,incidents,before,origin){
 const kind=npc.hp===0?'death':origin.side==='player'&&!origin.militia&&!incidents.some(event=>event.kind==='wounded')?'wounded':null;
 if(kind){npc.civilianHarm??={version:1,incidents:[]};npc.civilianHarm.incidents.push({sequence:incidents.length+1,kind,...origin,hpBefore:before,hpAfter:npc.hp});}
}

// Use the existing battle wound clock. No damage source is inferred for an
// old injury; the most recent real damaging hit supplies an attributed bleed.
export function advanceCivilianBleeding(state,npc,ticks){
 if(!npc||(npc.hp??100)<=0||npc.departure||npc.fled||!npc.bleeding||!ticks)return npc;
 need(Number.isInteger(ticks)&&ticks>0,'El tiempo de la hemorragia civil no es válido.');
 validateCivilianWounds(npc,state);
 const incidents=civilianIncidents(npc),before=npc.hp??100,origin=npc.bleedSource??unknownOrigin();
 npc.hp=Math.max(0,before-npc.bleeding*ticks);
 if(npc.hp===0)recordIncident(npc,incidents,before,origin);
 refreshCivilianCondition(npc);
 return npc;
}

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
 validateCivilianWounds(npc,state);
 const before=npc.hp??100,loss=Math.min(before,Math.round(damage)),bandaged=civilianBandaged(npc);
 npc.hp=before-loss;npc.energy=Math.max(0,(npc.energy??100)-Math.round(breathLoss));
 if(knockedDown)npc.knockedDown=true;
 refreshCivilianCondition(npc);
 if(!loss)return npc;
 const actor=source&&state.units?.find(unit=>String(unit.id)===String(source.id)),side=['player','enemy'].includes(actor?.side)?actor.side:'unknown';
 const origin={attackerId:side==='unknown'?null:String(actor.id),side,militia:side==='player'&&Boolean(actor.militia),intentional:side!=='unknown'&&Boolean(intentional)};
 npc.bandaged=bandaged;
 npc.civilianWoundVersion=1;
 if(npc.hp>0){npc.bleeding=Math.min(10,(npc.bleeding??0)+Math.ceil(loss/15));npc.bleedSource=origin;}
 recordIncident(npc,incidents,before,origin);
 return npc;
}
