import {isUnconscious} from './actor-condition.js';
import {rosterFor} from './recruitment.js';
import {CAMPAIGN_PROJECT_LABELS,campaignProjectComplete} from './campaign-projects.js';
import {atDialogueMeeting} from './dialogue-movement.js';
import {contentQuestStatus,CONTENT_QUEST_STATES} from './content-quests.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {operativeIdForCharacter} from './content-character-ids.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export const DIALOGUE_PERSON_STATE_LABELS=Object.freeze({alive:'Vivo',dead:'Muerto',serving:'Incorporado al servicio',present:'Presente en el mundo',conscious:'Consciente',unconscious:'Inconsciente',wounded:'Herido',bleeding:'Con hemorragia',stable:'Consciente y sin sangrado',healthy:'Salud completa y consciente'});
export const DIALOGUE_PERSON_STATES=Object.keys(DIALOGUE_PERSON_STATE_LABELS);
export function validateDialogueConditions(conditions,characters,quests){
 if(conditions===undefined)return;
 need(Array.isArray(conditions)&&conditions.length<=6,'Cada opción admite hasta seis condiciones.');
 for(const c of conditions){
  need(object(c),'La condición del diálogo no es válida.');
  if(c.type==='character')need(exact(c,['type','character','state'])&&characters?.has(c.character)&&DIALOGUE_PERSON_STATES.includes(c.state),'La condición necesita un personaje y un estado válidos.');
  else if(c.type==='meeting')need(exact(c,['type','character'])&&characters?.has(c.character),'La condición del encuentro necesita un personaje válido.');
  else if(c.type==='quest')need(exact(c,['type','quest','status'])&&quests?.has(c.quest)&&CONTENT_QUEST_STATES.includes(c.status),'La condición necesita un encargo y un estado válidos.');
  else if(c.type==='project')need(exact(c,['type','project','completed'])&&Object.hasOwn(CAMPAIGN_PROJECT_LABELS,c.project)&&typeof c.completed==='boolean','La condición necesita un proyecto y un estado válidos.');
  else if(c.type==='sector')need(exact(c,['type','sector','owner'])&&CAMPAIGN_SECTORS.some(s=>s.id===c.sector)&&['patriot','royalist'].includes(c.owner),'La condición necesita una localidad y un control válidos.');
  else if(c.type==='day'||c.type==='treasury')need(exact(c,['type','min','max'])&&integer(c.min,c.type==='day'?1:0,1000000000)&&(c.max===null||integer(c.max,c.min,1000000000)),'La condición necesita un intervalo válido.');
  else need(false,'El tipo de condición del diálogo no está disponible.');
 }
}
function characterState(s,character,battle,state){
 const id=operativeIdForCharacter(s.contentCampaign.package,character),record=s.operativeState[id],request=s.pendingBattle,deployed=[...(request?.squad??[]),...(request?.missionAllies??[])].some(u=>Number(u.id)===id);
 const scene=battle&&request&&battle.sectorId===request.sector&&(battle.sceneId??null)===(request.sceneId??null)&&(!battle.battleId||battle.battleId===request.id)?battle:null;
 const unit=deployed?scene?.units.find(u=>u.side==='player'&&Number(u.id)===id):null;
 const identifies=n=>n.operativeId!=null&&Number(n.operativeId)===id||n.contentId===character||id===57&&n.id==='yatasto-san-martin';
 const resident=!s.recruited.includes(id)?scene?.npcs?.find(n=>identifies(n)&&request.npcs?.some(expected=>expected.id===n.id&&identifies(expected))):null;
 const physical=unit??resident??record,alive=unit||resident?physical.hp>0:record?.alive===true;
 const conscious=alive&&!isUnconscious(physical),maxHp=(unit??resident)?.maxHp??(['wounded','healthy'].includes(state)?rosterFor(s).find(o=>o.id===id)?.maxHp:undefined);
 const stable=conscious&&(physical.bleeding??0)===0;
 return {alive,dead:Boolean(record)&&!alive,serving:alive&&!record?.captured&&s.recruited.includes(id),present:alive&&!record?.captured&&!s.recruited.includes(id)&&Boolean(s.contentPresence?.people[character]?.appeared&&s.contentPresence.people[character].sector),conscious,unconscious:alive&&!conscious,wounded:alive&&physical.hp<maxHp,bleeding:alive&&(physical.bleeding??0)>0,stable,healthy:stable&&physical.hp===maxHp};
}
export function dialogueConditionsMet(s,conditions,battle=null){
 return (conditions??[]).every(c=>{
  if(c.type==='character')return characterState(s,c.character,battle,c.state)[c.state]===true;
  if(c.type==='meeting')return atDialogueMeeting(s,c.character,battle);
  if(c.type==='quest')return contentQuestStatus(s,c.quest)===c.status;
  if(c.type==='project')return Object.hasOwn(CAMPAIGN_PROJECT_LABELS,c.project)&&campaignProjectComplete(s,c.project)===c.completed;
  if(c.type==='sector')return s.sectors[c.sector]?.owner===c.owner;
  if(!['day','treasury'].includes(c.type))return false;
  const value=c.type==='day'?Math.floor(s.hour/24)+1:s.resources.treasury;
  return value>=c.min&&(c.max===null||value<=c.max);
 });
}
