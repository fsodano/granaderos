import {campaignStory} from './campaign-story.js';
import {validateMovementScene} from './dialogue-movement.js';
import {validWorldLocation,locationId} from './world-cells.js';
import {characterForOperative,isContractOperative} from './content-character-ids.js';
import {OPERATIVES} from './data.js';
import {encounterDefinitions} from './encounters.js';
import {YATASTO_NPCS} from './missions.js';
import {authoredOperative,authoredRoster} from './content-roster.js';
import {civilianMaxHp,civilianRestoredHp,seedCivilianHealth,migrateCivilianHealth} from './civilian-health.js';
import {civilianIncidents,validateCivilianWounds,advanceCivilianWoundTime} from './civilian-harm.js';
import {recordCityLoyalty} from './cities.js';
import {NPC_QUESTS} from './quests.js';
import {CIVILIAN_SUPPLY_FIELDS,civilianSuppliesFor,validCivilianSupplies} from './civilian-supplies.js';

const need=(ok,message='El estado de los habitantes no coincide con la campaña.')=>{if(!ok)throw Error(message);};
const fields=['civilianHealthVersion','maxHp','hp','energy','unconscious','civilianWoundVersion','civilianWoundSeconds','bleeding','bandaged','bleedSource','civilianHarm','civilianFirstAid'];
const physical=n=>Object.fromEntries(fields.filter(k=>n[k]!==undefined).map(k=>[k,structuredClone(n[k])]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const operativeId=n=>n.id==='yatasto-san-martin'?57:n.operativeId;
function supplies(s,n){
 const id=operativeId(n),result=civilianSuppliesFor(s.operativeState[id]);
 const prior=id===57?s.missionAllies?.san_lorenzo:null;
 if(prior&&s.operativeState[57]?.missionSuppliesVersion!==1&&!s.civilianState?.people['person-57']){const carried=civilianSuppliesFor(prior);for(const k of CIVILIAN_SUPPLY_FIELDS)result[k]=Math.min(result[k],carried[k]);}
 return result;
}
export const civilianKey=n=>operativeId(n)!==undefined?`person-${operativeId(n)}`:`npc-${n.id}`;
function definition(s,n){
 const original=[...encounterDefinitions(s),...YATASTO_NPCS].find(v=>v.id===n.id);
 need(original&&original.operativeId===n.operativeId,'El habitante no pertenece a este mundo.');
 return original;
}
function service(s,n){
 const id=operativeId(n),base=authoredRoster(s,OPERATIVES).find(o=>o.id===id);
 if(!base)return undefined;
 const current={...authoredOperative(s,base),...s.operativeState[id]},prior=id===57?s.missionAllies?.san_lorenzo:null;
 // Old saves kept mission wounds only on the retained ally. Until a civilian
 // receipt exists, that earlier injury must not be replaced by a full roster HP.
 if(prior&&!s.civilianState?.people['person-57']){current.hp=Math.min(current.hp,prior.hp);current.energy=Math.min(current.energy??100,prior.energy??100);current.bleeding=Math.max(current.bleeding??0,prior.bleeding??0);}
 return current;
}
export function campaignCivilian(s,n,{fromService=false}={}){
 const record=s.civilianState?.people[civilianKey(n)],id=operativeId(n);
 const metadata={...n};for(const k of fields)delete metadata[k];
 if(record&&!fromService&&!record.inService&&!s.recruited.includes(id))return {...metadata,...structuredClone(record.health),civilianSupplies:supplies(s,n)};
 const seeded=seedCivilianHealth(metadata,service(s,n));
 if(record?.health.civilianHarm&&seeded.hp>0&&record.health.hp>0)seeded.civilianHarm=structuredClone(record.health.civilianHarm);
 return {...seeded,civilianSupplies:supplies(s,n)};
}
export function civilianDiedHere(s,n,sector,sceneId=null){
 const record=s.civilianState?.people[civilianKey(n)];
 return Boolean(record?.health.hp===0&&!record.inService&&record.sector===sector&&record.sceneId===sceneId&&record.npcId===n.id);
}
function applyDeath(s,n,record,atHour=s.hour){
 const death=civilianIncidents(n).find(e=>e.kind==='death');
 if(death&&death.side!=='unknown'){
  const kind=death.side==='player'?(death.militia?'civilianMilitia':'civilianPlayerIntentional'):
   s.sectors[record.sector]?.owner==='patriot'?'civilianEnemyPatriot':'civilianEnemyRoyalist';
  const accidental=death.intentional?kind:kind==='civilianPlayerIntentional'?'civilianPlayerAccidental':`${kind}Accidental`;
  recordCityLoyalty(s,{sectorId:record.sector==='san_lorenzo'?'san_nicolas':record.sector,kind:accidental,eventId:`civilian:${civilianKey(n)}`});
 }
 for(const q of NPC_QUESTS.filter(q=>q.npcId===n.id))if(s.quests[q.id]?.status!=='completed')
  s.quests[q.id]={status:'failed',offeredAt:s.quests[q.id]?.offeredAt??atHour,completedAt:null,failedAt:atHour};
 if(!campaignStory(s)&&(operativeId(n)===57||n.id==='yatasto-belgrano')&&!s.completed){
  s.defeated=true;
  if(record.sceneId==='yatasto')s.missions.yatasto={...(s.missions.yatasto??{}),stage:'failed',completed:false};
  s.log.unshift({hour:atHour,text:`${n.name} ha muerto. La campaña no puede continuar sin este mando.`});s.log=s.log.slice(0,80);
 }
}
function remember(s,n,scene,deathSecond){
 const key=civilianKey(n),before=s.civilianState.people[key];
 const record={npcId:n.id,sector:scene.sectorId??scene.sector,sceneId:scene.sceneId??null,health:physical(n)};
 s.civilianState.people[key]=record;
 const id=operativeId(n);
 if(id!==undefined&&!s.recruited.includes(id)){
  Object.assign(s.operativeState[id],{hp:Math.ceil(n.hp),alive:n.hp>0,energy:n.energy,bleeding:n.bleeding??0,bandaged:n.bandaged??0});
  if(n.civilianSupplies!==undefined){need(validCivilianSupplies(n.civilianSupplies),'Los suministros del habitante no son válidos.');for(const k of CIVILIAN_SUPPLY_FIELDS)s.operativeState[id][k]=n.civilianSupplies[k];}
 }
 if(n.hp===0&&before?.health.hp!==0){
  if(deathSecond!==undefined&&id!==undefined)s.operativeState[id].deathMinute=Math.floor(deathSecond/60);
  applyDeath(s,n,record,deathSecond===undefined?s.hour:Math.floor(deathSecond/3600));
 }
}
function compareHistory(previous,n){
 const old=civilianIncidents(previous),now=civilianIncidents(n);
 need(now.length>=old.length&&old.every((e,i)=>same(e,now[i])),'Se perdió el historial de heridas del habitante.');
 const restored=civilianRestoredHp(n)-civilianRestoredHp(previous);
 need(restored>=0&&n.hp<=previous.hp+restored,'La salud del habitante aumentó sin atención médica.');
 need(previous.hp>0||n.hp===0,'Un habitante muerto no puede reaparecer vivo.');
 need(civilianMaxHp(n)===civilianMaxHp(previous),'La salud máxima del habitante cambió.');
}
export function acknowledgeCivilians(s,snapshot){
 const request=s.pendingBattle;
 need(request&&snapshot.sectorId===request.sector&&(snapshot.sceneId??null)===(request.sceneId??null)&&(!snapshot.battleId||snapshot.battleId===request.id));
 s.civilianState??={version:1,people:{}};
 validateMovementScene(s,snapshot);
 const expected=request.npcs??[];
 need(snapshot.npcs.length===expected.length,'Faltan habitantes en el parte del sector.');
 for(const n of snapshot.npcs){
  definition(s,n);validateCivilianWounds(n,snapshot);
  const prior=expected.find(v=>v.id===n.id);
  need(prior&&prior.operativeId===n.operativeId&&prior.contentId===n.contentId&&prior.presenceRevision===n.presenceRevision&&!s.recruited.includes(operativeId(n)));
  const previous=campaignCivilian(s,prior);compareHistory(previous,n);
  n.civilianSupplies??=structuredClone(previous.civilianSupplies);
  need(validCivilianSupplies(n.civilianSupplies)&&CIVILIAN_SUPPLY_FIELDS.every(k=>n.civilianSupplies[k]<=previous.civilianSupplies[k]),'Los suministros del habitante aumentaron sin una entrega.');
  for(const e of civilianIncidents(n).slice(civilianIncidents(previous).length))if(e.side!=='unknown'){
   const actor=snapshot.units.find(u=>String(u.id)===e.attackerId),source=previous.bleedSource;
   need(actor&&actor.side===e.side&&Boolean(actor.militia)===e.militia||e.kind==='death'&&source&&['attackerId','side','militia','intentional'].every(k=>source[k]===e[k]),'El responsable de la nueva herida no está en el sector.');
  }
  remember(s,n,snapshot);
 }
 const commander=snapshot.units.find(u=>u.missionAlly&&Number(u.id)===57);
 if(commander&&request.missionAllies?.some(u=>u.id===57)){
  Object.assign(s.operativeState[57],{hp:Math.ceil(commander.hp),alive:commander.hp>0,energy:commander.energy,bleeding:commander.bleeding??0,bandaged:commander.bandaged??0});
  const carried=civilianSuppliesFor(commander);for(const k of CIVILIAN_SUPPLY_FIELDS)s.operativeState[57][k]=carried[k];s.operativeState[57].missionSuppliesVersion=1;
  const record=s.civilianState.people['person-57'];if(record)record.inService=true;
  if(commander.hp===0)for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates)])scene.npcs=(scene.npcs??[]).filter(n=>operativeId(n)!==57);
 }
 refreshCivilianScenes(s);
}
function refreshCivilianScenes(s){
 const request=s.pendingBattle;
 // A retained tactical scene is only a cache. Keep its physical state in step
 // with the single identity, including the currently loaded request.
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(request?[request]:[])])for(const n of scene.npcs??[]){
  const record=s.civilianState.people[civilianKey(n)];
  if((record||operativeId(n)===57)&&!s.recruited.includes(operativeId(n))){const actor=campaignCivilian(s,n),current=physical(actor);if(!same(physical(n),current)){for(const k of fields)delete n[k];Object.assign(n,current);}n.civilianSupplies=actor.civilianSupplies;}
 }
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(request?[request]:[])])scene.npcs=(scene.npcs??[]).filter(n=>n.hp>0||civilianDiedHere(s,n,scene.sectorId??scene.sector,scene.sceneId??null));
}
// Start authored wounds when a living resident actually enters the world.
// Bulletin candidates and dormant successors have no physical clock here.
function placedResidents(s){
 if(!s.contentPresence)return [];
 return encounterDefinitions(s).flatMap(n=>{
  const id=operativeId(n),c=id!==undefined&&characterForOperative(s,id),person=c&&s.contentPresence.people[c.id];
  if(!person?.alive||!person.appeared||person.suspended||person.recruited||s.recruited.includes(id)||isContractOperative(s,{id})||s.operativeState[id]?.captured||s.pendingBattle?.missionAllies?.some(u=>Number(u.id)===id))return [];
  const sector=locationId(person.sector);return sector?[{n,id,sector}]:[];
 });
}
export function synchronizeResidentWounds(s){
 if(!s.civilianState)return;
 for(const {n,id,sector}of placedResidents(s)){
  const record=s.civilianState.people[civilianKey(n)];
  if(record){
   // A mobile living identity carries its wounds to the new cell. A corpse
   // retains the place of death, even if its former placement was mobile.
   if(record.npcId===n.id&&!record.inService&&record.health.hp>0){record.sector=sector;record.sceneId=null;}
  }else if(s.operativeState[id].bleeding>0){
   remember(s,campaignCivilian(s,n),{sector,sceneId:null});
  }
 }
}
export function migrateResidentWounds(s){
 if(s.civilianState.version!==1)return false;
 // Start older unseen wounds from saved health and time, without damage for
 // elapsed hours that the old version never simulated.
 s.civilianState.version=2;synchronizeResidentWounds(s);return true;
}
function unloadedWounds(s){
 const excluded=new Set([...(s.pendingBattle?.npcs??[]).map(civilianKey),...s.recruited.map(id=>`person-${id}`)]);
 return Object.entries(s.civilianState?.people??{}).filter(([key,r])=>!excluded.has(key)&&!r.inService&&r.health.hp>0&&r.health.bleeding>0);
}
export function nextUnloadedCivilianDeath(s){
 return Math.min(Infinity,...unloadedWounds(s).map(([,r])=>Math.ceil(r.health.hp/r.health.bleeding)*6-(r.health.civilianWoundSeconds??0)));
}
// The campaign clock advances residents outside the loaded scene. Its endpoint
// is already on s; loaded actors are advanced only by the tactical clock.
export function advanceUnloadedCivilians(s,seconds){
 need(Number.isSafeInteger(seconds)&&seconds>=0,'El tiempo de los habitantes no es válido.');
 if(!seconds||!s.civilianState)return;
 const start=s.hour*3600+(s.secondOfHour??0)-seconds;let changed=false;
 for(const [,record]of unloadedWounds(s)){
  const original=encounterDefinitions(s).find(n=>n.id===record.npcId)??YATASTO_NPCS.find(n=>n.id===record.npcId);
  need(original,'El habitante no pertenece a este mundo.');
  if(s.recruited.includes(operativeId(original)))continue;
  const n={...original,...structuredClone(record.health)};
  const deathSecond=start+Math.ceil(n.hp/n.bleeding)*6-(n.civilianWoundSeconds??0);
  advanceCivilianWoundTime({},n,seconds);
  remember(s,n,record,n.hp===0?deathSecond:undefined);changed=true;
  if(n.hp===0){s.log.unshift({hour:Math.floor(deathSecond/3600),text:`${n.name} murió por sus heridas mientras la escuadra estaba fuera del sector.`});s.log=s.log.slice(0,80);}
 }
 if(changed)refreshCivilianScenes(s);
}

// The service sheet is authoritative until departure. Resume a previously
// encountered world identity once, using its current wounds and finite stock.
// The active request is never populated here; reentry admits the returning NPC.
export function resumeCivilianServiceReturns(s){
 if(!s.civilianState||!s.contentPresence)return false;
 let changed=false;
 for(const [key,record]of Object.entries(s.civilianState.people)){
  if(!record.inService)continue;
  const original=encounterDefinitions(s).find(n=>civilianKey(n)===key),id=original&&operativeId(original),serviceRecord=s.operativeState[id];
  if(id===undefined||isContractOperative(s,{id})||s.recruited.includes(id)||s.pendingBattle?.missionAllies?.some(u=>Number(u.id)===id)||!serviceRecord?.alive||serviceRecord.hp<=0||serviceRecord.captured)continue;
  const character=characterForOperative(s,id),person=character&&s.contentPresence.people[character.id],sector=person&&locationId(person.sector);
  if(!person?.alive||person.recruited||!person.appeared||!sector)continue;
  need(record.health.hp>0,'Un habitante muerto no puede volver del servicio.');
  const current=campaignCivilian(s,original,{fromService:true});
  remember(s,current,{sector,sceneId:null});changed=true;
 }
 if(changed)refreshCivilianScenes(s);
 return changed;
}

export function transferCivilian(s,n){
 const key=civilianKey(n);
 if(s.civilianState?.people[key])s.civilianState.people[key].inService=true;
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),s.pendingBattle])if(scene)
  scene.npcs=(scene.npcs??[]).filter(v=>civilianKey(v)!==key);
}
export function validateCivilianScene(s,scene,{active=false}={}){
 if(active)need(scene.npcs.length===(s.pendingBattle.npcs??[]).length&&(s.pendingBattle.npcs??[]).every(n=>scene.npcs.some(v=>v.id===n.id)),'Faltan habitantes en el sector guardado.');
 for(const n of scene.npcs??[]){
  definition(s,n);validateCivilianWounds(n,scene);
  const record=s.civilianState?.people[civilianKey(n)];
  need(!s.recruited.includes(operativeId(n)));
  const expected=campaignCivilian(s,n);need(same(physical(n),physical(expected)));
  need(validCivilianSupplies(n.civilianSupplies)&&CIVILIAN_SUPPLY_FIELDS.every(k=>n.civilianSupplies[k]===expected.civilianSupplies[k]),'Los suministros guardados del habitante no coinciden con su ficha.');
  if(n.hp===0)need(civilianDiedHere(s,n,scene.sectorId??scene.sector,scene.sceneId??null));
  if(record&&!record.inService)need(record.health.hp===n.hp);
 }
}
export function validateCampaignCivilians(s){
 const ledger=s.civilianState;
 need(ledger&&[1,2].includes(ledger.version)&&ledger.people&&typeof ledger.people==='object'&&!Array.isArray(ledger.people));
 need(Object.keys(ledger).length===2&&Object.keys(ledger.people).length<=encounterDefinitions(s).length+YATASTO_NPCS.length);
 for(const [key,r]of Object.entries(ledger.people)){
  const n=definition(s,{id:r.npcId,operativeId:encounterDefinitions(s).find(n=>n.id===r.npcId)?.operativeId});
  need(civilianKey(n)===key&&Object.keys(r).every(k=>['npcId','sector','sceneId','health','inService'].includes(k)));
  need((validWorldLocation(r.sector)||r.sector==='san_lorenzo')&&(r.sceneId===null||r.sceneId==='yatasto')&&r.health&&Object.keys(r.health).every(k=>fields.includes(k)));
  validateCivilianWounds(r.health);
  const id=operativeId(n);
  need(r.inService===undefined||r.inService===true&&id!==undefined);
  if(id!==undefined&&!r.inService&&!s.recruited.includes(id))need(s.operativeState[id].hp===r.health.hp&&s.operativeState[id].alive===(r.health.hp>0));
 }
 if(ledger.version===2)for(const {n,id,sector}of placedResidents(s)){
  const record=ledger.people[civilianKey(n)];
  if(s.operativeState[id].bleeding>0)need(record,'Falta el reloj de un habitante herido.');
  if(record?.npcId===n.id&&!record.inService&&record.health.hp>0)need(record.sector===sector&&record.sceneId===null,'La herida no corresponde a la ubicación del habitante.');
 }
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(s.pendingBattle?[s.pendingBattle]:[])])validateCivilianScene(s,scene);
}
// Pre-ledger saves are admitted once. Preserve the worst known health across
// copies and translate the old 100-point civilian scale without healing.
export function migrateCampaignCivilians(s){
 if(s.civilianState!==undefined)return;
 s.civilianState={version:1,people:{}};
 const scenes=[...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(s.pendingBattle?[s.pendingBattle]:[])];
 for(const scene of scenes)scene.npcs=(scene.npcs??[]).filter(n=>!s.recruited.includes(operativeId(n)));
 for(const scene of scenes)for(const n of scene.npcs??[]){
  definition(s,n);migrateCivilianHealth(n,service(s,n));
  const old=s.civilianState.people[civilianKey(n)];
  if(!old||n.hp<old.health.hp)remember(s,n,scene);
 }
 for(const scene of scenes){
  for(const n of scene.npcs??[])Object.assign(n,structuredClone(s.civilianState.people[civilianKey(n)].health));
  scene.npcs=(scene.npcs??[]).filter(n=>n.hp>0||civilianDiedHere(s,n,scene.sectorId??scene.sector,scene.sceneId??null));
 }
 return true;
}
export function migrateActiveCivilians(s,battle,{legacy=false}={}){
 for(const n of battle.npcs??[])if(n.civilianSupplies===undefined)n.civilianSupplies=supplies(s,n);
 for(const n of battle.npcs??[])if(n.civilianHealthVersion===undefined){
  migrateCivilianHealth(n,service(s,n));
  const expected=campaignCivilian(s,n);if(legacy)continue;need(n.hp===expected.hp,'La herida civil anterior no coincide con la campaña.');
  Object.assign(n,physical(expected));
 }
 if(legacy)acknowledgeCivilians(s,battle);
}
export function migrateCampaignCivilianSupplies(s){
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(s.pendingBattle?[s.pendingBattle]:[])])for(const n of scene.npcs??[])if(n.civilianSupplies===undefined)n.civilianSupplies=supplies(s,n);
}
