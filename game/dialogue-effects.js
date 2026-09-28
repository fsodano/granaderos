import {movementQuote,recordDialogueMovement} from './dialogue-movement.js';
import {questTransitionQuote,applyQuestTransition,QUEST_STATE_LABELS} from './content-quests.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function validateDialogueEffects(effects,quests,characters){
 if(effects===undefined)return;
 need(Array.isArray(effects)&&effects.length<=3,'Cada opción admite pesos, un encargo y un movimiento.');
 const types=new Set();for(const e of effects){
  need(object(e)&&!types.has(e.type),'Las operaciones del diálogo no pueden repetirse.');types.add(e.type);
  if(e.type==='treasury')need(exact(e,['type','operation','amount'])&&['pay','receive'].includes(e.operation)&&Number.isSafeInteger(e.amount)&&e.amount>=1&&e.amount<=1000000,'La operación necesita un importe entre 1 y 1000000 pesos.');
  else if(e.type==='movement')need(exact(e,['type','character','destination'])&&characters?.has(e.character)&&e.destination==='speaker','El movimiento necesita un personaje y el destino del encuentro.');
  else need(e.type==='quest'&&exact(e,['type','quest','status'])&&quests?.has(e.quest)&&['active','completed','failed'].includes(e.status),'La operación necesita un encargo y un estado válidos.');
 }
}
const amountFor=effect=>effect?effect.amount*(effect.operation==='pay'?-1:1):0;
const receiptFor=(s,npc,node,choice)=>s.conversations?.[npc.id]?.dialogueReceipts?.find(r=>r.node===node&&r.choice===choice);
export function dialogueEffectQuote(s,npc,node,choice,battle=null){
 if(!choice.effects?.length)return null;
 const money=choice.effects.find(e=>e.type==='treasury'),quest=choice.effects.find(e=>e.type==='quest'),transition=quest?questTransitionQuote(s,quest):null;
 const amount=amountFor(money),used=Boolean(receiptFor(s,npc,node,choice.id)),next=s.resources.treasury+amount;
 const movement=choice.effects.find(e=>e.type==='movement'),move=movement&&!used?movementQuote(s,battle,movement,npc):null;
 const reason=used?null:next<0?`Faltan ${-next} pesos.`:next>1000000000?'La tesorería no admite este importe.':transition?.reason??move?.reason??null;
 const labels=[...(move?[move.label]:[]),...(money?[`${amount>0?'Recibir':'Pagar'} ${Math.abs(amount)} pesos · una sola vez`]:[]),...(transition?[`${transition.quest.title}: ${QUEST_STATE_LABELS[quest.status]}${quest.status==='active'&&transition.quest.deadlineHours!=null?` · plazo de ${transition.quest.deadlineHours} h`:''}`]:[])];
 return {available:!reason,reason,label:used?'Operación ya realizada':labels.join(' · '),used,amount,...(movement?{movement:{character:movement.character,name:s.contentCampaign.package.characters.find(c=>c.id===movement.character).name}}:{}),...(quest?{quest:{id:quest.quest,title:transition.quest.title,status:quest.status}}:{})};
}
export function applyDialogueEffects(s,npc,node,choice,battle=null){
 const quote=dialogueEffectQuote(s,npc,node,choice,battle);if(!quote)return null;
 need(quote.available,quote.reason);
 if(!quote.used){
  const movement=choice.effects.find(e=>e.type==='movement');if(movement)recordDialogueMovement(s,npc,node,choice,movementQuote(s,battle,movement,npc));
  const quest=choice.effects.find(e=>e.type==='quest');if(quest)applyQuestTransition(s,quest,{npc:npc.id,node,choice:choice.id});
  s.resources.treasury+=quote.amount;s.conversations??={};
  const record=s.conversations[npc.id]??={};
  record.dialogueReceipts=[...(record.dialogueReceipts??[]),{node,choice:choice.id,amount:quote.amount,hour:s.hour}];
 }
 return {node,choice:choice.id,amount:quote.amount,applied:!quote.used,...(quote.movement?{movement:quote.movement}:{}),...(quote.quest?{quest:quote.quest}:{})};
}
export function validateDialogueReceipts(s,graph,record){
 const receipts=record.dialogueReceipts;if(receipts===undefined)return;
 need(Array.isArray(receipts)&&receipts.length<=360,'El registro de operaciones del diálogo es inválido.');
 const seen=new Set();for(const receipt of receipts){
  need(exact(receipt,['node','choice','amount','hour']),'El registro de operaciones del diálogo es inválido.');
  const choice=graph?.nodes.find(n=>n.id===receipt.node)?.choices.find(c=>c.id===receipt.choice),key=`${receipt.node}/${receipt.choice}`;
  need(choice?.effects?.length>0&&receipt.amount===amountFor(choice.effects.find(e=>e.type==='treasury'))&&Number.isSafeInteger(receipt.hour)&&receipt.hour>=0&&receipt.hour<=record.hour&&receipt.hour<=s.hour&&!seen.has(key),'La operación guardada no coincide con el diálogo.');seen.add(key);
 }
}
export function validateLastDialogueEffect(s,npc,graph,last){
 const effect=last?.dialogueEffect;if(effect===undefined)return;
 need(last.outcome==='dialogue'&&exact(effect,['node','choice','amount','applied',...(effect.movement===undefined?[]:['movement']),...(effect.quest===undefined?[]:['quest'])])&&typeof effect.applied==='boolean','La operación de la conversación guardada es inválida.');
 const receipt=receiptFor(s,npc,effect.node,effect.choice),choice=graph?.nodes.find(n=>n.id===effect.node)?.choices.find(c=>c.id===effect.choice);
 need(receipt&&receipt.amount===effect.amount&&choice?.next===last.dialogueNode,'La operación de la conversación guardada no tiene su registro.');
 const movement=choice.effects.find(e=>e.type==='movement'),person=s.contentCampaign?.package.characters.find(c=>c.id===movement?.character);
 need(movement?exact(effect.movement,['character','name'])&&effect.movement.character===movement.character&&effect.movement.name===person?.name:effect.movement===undefined,'El movimiento guardado no coincide con el diálogo.');
 const quest=choice.effects.find(e=>e.type==='quest'),definition=s.contentCampaign?.package.quests?.find(q=>q.id===quest?.quest);
 need(quest?exact(effect.quest,['id','title','status'])&&effect.quest.id===quest.quest&&effect.quest.title===definition?.title&&effect.quest.status===quest.status:effect.quest===undefined,'El resultado guardado del encargo no coincide con el diálogo.');
}
