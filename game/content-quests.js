import {characterForOperative} from './content-character-ids.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const timeOf=s=>s.hour*3600+(s.secondOfHour??0);
const secondsOf=e=>e.hour*3600+(e.secondOfHour??0);
export const CONTENT_QUEST_STATES=['not-started','active','completed','failed'];
export const QUEST_STATE_LABELS={'not-started':'Sin iniciar',active:'En curso',completed:'Completado',failed:'Fallido'};
export function validateContentQuests(quests){
 if(quests===undefined)return;
 need(Array.isArray(quests)&&quests.length<=100,'La campaña admite hasta 100 encargos.');
 const ids=new Set();for(const q of quests){
  need(object(q)&&['id','title','description'].every(k=>Object.hasOwn(q,k))&&Object.keys(q).every(k=>['id','title','description','deadlineHours'].includes(k))&&typeof q.id==='string'&&/^[a-z][a-z0-9-]{0,59}$/.test(q.id)&&!['constructor','prototype'].includes(q.id)&&!ids.has(q.id)&&typeof q.title==='string'&&q.title.trim().length>0&&q.title.length<=100&&typeof q.description==='string'&&q.description.trim().length>0&&q.description.length<=1000,'El encargo necesita identidad, título y descripción válidos.');ids.add(q.id);
  need(q.deadlineHours==null||Number.isSafeInteger(q.deadlineHours)&&q.deadlineHours>=1&&q.deadlineHours<=720,'El plazo del encargo debe ser de 1 a 720 horas, o quedar vacío.');
 }
}
export const contentQuestStatus=(s,id)=>s.contentQuestEvents?.findLast(e=>e.quest===id)?.to??'not-started';
const allowed=(from,to)=>from==='not-started'?to==='active':from==='active'&&['completed','failed'].includes(to);
export function questTransitionQuote(s,effect){
 const quest=s.contentCampaign?.package.quests?.find(q=>q.id===effect.quest),from=contentQuestStatus(s,effect.quest);
 need(quest,'El encargo no pertenece a esta campaña.');
 const start=s.contentQuestEvents?.find(e=>e.quest===quest.id&&e.to==='active');
 if(from==='active'&&quest.deadlineHours!=null&&timeOf(s)>=secondsOf(start)+quest.deadlineHours*3600)return {quest,from,available:false,reason:`Venció el plazo de «${quest.title}».`};
 return {quest,from,available:allowed(from,effect.status),reason:allowed(from,effect.status)?null:`«${quest.title}» está ${QUEST_STATE_LABELS[from].toLowerCase()}; no puede pasar a ${QUEST_STATE_LABELS[effect.status].toLowerCase()}.`};
}
export function applyQuestTransition(s,effect,source){
 const quote=questTransitionQuote(s,effect);need(quote.available,quote.reason);
 s.contentQuestEvents=[...(s.contentQuestEvents??[]),{quest:effect.quest,from:quote.from,to:effect.status,...source,hour:s.hour,secondOfHour:s.secondOfHour??0}];
}
export function expireContentQuests(s){
 const due=(s.contentCampaign?.package.quests??[]).filter(q=>q.deadlineHours!=null&&contentQuestStatus(s,q.id)==='active').map(q=>{
  const start=s.contentQuestEvents.find(e=>e.quest===q.id&&e.to==='active');return {quest:q.id,deadline:secondsOf(start)+q.deadlineHours*3600};
 }).filter(q=>q.deadline<=timeOf(s)).sort((a,b)=>a.deadline-b.deadline||a.quest.localeCompare(b.quest));
 for(const q of due){
  s.contentQuestEvents.push({...q,from:'active',to:'failed',hour:Math.floor(q.deadline/3600),secondOfHour:q.deadline%3600});
  const definition=s.contentCampaign.package.quests.find(d=>d.id===q.quest);s.log.push({hour:s.hour,text:`Venció el plazo del encargo «${definition.title}».`});s.log=s.log.slice(-80);
 }
}
export function contentQuestJournal(s){
 return (s.contentCampaign?.package.quests??[]).map(q=>{
  const events=(s.contentQuestEvents??[]).filter(e=>e.quest===q.id),deadline=events.length&&q.deadlineHours!=null?secondsOf(events[0])+q.deadlineHours*3600:null;return {...q,status:events.at(-1)?.to??'not-started',startedAt:events[0]?.hour,resolvedAt:events.length===2?events[1].hour:null,deadline,remainingMinutes:deadline===null?null:Math.max(0,Math.ceil((deadline-timeOf(s))/60)),expired:events.at(-1)?.deadline!==undefined};
 }).filter(q=>q.status!=='not-started');
}
export function validateContentQuestState(s,npcs){
 const events=s.contentQuestEvents??[];need(Array.isArray(events)&&events.length<=(s.contentCampaign?.package.quests?.length??0)*2,'El registro de encargos es inválido.');
 const states={},starts={},seen=new Set();let lastTime=0;
 for(const event of events){
  const automatic=event?.deadline!==undefined;
  need(exact(event,['quest','from','to','hour',...(event?.secondOfHour===undefined?[]:['secondOfHour']),...(automatic?['deadline']:['npc','node','choice'])]),'El registro de encargos es inválido.');
  const quest=s.contentCampaign.package.quests.find(q=>q.id===event.quest),time=secondsOf(event);
  need(quest&&Number.isSafeInteger(event.hour)&&event.hour>=0&&(event.secondOfHour===undefined||Number.isSafeInteger(event.secondOfHour))&&(event.secondOfHour??0)>=0&&(event.secondOfHour??0)<3600&&time>=lastTime&&time<=timeOf(s),'La secuencia guardada del encargo es inválida.');
  if(automatic){
   need(event.from==='active'&&event.to==='failed'&&states[event.quest]==='active'&&quest.deadlineHours!=null&&event.deadline===starts[event.quest]+quest.deadlineHours*3600&&time===event.deadline,'El vencimiento guardado del encargo es inválido.');
  }else{
  const npc=npcs.find(n=>n.id===event.npc),graph=characterForOperative(s,npc?.operativeId)?.encounter?.dialogue,choice=graph?.nodes.find(n=>n.id===event.node)?.choices.find(c=>c.id===event.choice),effect=choice?.effects?.find(e=>e.type==='quest'),receipt=s.conversations?.[event.npc]?.dialogueReceipts?.find(r=>r.node===event.node&&r.choice===event.choice),key=`${event.npc}/${event.node}/${event.choice}`;
  need(effect&&effect.quest===event.quest&&effect.status===event.to&&receipt&&receipt.hour===event.hour&&!seen.has(key),'El encargo guardado no coincide con su conversación.');
  need(event.from===(states[event.quest]??'not-started')&&allowed(event.from,event.to)&&(event.to==='active'||quest.deadlineHours==null||time<starts[event.quest]+quest.deadlineHours*3600),'La secuencia guardada del encargo es inválida.');seen.add(key);
  }
  if(event.to==='active')starts[event.quest]=time;states[event.quest]=event.to;lastTime=time;
 }
 for(const q of s.contentCampaign?.package.quests??[])if(states[q.id]==='active'&&q.deadlineHours!=null)need(timeOf(s)<starts[q.id]+q.deadlineHours*3600,'Falta el vencimiento del encargo guardado.');
 for(const npc of npcs){
  const graph=characterForOperative(s,npc.operativeId)?.encounter?.dialogue;
  for(const r of s.conversations?.[npc.id]?.dialogueReceipts??[]){
   const choice=graph?.nodes.find(n=>n.id===r.node)?.choices.find(c=>c.id===r.choice);
   if(choice?.effects?.some(e=>e.type==='quest'))need(seen.has(`${npc.id}/${r.node}/${r.choice}`),'Falta el registro del encargo aplicado por el diálogo.');
  }
 }
}
