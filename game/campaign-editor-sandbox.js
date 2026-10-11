import {initialCampaign,dispatchCampaign,rosterFor} from './campaign.js';
import {prepareCampaignBattle} from './battle-handoff.js';
import {actBattle,endTurn,getReachable,canSee,createBattle} from './tactical.js';
import {applyQuestEscortOrders} from './quest-escort.js';
import {applyQuestWithdrawalOrders} from './quest-withdrawal.js';
import {projectDialogueMovements} from './dialogue-movement.js';
import {addIssuedGriefParticipant} from './companion-grief.js';
import {addIssuedConductObserver} from './service-objections.js';
import {syncBattleTime} from './time.js';
import {encodeSave,decodeSave} from './save.js';
import {dialogueForNPC} from './content-dialogue.js';
import {dialogueConditionsMet} from './dialogue-conditions.js';
import {characterForOperative} from './content-character-ids.js';
import {contentIdentity} from './content-identity.js';
import {wallMovementBlocked,wallEdgeCells} from './wall-geometry.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const message=error=>error instanceof Error?error.message:String(error);
// A declared test setup creates a fresh package. It never forges live quest
// states, receipts, membership or wounds in an admitted campaign snapshot.
export function createCampaignSandbox(content,seed=18130203,setup={}){
 const definitions=structuredClone(content);delete definitions.campaignOrigin;
 need(Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff,'La semilla de prueba no es válida.');
 if(setup.startingTreasury!==undefined){need(Number.isSafeInteger(setup.startingTreasury)&&setup.startingTreasury>=0&&setup.startingTreasury<=1000000000,'La tesorería de prueba no es válida.');definitions.rules={...definitions.rules,startingTreasury:setup.startingTreasury};}
 if(setup.startingTerritory!==undefined)definitions.startingTerritory=structuredClone(setup.startingTerritory);
 const campaign=initialCampaign(seed,definitions);
 return {version:1,seed,setup:structuredClone(setup),sourceIdentity:contentIdentity(content),campaign,battle:null,history:[],lastError:null};
}
function order(pair,action){const campaign=dispatchCampaign(pair.campaign,action);need(!campaign.lastError,campaign.lastError);return {...pair,campaign};}
function synchronize(pair,battle){need(!battle.lastError,battle.lastError);const next=syncBattleTime(pair.campaign,battle);need(!next.error,next.error);return {...pair,campaign:next.campaign,battle:next.battle};}
// Project the conversation's admitted orders into the active scene, just as
// the live game does. A local hire changes physical custody and must enter
// the squad at the contact's actual position before saving or leaving.
function projectConversation(pair,npcId){
 const {campaign,battle}=pair;
 let next=applyQuestWithdrawalOrders(campaign,projectDialogueMovements(campaign,applyQuestEscortOrders(campaign,battle)));
 if(campaign.lastConversation?.outcome==='recruited'){
  const id=campaign.lastConversation.operativeId,npc=battle.npcs.find(n=>n.id===npcId),record=campaign.pendingBattle.squad.find(o=>o.id===id);
  need(npc&&record,'La contratación perdió al personaje presente.');
  next=structuredClone(next);next.npcs=next.npcs.filter(n=>n.id!==npcId);
  if(!next.units.some(u=>Number(u.id)===id)){
   const unit=createBattle([record],{width:battle.width,height:battle.height,enemies:[],exploration:true}).units.find(u=>u.side==='player');
   need(unit,'No se pudo incorporar al personaje contratado.');
   const joined={...unit,x:npc.x,y:npc.y};next.units.push(joined);addIssuedGriefParticipant(next,joined);addIssuedConductObserver(next,joined);
  }
 }
 return {...pair,battle:next};
}
function leave(pair){
 need(pair.battle&&pair.campaign.pendingBattle,'Primero entrá en un sector.');
 need(pair.campaign.pendingBattle.exploration,'Terminá el combate en la vista táctica antes de volver.');
 const next=order(pair,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});return {...next,battle:null};
}
function approach(pair,unitId,npcId){
 need(pair.battle,'Primero entrá en un sector.');
 need(pair.battle.mode==='exploration','Acercate desde la vista táctica durante el combate.');
 for(let i=0;i<240;i++){
  const battle=pair.battle,actor=battle.units.find(u=>u.id===String(unitId)),npc=battle.npcs?.find(n=>n.id===npcId);
  need(actor&&npc,'Elegí un combatiente y un interlocutor presentes.');
  if(Math.abs(actor.x-npc.x)+Math.abs(actor.y-npc.y)<=1&&!wallMovementBlocked(battle,actor,npc)){
   if(canSee(battle,actor,npc))return pair;
   pair=synchronize(pair,actBattle(battle,{type:'look',unitId:actor.id,x:npc.x,y:npc.y}));continue;
  }
  if(actor.hp>=15&&actor.energy<10){pair=synchronize(pair,endTurn(battle));continue;}
  const reachable=getReachable(battle,actor),adjacent=reachable.filter(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1&&!wallMovementBlocked(battle,p,npc)).sort((a,b)=>a.cost-b.cost)[0];
  let action;
  if(adjacent?.path.length)action={type:'move',unitId:actor.id,...adjacent.path[0]};
  else{
   const doors=(battle.wallEdges??[]).filter(d=>d.type==='door'&&!d.open&&!d.locked&&!d.jammed&&!d.destroyed);
   const next=doors.flatMap(door=>reachable.filter(p=>wallEdgeCells(door).some(c=>c.x===p.x&&c.y===p.y&&(c.tacticalLevel??0)===(p.tacticalLevel??0))).map(p=>({door,p}))).sort((a,b)=>(a.p.cost+Math.abs(a.door.x-npc.x)+Math.abs(a.door.y-npc.y))-(b.p.cost+Math.abs(b.door.x-npc.x)+Math.abs(b.door.y-npc.y)))[0];
   need(next,'No hay un camino libre hasta el interlocutor. Usá la vista táctica para abrir paso.');
   action=next.p.path.length?{type:'move',unitId:actor.id,...next.p.path[0]}:{type:'door',unitId:actor.id,doorId:next.door.doorId};
  }
  pair=synchronize(pair,actBattle(battle,action));
 }
 throw Error('No se llegó al interlocutor en 240 pasos. Usá la vista táctica.');
}
/** Execute the same strategic/tactical actions used by the live game. Failed
 * actions retain the original state; a bounded approach retains completed
 * physical steps only when it succeeds as a command. */
export function dispatchCampaignSandbox(state,action){
 try{
  need(state?.version===1&&state.history.length<2000,'La prueba alcanzó su límite. Reiniciala.');
  let next={...state,lastError:null};
  if(action.type==='enter'){
   next=order(next,{type:'visitSector',sector:action.sector??next.campaign.location});const pair=prepareCampaignBattle(next.campaign);need(!pair.error,pair.error);next={...next,campaign:pair.campaign,battle:pair.battle};
  }else if(action.type==='finish'){
   if(next.campaign.pendingBattle?.exploration)next=leave(next);
   else{const battle=next.battle;need(battle,'No hay una batalla abierta.');next=order(next,{type:'battleResult',battleId:next.campaign.pendingBattle.id,outcome:battle.status==='retreat'?'retreat':battle.sectorCleared?'victory':battle.status,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});next={...next,battle:null};}
  }else if(action.type==='leave')next=leave(next);
  else if(action.type==='wait'){
   if(next.battle)next=leave(next);
   next=order(next,{type:'wait',hours:action.hours});
  }else if(action.type==='approach')next=approach(next,action.unitId,action.npcId);
  else if(action.type==='talk'){
   need(next.battle,'Primero entrá en un sector.');
   next=order(next,{type:'talkNPC',npcId:action.npcId,unitId:action.unitId,approach:action.approach??'dialogue',...(action.term?{term:action.term}:{}),...(action.choice?{dialogueChoice:action.choice,dialogueNode:action.node}:{}),...(action.questResolution?{questResolution:action.questResolution}:{}),...(action.questWithdrawal?{questWithdrawal:action.questWithdrawal}:{}),sectorState:next.battle});
   next=projectConversation(next,action.npcId);
  }else if(action.type==='tactical')next=synchronize(next,action.order?.type==='endTurn'?endTurn(next.battle):actBattle(next.battle,action.order));
  else{next=order(next,action);if(next.campaign.pendingBattle&&!next.battle){const pair=prepareCampaignBattle(next.campaign);need(!pair.error,pair.error);next={...next,campaign:pair.campaign,battle:pair.battle};}}
  return {...next,history:[...state.history,{action:structuredClone(action),hour:next.campaign.hour,second:next.campaign.secondOfHour??0,treasury:next.campaign.resources.treasury}],lastError:null};
 }catch(error){return {...state,lastError:message(error)};}
}
export function adoptCampaignSandboxBattle(state,battle){
 try{return {...synchronize(state,battle),lastError:null};}catch(error){return {...state,lastError:message(error)};}
}
export function campaignSandboxDialogues(state){
 if(!state?.battle)return [];
 return (state.battle.npcs??[]).flatMap(npc=>{
  const dialogue=dialogueForNPC(state.campaign,npc,state.battle);if(!dialogue)return [];
  const graph=characterForOperative(state.campaign,npc.operativeId)?.encounter?.dialogue,node=graph.nodes.find(n=>n.id===dialogue.node);
  return [{npc,dialogue,choices:node.choices.map(choice=>({choice,conditions:(choice.conditions??[]).map(condition=>({condition,met:dialogueConditionsMet(state.campaign,[condition],state.battle)})),available:dialogue.choices.find(c=>c.id===choice.id)??null}))}];
 });
}
export function encodeCampaignSandbox(state){
 need(state?.version===1,'La prueba no es válida.');
 return JSON.stringify({format:'granaderos-editor-sandbox',version:1,seed:state.seed,setup:state.setup,sourceIdentity:state.sourceIdentity,history:state.history,save:encodeSave(state.campaign,state.battle)},null,2);
}
export function decodeCampaignSandbox(text,content){
 const value=JSON.parse(text);need(value?.format==='granaderos-editor-sandbox'&&value.version===1&&Array.isArray(value.history)&&value.history.length<=2000,'El archivo no es una prueba del taller.');
 need(value.sourceIdentity?.hash===contentIdentity(content).hash,'La prueba pertenece a otro contenido. Reiniciala con el proyecto actual.');
 const expected=createCampaignSandbox(content,value.seed,value.setup??{}),pair=decodeSave(value.save);
 need(pair.campaign.contentCampaign?.identity.hash===expected.campaign.contentCampaign.identity.hash,'La partida de prueba no corresponde a su configuración.');
 return {...expected,...pair,history:value.history,lastError:null};
}
export function campaignSandboxActors(state){return rosterFor(state.campaign);}
