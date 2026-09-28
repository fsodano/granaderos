const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function validateDialogueEffects(effects){
 if(effects===undefined)return;
 need(Array.isArray(effects)&&effects.length<=1,'Cada opción admite una operación de pesos.');
 for(const e of effects)need(exact(e,['type','operation','amount'])&&e.type==='treasury'&&['pay','receive'].includes(e.operation)&&Number.isSafeInteger(e.amount)&&e.amount>=1&&e.amount<=1000000,'La operación necesita un importe entre 1 y 1000000 pesos.');
}
const amountFor=effect=>effect.amount*(effect.operation==='pay'?-1:1);
const receiptFor=(s,npc,node,choice)=>s.conversations?.[npc.id]?.dialogueReceipts?.find(r=>r.node===node&&r.choice===choice);
export function dialogueEffectQuote(s,npc,node,choice){
 const effect=choice.effects?.[0];if(!effect)return null;
 const amount=amountFor(effect),used=Boolean(receiptFor(s,npc,node,choice.id)),next=s.resources.treasury+amount;
 const reason=used?null:next<0?`Faltan ${-next} pesos.`:next>1000000000?'La tesorería no admite este importe.':null;
 return {available:!reason,reason,label:used?'Operación ya realizada':`${amount>0?'Recibir':'Pagar'} ${Math.abs(amount)} pesos · una sola vez`,used,amount};
}
export function applyDialogueEffects(s,npc,node,choice){
 const quote=dialogueEffectQuote(s,npc,node,choice);if(!quote)return null;
 need(quote.available,quote.reason);
 if(!quote.used){
  s.resources.treasury+=quote.amount;s.conversations??={};
  const record=s.conversations[npc.id]??={};
  record.dialogueReceipts=[...(record.dialogueReceipts??[]),{node,choice:choice.id,amount:quote.amount,hour:s.hour}];
 }
 return {node,choice:choice.id,amount:quote.amount,applied:!quote.used};
}
export function validateDialogueReceipts(s,graph,record){
 const receipts=record.dialogueReceipts;if(receipts===undefined)return;
 need(Array.isArray(receipts)&&receipts.length<=360,'El registro de operaciones del diálogo es inválido.');
 const seen=new Set();for(const receipt of receipts){
  need(exact(receipt,['node','choice','amount','hour']),'El registro de operaciones del diálogo es inválido.');
  const choice=graph?.nodes.find(n=>n.id===receipt.node)?.choices.find(c=>c.id===receipt.choice),key=`${receipt.node}/${receipt.choice}`;
  need(choice?.effects?.length===1&&receipt.amount===amountFor(choice.effects[0])&&Number.isSafeInteger(receipt.hour)&&receipt.hour>=0&&receipt.hour<=record.hour&&receipt.hour<=s.hour&&!seen.has(key),'La operación guardada no coincide con el diálogo.');seen.add(key);
 }
}
export function validateLastDialogueEffect(s,npc,graph,last){
 const effect=last?.dialogueEffect;if(effect===undefined)return;
 need(last.outcome==='dialogue'&&exact(effect,['node','choice','amount','applied'])&&typeof effect.applied==='boolean','La operación de la conversación guardada es inválida.');
 const receipt=receiptFor(s,npc,effect.node,effect.choice),choice=graph?.nodes.find(n=>n.id===effect.node)?.choices.find(c=>c.id===effect.choice);
 need(receipt&&receipt.amount===effect.amount&&choice?.next===last.dialogueNode,'La operación de la conversación guardada no tiene su registro.');
}
