import {hasPendingDetentionHealth,acknowledgeDetentionHealth,validateCampaignDetention} from './campaign-detention.js';
import {validateDetainedPrisoner} from './detention.js';
import {failQuestsForDeadContact} from './quests.js';
import {civilianMaxHp,civilianRestoredHp,migrateCivilianHealth,validateCivilianHealth} from './civilian-health.js';
import {CIVIC_RECRUITS} from './recruitment.js';
import {CAMPAIGN_SECTORS,OPERATIVES} from './data.js';
import {ENCOUNTERS} from './encounters.js';
import {YATASTO_NPCS} from './missions.js';
import {civilianIncidents,civilianBandaged,validateCivilianWounds} from './civilian-harm.js';
import {isUnconscious,CRITICAL_HEALTH} from './tactical-condition.js';
import {CITY_LOYALTY_REWARDS,cityForSector,recordCityLoyalty} from './cities.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fields=['sequence','kind','attackerId','side','militia','intentional','hpBefore','hpAfter'];
const kinds=new Set(['civilianPlayerIntentional','civilianPlayerAccidental','civilianMilitia','civilianMilitiaAccidental','civilianEnemyPatriot','civilianEnemyPatriotAccidental','civilianEnemyRoyalist','civilianEnemyRoyalistAccidental']);
const identity=(sectorId,sceneId,npcId)=>JSON.stringify([sectorId,sceneId??null,npcId]);
const civicSector=sectorId=>sectorId==='san_lorenzo'?'san_nicolas':sectorId;
const validSector=id=>id==='san_lorenzo'||CAMPAIGN_SECTORS.some(sector=>sector.id===id);
const validScene=(sectorId,sceneId)=>sceneId===null||sceneId==='yatasto'&&sectorId==='tucuman';
const npcId=value=>typeof value==='string'&&value.length>0&&value.length<=120&&!/[<>\x00-\x1f]/u.test(value);
const sameIncident=(a,b)=>fields.every(field=>a[field]===b[field]);
const exactFields=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const emptyLedger=()=>({version:2,records:{}});
const ledgerOf=campaign=>campaign.civilianHarm??emptyLedger();
const previousScene=(campaign,sectorId,sceneId)=>{
 const previous=sceneId?campaign.sceneStates?.[sceneId]:campaign.sectorStates?.[sectorId];
 return previous?.sectorId===sectorId&&(previous.sceneId??null)===sceneId?previous:null;
};
const authoredNpc=(sectorId,sceneId,id)=>(sceneId==='yatasto'?YATASTO_NPCS:ENCOUNTERS).find(npc=>npc.id===id&&npc.sector===sectorId);
const serviceFor=(campaign,sectorId,sceneId,npc)=>{
 const id=authoredNpc(sectorId,sceneId,npc.id)?.operativeId;
 if(id===undefined)return null;
 const record=campaign.operativeState?.[id],base=[...OPERATIVES,...CIVIC_RECRUITS].find(op=>op.id===id);
 need(record&&base,'Falta la hoja de servicio del habitante.');
 return {...record,maxHp:record.maxHp??base.maxHp};
};
export function migrateCivilianSnapshotHealth(campaign,snapshot,{legacy=false}={}){
 if(!snapshot)return;
 const sectorId=snapshot.sectorId??snapshot.sector,sceneId=snapshot.sceneId??null;
 for(const npc of snapshot.npcs??[]){
  if(npc.detention!==undefined){validateDetainedPrisoner(npc);continue;}
  const service=serviceFor(campaign,sectorId,sceneId,npc);
  const id=authoredNpc(sectorId,sceneId,npc.id)?.operativeId,retained=ledgerOf(campaign).records[identity(sectorId,sceneId,npc.id)];
  const currentContact=id===undefined||!campaign.recruited?.includes(id)&&retained?.transferredTo!==id;
  if(legacy)migrateCivilianHealth(npc,service,{currentContact});
  validateCivilianHealth(npc);
  // Retired bodies and pristine prior visits keep their historical scale.
  // A pristine contact receives current service health on sector entry.
  const historical=!currentContact||npc.civilianWoundVersion===undefined;
  if(service)need(npc.civilianHealthVersion===1&&npc.maxHp<=service.maxHp&&(historical||npc.maxHp===service.maxHp)&&Number.isInteger(npc.hp),'La escala del habitante no corresponde a su hoja de servicio.');
  else need(civilianMaxHp(npc)===100,'La escala del habitante no es válida.');
 }
}
export function migrateCampaignCivilianHealth(campaign){
 const legacy=campaign.civilianHealthVersion===undefined;
 need(legacy||campaign.civilianHealthVersion===1,'La versión de salud civil de campaña no es válida.');
 if(legacy&&campaign.civilianHarm!==undefined)need(campaign.civilianHarm?.version===1,'La salud civil de campaña mezcla versiones.');
 const owners=[...Object.values(campaign.sectorStates??{}),...Object.values(campaign.sceneStates??{}),campaign.pendingBattle,campaign.pendingBattle?.resumeSnapshot].filter(Boolean);
 if(legacy)need(!owners.some(owner=>(owner.npcs??[]).some(npc=>npc.civilianHealthVersion!==undefined||npc.civilianFirstAid!==undefined)),'La salud civil de campaña mezcla versiones.');
 if(campaign.civilianHarm?.version===1){
  need(legacy&&!owners.some(owner=>(owner.npcs??[]).some(npc=>npc.civilianFirstAid!==undefined)),'El registro de estabilización mezcla versiones.');
  for(const record of Object.values(campaign.civilianHarm.records??{})){need(!Object.hasOwn(record,'hpRestored'),'El recibo de estabilización mezcla versiones.');record.hpRestored=0;}
  campaign.civilianHarm.version=2;
 }
 for(const owner of owners)migrateCivilianSnapshotHealth(campaign,owner,{legacy});
 if(legacy)for(const owner of owners)for(const npc of owner.npcs??[]){
  const sectorId=owner.sectorId??owner.sector,sceneId=owner.sceneId??null,id=authoredNpc(sectorId,sceneId,npc.id)?.operativeId;
  if(id===undefined||npc.civilianWoundVersion!==1||civilianIncidents(npc).length)continue;
  campaign.civilianHarm??=emptyLedger();
  campaign.civilianHarm.records[identity(sectorId,sceneId,npc.id)]??={sectorId,sceneId,npcId:npc.id,incidents:[],effects:[],transferredTo:campaign.recruited?.includes(id)?id:null,hpRestored:0};
 }
 campaign.civilianHealthVersion=1;
 return campaign;
}
const recruitedSurvivor=(campaign,record)=>{
 const id=authoredNpc(record.sectorId,record.sceneId,record.npcId)?.operativeId;
 const retained=ledgerOf(campaign).records[identity(record.sectorId,record.sceneId,record.npcId)];
 // A lawful transfer into the service roster remains valid after that soldier
 // dies or leaves service. A civilian death never permits this absence.
 return id!==undefined&&![...record.incidents,...(retained?.incidents??[])].some(event=>event.kind==='death')&&(retained?.transferredTo===id||campaign.recruited?.includes(id));
};

export function markCivilianServiceTransfer(campaign,id){
 const records=Object.values(ledgerOf(campaign).records).filter(record=>authoredNpc(record.sectorId,record.sceneId,record.npcId)?.operativeId===id);
 if(!records.length)return;
 need(campaign.operativeState?.[id]?.alive&&campaign.contracts?.[id],'El traslado civil requiere una incorporación válida.');
 need(records.every(record=>!record.incidents.some(event=>event.kind==='death')&&(record.transferredTo===null||record.transferredTo===id)),'Un habitante fallecido no puede trasladarse al servicio.');
 for(const record of records)record.transferredTo=id;
}
function serviceHealth(campaign,sectorId,sceneId,npc){
 const id=authoredNpc(sectorId,sceneId,npc.id)?.operativeId;
 if(id===undefined||campaign.recruited?.includes(id)||ledgerOf(campaign).records[identity(sectorId,sceneId,npc.id)]?.transferredTo===id)return null;
 const operative=campaign.operativeState?.[id];
 need(operative&&Number.isFinite(operative.hp)&&Number.isFinite(operative.maxHp),'Falta la hoja de servicio del habitante.');
 const maxHp=civilianMaxHp(npc),civilianHp=npc.hp??maxHp;
 need(npc.civilianHealthVersion===1&&maxHp===operative.maxHp,'La escala del habitante no corresponde a su hoja de servicio.');
 need([civilianHp,npc.energy??100].every(value=>Number.isFinite(value)&&value>=0&&value<=100),'La salud del habitante no es válida.');
 const acknowledged=ledgerOf(campaign).records[identity(sectorId,sceneId,npc.id)]?.hpRestored??0;
 const restored=civilianRestoredHp(npc);
 need(restored>=acknowledged,'El parte perdió una estabilización civil ya registrada.');
 need(civilianHp<=Math.max(operative.hp,Math.min(CRITICAL_HEALTH,maxHp)),'La estabilización civil supera el límite crítico.');
 need(civilianHp<=operative.hp+restored-acknowledged,'La salud del habitante aumentó sin una estabilización nueva.');
 // Only the unacknowledged, paid tactical gain can increase service health.
 // The physical HP cap also retains any damage suffered after treatment.
 const hp=operative.hp>0?Math.min(Math.ceil(civilianHp),operative.hp+Math.floor(restored-acknowledged)):0,energy=Math.min(operative.energy??100,npc.energy??100);
 const canonical=npc.civilianWoundVersion===1;
 const bleeding=hp>0?(canonical?npc.bleeding??0:operative.bleeding??0):0;
 const bandaged=Math.min(canonical?civilianBandaged(npc):operative.bandaged??0,Math.max(0,operative.maxHp-hp));
 const unconscious=isUnconscious({hp,energy});
 return hp!==operative.hp||energy!==(operative.energy??100)||bleeding!==(operative.bleeding??0)||bandaged!==(operative.bandaged??0)||(npc.civilianHarm||npc.hp!==undefined)&&unconscious!==(operative.unconscious??false)?{id,hp,energy,bleeding,bandaged,unconscious}:null;
}

function effectFor(sectorId,owner,event,key){
 let kind=null;
 if(event.kind==='death'&&cityForSector(civicSector(sectorId))){
  if(event.side==='player')kind=event.militia?(event.intentional?'civilianMilitia':'civilianMilitiaAccidental'):(event.intentional?'civilianPlayerIntentional':'civilianPlayerAccidental');
  else if(event.side==='enemy')kind=owner==='patriot'?(event.intentional?'civilianEnemyPatriot':'civilianEnemyPatriotAccidental'):(event.intentional?'civilianEnemyRoyalist':'civilianEnemyRoyalistAccidental');
 }
 const eventId=kind?`civilian:${key}:${event.sequence}`:null;
 need(!eventId||eventId.length<=160,'La identidad del incidente civil es demasiado larga.');
 return {sequence:event.sequence,owner,kind,delta:kind?CITY_LOYALTY_REWARDS[kind]:0,eventId};
}

function validatePrefix(acknowledged,current){
 need(current.length>=acknowledged.length&&acknowledged.every((event,index)=>sameIncident(event,current[index])),'El parte perdió o cambió daños civiles ya registrados.');
}

function context(campaign,battle){
 const request=campaign.pendingBattle,sceneId=request?.sceneId??null;
 need(request&&battle&&battle.battleId===request.id&&battle.sectorId===request.sector&&(battle.sceneId??null)===sceneId,'Los daños civiles no corresponden al despliegue.');
 need(validSector(request.sector)&&validScene(request.sector,sceneId)&&Array.isArray(battle.npcs)&&battle.npcs.length<=2000,'Los habitantes del parte civil no son válidos.');
 migrateCivilianSnapshotHealth(campaign,battle);
 const prior=previousScene(campaign,request.sector,sceneId),allowed=new Map();
 for(const npc of [...(prior?.npcs??[]),...(request.npcs??[])])if(npcId(npc?.id))allowed.set(npc.id,npc);
 const ledger=ledgerOf(campaign);
 need(exactFields(ledger,['version','records'])&&ledger.version===2&&object(ledger.records),'El registro civil de campaña no es válido.');
 const seen=new Set(),pending=[],healthUpdates=[];
 for(const npc of battle.npcs){
  need(npcId(npc?.id)&&!seen.has(npc.id),'La identidad del habitante no es válida.');seen.add(npc.id);
  validateCivilianWounds(npc,battle);
  if(npc.detention!==undefined)continue;
  const incidents=civilianIncidents(npc),key=identity(request.sector,sceneId,npc.id),acknowledged=ledger.records[key]?.incidents??[];
  validatePrefix(acknowledged,incidents);
  const previousNpc=prior?.npcs?.find(previous=>previous.id===npc.id),previousIncidents=previousNpc?civilianIncidents(previousNpc):[];
  validatePrefix(previousIncidents,incidents);
  const restored=civilianRestoredHp(npc),restoredAck=ledger.records[key]?.hpRestored??0;
  need(restored>=restoredAck&&restored>=civilianRestoredHp(previousNpc),'El parte perdió una estabilización civil ya registrada.');
  const authored=authoredNpc(request.sector,sceneId,npc.id);
  const medicalContact=authored?.operativeId!==undefined&&npc.civilianWoundVersion===1&&(npc.hp<civilianMaxHp(npc)||(npc.bleeding??0)>0);
  const health=serviceHealth(campaign,request.sector,sceneId,npc);
  if(!incidents.length&&!health&&!medicalContact&&restored===restoredAck)continue;
  need(allowed.has(npc.id),'El habitante herido no pertenece al despliegue.');
  need(npc.operativeId===allowed.get(npc.id).operativeId&&(!authored||npc.operativeId===authored.operativeId),'La identidad de servicio del habitante no coincide.');
  if(health)healthUpdates.push(health);
  for(const event of incidents.slice(acknowledged.length)){
   if(previousIncidents[event.sequence-1]&&sameIncident(previousIncidents[event.sequence-1],event))continue;
   need(authored?.operativeId===undefined||!campaign.recruited?.includes(authored.operativeId)&&ledger.records[key]?.transferredTo!==authored.operativeId,'Un combatiente incorporado no puede figurar como una nueva víctima civil.');
   if(event.side!=='unknown'){
    const attacker=battle.units?.find(unit=>String(unit.id)===event.attackerId);
    const oldSource=previousNpc?.bleedSource;
    const retainedBleed=event.kind==='death'&&(previousNpc?.bleeding??0)>0&&oldSource&&['attackerId','side','militia','intentional'].every(field=>oldSource[field]===event[field]);
    need(attacker?attacker.side===event.side&&Boolean(attacker.militia)===event.militia:retainedBleed,'El responsable del daño civil no pertenece al despliegue.');
   }
  }
  // A non-player injury also needs a lasting service-transfer identity, but
  // it must not acquire a fictional player-wound or civic consequence.
  if(incidents.length>acknowledged.length||restored>restoredAck||(health||medicalContact)&&!ledger.records[key])pending.push({key,npc,incidents,acknowledged});
 }
 for(const npc of request.npcs??[]){
  const previous=prior?.npcs?.find(previous=>previous.id===npc.id),incidents=previous?civilianIncidents(previous):civilianIncidents(npc);
  need(seen.has(npc.id)||recruitedSurvivor(campaign,{sectorId:request.sector,sceneId,npcId:npc.id,incidents}),'El parte omitió un habitante del despliegue.');
 }
 for(const npc of prior?.npcs??[]){const incidents=civilianIncidents(npc);if(incidents.length&&!npc.detention)need(seen.has(npc.id)||recruitedSurvivor(campaign,{sectorId:request.sector,sceneId,npcId:npc.id,incidents}),'El parte omitió un habitante herido del sector.');}
 for(const record of Object.values(ledger.records))if(record.sectorId===request.sector&&record.sceneId===sceneId)need(seen.has(record.npcId)||recruitedSurvivor(campaign,record),'El parte omitió un habitante con daños civiles registrados.');
 return {request,sceneId,pending,healthUpdates};
}

export function hasPendingCivilianHarm(campaign,battle){const {pending,healthUpdates}=context(campaign,battle);return hasPendingDetentionHealth(campaign,battle)||pending.length>0||healthUpdates.length>0;}

// The tactical receipt is the evidence. This ledger acknowledges it once,
// including rural and unknown-source deaths that have no civic modifier.
export function acknowledgeCivilianHarm(campaign,battle){
 // A shallow audit wrapper permits legacy initialization without changing a
 // rejected caller. Validation does not mutate any existing nested record.
 validateCampaignCivilianHarm({...campaign});
 const {request,sceneId,pending,healthUpdates}=context(campaign,battle);
 if(!pending.length&&!healthUpdates.length){acknowledgeDetentionHealth(campaign,battle);return [];}
 const owner=campaign.sectors?.[civicSector(request.sector)]?.owner;
 need(['patriot','royalist'].includes(owner),'Falta el control de la localidad del incidente.');
 const planned=pending.map(entry=>({...entry,effects:entry.incidents.slice(entry.acknowledged.length).map(event=>effectFor(request.sector,owner,event,entry.key))}));
 const additions=planned.flatMap(entry=>entry.effects).filter(effect=>effect.kind).length;
 need((campaign.cityLoyaltyEvents?.length??0)+additions<=30000,'El registro de lealtad no admite más incidentes.');
 const existing=ledgerOf(campaign);
 need(Object.keys(existing.records).length+planned.filter(entry=>!Object.hasOwn(existing.records,entry.key)).length<=30000,'El registro civil no admite más habitantes.');
 for(const entry of planned){
  const id=authoredNpc(request.sector,sceneId,entry.npc.id)?.operativeId;
  if(id!==undefined&&!campaign.recruited?.includes(id))need(campaign.operativeState?.[id]&&Number.isFinite(campaign.operativeState[id].hp),'Falta la hoja de servicio del habitante.');
  for(const effect of entry.effects)if(effect.kind)need(Number.isFinite(effect.delta)&&!(campaign.cityLoyaltyEvents??[]).some(event=>event.key===`${cityForSector(civicSector(request.sector)).id}:${effect.kind}:${effect.eventId}`),'El efecto civil ya existe sin su recibo.');
 }
 // All receipt and capacity checks precede the first campaign mutation.
 acknowledgeDetentionHealth(campaign,battle);
 campaign.civilianHarm??=emptyLedger();const messages=[];
 for(const entry of planned){
  const record=campaign.civilianHarm.records[entry.key]??={sectorId:request.sector,sceneId,npcId:entry.npc.id,incidents:[],effects:[],transferredTo:null,hpRestored:0};
  for(const effect of entry.effects){
   if(effect.kind){
    const result=recordCityLoyalty(campaign,{sectorId:civicSector(request.sector),kind:effect.kind,eventId:effect.eventId});
    need(result.applied,'El efecto civil ya existe sin su recibo.');
    messages.push(`La muerte de un habitante modifica el apoyo local (${effect.delta>0?'+':''}${effect.delta}).`);
   }
   record.effects.push(structuredClone(effect));
  }
  record.incidents=structuredClone(entry.incidents);record.hpRestored=civilianRestoredHp(entry.npc);
  if(entry.incidents.some(event=>event.kind==='death'))messages.push(...failQuestsForDeadContact(campaign,request.sector,sceneId,entry.npc.id));
 }
 for(const {id,hp,energy,bleeding,bandaged,unconscious}of healthUpdates){
  const operative=campaign.operativeState[id];
  // Service records require integral HP. Preserve a living fractional legacy
  // civilian as living; only an actual zero-HP receipt can make a corpse.
  Object.assign(operative,{hp,energy,bleeding,bandaged,alive:hp>0,unconscious,recoveryHours:0});
  if(!operative.alive){operative.bleeding=0;operative.assignment='active';operative.asleep=false;operative.sleepCollapsed=false;}
 }
 return messages;
}

export function validateCampaignCivilianHarm(campaign){
 validateCampaignDetention(campaign);
 const snapshots=[...Object.values(campaign.sectorStates??{}),...Object.values(campaign.sceneStates??{})];
 const receiptOwners=[...snapshots,...(campaign.pendingBattle?[campaign.pendingBattle,campaign.pendingBattle.resumeSnapshot].filter(Boolean):[])];
 for(const snapshot of receiptOwners)for(const npc of snapshot.npcs??[])validateCivilianWounds(npc,snapshot);
 const civicEvents=(campaign.cityLoyaltyEvents??[]).filter(event=>kinds.has(event?.kind));
 if(campaign.civilianHarm===undefined){
  need(!civicEvents.length&&!receiptOwners.some(snapshot=>(snapshot.npcs??[]).some(npc=>npc.civilianHarm!==undefined||npc.civilianWoundVersion!==undefined||npc.civilianFirstAid!==undefined)),'El registro de daños civiles mezcla versiones.');
  campaign.civilianHarm=emptyLedger();
 }
 const ledger=campaign.civilianHarm;
 need(exactFields(ledger,['version','records'])&&ledger.version===2&&object(ledger.records)&&Object.keys(ledger.records).length<=30000,'El registro civil de campaña no es válido.');
 const effects=new Map();
 for(const [key,record]of Object.entries(ledger.records)){
  need(exactFields(record,['sectorId','sceneId','npcId','incidents','effects','transferredTo','hpRestored'])&&validSector(record.sectorId)&&validScene(record.sectorId,record.sceneId)&&npcId(record.npcId)&&key===identity(record.sectorId,record.sceneId,record.npcId),'La identidad del recibo civil no es válida.');
  need(Number.isFinite(record.hpRestored)&&record.hpRestored>=0&&record.hpRestored<=1e7,'El recibo de estabilización civil no es válido.');
  const hp=record.incidents?.at(-1)?.kind==='death'?0:100;
  need(Array.isArray(record.incidents)&&record.incidents.length<=2,'La secuencia del recibo civil no es válida.');
  const incidents=record.incidents.length?civilianIncidents({hp,civilianHarm:{version:1,incidents:record.incidents}}):[];
  need(incidents.length||record.hpRestored>0||authoredNpc(record.sectorId,record.sceneId,record.npcId)?.operativeId!==undefined,'Un recibo civil sin incidentes requiere un contacto de servicio.');
  need(record.transferredTo===null||Number.isInteger(record.transferredTo)&&record.transferredTo===authoredNpc(record.sectorId,record.sceneId,record.npcId)?.operativeId&&!incidents.some(event=>event.kind==='death'),'El traslado de un habitante al servicio no es válido.');
  need(Array.isArray(record.effects)&&record.effects.length===incidents.length,'Los efectos del recibo civil están incompletos.');
  for(const [index,effect]of record.effects.entries()){
   need(exactFields(effect,['sequence','owner','kind','delta','eventId'])&&['patriot','royalist'].includes(effect.owner),'El efecto civil guardado no es válido.');
   const expected=effectFor(record.sectorId,effect.owner,incidents[index],key);
   need(Object.keys(expected).every(field=>effect[field]===expected[field]),'El efecto civil no corresponde al incidente.');
   if(effect.kind){const city=cityForSector(civicSector(record.sectorId));effects.set(`${city.id}:${effect.kind}:${effect.eventId}`,effect);}
  }
  const pending=campaign.pendingBattle;
  const operativeId=authoredNpc(record.sectorId,record.sceneId,record.npcId)?.operativeId;
  if(operativeId!==undefined&&incidents.some(event=>event.kind==='death'))need(campaign.operativeState?.[operativeId]?.hp===0&&campaign.operativeState[operativeId].alive===false,'Un habitante fallecido figura vivo en su hoja de servicio.');
  if(pending?.sector===record.sectorId&&(pending.sceneId??null)===record.sceneId)continue;
  const npc=previousScene(campaign,record.sectorId,record.sceneId)?.npcs?.find(npc=>npc.id===record.npcId);
  need(npc||recruitedSurvivor(campaign,record),'Falta un habitante con daños civiles registrados.');if(npc){validatePrefix(incidents,civilianIncidents(npc));need(civilianRestoredHp(npc)===record.hpRestored,'El recibo de estabilización no corresponde al habitante.');}
 }
 need(civicEvents.length===effects.size&&civicEvents.every(event=>effects.has(event.key)&&event.delta===effects.get(event.key).delta&&Number.isInteger(event.hour)&&event.hour>=0&&event.hour<=campaign.hour),'El registro de lealtad perdió o alteró un efecto civil.');
 for(const snapshot of snapshots){
  if(campaign.pendingBattle?.sector===snapshot.sectorId&&(campaign.pendingBattle.sceneId??null)===(snapshot.sceneId??null))continue;
  migrateCivilianSnapshotHealth(campaign,snapshot);
  for(const npc of snapshot.npcs??[]){
   if(npc.detention!==undefined)continue;
   const incidents=civilianIncidents(npc),sceneId=snapshot.sceneId??null;
   const medicalContact=npc.civilianWoundVersion===1&&authoredNpc(snapshot.sectorId,sceneId,npc.id)?.operativeId!==undefined&&((npc.hp??civilianMaxHp(npc))<civilianMaxHp(npc)||(npc.energy??100)<100);
   if(!incidents.length&&!medicalContact&&!civilianRestoredHp(npc))continue;
   const record=ledger.records[identity(snapshot.sectorId,sceneId,npc.id)];need(record&&record.incidents.length===incidents.length,'Falta el recibo de un incidente civil.');validatePrefix(record.incidents,incidents);need(record.hpRestored===civilianRestoredHp(npc),'Falta el recibo de estabilización civil.');
  }
 }
 return campaign;
}
