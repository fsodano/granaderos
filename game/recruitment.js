import {authoredRoster} from './content-roster.js';
import {pendingHire} from './hiring-arrivals.js';
import {gainsExperience,isContractOperative} from './content-character-ids.js';
import {applyCharacterProfile} from './character-profile.js';
import {campaignOfficerCreation,officerCreationWeapon} from './campaign-officer-creation.js';
import {weaponMetadata} from './weapon-definition.js';
import {serviceRelationshipRefusal} from './service-relationships.js';
import {serviceEquipmentReturnReason} from './service-equipment-notice.js';
export * from './character-profile.js';
import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS,CIVIC_DEFAULTS} from './civic-recruits.js';
export {CIVIC_RECRUITS} from './civic-recruits.js';
export const OFFICER_TRAITS=structuredClone(campaignOfficerCreation().traits);
export const OFFICER_QUESTIONS=structuredClone(campaignOfficerCreation().commissionQuestions);
export function createOfficerRecord(name,answers,profile,context=null){
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>30||/[<>\x00-\x1f]/u.test(name))throw Error('Escribe un nombre de entre 2 y 30 caracteres, sin símbolos de marcado.');
 const creation=campaignOfficerCreation(context);if(!answers||creation.commissionQuestions.some(q=>!q.choices.some(c=>c.id===answers[q.id])))throw Error(creation.commission.questionError);
 const primary=officerCreationWeapon(creation.commission.doctrineWeapons[answers.doctrine]??creation.commission.weapon,context),content=context?.contentCampaign?.package??context?.campaignPackage??context;
 const op={...CIVIC_DEFAULTS,id:1000,name:name.trim(),nickname:name.trim().slice(0,14),role:creation.commission.role,biography:creation.commission.biography,profileRegistry:creation.registry,monthlyPay:300,weeklyPay:70,hp:78,maxHp:78,agility:72,dexterity:72,strength:70,leadership:65,wisdom:75,marksmanship:65,mechanical:35,explosives:30,medical:35,weapon:primary?.template??0,...(primary&&content?.weapons?{weaponMetadata:weaponMetadata(primary)}:{}),traits:[answers.doctrine]};
 const boosts={estancia:{strength:10,agility:6},cabildo:{wisdom:10,leadership:8},workshop:{mechanical:25,dexterity:8},rescue:{medical:20,strength:5},rally:{leadership:12,wisdom:5},flank:{agility:10,marksmanship:5}};
 for(const response of [answers.origin,answers.crisis])for(const[k,v]of Object.entries(boosts[response]))op[k]=Math.min(95,op[k]+v);
 if(answers.doctrine==='line_marksman')op.marksmanship+=12;
 if(answers.doctrine==='gunsmith_artillerist'){op.mechanical+=15;op.explosives+=15;}
 return applyCharacterProfile(op,answers,profile,context);
}
export function rosterFor(state){
 const base=authoredRoster(state,[...OPERATIVES,...CIVIC_RECRUITS]);if(state.officer)base.push(createOfficerRecord(state.officer.name,state.officer.answers,state.officer.profile,state));
 return base.map(op=>{
   const progress=state.operativeState?.[op.id],xp=progress?.xp??0,level=1+Math.min(9,Math.floor(xp/100));
   if(!gainsExperience(state,op))return {...op,xp,level:1};
   const grown={...op,xp,level};for(const field of ['maxHp','agility','dexterity','strength','leadership','wisdom'])grown[field]=Math.min(state.contentCampaign?Math.max(95,op[field]):95,op[field]+(level-1)*2);
   for(const field of EXPERIENCE_TECHNICAL_SKILLS)grown[field]=Math.min(100,op[field]+(progress?.legacySkillBonus?.[field]??0));
   return grown;
 });
}
export const EXPERIENCE_TECHNICAL_SKILLS=Object.freeze(['marksmanship','mechanical','explosives','medical']);
// Old saves already received these values through XP. Freeze that historical
// amount once; new XP no longer teaches technical skills without practice.
export function migrateLegacySkillLearning(state){
 if(state.skillLearningVersion===1)return state;
 if(state.skillLearningVersion!==undefined)throw Error('La versión de aprendizaje es inválida.');
 const base=authoredRoster(state,[...OPERATIVES,...CIVIC_RECRUITS]);if(state.officer)base.push(createOfficerRecord(state.officer.name,state.officer.answers,state.officer.profile,state));
 for(const op of base){
  const record=state.operativeState?.[op.id];if(!record||!gainsExperience(state,op))continue;
  const levels=Math.min(9,Math.floor((record.xp??0)/100));
  record.legacySkillBonus=Object.fromEntries(EXPERIENCE_TECHNICAL_SKILLS.map(field=>[field,Math.min(state.contentCampaign?Math.max(95,op[field]):95,op[field]+levels*(field==='marksmanship'?4:2))-op[field]]));
 }
 state.skillLearningVersion=1;return state;
}
export function civicStatus(state,id){
 id=Number(id);
 const op=rosterFor(state).find(o=>o.id===id&&isContractOperative(state,o)),record=state.operativeState[id];
 const reason=!op?'No existe ese voluntario.':state.recruited.includes(id)?'Ya se encuentra en tus filas.':pendingHire(state,id)?'Este contratado ya está en camino.':!record?.alive?'Ha caído en combate.':record.captured?'Este personaje está cautivo.':serviceEquipmentReturnReason(state,id)??serviceRelationshipRefusal(state,op)?.reason??null;
 return {available:!reason,reason:reason??campaignOfficerCreation(state).commission.availableText};
}
