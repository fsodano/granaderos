import {contentCellIds} from './content-map.js';
import {characterForOperative,isWorldCharacter} from './content-character-ids.js';
import {npcRoutes} from './npc-ai.js';
import {wallMovementBlocked} from './wall-geometry.js';
const need=(ok)=>{if(!ok)throw Error('La orden de movimiento del diálogo es inválida.');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const time=s=>s.hour*3600+(s.secondOfHour??0);
const character=(s,n)=>characterForOperative(s,n.operativeId)?.id;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function movementQuote(s,battle,effect,speaker){
 const definition=s.contentCampaign?.package.characters.find(c=>c.id===effect.character),name=definition?.name??effect.character;
 const fail=reason=>({reason,label:effect.destination==='routine'?`Terminar el encuentro de ${name}`:`Llamar a ${name}`});
 if(!battle||battle.sceneId)return fail('Entrá al sector para dar esta orden.');
 const actor=battle.npcs?.find(n=>character(s,n)===effect.character),host=battle.npcs?.find(n=>n.id===speaker.id);
 if(!actor||!host||actor===host&&effect.destination!=='routine'||actor.hp<=0||actor.unconscious||actor.departure||actor.surrendered||actor.mission||host.hp<=0)return fail(`${name} debe estar consciente y disponible en este sector.`);
 if((s.dialogueMovements?.length??0)>=1000)return fail('Se alcanzó el límite de movimientos de esta campaña.');
 if(effect.destination==='routine')return actor.scriptedMove?{reason:null,label:`${name} retoma su rutina · una sola vez`,target:null,revision:actor.presenceRevision,character:effect.character,sector:battle.sectorId}:fail(`${name} no tiene un encuentro pendiente.`);
 const routes=npcRoutes(battle,actor,{stopWhen:(p,t)=>Math.abs(p.x-host.x)+Math.abs(p.y-host.y)===1&&t?.type!=='door'&&!wallMovementBlocked(battle,p,host)}),target=[...routes.records.values()].filter(p=>Math.abs(p.x-host.x)+Math.abs(p.y-host.y)===1&&routes.tiles.get(`${p.x},${p.y}`)?.type!=='door'&&!wallMovementBlocked(battle,p,host)).sort((a,b)=>a.path.length-b.path.length||a.y-b.y||a.x-b.x)[0];
 if(!target)return fail(`No hay un camino libre para que ${name} llegue al encuentro.`);
 return {reason:null,label:`Llamar a ${name} a este lugar · una sola vez`,target:{x:target.x,y:target.y},revision:actor.presenceRevision,character:effect.character,sector:battle.sectorId};
}
export function recordDialogueMovement(s,npc,node,choice,quote){
 need(!quote.reason);
 s.dialogueMovements??=[];
 s.dialogueMovements.push({npc:npc.id,node,choice:choice.id,character:quote.character,sector:quote.sector,revision:quote.revision,target:quote.target,hour:s.hour,secondOfHour:s.secondOfHour??0});
}
function orderFor(s,scene,n){
 const id=character(s,n),sector=scene.sectorId??scene.sector;
 if(scene.sceneId||s.recruited.includes(Number(n.operativeId)))return undefined;
 const orders=s.dialogueMovements??[];
 for(let i=orders.length-1;i>=0;i--){const o=orders[i];if(o.character===id&&o.sector===sector&&o.revision===n.presenceRevision)return o.target===null?undefined:{order:i,target:{...o.target}};}
}
// This is current physical presence, not a timer or a historical completion flag.
export function atDialogueMeeting(s,characterId,battle){
 const request=s.pendingBattle;
 if(!request||!battle||battle.sceneId||battle.sectorId!==request.sector||battle.battleId&&battle.battleId!==request.id)return false;
 const person=s.contentPresence?.people[characterId],n=battle.npcs?.find(n=>character(s,n)===characterId);
 if(!person?.alive||person.recruited||!n||person.revision!==n.presenceRevision||n.hp<=0||n.unconscious||n.departure||n.surrendered||n.ai?.threat&&(battle.elapsedSeconds??0)<n.ai.safeAfter)return false;
 const order=orderFor(s,battle,n);
 return Boolean(order&&same(n.scriptedMove,order)&&n.x===order.target.x&&n.y===order.target.y);
}
export function applyDialogueMovements(s,scene){
 for(const n of scene.npcs??[]){const order=orderFor(s,scene,n);if(order)n.scriptedMove=order;else if(n.scriptedMove){delete n.scriptedMove;if(n.ai){delete n.ai.destination;n.ai.wait=0;if(!n.ai.threat)n.ai.activity='roaming';}}}
 return scene;
}
export function projectDialogueMovements(s,battle){return s.dialogueMovements?.length?applyDialogueMovements(s,structuredClone(battle)):battle;}
export function synchronizeDialogueMovements(s){
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(s.pendingBattle?[s.pendingBattle]:[])])applyDialogueMovements(s,scene);
}
export function validateMovementScene(s,scene){
 for(const n of scene.npcs??[])need(same(n.scriptedMove,orderFor(s,scene,n)));
}
export function validateDialogueMovements(s,npcs){
 const orders=s.dialogueMovements??[];need(Array.isArray(orders)&&orders.length<=1000);
 const seen=new Set();let previous=0;
 for(const o of orders){
  need(exact(o,['npc','node','choice','character','sector','revision','target','hour','secondOfHour']));
  const source=npcs.find(n=>n.id===o.npc),owner=source&&characterForOperative(s,source.operativeId),choice=owner?.encounter?.dialogue?.nodes.find(n=>n.id===o.node)?.choices.find(c=>c.id===o.choice),effect=choice?.effects?.find(e=>e.type==='movement');
  const definition=s.contentCampaign?.package.characters.find(c=>c.id===o.character),placement=s.contentCampaign?.package.placements.find(p=>p.character===o.character),person=s.contentPresence?.people[o.character];
  const receipt=s.conversations?.[o.npc]?.dialogueReceipts?.find(r=>r.node===o.node&&r.choice===o.choice),key=`${o.npc}/${o.node}/${o.choice}`;
  need(effect?.character===o.character&&definition&&isWorldCharacter(definition)&&(effect.destination==='routine'||owner.id!==o.character)&&receipt?.hour===o.hour&&!seen.has(key));seen.add(key);
  need((effect.destination==='routine'?o.target===null:exact(o.target,['x','y'])&&integer(o.target.x,0,127)&&integer(o.target.y,0,127))&&integer(o.hour,0,s.hour)&&integer(o.secondOfHour,0,3599)&&time(o)>=previous&&time(o)<=time(s));previous=time(o);
  need(placement&&integer(o.revision,1,person?.revision??0)&&typeof o.sector==='string'&&contentCellIds(placement.sectors).includes(contentCellIds([o.sector])[0]));
 }
 for(const [npc,record]of Object.entries(s.conversations??{})){
  const source=npcs.find(n=>n.id===npc),owner=source&&characterForOperative(s,source.operativeId);
  for(const r of record.dialogueReceipts??[]){const c=owner?.encounter?.dialogue?.nodes.find(n=>n.id===r.node)?.choices.find(c=>c.id===r.choice);if(c?.effects?.some(e=>e.type==='movement'))need(seen.has(`${npc}/${r.node}/${r.choice}`));}
 }
 for(const scene of [...Object.values(s.sectorStates),...Object.values(s.sceneStates),...(s.pendingBattle?[s.pendingBattle]:[])])validateMovementScene(s,scene);
}
