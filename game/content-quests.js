import {characterForOperative} from './content-character-ids.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const CONTENT_QUEST_STATES=['not-started','active','completed','failed'];
export const QUEST_STATE_LABELS={'not-started':'Sin iniciar',active:'En curso',completed:'Completado',failed:'Fallido'};
export function validateContentQuests(quests){
 if(quests===undefined)return;
 need(Array.isArray(quests)&&quests.length<=100,'La campaña admite hasta 100 encargos.');
 const ids=new Set();for(const q of quests){
  need(exact(q,['id','title','description'])&&typeof q.id==='string'&&/^[a-z][a-z0-9-]{0,59}$/.test(q.id)&&!['constructor','prototype'].includes(q.id)&&!ids.has(q.id)&&typeof q.title==='string'&&q.title.trim().length>0&&q.title.length<=100&&typeof q.description==='string'&&q.description.trim().length>0&&q.description.length<=1000,'El encargo necesita identidad, título y descripción válidos.');ids.add(q.id);
 }
}
export const contentQuestStatus=(s,id)=>s.contentQuestEvents?.findLast(e=>e.quest===id)?.to??'not-started';
const allowed=(from,to)=>from==='not-started'?to==='active':from==='active'&&['completed','failed'].includes(to);
export function questTransitionQuote(s,effect){
 const quest=s.contentCampaign?.package.quests?.find(q=>q.id===effect.quest),from=contentQuestStatus(s,effect.quest);
 need(quest,'El encargo no pertenece a esta campaña.');
 return {quest,from,available:allowed(from,effect.status),reason:allowed(from,effect.status)?null:`«${quest.title}» está ${QUEST_STATE_LABELS[from].toLowerCase()}; no puede pasar a ${QUEST_STATE_LABELS[effect.status].toLowerCase()}.`};
}
export function applyQuestTransition(s,effect,source){
 const quote=questTransitionQuote(s,effect);need(quote.available,quote.reason);
 s.contentQuestEvents=[...(s.contentQuestEvents??[]),{quest:effect.quest,from:quote.from,to:effect.status,...source,hour:s.hour}];
}
export function contentQuestJournal(s){
 return (s.contentCampaign?.package.quests??[]).map(q=>{
  const events=(s.contentQuestEvents??[]).filter(e=>e.quest===q.id);return {...q,status:events.at(-1)?.to??'not-started',startedAt:events[0]?.hour,resolvedAt:events.length===2?events[1].hour:null};
 }).filter(q=>q.status!=='not-started');
}
export function validateContentQuestState(s,npcs){
 const events=s.contentQuestEvents??[];need(Array.isArray(events)&&events.length<=(s.contentCampaign?.package.quests?.length??0)*2,'El registro de encargos es inválido.');
 const states={},seen=new Set();let lastHour=0;
 for(const event of events){
  need(exact(event,['quest','from','to','npc','node','choice','hour']),'El registro de encargos es inválido.');
  const npc=npcs.find(n=>n.id===event.npc),graph=characterForOperative(s,npc?.operativeId)?.encounter?.dialogue,choice=graph?.nodes.find(n=>n.id===event.node)?.choices.find(c=>c.id===event.choice),effect=choice?.effects?.find(e=>e.type==='quest'),receipt=s.conversations?.[event.npc]?.dialogueReceipts?.find(r=>r.node===event.node&&r.choice===event.choice),key=`${event.npc}/${event.node}/${event.choice}`;
  need(effect&&effect.quest===event.quest&&effect.status===event.to&&receipt&&receipt.hour===event.hour&&!seen.has(key),'El encargo guardado no coincide con su conversación.');
  need(event.from===(states[event.quest]??'not-started')&&allowed(event.from,event.to)&&Number.isSafeInteger(event.hour)&&event.hour>=lastHour&&event.hour<=s.hour,'La secuencia guardada del encargo es inválida.');
  states[event.quest]=event.to;lastHour=event.hour;seen.add(key);
 }
 for(const npc of npcs){
  const graph=characterForOperative(s,npc.operativeId)?.encounter?.dialogue;
  for(const r of s.conversations?.[npc.id]?.dialogueReceipts??[]){
   const choice=graph?.nodes.find(n=>n.id===r.node)?.choices.find(c=>c.id===r.choice);
   if(choice?.effects?.some(e=>e.type==='quest'))need(seen.has(`${npc.id}/${r.node}/${r.choice}`),'Falta el registro del encargo aplicado por el diálogo.');
  }
 }
}
