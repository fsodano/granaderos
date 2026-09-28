import {validateDialogueConditions,dialogueConditionsMet} from './dialogue-conditions.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const time=s=>s.hour*3600+(s.secondOfHour??0);
const stamp=s=>({hour:s.hour,secondOfHour:s.secondOfHour??0});
export const campaignStory=s=>s?.contentCampaign?.package.campaignStory??null;
export function defaultCampaignStory(){
 return {introduction:'Reuní una escuadra y cumplí los objetivos de esta campaña.',victory:'La misión de la escuadra está cumplida.',defeat:'La campaña no puede continuar.',chapters:[{id:'chapter-1',name:'Primer objetivo',objective:'Llegá al segundo día de campaña.',conditions:[{type:'day',min:2,max:null}]}],failureConditions:[]};
}
export function validateCampaignStory(value,characters,quests){
 if(value==null)return;
 need(exact(value,['introduction','victory','defeat','chapters','failureConditions'])&&['introduction','victory','defeat'].every(k=>text(value[k],1000)),'La campaña necesita introducción, victoria, derrota y capítulos válidos.');
 need(Array.isArray(value.chapters)&&value.chapters.length>=1&&value.chapters.length<=12,'La campaña admite entre uno y doce capítulos.');
 const conditions=(list,required)=>{
  validateDialogueConditions(list,characters,quests);
  need(Array.isArray(list)&&(!required||list.length>0)&&list.every(c=>c.type!=='meeting'),'Los objetivos necesitan condiciones de campaña; los encuentros se resuelven mediante encargos.');
 };
 const ids=new Set();for(const chapter of value.chapters){
  need(exact(chapter,['id','name','objective','conditions'])&&typeof chapter.id==='string'&&/^[a-z][a-z0-9-]{0,59}$/.test(chapter.id)&&!['constructor','prototype'].includes(chapter.id)&&!ids.has(chapter.id)&&text(chapter.name,100)&&text(chapter.objective,1000),'El capítulo necesita identidad única, nombre y objetivo válidos.');
  ids.add(chapter.id);conditions(chapter.conditions,true);
 }
 conditions(value.failureConditions,false);
}
export const campaignChapterIndex=s=>campaignStory(s)?Math.min(s.campaignProgress?.completed.length??0,campaignStory(s).chapters.length-1):s.phase;
export const storyReferences=(story,type,id)=>[...(story?.chapters??[]).flatMap(c=>c.conditions),...(story?.failureConditions??[])].some(c=>c.type===type&&c[type]===id);
export function initializeCampaignStory(s){
 if(!campaignStory(s))return;
 s.campaignProgress={version:1,completed:[],outcome:null};
 s.log=[{hour:0,text:campaignStory(s).introduction}];
}
// Campaign objectives use settled campaign state. Do not finish an open scene.
export function advanceCampaignStory(s,battle=null){
 const story=campaignStory(s);if(!story||s.campaignProgress.outcome)return;
 const log=value=>{s.log.unshift({hour:s.hour,text:value});s.log=s.log.slice(0,80);};
 if(s.defeated||(story.failureConditions.length>0&&dialogueConditionsMet(s,story.failureConditions,battle))){
  s.defeated=true;s.campaignProgress.outcome={type:'defeat',...stamp(s)};log(story.defeat);return;
 }
 if(s.pendingBattle)return;
 while(s.campaignProgress.completed.length<story.chapters.length){
  const chapter=story.chapters[s.campaignProgress.completed.length];
  if(!dialogueConditionsMet(s,chapter.conditions))break;
  s.campaignProgress.completed.push({chapter:chapter.id,...stamp(s)});log(`Objetivo cumplido: ${chapter.name}.`);
 }
 if(s.campaignProgress.completed.length===story.chapters.length){s.completed=true;s.campaignProgress.outcome={type:'victory',...stamp(s)};log(story.victory);}
}
export function validateCampaignProgress(s){
 const story=campaignStory(s),p=s.campaignProgress;
 if(!story){need(p===undefined,'Esta campaña no utiliza capítulos propios.');return;}
 const message='El avance guardado de los capítulos no es válido.';
 need(exact(p,['version','completed','outcome'])&&p.version===1&&Array.isArray(p.completed)&&p.completed.length<=story.chapters.length&&s.phase===0,message);
 const validTime=e=>Number.isSafeInteger(e.hour)&&e.hour>=0&&Number.isSafeInteger(e.secondOfHour)&&e.secondOfHour>=0&&e.secondOfHour<3600&&time(e)<=time(s);
 let previous=0;for(const [i,e]of p.completed.entries()){
  need(exact(e,['chapter','hour','secondOfHour'])&&e.chapter===story.chapters[i].id&&validTime(e)&&time(e)>=previous,message);previous=time(e);
 }
 need(!(s.completed&&s.defeated),message);
 if(p.outcome===null)need(!s.completed&&!s.defeated&&p.completed.length<story.chapters.length,message);
 else{
  need(exact(p.outcome,['type','hour','secondOfHour'])&&validTime(p.outcome)&&time(p.outcome)>=previous,message);
  need(p.outcome.type==='victory'?s.completed&&!s.defeated&&p.completed.length===story.chapters.length:p.outcome.type==='defeat'&&s.defeated&&!s.completed,message);
 }
}
