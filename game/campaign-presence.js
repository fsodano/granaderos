import {civilianDiedHere} from './campaign-civilians.js';
import {encounterDefinitions} from './encounters.js';
import {createContentSession,advancePlacementState,changePlacementStatus} from './content-placement.js';
import {isContractCharacter,operativeIdForCharacter,characterForOperative} from './content-character-ids.js';
import {contentCellIds} from './content-map.js';
import {locationId} from './world-cells.js';
const minuteOf=s=>s.hour*60+Math.floor((s.secondOfHour??0)/60);
const strip=({content,history,...runtime})=>runtime;
const need=ok=>{if(!ok)throw Error('Las apariciones guardadas son inválidas.');};
export function initializeCampaignPresence(state){
  state.contentPresence=strip(createContentSession(state.contentCampaign.package,state.seed));
  synchronizeCampaignPresence(state);
}
export function characterPresentInSector(state,characterId,sector){
  const person=state.contentPresence?.people[characterId];
  return Boolean(person?.alive&&!person.recruited&&!person.suspended&&person.appeared&&locationId(person.sector)===locationId(sector));
}
function currentResident(state,npc,sector){
  const original=encounterDefinitions(state).find(n=>n.id===npc.id);
  if(!original||original.operativeId!==npc.operativeId||original.contentId!==undefined&&original.contentId!==npc.contentId)return false;
  if(npc.hp===0)return civilianDiedHere(state,npc,sector);
  const character=characterForOperative(state,npc.operativeId);
  if(!character)return npc.operativeId===undefined&&npc.contentId===undefined;
  const person=state.contentPresence.people[character.id];
  return characterPresentInSector(state,character.id,sector)&&npc.presenceRevision===person.revision;
}
// One identity owns the location. A retained scene is a cache, never a second
// source of residents. A new visit after a relocation starts a new local routine.
export function synchronizeCampaignPresence(state){
  if(!state.contentPresence)return;
  let runtime={...state.contentPresence,content:state.contentCampaign.package,history:[]};
  const loaded=state.pendingBattle&&locationId(state.pendingBattle.sector)
    ?contentCellIds([state.pendingBattle.sector])[0]:null;
  runtime=advancePlacementState(runtime,minuteOf(state),loaded,52560000);
  for(const c of runtime.content.characters){
    const numeric=operativeIdForCharacter(runtime.content,c.id),record=state.operativeState[numeric],person=runtime.people[c.id];
    if(record.alive===false&&person.alive){record.deathMinute=runtime.minute;runtime=changePlacementStatus(runtime,c.id,'dead',loaded);}
    else if(person.alive&&person.recruited!==state.recruited.includes(numeric))
      runtime=changePlacementStatus(runtime,c.id,state.recruited.includes(numeric)?'recruited':'released',loaded);
    runtime.people[c.id].hp=record.hp;
  }
  state.contentPresence=strip(runtime);
  for(const [sector,scene] of Object.entries(state.sectorStates))
    scene.npcs=(scene.npcs??[]).filter(n=>currentResident(state,n,sector));
  if(state.pendingBattle&&!state.pendingBattle.sceneId)
    state.pendingBattle.npcs=(state.pendingBattle.npcs??[]).filter(n=>currentResident(state,n,state.pendingBattle.sector));
}
export function validatePresenceScene(state,scene){
  if(!state.contentPresence||scene.sceneId)return;
  for(const npc of scene.npcs??[])need(currentResident(state,npc,scene.sectorId??scene.sector));
}
function validateSuccessions(state){
 const r=state.contentPresence,placements=state.contentCampaign.package.placements;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 need(Array.isArray(r.events)&&Array.isArray(r.receipts)&&r.events.length<=placements.length&&r.receipts.length<=placements.length);
 const receipts=new Map(),events=new Map();
 for(const receipt of r.receipts){
  need(object(receipt)&&Object.keys(receipt).length===4&&['placement','trigger','minute','at'].every(k=>Object.hasOwn(receipt,k)));
  const p=placements.find(p=>p.id===receipt.placement);
  need(p&&p.afterDeath===receipt.trigger&&r.people[p.afterDeath]?.alive===false&&!receipts.has(p.id));
  need(integer(receipt.minute,0,r.minute)&&receipt.minute===state.operativeState[operativeIdForCharacter(state.contentCampaign.package,p.afterDeath)]?.deathMinute&&integer(receipt.at,receipt.minute+p.delayMin,receipt.minute+p.delayMax));
  receipts.set(p.id,receipt);
 }
 for(const event of r.events){
  need(object(event)&&Object.keys(event).every(k=>['placement','at','destination'].includes(k)));
  const p=placements.find(p=>p.id===event.placement),receipt=receipts.get(event.placement);
  need(p&&receipt&&event.at===receipt.at&&!events.has(p.id)&&!r.people[p.character]?.appeared);
  need(event.destination===undefined||p.sectors.includes(event.destination));
  if(event.at<=r.minute)need(event.destination!==undefined&&state.pendingBattle&&locationId(event.destination)===locationId(state.pendingBattle.sector));
  else need(event.destination===undefined);
  events.set(p.id,event);
 }
 for(const p of placements.filter(p=>p.afterDeath!==null)){
  const person=r.people[p.character],receipt=receipts.get(p.id);
  need(Boolean(receipt)===(r.people[p.afterDeath]?.alive===false));
  if(!receipt)need(!person.appeared&&person.sector===null&&person.revision===0);
  else if(person.appeared)need(!events.has(p.id)&&receipt.at<=r.minute);
  else if(person.alive&&!person.recruited)need(events.has(p.id));
 }
}
export function validateCampaignPresence(state){
  const content=state.contentCampaign?.package,r=state.contentPresence;
  if(state.contentCampaign?.adapter!=='character-presence-v1'){need(r===undefined);return;}
  const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  need(object(r)&&r.version===1&&integer(r.rng,0,0xffffffff)&&integer(r.initialSeed,0,0xffffffff)&&r.minute===minuteOf(state)&&integer(r.minute,0,52560000));
  need(Object.keys(r).every(k=>['version','rng','initialSeed','minute','nextDaily','people','events','receipts'].includes(k)));
  need(r.nextDaily===240+1440*(Math.floor((r.minute-240)/1440)+1));
  need(object(r.people)&&Object.keys(r.people).length===content.characters.length);
  for(const c of content.characters){
    const p=r.people[c.id],placement=content.placements.find(v=>v.character===c.id),record=state.operativeState[operativeIdForCharacter(content,c.id)];
    need(object(p)&&['alive','recruited','appeared','suspended'].every(k=>typeof p[k]==='boolean')&&p.suspended===false&&integer(p.revision,0,1e9));
    need(Object.keys(p).every(k=>['alive','recruited','appeared','suspended','revision','sector','hp'].includes(k)));
    if(record.deathMinute!==undefined)need(record.alive===false&&integer(record.deathMinute,0,r.minute));
    need(p.hp===record.hp&&p.alive===record.alive&&p.recruited===state.recruited.includes(operativeIdForCharacter(content,c.id)));
    need(p.sector===null||placement?.sectors.includes(p.sector));
    need(!p.appeared||Boolean(placement)&&p.revision>=1);
    need(p.alive||p.hp===0&&p.sector===null);
    if(!placement||isContractCharacter(c))need(!p.appeared&&p.sector===null&&p.revision===0);
    else if(placement.afterDeath===null||p.appeared)need(p.appeared&&(!p.alive||p.sector!==null));
    else need(p.sector===null&&p.revision===0&&!p.recruited);
  }
 validateSuccessions(state);
  for(const scene of Object.values(state.sectorStates))validatePresenceScene(state,scene);
  if(state.pendingBattle)validatePresenceScene(state,state.pendingBattle);
}
