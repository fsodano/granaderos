import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';

const content=defaultContentPackage(),base=structuredClone(content.characters.find(c=>c.id==='person-100'));
delete base.arrivalHours;
content.characters.push({...base,id:'aid-patient',name:'Paciente de la posta',nickname:'Paciente',weapon:null,
 recruitmentSource:'encounter',monthlyPay:300,attributes:{...base.attributes,maxHp:70},
 encounter:{recruitable:true,greeting:'Puedo servir por un plazo acordado.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
content.placements.push({id:'aid-location',character:'aid-patient',mode:'fixed',sectors:['buenos_aires'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});
for(const id of ['person-110','person-112'])content.characters.find(c=>c.id===id).arrivalHours=0;
// This isolated first-aid scenario declares three finite carried dressings.
content.characters.find(c=>c.id==='person-112').startingSupplies={rations:2,torches:2,medkits:3,boleadoras:1};
export const PATIENT='authored-aid-patient';
export const PATIENT_ID=operativeIdForCharacter(content,'aid-patient');
export const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
export const act=(b,a)=>{const n=actBattle(b,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
export const sync=(campaign,battle)=>{const p=syncBattleTime(campaign,battle);assert.equal(p.error,null,p.error);return {campaign:p.campaign,battle:p.battle};};
export const saved=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
export const npc=(battle,id=PATIENT)=>battle.npcs.find(n=>n.id===id);
export const record=campaign=>campaign.civilianState.people[`person-${PATIENT_ID}`];
export const aid=battle=>act(battle,{type:'useItem',unitId:'112',targetId:PATIENT,targetKind:'npc'});
export const finish=(campaign,battle)=>order(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});

export function paidVisit({sector='buenos_aires',target=PATIENT}={}){
 let campaign=initialCampaign(8,content);
 // Declared local-control checkpoint and compact treatment geometry. The
 // patient is authored as an encounter; bulletin hires remain off the map.
 if(sector!=='retiro')campaign.sectors[sector].owner='patriot';
 const cash=campaign.resources.treasury,stock=campaign.merchants.retiro.supplies.medkits;
 campaign=order(campaign,{type:'recruitCivic',id:112,term:'week'});
 assert.equal(campaign.resources.treasury,cash-campaign.contracts[112].paid);
 assert.equal(campaign.merchants.retiro.supplies.medkits,stock);
 assert.equal(campaign.operativeState[112].medkits,3);
 if(sector!=='retiro')campaign=order(campaign,{type:'travel',sector});
 campaign=order(campaign,{type:'visitSector'});const request=campaign.pendingBattle;
 let battle=createBattle(request.squad.map((u,i)=>({...u,x:2,y:2+i})),{...request,width:12,height:10,props:[],enemies:[],
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
  npcs:request.npcs.map((n,i)=>({...n,x:n.id===target?3:8,y:n.id===target?2:5+i}))});
 // The treatment fixture leaves its conquered arsenal unopened.
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 assert.ok(npc(battle,target));assert.equal(npc(battle,'sosa'),undefined,'bulletin candidates do not become encounters');
 battle=act(battle,{type:'weapon',unitId:'112',slot:'medical'});
 return {campaign,battle};
}
export function wound(battle,{target=PATIENT,damage=20,source='player'}={}){
 // Injury magnitude is the scenario input; the shared injury function owns
 // bleeding, responsibility and receipts. Treatment uses real finite stock.
 applyCivilianHarm(battle,npc(battle,target),{source:source==='player'?battle.units.find(u=>u.id==='112'):null,damage,intentional:source==='player'});
}
export function hirePatient(campaign,battle,term='week'){
 ({campaign,battle}=sync(campaign,approachNPC(battle,'112',PATIENT)));
 const patient=npc(battle),cash=campaign.resources.treasury;
 campaign=order(campaign,{type:'talkNPC',unitId:112,npcId:PATIENT,approach:'recruit',term,sectorState:battle});
 assert.equal(campaign.resources.treasury,cash-campaign.contracts[PATIENT_ID].paid);
 assert.equal(campaign.hiringArrivals.length,0,'local service begins in this sector');
 const operative=campaign.pendingBattle.squad.find(u=>u.id===PATIENT_ID);
 battle=structuredClone(battle);battle.npcs=battle.npcs.filter(n=>n.id!==PATIENT);
 battle.units.push({...createBattle([operative],{width:8,height:8,exploration:true,enemies:[]}).units[0],x:patient.x,y:patient.y});
 return saved({campaign,battle});
}
