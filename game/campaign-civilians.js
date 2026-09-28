import {validWorldLocation} from './world-cells.js';
import {OPERATIVES} from './data.js';
import {ENCOUNTERS} from './encounters.js';
import {YATASTO_NPCS} from './missions.js';
import {authoredOperative} from './content-roster.js';
import {civilianMaxHp,civilianRestoredHp,seedCivilianHealth,migrateCivilianHealth} from './civilian-health.js';
import {civilianIncidents,validateCivilianWounds} from './civilian-harm.js';
import {recordCityLoyalty} from './cities.js';
import {NPC_QUESTS} from './quests.js';

const need=(ok,message='El estado de los habitantes no coincide con la campaña.')=>{if(!ok)throw Error(message);};
const fields=['civilianHealthVersion','maxHp','hp','energy','unconscious','civilianWoundVersion','bleeding','bandaged','bleedSource','civilianHarm','civilianFirstAid'];
const physical=n=>Object.fromEntries(fields.filter(k=>n[k]!==undefined).map(k=>[k,structuredClone(n[k])]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const operativeId=n=>n.id==='yatasto-san-martin'?57:n.operativeId;
export const civilianKey=n=>operativeId(n)!==undefined?`person-${operativeId(n)}`:`npc-${n.id}`;
function definition(n){
 const original=[...ENCOUNTERS,...YATASTO_NPCS].find(v=>v.id===n.id);
 need(original&&original.operativeId===n.operativeId,'El habitante no pertenece a este mundo.');
 return original;
}
function service(s,n){
 const id=operativeId(n),base=OPERATIVES.find(o=>o.id===id);
 return base?{...authoredOperative(s,base),...s.operativeState[id]}:undefined;
}
export function campaignCivilian(s,n){
 const record=s.civilianState?.people[civilianKey(n)],id=operativeId(n);
 const metadata={...n};for(const k of fields)delete metadata[k];
 if(record&&!record.inService&&!s.recruited.includes(id))return {...metadata,...structuredClone(record.health)};
 const seeded=seedCivilianHealth(metadata,service(s,n));
 if(record?.health.civilianHarm&&seeded.hp>0&&record.health.hp>0)seeded.civilianHarm=structuredClone(record.health.civilianHarm);
 return seeded;
}
export function civilianDiedHere(s,n,sector,sceneId=null){
 const record=s.civilianState?.people[civilianKey(n)];
 return Boolean(record?.health.hp===0&&!record.inService&&record.sector===sector&&record.sceneId===sceneId&&record.npcId===n.id);
}
function applyDeath(s,n,record){
 const death=civilianIncidents(n).find(e=>e.kind==='death');
 if(death&&death.side!=='unknown'){
  const kind=death.side==='player'?(death.militia?'civilianMilitia':'civilianPlayerIntentional'):
   s.sectors[record.sector]?.owner==='patriot'?'civilianEnemyPatriot':'civilianEnemyRoyalist';
  const accidental=death.intentional?kind:kind==='civilianPlayerIntentional'?'civilianPlayerAccidental':`${kind}Accidental`;
  recordCityLoyalty(s,{sectorId:record.sector==='san_lorenzo'?'san_nicolas':record.sector,kind:accidental,eventId:`civilian:${civilianKey(n)}`});
 }
 for(const q of NPC_QUESTS.filter(q=>q.npcId===n.id))if(s.quests[q.id]?.status!=='completed')
  s.quests[q.id]={status:'failed',offeredAt:s.quests[q.id]?.offeredAt??s.hour,completedAt:null,failedAt:s.hour};
 if((operativeId(n)===57||n.id==='yatasto-belgrano')&&!s.completed){
  s.defeated=true;
  if(record.sceneId==='yatasto')s.missions.yatasto={...(s.missions.yatasto??{}),stage:'failed',completed:false};
  s.log.push({hour:s.hour,text:`${n.name} ha muerto. La campaña no puede continuar sin este mando.`});
 }
}
function remember(s,n,scene){
 const key=civilianKey(n),before=s.civilianState.people[key];
 const record={npcId:n.id,sector:scene.sectorId??scene.sector,sceneId:scene.sceneId??null,health:physical(n)};
 s.civilianState.people[key]=record;
 const id=operativeId(n);
 if(id!==undefined&&!s.recruited.includes(id))Object.assign(s.operativeState[id],{hp:Math.ceil(n.hp),alive:n.hp>0,energy:n.energy,bleeding:n.bleeding??0});
 if(n.hp===0&&before?.health.hp!==0)applyDeath(s,n,record);
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
 const expected=request.npcs??[];
 need(snapshot.npcs.length===expected.length,'Faltan habitantes en el parte del sector.');
 for(const n of snapshot.npcs){
  definition(n);validateCivilianWounds(n,snapshot);
  const prior=expected.find(v=>v.id===n.id);
  need(prior&&prior.operativeId===n.operativeId&&prior.contentId===n.contentId&&prior.presenceRevision===n.presenceRevision&&!s.recruited.includes(operativeId(n)));
  const previous=campaignCivilian(s,prior);compareHistory(previous,n);
  for(const e of civilianIncidents(n).slice(civilianIncidents(previous).length))if(e.side!=='unknown'){
   const actor=snapshot.units.find(u=>String(u.id)===e.attackerId),source=previous.bleedSource;
   need(actor&&actor.side===e.side&&Boolean(actor.militia)===e.militia||e.kind==='death'&&source&&['attackerId','side','militia','intentional'].every(k=>source[k]===e[k]),'El responsable de la nueva herida no está en el sector.');
  }
  remember(s,n,snapshot);
 }
 const commander=snapshot.units.find(u=>u.missionAlly&&Number(u.id)===57);
 if(commander&&request.missionAllies?.some(u=>u.id===57)){
  Object.assign(s.operativeState[57],{hp:Math.ceil(commander.hp),alive:commander.hp>0,energy:commander.energy,bleeding:commander.bleeding??0});
  const record=s.civilianState.people['person-57'];if(record)record.inService=true;
  if(commander.hp===0)for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates)])scene.npcs=(scene.npcs??[]).filter(n=>operativeId(n)!==57);
 }
 // A retained tactical scene is only a cache. Keep its physical state in step
 // with the single identity, including the currently loaded request.
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),request])for(const n of scene.npcs??[]){
  const record=s.civilianState.people[civilianKey(n)];
  if((record||operativeId(n)===57)&&!s.recruited.includes(operativeId(n))){const current=physical(campaignCivilian(s,n));if(!same(physical(n),current)){for(const k of fields)delete n[k];Object.assign(n,current);}}
 }
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),request])scene.npcs=(scene.npcs??[]).filter(n=>n.hp>0||civilianDiedHere(s,n,scene.sectorId??scene.sector,scene.sceneId??null));
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
  definition(n);validateCivilianWounds(n,scene);
  const record=s.civilianState?.people[civilianKey(n)];
  need(!s.recruited.includes(operativeId(n)));
  need(same(physical(n),physical(campaignCivilian(s,n))));
  if(n.hp===0)need(civilianDiedHere(s,n,scene.sectorId??scene.sector,scene.sceneId??null));
  if(record&&!record.inService)need(record.health.hp===n.hp);
 }
}
export function validateCampaignCivilians(s){
 const ledger=s.civilianState;
 need(ledger&&ledger.version===1&&ledger.people&&typeof ledger.people==='object'&&!Array.isArray(ledger.people));
 need(Object.keys(ledger).length===2&&Object.keys(ledger.people).length<=ENCOUNTERS.length+YATASTO_NPCS.length);
 for(const [key,r]of Object.entries(ledger.people)){
  const n=definition({id:r.npcId,operativeId:ENCOUNTERS.find(n=>n.id===r.npcId)?.operativeId});
  need(civilianKey(n)===key&&Object.keys(r).every(k=>['npcId','sector','sceneId','health','inService'].includes(k)));
  need((validWorldLocation(r.sector)||r.sector==='san_lorenzo')&&(r.sceneId===null||r.sceneId==='yatasto')&&r.health&&Object.keys(r.health).every(k=>fields.includes(k)));
  validateCivilianWounds(r.health);
  const id=operativeId(n);
  need(r.inService===undefined||r.inService===true&&id!==undefined);
  if(id!==undefined&&!r.inService&&!s.recruited.includes(id))need(s.operativeState[id].hp===r.health.hp&&s.operativeState[id].alive===(r.health.hp>0));
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
  definition(n);migrateCivilianHealth(n,service(s,n));
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
 for(const n of battle.npcs??[])if(n.civilianHealthVersion===undefined){
  migrateCivilianHealth(n,service(s,n));
  const expected=campaignCivilian(s,n);if(legacy)continue;need(n.hp===expected.hp,'La herida civil anterior no coincide con la campaña.');
  Object.assign(n,physical(expected));
 }
 if(legacy)acknowledgeCivilians(s,battle);
}
