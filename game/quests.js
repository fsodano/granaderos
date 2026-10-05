import {extractItemQuantity,SUPPLY_ITEMS} from './tactical-inventory.js';
import {boundaryMatches} from './tactical-exits.js';
import {validateOutfit} from './outfits.js';
import {cityForSector,CITY_LOYALTY_REWARDS} from './cities.js';
import {questWithdrawalChoice} from './quest-withdrawal.js';
import {questContactIds,questBeneficiaryForNPC,selectedQuestBeneficiary} from './quest-beneficiaries.js';
// Authored errands use physical delivery receipts or adjacent NPC dialogue.
export const NPC_QUESTS=[
 {id:'jujuy-arriero',npcId:'local-jujuy',sector:'jujuy',title:'Escolta hasta la salida de la Quebrada',cost:{},escort:{edge:'W',destination:'humahuaca'},requiredSectors:['jujuy','humahuaca'],offer:'Acompañame hasta la salida occidental de Jujuy, hacia Humahuaca. Allí me reuniré con la recua. Seguiré al combatiente que acepte; hablame si debo esperar o seguir a otra persona. El camino debe estar bajo control patriota.',delivery:'Llegamos a la salida de la Quebrada. Esperaré aquí a la recua. El pueblo recordará tu ayuda.'},
 {id:'tucuman-vendas',npcId:'local-tucuman',sector:'tucuman',title:'Vendas para la Ciudadela',cost:{},carried:{item:'medkits',count:3,label:'Vendas',instruction:'Llevá las vendas restantes. Seleccioná la cantidad en tu inventario y entregásela al oficial.'},requiredSectors:['tucuman'],offer:'Necesitamos tres vendas para atender a los heridos de la Ciudadela. Traelas en tu equipo y entregámelas. Podemos recibirlas por separado.',delivery:'Recibimos las tres vendas para los heridos. La ciudad reconoce tu ayuda.'},
 {id:'retiro-uniformes',npcId:'local-retiro',sector:'retiro',title:'Abrigo para los nuevos reclutas',cost:{},carried:{outfit:'poncho',count:2,label:'Ponchos',instruction:'Llevá los ponchos restantes. Seleccioná cada uno en el inventario y entregáselo al contacto.'},requiredSectors:['retiro'],offer:'Los nuevos reclutas pasan frío en el patio. Traé dos ponchos de lana en buen estado. Seleccioná cada uno en tu inventario y entregámelo. El Cabildo sabrá que cumpliste tu palabra.',delivery:'Recibimos los dos ponchos. Los reclutas tendrán abrigo y el vecindario recordará esta ayuda.'},
 {id:'posta-polvora',npcId:'local-san_nicolas',sector:'san_nicolas',title:'Asegurar la posta',reward:200,requiredSectors:['san_nicolas'],offer:'Liberá San Nicolás y volvé a dar el parte. El Cabildo pagará 200 pesos por restablecer el servicio de correos.',delivery:'La posta vuelve a funcionar. Recibís 200 pesos por el servicio.'},
 {id:'salta-correos',npcId:'macacha',sector:'salta',title:'Abrir la ruta del norte',reward:400,requiredSectors:['salta','jujuy'],offer:'Asegurá Salta y Jujuy y volvé a informarme. Pagaré 400 pesos cuando los enlaces puedan recorrer ambas localidades.',delivery:'Salta y Jujuy están seguras. Recibís 400 pesos por abrir la ruta.'},
];
export function questsFor(state={}){return state.contentCampaign?.package.errands??state.errandDefinitions??NPC_QUESTS;}
const definitionForNPC=(state,npcId)=>questsFor(state).find(q=>questContactIds(q).includes(npcId));
export function questForNPC(state,npcId){
 const q=definitionForNPC(state,npcId);if(!q)return null;
 const record=state.quests?.[q.id],status=record?.status??'unoffered';
 const beneficiary=questBeneficiaryForNPC(q,npcId),beneficiaryId=selectedQuestBeneficiary(state,q);
 const conditionMet=q.requiredSectors.every(id=>state.sectors?.[id]?.owner==='patriot')&&(q.requires??[]).every(id=>state.quests?.[id]?.status==='completed')&&(!beneficiary||state.sectors?.[beneficiary.sector]?.owner==='patriot');
 return {...q,status,conditionMet,...(q.withdrawal?{withdrawalChoice:questWithdrawalChoice(state,q,npcId)}:{}),...(beneficiary?{beneficiary,...(beneficiaryId===undefined?{}:{beneficiaryId}),resolutionReady:status==='offered'&&beneficiaryId===beneficiary.id&&conditionMet&&state.conversations?.[npcId]?.giftCount===q.carried.count}:{}),...(q.rewardChoice?{resolutionReady:status==='offered'&&conditionMet&&state.conversations?.[npcId]?.giftCount===q.carried.count,...(record?.questResolution!==undefined?{questResolution:record.questResolution}:{})}:{})};
}
// New physical receipts need acknowledgement. A complete legacy delivery can
// also finish after its conditions change; a reward choice waits for speech.
export function questGiftProgressPending(quest,count,acknowledged){
 if(quest.status==='withdrawn')return false;
 return count>acknowledged||count>0&&count===quest?.carried?.count&&!['completed','failed'].includes(quest.status)&&quest.conditionMet&&quest.rewardChoice===undefined&&quest.beneficiaries===undefined;
}
export function questResolutionReward(quest,choice){
 const reimbursement=quest?.rewardChoice?.reimbursement;
 if(!quest?.carried||!cityForSector(quest.sector)||Object.keys(quest.rewardChoice??{}).length!==1||!Object.hasOwn(quest.rewardChoice??{},'reimbursement')||!Number.isSafeInteger(reimbursement)||reimbursement<1||reimbursement>10000||quest.reward!==undefined&&(quest.reward?.treasury!==0||quest.reward?.loyalty!==false)||!['cash','civic'].includes(choice))throw Error('La resolución del encargo es inválida.');
 return choice==='cash'?{treasury:reimbursement,loyalty:false}:{treasury:0,loyalty:true};
}
export function questResolutionText(quest,choice){
 const reward=questResolutionReward(quest,choice);
 return `${quest.delivery} ${choice==='cash'?`Recibís un reintegro de ${reward.treasury} pesos.`:`Renunciás al reintegro. El apoyo de la localidad aumenta ${CITY_LOYALTY_REWARDS.quest} puntos, hasta un máximo de 100.`}`;
}
export function questBeneficiaryResolutionText(quest){
 const branch=quest.beneficiary??quest.beneficiaries?.find(b=>b.id===quest.beneficiaryId);
 if(!branch)throw Error('El destino de la entrega no es válido.');
 const effects=[branch.reward.treasury>0?`Recibís ${branch.reward.treasury} pesos.`:'',branch.reward.loyalty?`El apoyo de ${cityForSector(branch.sector).name} aumenta ${CITY_LOYALTY_REWARDS.quest} puntos, hasta un máximo de 100.`:''].filter(Boolean);
 return [branch.delivery,...effects].join(' ');
}
export function questDeliveryText(quest,count){
 if(count<quest.carried.count)return `Recibimos ${count} de ${quest.carried.count} ${quest.carried.label.toLowerCase()}. Todavía faltan objetos para completar el encargo.`;
 if(quest.beneficiaries){
  if(quest.status==='failed')return 'Recibimos todos los objetos. El encargo terminó sin recompensa.';
  if(quest.status==='completed')return questBeneficiaryResolutionText(quest);
  return quest.conditionMet===false?'Recibimos todos los objetos. Falta asegurar las localidades y completar los encargos previos antes de confirmar.':'Recibimos todos los objetos. Hablá conmigo para confirmar la entrega y mejorar el apoyo de esta localidad.';
 }
 if(quest.rewardChoice){
  if(quest.status==='failed')return 'Recibimos todos los objetos. El encargo terminó sin recompensa.';
  if(quest.status==='completed')return questResolutionText(quest,quest.questResolution);
  if(quest.conditionMet===false)return 'Recibimos todos los objetos. Falta asegurar las localidades y completar los encargos previos antes de elegir la recompensa.';
  return `Recibimos todos los objetos. Hablá conmigo para cobrar ${quest.rewardChoice.reimbursement} pesos de reintegro o renunciar al pago para mejorar el apoyo local.`;
 }
 return quest.conditionMet===false?'Recibimos todos los objetos. Falta asegurar las localidades del encargo.':quest.delivery;
}
export function validateQuests(quests,hour,state={}){
 const definitions=questsFor(state);
 return quests&&typeof quests==='object'&&!Array.isArray(quests)&&Object.entries(quests).every(([id,q])=>{
  if(!definitions.some(n=>n.id===id)||!q||!['offered','completed','failed','withdrawn'].includes(q.status)||!Number.isInteger(q.offeredAt)||q.offeredAt<0||q.offeredAt>hour)return false;
  const definition=definitions.find(n=>n.id===id);
  if(definition.beneficiaries){
   if(q.beneficiaryId!==undefined&&!definition.beneficiaries.some(b=>b.id===q.beneficiaryId))return false;
   if(q.status==='completed'&&q.beneficiaryId===undefined)return false;
  }else if(Object.hasOwn(q,'beneficiaryId'))return false;
  if(definition.rewardChoice&&q.status==='completed'){
   if(!['cash','civic'].includes(q.questResolution))return false;
  }else if(Object.hasOwn(q,'questResolution'))return false;
  if(definition.escort){
   const order=q.escortOrder;
   if(order===undefined?q.status!=='failed':!order||typeof order.leaderId!=='string'||!/^\d+$/.test(order.leaderId)||typeof order.waiting!=='boolean'||Object.keys(order).some(k=>!['leaderId','waiting'].includes(k)))return false;
   if(q.status==='completed'){
    const a=q.arrival;if(!a||Object.keys(a).length!==6||!['x','y','leaderX','leaderY','width','height'].every(k=>Number.isInteger(a[k]))||a.width<1||a.width>512||a.height<1||a.height>512||(a.x<0||a.x>=a.width||!boundaryMatches(a,a,definition.escort.edge)&&!boundaryMatches(a,{x:a.leaderX,y:a.leaderY},definition.escort.edge))||a.y<0||a.y>=a.height||a.leaderX<0||a.leaderX>=a.width||a.leaderY<0||a.leaderY>=a.height||Math.abs(a.x-a.leaderX)+Math.abs(a.y-a.leaderY)>1)return false;
   }else if(q.arrival!==undefined)return false;
  }else if(q.escortOrder!==undefined||q.arrival!==undefined)return false;
  if(q.status==='withdrawn')return Object.keys(q).every(k=>['status','offeredAt','completedAt','beneficiaryId','withdrawnAt','withdrawnSecond','withdrawal'].includes(k))&&Boolean(definition.withdrawal)&&q.completedAt===null&&q.failedAt===undefined&&q.failureReason===undefined&&Number.isInteger(q.withdrawnAt)&&q.withdrawnAt>=q.offeredAt&&q.withdrawnAt<=hour&&Number.isInteger(q.withdrawnSecond)&&q.withdrawnSecond>=0&&q.withdrawnSecond<3600&&q.withdrawal!==undefined;
  if(q.withdrawnAt!==undefined||q.withdrawnSecond!==undefined||q.withdrawal!==undefined)return false;
  const date=value=>Number.isInteger(value)&&value>=q.offeredAt&&value<=hour;
  if(q.status==='failed')return q.completedAt===null&&date(q.failedAt)&&(definition.beneficiaries?q.beneficiaryId===undefined?q.failureReason==='contacts-dead':q.failureReason==='contact-dead':q.failureReason===undefined||q.failureReason==='contact-dead');
  return q.failedAt===undefined&&q.failureReason===undefined&&(q.status==='offered'?q.completedAt===null:date(q.completedAt));
 });
}
// Only a recorded death ends an accepted errand. Injury, flight and temporary
// enemy occupation do not erase it, and completed deliveries remain credited.
export function failQuestsForDeadContact(campaign,sectorId,sceneId,npcId,atHour=campaign.hour){
 if(sceneId)return [];
 const quest=definitionForNPC(campaign,npcId),record=quest&&campaign.quests?.[quest.id];
 if(!quest)return [];
 let failureReason='contact-dead';
 if(quest.beneficiaries){
  const branch=questBeneficiaryForNPC(quest,npcId);if(campaign.contentCampaign?.package.errands===undefined&&branch?.sector!==sectorId)return [];
  if(record?.beneficiaryId===undefined){if(!quest.beneficiaries.every(b=>recordedContactDeath(campaign,b.npcId,b.sector)))return [];failureReason='contacts-dead';}
  else if(branch.id!==record.beneficiaryId)return [];
 }
 else if(campaign.contentCampaign?.package.errands===undefined&&quest.sector!==sectorId)return [];
 if(record?.status!=='offered')return [];
 campaign.quests[quest.id]={...record,status:'failed',failedAt:atHour,failureReason};
 return [`Encargo fallido: ${quest.title}. ${failureReason==='contacts-dead'?'Ambos destinatarios murieron.':'El contacto murió.'}${quest.carried?' Los objetos ya entregados no se recuperan.':''}`];
}
function recordedContactDeath(campaign,npcId,sectorId){
 const authored=campaign.contentCampaign?.package.errands!==undefined;
 return Object.values(campaign.civilianState?.people??{}).some(r=>(authored||r.sector===sectorId)&&r.sceneId===null&&r.npcId===npcId&&r.health?.hp===0)||Object.values(campaign.civilianHarm?.records??{}).some(r=>(authored||r.sectorId===sectorId)&&r.sceneId===null&&r.npcId===npcId&&r.incidents.some(e=>e.kind==='death'));
}
export function validateQuestFailures(campaign){
 for(const [id,record]of Object.entries(campaign.quests??{})){
  if(record.status!=='failed')continue;
  const quest=questsFor(campaign).find(q=>q.id===id);
  if(quest?.beneficiaries){
   const branch=quest.beneficiaries.find(b=>b.id===record.beneficiaryId);
   if(branch?record.failureReason!=='contact-dead'||!recordedContactDeath(campaign,branch.npcId,branch.sector):record.beneficiaryId!==undefined||record.failureReason!=='contacts-dead'||!quest.beneficiaries.every(b=>recordedContactDeath(campaign,b.npcId,b.sector)))throw Error('El encargo fallido no tiene los fallecimientos de sus destinatarios.');
   continue;
  }
  const branch=quest?.beneficiaries?.find(b=>b.id===record.beneficiaryId),npcId=branch?.npcId??quest?.npcId,at=branch?.sector??quest?.sector;
  const recordedDeath=quest&&(!quest.beneficiaries||branch)&&(Object.values(campaign.civilianState?.people??{}).some(receipt=>(campaign.contentCampaign?.package.errands!==undefined||receipt.sector===at)&&receipt.sceneId===null&&receipt.npcId===npcId&&receipt.health?.hp===0)||Object.values(campaign.civilianHarm?.records??{}).some(receipt=>(campaign.contentCampaign?.package.errands!==undefined||receipt.sectorId===at)&&receipt.sceneId===null&&receipt.npcId===npcId&&receipt.incidents.some(event=>event.kind==='death')));
  if(!recordedDeath)throw Error('El encargo fallido no tiene un fallecimiento registrado.');
 }
}

// Accepted objects stay with the recipient, with their exact identity and wear.
// A receipt is physical ownership, not a debit against distant campaign goods.
export function validateQuestGifts(npc,state={}){
 if(npc.questGifts===undefined)return [];
 const quest=definitionForNPC(state,npc.id),gifts=npc.questGifts;
 if(!quest?.carried||!Array.isArray(gifts)||gifts.length>quest.carried.count)throw Error('Las entregas del interlocutor no son válidas.');
 for(const gift of gifts){
  if(quest.carried.item){const supply=SUPPLY_ITEMS[quest.carried.item];if(!gift||gift.item!==supply.item||gift.count!==1||gift.weight!==supply.weight||Object.keys(gift).some(key=>!['item','count','weight'].includes(key)))throw Error('El suministro entregado no corresponde al encargo.');continue;}
  validateOutfit(gift,{worn:true});if(!gift||gift.outfit!==quest.carried.outfit||gift.condition<=0||gift.item!==undefined)throw Error('El objeto entregado no corresponde al encargo.');}
 return gifts;
}
// This decision is made only when a physical offer reaches the NPC. It is not
// a hover prediction, and a refusal never takes custody of the offered stack.
export function questGiftDecision(npc,stack,state={}){
 const quest=definitionForNPC(state,npc?.id);
 const refuse=text=>({accepted:false,text});
 if(!quest?.carried)return refuse('Gracias, pero no necesito ese objeto.');
 if(state.quests?.[quest.id]?.status==='withdrawn'||Object.hasOwn(state.questWithdrawals??{},quest.id))return refuse('El compromiso fue retirado. No acepto más objetos para este encargo.');
 const branch=questBeneficiaryForNPC(quest,npc.id),selected=selectedQuestBeneficiary(state,quest);
 if(branch&&selected!==undefined&&branch.id!==selected)return refuse('La primera entrega fijó otro destinatario. Los objetos restantes deben ir a esa persona.');
 const gifts=validateQuestGifts(npc,state);
 if(gifts.length>=quest.carried.count)return refuse('Ya recibí todos los objetos que necesitábamos. Gracias.');
 if(quest.carried.item){
  if(stack?.item!==quest.carried.item||!Number.isInteger(stack.count)||stack.count<1)return refuse(`Necesitamos ${quest.carried.label.toLowerCase()}.`);
  const remaining=quest.carried.count-gifts.length;
  if(stack.count>remaining)return refuse(`Solo faltan ${remaining} ${quest.carried.label.toLowerCase()}. Seleccioná esa cantidad o una menor.`);
  const supply=SUPPLY_ITEMS[quest.carried.item],received=Array.from({length:stack.count},()=>({item:supply.item,count:1,weight:supply.weight}));
  return {accepted:true,gifts:[...structuredClone(gifts),...received],text:stack.count===remaining?(quest.rewardChoice||branch?questDeliveryText(quest,quest.carried.count):quest.delivery):`Gracias por la entrega. Todavía faltan ${remaining-stack.count} ${quest.carried.label.toLowerCase()}.`};
 }
 if(stack?.kind!=='outfit'||stack.outfit!==quest.carried.outfit||!(stack.condition>0)||stack.count!==1)return refuse(`Necesitamos ${quest.carried.label.toLowerCase()} en buen estado.`);
 const {item,...gift}=structuredClone(stack);validateOutfit(gift,{worn:true});
 return {accepted:true,gifts:[...structuredClone(gifts),gift],text:quest.rewardChoice||branch?questDeliveryText(quest,gifts.length+1):state.errandDefinitions!==undefined?(gifts.length+1===quest.carried.count?quest.delivery:`Gracias por la entrega. Todavía faltan ${quest.carried.count-gifts.length-1}.`):(gifts.length+1===quest.carried.count?'Gracias. Ya tenemos los dos ponchos para los reclutas.':'Gracias por el poncho. Todavía necesitamos uno más.')};
}
export function questGiftPlan(unit,npc,state={}){
 const quest=definitionForNPC(state,npc?.id);
 if(!quest?.carried)throw Error('Esta persona no necesita ese objeto.');
 if(quest.carried.item)throw Error('Seleccioná las vendas en el inventario y ofrecé la cantidad al interlocutor.');
 if(validateQuestGifts(npc,state).length>=quest.carried.count)throw Error('Esta persona ya recibió todos los objetos del encargo.');
 if(unit.activeSlot!=='item'||!unit.activeItem?.startsWith('inventory:'))throw Error('Poné el objeto del encargo en la mano principal.');
 const record=unit.inventory?.[unit.activeItem.slice(10)];
 if(record?.kind!=='outfit'||record.outfit!==quest.carried.outfit||record.condition<=0)throw Error(`El encargo necesita ${quest.carried.label.toLowerCase()} en buen estado.`);
 const extracted=extractItemQuantity(unit,unit.activeItem,1),decision=questGiftDecision(npc,extracted.stack,state);
 return {unit:decision.accepted?extracted.unit:structuredClone(unit),gifts:decision.gifts,accepted:decision.accepted,text:decision.text,quest,label:`Entregar ${quest.carried.label.toLowerCase()}`,required:quest.carried.count};
}

// The notebook exposes only errands already accepted by the player. Progress
// comes from acknowledged receipts, never from unseen tactical NPC inventories.
export function questJournal(state){
 return questsFor(state).flatMap(quest=>{
  const record=state.quests?.[quest.id];if(!record)return [];
  const recipient=quest.beneficiaries?.find(b=>b.id===record.beneficiaryId),npcId=recipient?.npcId??quest.npcId;
  return [{...quest,...record,...(quest.rewardChoice||quest.beneficiaries?{resolutionReady:questForNPC(state,npcId).resolutionReady}:{}),delivered:quest.carried?Math.min(quest.carried.count,state.conversations?.[npcId]?.giftCount??0):null,
   missingQuests:(quest.requires??[]).filter(id=>state.quests?.[id]?.status!=='completed').map(id=>questsFor(state).find(q=>q.id===id)?.title??id),unsecured:record.status==='offered'?[...new Set([...quest.requiredSectors,...(recipient?[recipient.sector]:[])])].filter(id=>state.sectors[id]?.owner!=='patriot'):[]}];
 }).sort((a,b)=>(a.status==='offered'?0:1)-(b.status==='offered'?0:1)||b.offeredAt-a.offeredAt);
}
