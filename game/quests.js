import {extractItemQuantity,SUPPLY_ITEMS} from './tactical-inventory.js';
import {validateOutfit} from './outfits.js';
// Authored errands use physical delivery receipts or adjacent NPC dialogue.
export const NPC_QUESTS=[
 {id:'jujuy-arriero',npcId:'local-jujuy',sector:'jujuy',title:'Escolta hasta la salida de la Quebrada',cost:{},escort:{edge:'W',destination:'humahuaca'},requiredSectors:['jujuy','humahuaca'],offer:'Acompañame hasta la salida occidental de Jujuy, hacia Humahuaca. Allí me reuniré con la recua. Seguiré al combatiente que acepte; hablame si debo esperar o seguir a otra persona. El camino debe estar bajo control patriota.',delivery:'Llegamos a la salida de la Quebrada. Esperaré aquí a la recua. El pueblo recordará tu ayuda.'},
 {id:'tucuman-vendas',npcId:'local-tucuman',sector:'tucuman',title:'Vendas para la Ciudadela',cost:{},carried:{item:'medkits',count:3,label:'Vendas',instruction:'Llevá las vendas restantes. Seleccioná la cantidad en tu inventario y entregásela al oficial.'},requiredSectors:['tucuman'],offer:'Necesitamos tres vendas para atender a los heridos de la Ciudadela. Traelas en tu equipo y entregámelas. Podemos recibirlas por separado.',delivery:'Recibimos las tres vendas para los heridos. La ciudad reconoce tu ayuda.'},
 {id:'retiro-uniformes',npcId:'local-retiro',sector:'retiro',title:'Abrigo para los nuevos reclutas',cost:{},carried:{outfit:'poncho',count:2,label:'Ponchos',instruction:'Llevá los ponchos restantes. Seleccioná cada uno en el inventario y entregáselo al contacto.'},requiredSectors:['retiro'],offer:'Los nuevos reclutas pasan frío en el patio. Traé dos ponchos de lana en buen estado. Seleccioná cada uno en tu inventario y entregámelo. El Cabildo sabrá que cumpliste tu palabra.',delivery:'Recibimos los dos ponchos. Los reclutas tendrán abrigo y el vecindario recordará esta ayuda.'},
 {id:'posta-polvora',npcId:'local-san_nicolas',sector:'san_nicolas',title:'Asegurar la posta',reward:200,requiredSectors:['san_nicolas'],offer:'Liberá San Nicolás y volvé a dar el parte. El Cabildo pagará 200 pesos por restablecer el servicio de correos.',delivery:'La posta vuelve a funcionar. Recibís 200 pesos por el servicio.'},
 {id:'salta-correos',npcId:'macacha',sector:'salta',title:'Abrir la ruta del norte',reward:400,requiredSectors:['salta','jujuy'],offer:'Asegurá Salta y Jujuy y volvé a informarme. Pagaré 400 pesos cuando los enlaces puedan recorrer ambas localidades.',delivery:'Salta y Jujuy están seguras. Recibís 400 pesos por abrir la ruta.'},
];
export function questForNPC(state,npcId){const q=NPC_QUESTS.find(q=>q.npcId===npcId);return q?{...q,status:state.quests?.[q.id]?.status??'unoffered',conditionMet:q.requiredSectors.every(id=>state.sectors[id]?.owner==='patriot')}:null;}
export function validateQuests(quests,hour){
 return quests&&typeof quests==='object'&&!Array.isArray(quests)&&Object.entries(quests).every(([id,q])=>{
  if(!NPC_QUESTS.some(n=>n.id===id)||!q||!['offered','completed','failed'].includes(q.status)||!Number.isInteger(q.offeredAt)||q.offeredAt<0||q.offeredAt>hour)return false;
  const definition=NPC_QUESTS.find(n=>n.id===id);
  if(definition.escort){
   const order=q.escortOrder;
   if(order===undefined?q.status!=='failed':!order||typeof order.leaderId!=='string'||!/^\d+$/.test(order.leaderId)||typeof order.waiting!=='boolean'||Object.keys(order).some(k=>!['leaderId','waiting'].includes(k)))return false;
   if(q.status==='completed'){
    const a=q.arrival;if(!a||Object.keys(a).length!==6||!['x','y','leaderX','leaderY','width','height'].every(k=>Number.isInteger(a[k]))||a.width<1||a.width>512||a.height<1||a.height>512||(a.x<0||a.x>1||Math.min(a.x,a.leaderX)!==0)||a.y<0||a.y>=a.height||a.leaderX<0||a.leaderX>=a.width||a.leaderY<0||a.leaderY>=a.height||Math.abs(a.x-a.leaderX)+Math.abs(a.y-a.leaderY)>1)return false;
   }else if(q.arrival!==undefined)return false;
  }else if(q.escortOrder!==undefined||q.arrival!==undefined)return false;
  const date=value=>Number.isInteger(value)&&value>=q.offeredAt&&value<=hour;
  if(q.status==='failed')return q.completedAt===null&&date(q.failedAt)&&(q.failureReason===undefined||q.failureReason==='contact-dead');
  return q.failedAt===undefined&&q.failureReason===undefined&&(q.status==='offered'?q.completedAt===null:date(q.completedAt));
 });
}
// Only a recorded death ends an accepted errand. Injury, flight and temporary
// enemy occupation do not erase it, and completed deliveries remain credited.
export function failQuestsForDeadContact(campaign,sectorId,sceneId,npcId){
 if(sceneId)return [];
 const quest=NPC_QUESTS.find(q=>q.sector===sectorId&&q.npcId===npcId),record=quest&&campaign.quests?.[quest.id];
 if(record?.status!=='offered')return [];
 campaign.quests[quest.id]={...record,status:'failed',failedAt:campaign.hour,failureReason:'contact-dead'};
 return [`Encargo fallido: ${quest.title}. El contacto murió.${quest.carried?' Los objetos ya entregados no se recuperan.':''}`];
}
export function validateQuestFailures(campaign){
 for(const [id,record]of Object.entries(campaign.quests??{})){
  if(record.status!=='failed')continue;
  const quest=NPC_QUESTS.find(q=>q.id===id);
  const recordedDeath=quest&&(Object.values(campaign.civilianState?.people??{}).some(receipt=>receipt.sector===quest.sector&&receipt.sceneId===null&&receipt.npcId===quest.npcId&&receipt.health?.hp===0)||Object.values(campaign.civilianHarm?.records??{}).some(receipt=>receipt.sectorId===quest.sector&&receipt.sceneId===null&&receipt.npcId===quest.npcId&&receipt.incidents.some(event=>event.kind==='death')));
  if(!recordedDeath)throw Error('El encargo fallido no tiene un fallecimiento registrado.');
 }
}

// Accepted objects stay with the recipient, with their exact identity and wear.
// A receipt is physical ownership, not a debit against distant campaign goods.
export function validateQuestGifts(npc){
 if(npc.questGifts===undefined)return [];
 const quest=NPC_QUESTS.find(q=>q.npcId===npc.id),gifts=npc.questGifts;
 if(!quest?.carried||!Array.isArray(gifts)||gifts.length>quest.carried.count)throw Error('Las entregas del interlocutor no son válidas.');
 for(const gift of gifts){
  if(quest.carried.item){const supply=SUPPLY_ITEMS[quest.carried.item];if(!gift||gift.item!==supply.item||gift.count!==1||gift.weight!==supply.weight||Object.keys(gift).some(key=>!['item','count','weight'].includes(key)))throw Error('El suministro entregado no corresponde al encargo.');continue;}
  validateOutfit(gift,{worn:true});if(!gift||gift.outfit!==quest.carried.outfit||gift.condition<=0||gift.item!==undefined)throw Error('El objeto entregado no corresponde al encargo.');}
 return gifts;
}
// This decision is made only when a physical offer reaches the NPC. It is not
// a hover prediction, and a refusal never takes custody of the offered stack.
export function questGiftDecision(npc,stack){
 const quest=NPC_QUESTS.find(q=>q.npcId===npc?.id);
 const refuse=text=>({accepted:false,text});
 if(!quest?.carried)return refuse('Gracias, pero no necesito ese objeto.');
 const gifts=validateQuestGifts(npc);
 if(gifts.length>=quest.carried.count)return refuse('Ya recibí todos los objetos que necesitábamos. Gracias.');
 if(quest.carried.item){
  if(stack?.item!==quest.carried.item||!Number.isInteger(stack.count)||stack.count<1)return refuse('Necesitamos vendas para los heridos.');
  const remaining=quest.carried.count-gifts.length;
  if(stack.count>remaining)return refuse(`Solo faltan ${remaining} vendas. Seleccioná esa cantidad o una menor.`);
  const supply=SUPPLY_ITEMS[quest.carried.item],received=Array.from({length:stack.count},()=>({item:supply.item,count:1,weight:supply.weight}));
  return {accepted:true,gifts:[...structuredClone(gifts),...received],text:stack.count===remaining?quest.delivery:`Gracias por las vendas. Todavía faltan ${remaining-stack.count}.`};
 }
 if(stack?.kind!=='outfit'||stack.outfit!==quest.carried.outfit||!(stack.condition>0)||stack.count!==1)return refuse('Necesitamos un poncho de lana en buen estado.');
 const {item,...gift}=structuredClone(stack);validateOutfit(gift,{worn:true});
 return {accepted:true,gifts:[...structuredClone(gifts),gift],text:gifts.length+1===quest.carried.count?'Gracias. Ya tenemos los dos ponchos para los reclutas.':'Gracias por el poncho. Todavía necesitamos uno más.'};
}
export function questGiftPlan(unit,npc){
 const quest=NPC_QUESTS.find(q=>q.npcId===npc?.id);
 if(!quest?.carried)throw Error('Esta persona no necesita ese objeto.');
 if(quest.carried.item)throw Error('Seleccioná las vendas en el inventario y ofrecé la cantidad al interlocutor.');
 if(validateQuestGifts(npc).length>=quest.carried.count)throw Error('Esta persona ya recibió todos los objetos del encargo.');
 if(unit.activeSlot!=='item'||!unit.activeItem?.startsWith('inventory:'))throw Error('Poné el objeto del encargo en la mano principal.');
 const record=unit.inventory?.[unit.activeItem.slice(10)];
 if(record?.kind!=='outfit'||record.outfit!==quest.carried.outfit||record.condition<=0)throw Error('El encargo necesita un poncho de lana que todavía sirva.');
 const extracted=extractItemQuantity(unit,unit.activeItem,1),{item,...gift}=extracted.stack;
 return {unit:extracted.unit,gifts:[...(npc.questGifts??[]),gift],label:'Entregar poncho'};
}

// The notebook exposes only errands already accepted by the player. Progress
// comes from acknowledged receipts, never from unseen tactical NPC inventories.
export function questJournal(state){
 return NPC_QUESTS.flatMap(quest=>{
  const record=state.quests?.[quest.id];if(!record)return [];
  return [{...quest,...record,delivered:quest.carried?Math.min(quest.carried.count,state.conversations?.[quest.npcId]?.giftCount??0):null,
   unsecured:record.status==='offered'?quest.requiredSectors.filter(id=>state.sectors[id]?.owner!=='patriot'):[]}];
 }).sort((a,b)=>(a.status==='offered'?0:1)-(b.status==='offered'?0:1)||b.offeredAt-a.offeredAt);
}
