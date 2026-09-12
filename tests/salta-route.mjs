import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,isSupplied,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {attendYatasto} from './mission-helpers.mjs';

function orders(start){
 let campaign=decodeSave(encodeSave(start)).campaign;const events=[];
 return {get campaign(){return campaign;},events,prepareWeapons(report){campaign=finishReloadsBeforeMarch(campaign,{report});},order(action){
  const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);
  campaign=next;events.push({action,hour:campaign.hour,second:campaign.secondOfHour??0});
 }};
}
function renew(route,ids,buffer){
 for(const id of ids){const c=route.campaign,r=c.operativeState[id],contract=c.contracts[id];
  if(r.alive&&!r.captured&&contract?.expiresAt!=null&&contract.expiresAt-c.hour<=buffer){
   const cash=c.resources.treasury;route.order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});
   assert.ok(route.campaign.resources.treasury<cash);
  }
 }
}
export function prepareSaltaAssault(start,{report=()=>{}}={}){
 const route=orders(start),{order}=route,field=[123,122,106,143,109,147],support=[105,115,132,135];
 assert.equal(start.location,'tucuman');assert.equal(start.pendingBattle,null);
 // Keep service paid while staging a daylight arrival. Replacements are hired
 // locally after the rest, with their normal equipment and real contracts.
 const departure=start.hour+(24-start.hour%24)%24;
 for(let i=0;route.campaign.hour<departure&&i<48;i++){renew(route,route.campaign.recruited,2);order({type:'wait',hours:1});}assert.equal(route.campaign.hour,departure);
 // Hire a fresh officer for the assault; preserve every actual rescue survivor and casualty.
 for(const id of [143,132,135])order({type:'recruitCivic',id,term:'day'});
 // Preserve the chosen ordering of the real contract transactions and squads.
 renew(route,[...field,...support],13);
 order({type:'squad',ids:field});const fieldSquad=route.campaign.activeSquadId;
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});route.prepareWeapons(report);
 order({type:'createSquad',name:'Apoyo del norte',ids:support});const supportSquad=route.campaign.activeSquadId;
 for(const operativeId of support)order({type:'assignCare',operativeId,assignment:'active'});route.prepareWeapons(report);
 order({type:'attack',sector:'salta',queue:true});order({type:'selectSquad',id:fieldSquad});order({type:'attack',sector:'salta',queue:true});
 const deploying=[fieldSquad,supportSquad];
 for(let i=0;i<24&&!deploying.every(id=>route.campaign.squads.find(s=>s.id===id)?.journey?.status==='ready');i++){
  assert.equal(route.campaign.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(route.campaign.hour,departure+12);
 assert.ok(deploying.every(id=>route.campaign.squads.find(s=>s.id===id)?.journey?.status==='ready'));
 order({type:'beginAssault',sector:'salta'});
 const campaign=route.campaign,request=campaign.pendingBattle;
 assert.deepEqual(request.squad.map(u=>Number(u.id)).sort((a,b)=>a-b),[...field,...support].sort((a,b)=>a-b));
 const battle=enterSector(request,campaign.sectorStates.salta);
 assert.deepEqual(decodeSave(encodeSave(campaign,battle)),{campaign,battle});
 report({event:'jointSaltaDeployment',hour:campaign.hour,units:request.squad.map(u=>u.id)});
 return {campaign,battle,events:route.events};
}

export function completeNorthernMission(start,{report=()=>{}}={}){
 const route=orders(start),{order}=route;
 assert.equal(start.sectors.salta.owner,'patriot');assert.equal(start.phase,2);
 const local=rosterFor(start).filter(op=>{const r=start.operativeState[op.id];return start.recruited.includes(op.id)&&r.alive&&!r.captured&&r.location==='salta';});
 const patients=local.filter(op=>start.operativeState[op.id].hp<start.operativeState[op.id].maxHp).map(op=>op.id);
 const doctors=local.filter(op=>{const r=start.operativeState[op.id];return !patients.includes(op.id)&&op.medical>=20&&r.medkits>0&&r.energy>10;}).sort((a,b)=>b.medical-a.medical).map(op=>op.id);
 assert.ok(patients.length&&doctors.length,'actual survivors provide patients and capable doctors');
 for(const operativeId of patients)order({type:'assignCare',operativeId,assignment:'patient'});
 for(const operativeId of doctors)order({type:'assignCare',operativeId,assignment:'doctor'});
 order({type:'wait',hours:1});
 for(const id of patients){assert.equal(route.campaign.operativeState[id].bleeding,0);assert.ok(route.campaign.operativeState[id].alive);if(start.operativeState[id].bleeding)assert.equal(route.campaign.operativeState[id].hp,start.operativeState[id].hp);else assert.ok(route.campaign.operativeState[id].hp>=start.operativeState[id].hp);}
 const usedDressings=doctors.reduce((sum,id)=>sum+start.operativeState[id].medkits-route.campaign.operativeState[id].medkits,0);assert.ok(usedDressings>0);
 assert.ok(patients.some(id=>route.campaign.operativeState[id].hp>start.operativeState[id].hp),'treatment restores at least one actual wound');
 const treated=route.campaign;
 const supplies=route.campaign.resources;order({type:'diplomacy',kind:'northPact'});
 for(const [key,cost] of Object.entries({muskets:20,horses:10,powder:10}))assert.equal(route.campaign.resources[key],supplies[key]-cost);
 renew(route,[...route.campaign.recruited],20);
 const messenger=doctors[0];order({type:'squad',ids:[messenger]});order({type:'assignCare',operativeId:messenger,assignment:'active'});order({type:'travel',sector:'tucuman'});
 assert.equal(route.campaign.hour,start.hour+13);
 const campaign=attendYatasto(route.campaign);
 assert.equal(campaign.phase,3);assert.equal(campaign.missions.yatasto.completed,true);assert.equal(campaign.flags.northPact,true);assert.equal(isSupplied(campaign,'salta'),true);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.completed,false);
 for(const [id,record] of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 for(const {id} of local.filter(op=>op.id!==messenger)){assert.equal(campaign.operativeState[id].location,'salta');assert.ok(campaign.operativeState[id].hp>=treated.operativeState[id].hp);assert.equal(campaign.operativeState[id].bleeding,0);}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'yatastoCompleted',hour:campaign.hour,second:campaign.secondOfHour,phase:campaign.phase});
 return {campaign,events:route.events,care:{patients,doctors,usedDressings,messenger}};
}
