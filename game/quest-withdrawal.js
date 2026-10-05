import {cityForSector,recordCityLoyalty} from './cities.js';
import {canonicalContent} from './content-identity.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const integer=(v,low,high)=>Number.isSafeInteger(v)&&v>=low&&v<=high;
const definitions=s=>s.contentCampaign?.package.errands??s.errandDefinitions??[];
const recipient=(q,record)=>q.beneficiaries?.find(b=>b.id===record?.beneficiaryId)??(!q.beneficiaries?{npcId:q.npcId,sector:q.sector}:null);
const stamp=s=>s.hour*3600+(s.secondOfHour??0);
export const QUEST_WITHDRAWAL_DEFAULT_COST=4; // Granaderos civic tuning, not a historical measurement.

export function questWithdrawalChoice(state,quest,npcId){
 const record=state.quests?.[quest.id],contact=recipient(quest,record),count=state.conversations?.[npcId]?.giftCount??0;
 if(!quest.withdrawal||record?.status!=='offered'||!contact||contact.npcId!==npcId||count<=0||count>=quest.carried.count)return null;
 return {questId:quest.id,...(record.beneficiaryId===undefined?{}:{beneficiaryId:record.beneficiaryId}),deliveredCount:count};
}
export function questWithdrawalText(quest,record){
 return `Retiraste el compromiso. Los objetos entregados quedan con el destinatario; conservás los restantes. El apoyo local disminuyó ${record.withdrawal.actualSupportLoss} puntos. No recibís recompensa ni reintegro.`;
}
export function initializeQuestWithdrawals(state){
 const entries=definitions(state).flatMap(q=>state.quests?.[q.id]?.status==='withdrawn'?[[q.id,state.quests[q.id].withdrawal.deliveredCount]]:[]);
 return entries.length?Object.fromEntries(entries):undefined;
}
export function validateQuestWithdrawals(map,state){
 if(map===undefined)return true;
 need(object(map)&&Object.keys(map).length>0&&Object.keys(map).length<=200,'Los retiros de entrega son inválidos.');
 for(const [id,count]of Object.entries(map)){
  const q=definitions(state).find(q=>q.id===id);
  need(q?.withdrawal&&q.carried&&integer(count,1,q.carried.count-1),'El retiro no corresponde a una entrega parcial autorizada.');
 }
 return true;
}
// An issued seal is authority only when backed by the terminal campaign receipt.
// Earlier retained scenes may precede the withdrawal, but cannot add gifts.
export function validateQuestWithdrawalContext(campaign,battle,{request=campaign.pendingBattle,retained=false,issued=false}={}){
 need(battle,'Falta el estado de la entrega retirada.');validateQuestWithdrawals(battle.questWithdrawals,campaign);
 const expected=initializeQuestWithdrawals(campaign);
 if(request){
  validateQuestWithdrawals(request.questWithdrawals,campaign);
  need(canonicalContent(request.questWithdrawals)===canonicalContent(expected),'El retiro emitido no coincide con el compromiso guardado.');
  if(request.resumeSnapshot&&request.resumeSnapshot!==battle)validateQuestWithdrawalContext(campaign,request.resumeSnapshot,{request:{...request,resumeSnapshot:undefined}});
 }
 if(!retained)need(canonicalContent(battle.questWithdrawals)===canonicalContent(expected),'El retiro de la entrega cambió o desapareció.');
 else for(const [id,count]of Object.entries(battle.questWithdrawals??{}))need(expected?.[id]===count,'La escena conserva un retiro de entrega falso.');
 if(issued)return true;
 for(const [id,count]of Object.entries(expected??{})){
  const q=definitions(campaign).find(q=>q.id===id),contact=recipient(q,campaign.quests[id]);
  need(contact,'El retiro perdió su destinatario.');
  const local=battle.npcs?.find(n=>n.id===contact.npcId);
  if(local)need(retained?(local.questGifts?.length??0)<=count:(local.questGifts?.length??0)===count,'El retiro cambió la custodia de los objetos entregados.');
 }
 return true;
}
export function applyQuestWithdrawalOrders(campaign,battle){
 const map=initializeQuestWithdrawals(campaign);
 if(canonicalContent(map)===canonicalContent(battle.questWithdrawals))return battle;
 const next={...battle};if(map===undefined)delete next.questWithdrawals;else next.questWithdrawals=map;return next;
}
export function withdrawQuest(campaign,quest,npc,unit,expected){
 const choice=questWithdrawalChoice(campaign,quest,npc.id),record=campaign.quests?.[quest.id];
 need(choice&&object(expected)&&canonicalContent(choice)===canonicalContent(expected),'La entrega cambió. Revisá el compromiso antes de retirarlo.');
 need(npc.questGifts?.length===choice.deliveredCount,'El retiro requiere la entrega parcial reconocida.');
 const contact=recipient(quest,record),cost=quest.withdrawal.supportCost;
 const result=recordCityLoyalty(campaign,{sectorId:contact.sector,kind:'questWithdrawal',eventId:`npc-${quest.id}`,delta:-cost});
 need(result.applied,'El retiro del compromiso ya fue registrado.');
 const receipt={npcId:npc.id,unitId:Number(unit.id),deliveredCount:choice.deliveredCount,actualSupportLoss:-result.delta};
 campaign.quests[quest.id]={...record,status:'withdrawn',withdrawnAt:campaign.hour,withdrawnSecond:campaign.secondOfHour??0,withdrawal:receipt};
 const map=initializeQuestWithdrawals(campaign);campaign.pendingBattle.questWithdrawals=map;
 if(campaign.pendingBattle.resumeSnapshot)campaign.pendingBattle.resumeSnapshot=applyQuestWithdrawalOrders(campaign,campaign.pendingBattle.resumeSnapshot);
 return questWithdrawalText(quest,campaign.quests[quest.id]);
}
export function validateQuestWithdrawalReceipts(campaign,roster=[]){
 const events=campaign.cityLoyaltyEvents??[],quests=definitions(campaign);
 for(const q of quests){
  const r=campaign.quests?.[q.id],event=events.find(e=>e.kind==='questWithdrawal'&&e.eventId===`npc-${q.id}`);
  if(r?.status!=='withdrawn'){need(!event,'El costo del retiro no tiene un compromiso retirado.');continue;}
  const w=r.withdrawal,contact=recipient(q,r),conversation=contact&&campaign.conversations?.[contact.npcId];
  need(q.withdrawal&&contact&&object(w)&&Object.keys(w).length===4&&['npcId','unitId','deliveredCount','actualSupportLoss'].every(k=>Object.hasOwn(w,k))&&w.npcId===contact.npcId&&integer(w.unitId,0,1e9)&&roster.some(o=>o.id===w.unitId)&&integer(w.deliveredCount,1,q.carried.count-1)&&integer(w.actualSupportLoss,0,q.withdrawal.supportCost),'El comprobante de retiro es inválido.');
  need(integer(r.withdrawnAt,r.offeredAt,campaign.hour)&&integer(r.withdrawnSecond,0,3599)&&r.withdrawnAt*3600+r.withdrawnSecond<=stamp(campaign)&&conversation?.met&&conversation.giftCount===w.deliveredCount&&conversation.hour*3600+(conversation.secondOfHour??0)>=r.withdrawnAt*3600+r.withdrawnSecond,'El retiro no tiene una entrega parcial reconocida en su fecha.');
  need(event&&event.sectorId===contact.sector&&event.cityId===cityForSector(contact.sector)?.id&&event.delta===-q.withdrawal.supportCost&&event.hour===r.withdrawnAt&&event.secondOfHour===r.withdrawnSecond&&w.actualSupportLoss===event.before-event.after&&!events.some(e=>e.kind==='quest'&&e.eventId===`npc-${q.id}`),'El retiro no coincide con su costo local y su fecha.');
 }
 for(const e of events.filter(e=>e.kind==='questWithdrawal'))need(quests.some(q=>`npc-${q.id}`===e.eventId&&campaign.quests?.[q.id]?.status==='withdrawn'),'El costo de retiro no pertenece a un encargo.');
 return true;
}
