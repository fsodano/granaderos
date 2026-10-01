import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {actBattle,createBattle,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';
export const A='cell-27-27';
export const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
export const saved=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
export const localId=s=>operativeIdForCharacter(s.contentCampaign.package,'alma-contract');
export const localNPC=b=>b.npcs.find(n=>n.contentId==='alma-contract');
export function localPackage({pay=300,service='contract',recruitable=true}={}){
 const d=defaultContentPackage(),base=structuredClone(d.characters.find(c=>c.id==='person-100'));delete base.arrivalHours;
 d.characters.push({...base,id:'alma-contract',name:'Alma Contratada',nickname:'Alma',service,monthlyPay:pay,recruitmentSource:'encounter',weapon:null,attributes:{...base.attributes,maxHp:95},encounter:{recruitable,greeting:'Trabajo por un plazo acordado.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
 d.placements.push({id:'alma-location',character:'alma-contract',mode:'fixed',sectors:[A],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});
 d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;
}
export const visit=s=>{const campaign=order(s,{type:'visitSector'});return saved({campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0},campaign.sectorStates[campaign.location])});};
export const sync=p=>{const n=syncBattleTime(p.campaign,p.battle);assert.equal(n.error,null,n.error);return {campaign:n.campaign,battle:n.battle};};
export function tactical(p,action){const battle=actBattle(p.battle,{unitId:p.battle.units.find(u=>u.side==='player').id,...action});assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});}
export function readyLocal(options,content=localPackage(options)){let s=order(initialCampaign(42,content),{type:'recruitCivic',id:110,term:'month'});s=order(s,{type:'travel',sector:A});const p=visit(s),n=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player');return sync({campaign:p.campaign,battle:approachNPC(p.battle,unit.id,n.id)});}
export const talk=(p,term='day',approach='recruit')=>({type:'talkNPC',npcId:localNPC(p.battle).id,unitId:p.battle.units.find(u=>u.side==='player').id,term,approach,sectorState:p.battle});
export function approachLocal(p){
 const actor=p.battle.units.find(u=>u.side==='player'),npc=localNPC(p.battle),movement=actor.movementMode??'walk';
 if(movement!=='run')p=tactical(p,{type:'movement',unitId:actor.id,movement:'run'});
 p=sync({campaign:p.campaign,battle:approachNPC(p.battle,actor.id,npc.id)});
 if(movement!=='run')p=tactical(p,{type:'movement',unitId:actor.id,movement});
 return p;
}
export function hireLocal(p,term='day'){
 p=approachLocal(p);
 const npc=localNPC(p.battle),campaign=order(p.campaign,talk(p,term)),id=localId(campaign),op=campaign.pendingBattle.squad.find(u=>u.id===id),battle=structuredClone(p.battle);
 battle.npcs=battle.npcs.filter(n=>n.id!==npc.id);battle.units.push({...createBattle([op],{width:8,height:8,exploration:true,enemies:[]}).units[0],x:npc.x,y:npc.y});return saved({campaign,battle});
}
export const leave=p=>{p=sync(p);return order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});};
