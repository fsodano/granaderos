import {validateQuestWithdrawalContext} from './quest-withdrawal.js';
// Optional authored physical-delivery choices. Omitted definitions stay neutral.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const need=(ok,message)=>{if(!ok)throw Error(message);};
const definitions=state=>{
 const list=state?.contentCampaign?.package.errands??state?.errandDefinitions??[];
 need(Array.isArray(list),'Los encargos de entrega son inválidos.');
 for(const quest of list){
  need(object(quest)&&typeof quest.id==='string','Los encargos de entrega son inválidos.');
  if(quest.beneficiaries!==undefined)need(Array.isArray(quest.beneficiaries)&&quest.beneficiaries.length===2&&[...quest.beneficiaries].every(b=>object(b)&&typeof b.id==='string'&&typeof b.npcId==='string'&&typeof b.sector==='string'),'Los destinatarios del encargo son inválidos.');
 }
 return list;
};
export const questBeneficiaryOptions=quest=>Array.isArray(quest?.beneficiaries)?quest.beneficiaries:[];
export const questBeneficiaryForNPC=(quest,npcId)=>questBeneficiaryOptions(quest).find(b=>b.npcId===npcId)??null;
export const questContactIds=quest=>quest.beneficiaries?questBeneficiaryOptions(quest).map(b=>b.npcId):[quest.npcId];
export function selectedQuestBeneficiary(state,quest){
 return state?.quests?.[quest.id]?.beneficiaryId??state?.questBeneficiaries?.[quest.id];
}
export function initializeQuestBeneficiaries(state){
 const quests=definitions(state).filter(q=>q.beneficiaries);if(!quests.length)return undefined;
 return Object.fromEntries(quests.flatMap(q=>state.quests?.[q.id]?.beneficiaryId===undefined?[]:[[q.id,state.quests[q.id].beneficiaryId]]));
}
export function validateQuestBeneficiaries(value,state){
 const quests=definitions(state).filter(q=>q.beneficiaries);
 if(!quests.length){need(value===undefined,'Este despliegue no admite destinos de entrega.');return true;}
 need(object(value)&&Object.keys(value).length<=quests.length,'Los destinos de entrega del despliegue son inválidos.');
 for(const [id,branch]of Object.entries(value))need(quests.find(q=>q.id===id)?.beneficiaries.some(b=>b.id===branch),'El destino de entrega no pertenece al encargo.');
 return true;
}
// This accepts new physical custody, never a remote choice. Old retained scenes
// may precede a later commitment, but cannot contradict it or own opposite gifts.
export function validateQuestBeneficiaryContext(campaign,battle,{request=campaign.pendingBattle,retained=false,issued=false}={}){
 validateQuestWithdrawalContext(campaign,battle,{request,retained,issued});
 need(battle,'Falta el estado de la entrega.');validateQuestBeneficiaries(battle.questBeneficiaries,campaign);
 const quests=definitions(campaign).filter(q=>q.beneficiaries);if(!quests.length)return true;
 if(request)validateQuestBeneficiaries(request.questBeneficiaries,campaign);
 if(request?.resumeSnapshot)validateQuestBeneficiaries(request.resumeSnapshot.questBeneficiaries,campaign);
 const saved=initializeQuestBeneficiaries(campaign),requestChoices=request?.questBeneficiaries??{};
 if(request){
  for(const [id,branch]of Object.entries(requestChoices))need(saved[id]===branch,'El destino emitido no tiene una entrega reconocida.');
  for(const [id,branch]of Object.entries(saved))need(requestChoices[id]===branch,'El destino emitido perdió una entrega reconocida.');
 }
 // A stored resume is evidence only after its own physical receipts are
 // admitted without consulting itself. This also protects cloned resumes.
 const priorResume=request?.resumeSnapshot;
 if(priorResume&&priorResume!==battle)validateQuestBeneficiaryContext(campaign,priorResume,{request:{...request,resumeSnapshot:undefined}});
 const resume=priorResume&&priorResume!==battle?priorResume.questBeneficiaries:{};
 const authority={};
 for(const map of [requestChoices,resume,saved])for(const [id,branch]of Object.entries(map)){
  need(authority[id]===undefined||authority[id]===branch,'Los destinos guardados de la entrega no coinciden.');authority[id]=branch;
 }
 for(const [id,branch]of Object.entries(authority)){
  if(retained&&!Object.hasOwn(battle.questBeneficiaries,id))continue;
  need(battle.questBeneficiaries[id]===branch,'El destino de una entrega ya aceptada cambió o desapareció.');
 }
 const npcs=battle.npcs??[];need(Array.isArray(npcs),'Los receptores de la entrega son inválidos.');
 for(const quest of quests){
  const selected=battle.questBeneficiaries[quest.id],known=authority[quest.id],choice=selected??known;
  for(const branch of quest.beneficiaries){
   const npc=npcs.find(n=>n?.id===branch.npcId),count=npc?.questGifts?.length??0;
   if(!count)continue;
   need(choice===branch.id,'Los objetos están en un receptor distinto del destino elegido.');
   need((battle.sceneId??null)===null&&(battle.sectorId??battle.sector)===branch.sector,'La entrega no pertenece a la localidad del receptor.');
  }
  if(selected!==undefined&&known===undefined){
   const branch=quest.beneficiaries.find(b=>b.id===selected),npc=npcs.find(n=>n?.id===branch.npcId);
   need(!issued&&!retained&&(battle.sceneId??null)===null&&(battle.sectorId??battle.sector)===branch.sector&&Array.isArray(npc?.questGifts)&&npc.questGifts.length>0,'Un destino nuevo necesita objetos recibidos en este sector.');
  }
 }
 return true;
}
export function retainQuestBeneficiaries(campaign,request,battle){
 validateQuestBeneficiaryContext(campaign,battle,{request});
 for(const [id,branch]of Object.entries(battle.questBeneficiaries??{})){
  const old=campaign.quests?.[id];
  campaign.quests??={};campaign.quests[id]={...(old??{status:'offered',offeredAt:campaign.hour,completedAt:null}),beneficiaryId:branch};
 }
 const choices=initializeQuestBeneficiaries(campaign);if(choices!==undefined&&request)request.questBeneficiaries=choices;
}
export function commitQuestBeneficiary(state,quest,npcId){
 quest??=definitions(state).find(q=>questBeneficiaryForNPC(q,npcId));
 const branch=questBeneficiaryForNPC(quest,npcId);if(!branch)return;
 validateQuestBeneficiaries(state.questBeneficiaries,state);
 const old=state.questBeneficiaries[quest.id];need(old===undefined||old===branch.id,'Los objetos de este encargo ya tienen otro destinatario.');
 state.questBeneficiaries[quest.id]=branch.id;
}
export function questBeneficiaryDeliveryPreview(state,npcId){
 const quest=definitions(state).find(q=>questBeneficiaryForNPC(q,npcId));if(!quest)return undefined;
 return {questId:quest.id,beneficiaryId:questBeneficiaryForNPC(quest,npcId).id,selectedBeneficiaryId:selectedQuestBeneficiary(state,quest)??null,firstDeliveryLocks:true,
  beneficiaries:quest.beneficiaries.map(({id,npcId,sector,reward})=>({id,npcId,sector,reward:structuredClone(reward)}))};
}
