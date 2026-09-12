import {extractItemQuantity} from './tactical-inventory.js';
import {validateOutfit} from './outfits.js';
// Authored municipal errands. Completion is handled only by adjacent NPC dialogue.
export const NPC_QUESTS=[
 {id:'retiro-uniformes',npcId:'local-retiro',sector:'retiro',title:'Abrigo para los nuevos reclutas',cost:{},carried:{outfit:'poncho',count:2},requiredSectors:['retiro'],offer:'Los nuevos reclutas pasan frío en el patio. Traé dos ponchos de lana en buen estado. Poné cada uno en la mano y entregámelo; después confirmamos el encargo. El Cabildo sabrá que cumpliste tu palabra.',delivery:'Recibimos los dos ponchos. Los reclutas tendrán abrigo y el vecindario recordará esta ayuda.'},
 {id:'posta-polvora',npcId:'local-san_nicolas',sector:'san_nicolas',title:'Pólvora para la guardia de la posta',cost:{powder:5},requiredSectors:['san_nicolas'],offer:'La guardia de la posta necesita cinco cargas de pólvora para proteger a los correos. Volvé con esos pertrechos y podremos mantener abierto el relevo.',delivery:'La guardia recibe las cinco cargas. Los correos pueden contar con nuestra protección.'},
 {id:'salta-correos',npcId:'macacha',sector:'salta',title:'Monturas y armas para los enlaces del norte',cost:{muskets:5,horses:2},requiredSectors:['salta','jujuy'],offer:'Mis enlaces necesitan cinco mosquetes y dos caballos de remuda. Asegurá Salta y Jujuy antes de entregarlos: no mandaré a nadie por un camino ocupado.',delivery:'Las armas y las remudas ya están con los enlaces. Salta y Jujuy podrán sostener sus comunicaciones.'},
];
export function questForNPC(state,npcId){const q=NPC_QUESTS.find(q=>q.npcId===npcId);return q?{...q,status:state.quests?.[q.id]?.status??'unoffered',conditionMet:q.requiredSectors.every(id=>state.sectors[id]?.owner==='patriot')}:null;}
export function validateQuests(quests,hour){return quests&&typeof quests==='object'&&!Array.isArray(quests)&&Object.entries(quests).every(([id,q])=>NPC_QUESTS.some(n=>n.id===id)&&q&&['offered','completed'].includes(q.status)&&Number.isInteger(q.offeredAt)&&q.offeredAt>=0&&q.offeredAt<=hour&&(q.status==='offered'?q.completedAt===null:Number.isInteger(q.completedAt)&&q.completedAt>=q.offeredAt&&q.completedAt<=hour));}

// Accepted objects stay with the recipient, with their exact identity and wear.
// A receipt is physical ownership, not a debit against distant campaign goods.
export function validateQuestGifts(npc){
 if(npc.questGifts===undefined)return [];
 const quest=NPC_QUESTS.find(q=>q.npcId===npc.id),gifts=npc.questGifts;
 if(!quest?.carried||!Array.isArray(gifts)||gifts.length>quest.carried.count)throw Error('Las entregas del interlocutor no son válidas.');
 for(const gift of gifts){validateOutfit(gift,{worn:true});if(!gift||gift.outfit!==quest.carried.outfit||gift.condition<=0||gift.item!==undefined)throw Error('El objeto entregado no corresponde al encargo.');}
 return gifts;
}
export function questGiftPlan(unit,npc){
 const quest=NPC_QUESTS.find(q=>q.npcId===npc?.id);
 if(!quest?.carried)throw Error('Esta persona no necesita ese objeto.');
 if(validateQuestGifts(npc).length>=quest.carried.count)throw Error('Esta persona ya recibió todos los objetos del encargo.');
 if(unit.activeSlot!=='item'||!unit.activeItem?.startsWith('inventory:'))throw Error('Poné el objeto del encargo en la mano principal.');
 const record=unit.inventory?.[unit.activeItem.slice(10)];
 if(record?.kind!=='outfit'||record.outfit!==quest.carried.outfit||record.condition<=0)throw Error('El encargo necesita un poncho de lana que todavía sirva.');
 const extracted=extractItemQuantity(unit,unit.activeItem,1),{item,...gift}=extracted.stack;
 return {unit:extracted.unit,gifts:[...(npc.questGifts??[]),gift],label:'Entregar poncho'};
}
