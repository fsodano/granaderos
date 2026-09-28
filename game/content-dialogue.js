import {characterForOperative} from './content-character-ids.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,59}$/.test(v)&&!['constructor','prototype'].includes(v);
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const fields=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function validateDialogue(graph){
 need(fields(graph,['entry','nodes'])&&id(graph.entry)&&Array.isArray(graph.nodes)&&graph.nodes.length>=1&&graph.nodes.length<=30,'El diálogo necesita un comienzo y entre 1 y 30 pasajes.');
 const ids=new Set();
 for(const node of graph.nodes){
  need(fields(node,['id','title','text','choices'])&&id(node.id)&&!ids.has(node.id)&&text(node.title,80)&&text(node.text,1000)&&Array.isArray(node.choices)&&node.choices.length<=12,'Cada pasaje necesita identidad, título, texto y hasta 12 opciones válidas.');ids.add(node.id);
  const choices=new Set();for(const c of node.choices){need(fields(c,['id','label','next'])&&id(c.id)&&!choices.has(c.id)&&text(c.label,160)&&id(c.next),'Las opciones del diálogo no son válidas.');choices.add(c.id);}
 }
 need(ids.has(graph.entry)&&graph.nodes.every(n=>n.choices.every(c=>ids.has(c.next))),'El comienzo o un destino del diálogo no existe.');

}
const definition=(s,npc)=>characterForOperative(s,npc?.operativeId)?.encounter?.dialogue;
export function dialogueForNPC(s,npc){
 const graph=definition(s,npc);if(!graph)return null;
 const node=graph.nodes.find(n=>n.id===(s.conversations?.[npc.id]?.dialogueNode??graph.entry));
 need(node,'El pasaje guardado no pertenece al diálogo.');
 return {node:node.id,text:node.text,choices:node.choices.map(c=>({id:c.id,label:c.label}))};
}
export function chooseDialogue(s,npc,choice,expectedNode){
 const current=dialogueForNPC(s,npc);need(current,'Este habitante no tiene un diálogo con opciones.');
 if(choice===undefined){need(expectedNode===undefined,'Falta la opción del diálogo.');return current;}
 need(expectedNode===current.node,'La conversación cambió. Elegí una opción del pasaje actual.');
 const graph=definition(s,npc),node=graph.nodes.find(n=>n.id===current.node),selected=node.choices.find(c=>c.id===choice);need(selected,'Esa opción no pertenece al pasaje actual.');
 const next=graph.nodes.find(n=>n.id===selected.next);return {node:next.id,text:next.text,choices:next.choices.map(c=>({id:c.id,label:c.label}))};
}
export function validateSavedDialogues(s,npcs){
 for(const [npcId,record]of Object.entries(s.conversations??{})){
  const npc=npcs.find(n=>n.id===npcId),graph=definition(s,npc);
  if(record.dialogueNode!==undefined)need(graph?.nodes.some(n=>n.id===record.dialogueNode),'El pasaje guardado no pertenece al diálogo.');
  if(record.lastApproach==='dialogue')need(record.dialogueNode!==undefined&&graph,'Falta el pasaje de la conversación guardada.');
 }
 const last=s.lastConversation;if(last?.outcome!=='dialogue')return;
 const npc=npcs.find(n=>n.id===last.npcId),current=dialogueForNPC(s,npc);
 need(current&&last.dialogueNode===current.node&&last.text===current.text&&s.conversations[last.npcId]?.lastApproach==='dialogue','El texto guardado no coincide con el diálogo del habitante.');
}
