import {validateDetainedPrisoner} from './detention.js';
import {planDetentionHealth} from './detention-health.js';
import {civilianRestoredHp} from './civilian-health.js';
import {civilianIncidents,validateCivilianWounds} from './civilian-harm.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const healthFields=['hp','energy','bleeding','bandaged','alive','unconscious'];
function plans(campaign,battle){
 const request=campaign.pendingBattle;
 need(request&&battle.battleId===request.id&&battle.sectorId===request.sector,'El parte de prisioneros no corresponde al despliegue.');
 const manifest=request.detainedPrisoners??[],seen=new Set(),result=[];
 for(const npc of battle.npcs??[]){
  if(npc.detention===undefined)continue;
  validateDetainedPrisoner(npc);validateCivilianWounds(npc,battle);
  const original=manifest.find(n=>n.id===npc.id),d=npc.detention;
  need(original&&!seen.has(npc.id)&&equal(original.detention,d)&&!d.freed,'El parte cambió la custodia de un prisionero.');seen.add(npc.id);
  const record=campaign.operativeState[d.operativeId],prior=campaign.detentionRecords?.[npc.id];
  need(record,'Falta la hoja de servicio del prisionero.');
  const incidents=civilianIncidents(npc),oldIncidents=civilianIncidents(prior?.npc);
  need(oldIncidents.every((event,index)=>equal(event,incidents[index])),'El parte perdió heridas del prisionero.');
  if(prior?.npc.hp===0){
   need(npc.hp===0&&npc.maxHp===prior.npc.maxHp&&civilianRestoredHp(npc)===civilianRestoredHp(prior.npc),'El parte cambió un prisionero fallecido.');
   if(!equal(prior.npc,npc))result.push({npc,record,plan:{health:Object.fromEntries(healthFields.map(key=>[key,record[key]]))}});
   continue;
  }
  const plan=planDetentionHealth(d.operativeId,record,npc,civilianRestoredHp(prior?.npc));
  // Campaign medical records use integral health. Tactical damage in this
  // version is integral; do not silently create HP by rounding a report.
  need(Number.isInteger(plan.health.hp),'La salud del prisionero debe ser entera.');
  if(!prior||!equal(prior.npc,npc)||healthFields.some(key=>plan.health[key]!==record[key]))result.push({npc,record,plan});
 }
 need(manifest.every(n=>seen.has(n.id)),'El parte omitió un prisionero del despliegue.');
 return result;
}
export function hasPendingDetentionHealth(campaign,battle){return plans(campaign,battle).length>0;}
export function acknowledgeDetentionHealth(campaign,battle){
 const pending=plans(campaign,battle);
 if(!pending.length)return;
 campaign.detentionRecords??={};
 for(const {npc,record,plan} of pending){
  const receipt={...campaign.detentionRecords[npc.id],npc:structuredClone(npc)};
  Object.assign(record,plan.health);
  if(!record.alive){
   receipt.ammunition??=structuredClone(record.capturedAmmunition??{loaded:0,ammo:0});
   Object.assign(record,{captured:false,capturedSector:null,capturedAt:null,capturedContract:null,capturedAmmunition:{loaded:0,ammo:0},assignment:'active',asleep:false,sleepCollapsed:false});
   for(const horse of campaign.horseState?.horses??[])if(horse.custody?.kind==='captured'&&horse.custody.operativeId===npc.detention.operativeId)horse.custody.kind='field';
  }
  campaign.detentionRecords[npc.id]=receipt;
 }
}
export function validateCampaignDetention(campaign){
 const records=campaign.detentionRecords??{};
 need(records&&typeof records==='object'&&!Array.isArray(records)&&Object.keys(records).length<=10000,'El registro de prisioneros es inválido.');
 for(const [id,entry]of Object.entries(records)){
  need(entry&&typeof entry==='object'&&Object.keys(entry).every(k=>['npc','ammunition'].includes(k))&&entry.npc?.id===id,'El recibo del prisionero es inválido.');
  const npc=entry.npc;validateDetainedPrisoner(npc);validateCivilianWounds(npc);
  need(npc.detention&&!npc.detention.freed,'La custodia guardada es inválida.');
  const d=npc.detention,r=campaign.operativeState[d.operativeId];
  need(r&&d.capturedAt<=campaign.hour,'Falta la hoja de servicio del prisionero.');
  if(npc.hp===0)need(!r.alive&&r.hp===0&&!r.captured,'Un prisionero fallecido figura vivo.');
  if(entry.ammunition!==undefined)need(npc.hp===0&&Object.keys(entry.ammunition).every(k=>['loaded','ammo','preserveLoading','reloadProgress'].includes(k))&&['loaded','ammo'].every(k=>Number.isInteger(entry.ammunition[k])&&entry.ammunition[k]>=0),'La munición del prisionero fallecido es inválida.');
  if(r.captured&&r.capturedAt===d.capturedAt&&r.capturedSector===d.sector)for(const key of ['hp','energy','bleeding','bandaged'])need((r[key]??0)===(npc[key]??0),'Las heridas guardadas del prisionero no coinciden.');
 }
 const request=campaign.pendingBattle,manifest=request?.detainedPrisoners??[],ids=new Set();
 need(Array.isArray(manifest),'El manifiesto de prisioneros es inválido.');
 for(const npc of manifest){
  validateDetainedPrisoner(npc);const d=npc.detention,r=campaign.operativeState[d?.operativeId];
  need(d&&d.sector===request.sector&&!request.sceneId&&!d.freed&&!ids.has(npc.id)&&r,'El manifiesto de prisioneros no corresponde al sector.');ids.add(npc.id);
  need(r.captured&&r.capturedAt===d.capturedAt&&r.capturedSector===d.sector||records[npc.id]?.npc.hp===0,'El manifiesto no corresponde al cautiverio.');
 }
 if(request?.detainedPrisoners!==undefined)for(const [id,r]of Object.entries(campaign.operativeState))if(r.captured&&r.capturedSector===request.sector&&!request.sceneId)need(ids.has(`captive:${id}:${r.capturedAt}`),'El manifiesto omitió un prisionero local.');
 for(const snapshot of [...Object.values(campaign.sectorStates??{}),...Object.values(campaign.sceneStates??{})])for(const npc of snapshot.npcs??[]){
  if(!npc.detention)continue;
  const receipt=records[npc.id];need(receipt,'Falta el recibo del prisionero.');
  if(request?.sector!==snapshot.sectorId)need(equal(receipt.npc,npc),'El sector perdió el estado del prisionero.');
 }
 return campaign;
}
