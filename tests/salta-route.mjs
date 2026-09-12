import assert from 'node:assert/strict';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {dispatchCampaign,isSupplied} from '../game/campaign.js';
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
 const route=orders(start),{order}=route,field=[123,122,106,145,109,147],support=[105,115,132,135];
 assert.equal(start.hour,179);assert.equal(start.location,'tucuman');assert.equal(start.pendingBattle,null);
 // Keep service paid while staging a daylight arrival. Replacements are hired
 // locally after the rest, with their normal equipment and real contracts.
 const departure=start.hour+(24-start.hour%24)%24;
 for(let i=0;route.campaign.hour<departure&&i<48;i++){renew(route,route.campaign.recruited,2);order({type:'wait',hours:1});}assert.equal(route.campaign.hour,departure);
 for(const id of [132,135])order({type:'recruitCivic',id,term:'day'});
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
 const patients=[115,132],doctors=[109,122];
 for(const id of patients){assert.ok(start.operativeState[id].alive&&start.operativeState[id].bleeding>0);order({type:'assignCare',operativeId:id,assignment:'patient'});}
 for(const id of doctors){assert.ok(start.operativeState[id].medkits>0);order({type:'assignCare',operativeId:id,assignment:'doctor'});}
 order({type:'wait',hours:1});
 for(const id of patients){assert.equal(route.campaign.operativeState[id].bleeding,0);assert.equal(route.campaign.operativeState[id].hp,start.operativeState[id].hp);}
 for(const id of doctors)assert.equal(route.campaign.operativeState[id].medkits,start.operativeState[id].medkits-1);
 const supplies=route.campaign.resources;order({type:'diplomacy',kind:'northPact'});
 for(const [key,cost] of Object.entries({muskets:20,horses:10,powder:10}))assert.equal(route.campaign.resources[key],supplies[key]-cost);
 renew(route,[...route.campaign.recruited],20);
 order({type:'squad',ids:[122]});order({type:'assignCare',operativeId:122,assignment:'active'});order({type:'travel',sector:'tucuman'});
 assert.equal(route.campaign.hour,start.hour+13);
 const campaign=attendYatasto(route.campaign);
 assert.equal(campaign.phase,3);assert.equal(campaign.missions.yatasto.completed,true);assert.equal(campaign.flags.northPact,true);assert.equal(isSupplied(campaign,'salta'),true);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.completed,false);
 for(const [id,record] of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of [123,106,145,109,147,105,115,132]){assert.equal(campaign.operativeState[id].location,'salta');assert.equal(campaign.operativeState[id].hp,start.operativeState[id].hp);assert.equal(campaign.operativeState[id].bleeding,0);}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 report({event:'yatastoCompleted',hour:campaign.hour,second:campaign.secondOfHour,phase:campaign.phase});
 return {campaign,events:route.events};
}
