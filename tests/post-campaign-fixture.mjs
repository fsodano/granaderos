import {firstAidPlan} from '../game/first-aid.js';
import {doctorRate,careAssignmentReason} from '../game/medical-care.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {fight} from './cuyo-route-driver.mjs';
import {order,saved,visit,leave,sync} from './local-contract-fixture.mjs';
export const postContent=()=>parseContentPackage(readFileSync(new URL('../web/public/campaigns/la-ruta-de-las-postas.json',import.meta.url),'utf8'));
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const summary=s=>({hour:s.hour,second:s.secondOfHour??0,funds:s.resources.treasury,controlled:Object.keys(s.sectors).filter(k=>s.sectors[k].owner==='patriot'),chapters:s.campaignProgress.completed.map(c=>c.chapter),squad:[...s.squad],deaths:Object.keys(s.operativeState).filter(id=>!s.operativeState[id].alive),completed:s.completed,defeated:s.defeated});
export function approachPost(s,person){
 let p=visit(s);const npc=p.battle.npcs.find(n=>n.contentId===person);assert.ok(npc,person);assert.ok(npc.hp>0,person);
 const candidates=p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.routed).flatMap(u=>getReachable(p.battle,u).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).map(spot=>({u,spot}))).sort((a,b)=>a.spot.cost-b.spot.cost);assert.ok(candidates.length,person);
 const {u,spot}=candidates[0];if(spot.cost)p=tactical(p,{type:'move',unitId:u.id,x:spot.x,y:spot.y});return {...p,speaker:u.id,npc:npc.id};
}
export function choosePost(p,node,choice){return {...p,campaign:order(p.campaign,{type:'talkNPC',npcId:p.npc,unitId:p.speaker,approach:'dialogue',dialogueNode:node,dialogueChoice:choice,sectorState:p.battle})};}
export function readyPostCampaign(){
 const d=postContent();let s=initialCampaign(8,d);assert.equal(s.location,'cordoba');assert.deepEqual(Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'),['cordoba']);assert.deepEqual(s.recruited,[]);
 for(const c of d.characters.filter(c=>c.recruitmentSource==='contract').slice(0,6))s=order(s,{type:'recruitCivic',id:operativeIdForCharacter(d,c.id),term:'week',destination:'cordoba'});
 assert.equal(s.hiringArrivals.length,6);s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;
 let p=approachPost(s,'ines');p=choosePost(choosePost(p,'offer','ask'),'directions','back');p=choosePost(p,'offer','accept');
 s=saved({campaign:leave(saved(p))}).campaign;assert.equal(contentQuestStatus(s,'postas'),'active');assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['encargo']);return s;
}
export function finishPostCampaign({onCheckpoint}={}){
 let s=readyPostCampaign();const notes=[{stage:'accepted',...summary(s)}];onCheckpoint?.('accepted',s,notes);
 for(const [sector,contact,quest]of [['tucuman','mateo','posta-tucuman'],['salta','elena','posta-salta']]){
  s=order(s,{type:'attack',sector});const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  const result=fight(request,previous,{scoutCostWeight:.01,avoidCivilians:true});assert.equal(result.battle.status,'victory',sector);
  let p={campaign:s,battle:enterSector(request,previous)};
  for(const [i,a]of result.orders.entries()){p=tactical(p,a);if(i===Math.floor(result.orders.length/2))p=saved(p);}
  assert.deepEqual(p.battle.units,result.battle.units);assert.deepEqual(p.battle.npcs,result.battle.npcs);assert.equal(p.battle.seed,result.battle.seed);assert.equal(p.battle.elapsedSeconds,result.battle.elapsedSeconds);
  p=tactical(saved(p),{type:'explore'});
  for(const u of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious&&firstAidPlan(u,u).valid))p=tactical(p,{type:'heal',unitId:u.id});
  const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};s=saved({campaign:order(p.campaign,report)}).campaign;
  assert.ok(dispatchCampaign(s,report).lastError);assert.equal(s.sectors[sector].owner,'patriot');assert.equal(s.completed,false);assert.equal(s.defeated,false);
  p=approachPost(s,contact);p=choosePost(choosePost(p,'waiting','prepare'),'confirm','reopen');s=saved({campaign:leave(saved(p))}).campaign;assert.equal(contentQuestStatus(s,quest),'completed');
  notes.push({stage:sector,actions:result.actions,turns:result.battle.turn,...summary(s)});onCheckpoint?.(sector,s,notes);
  s=order(s,{type:'fortify',sector});
  if(sector==='tucuman'){
   const d=s.contentCampaign.package,available=d.characters.filter(c=>c.recruitmentSource==='contract').map(c=>operativeIdForCharacter(d,c.id)).filter(id=>s.operativeState[id].alive&&!s.recruited.includes(id)).slice(0,6-s.squad.length);
   for(const id of available)s=order(s,{type:'recruitCivic',id,term:'week',destination:sector});
   if(available.length)s=order(s,{type:'wait',hours:6});
   s=order(s,{type:'travel',sector:'cordoba'});
   for(const id of s.squad)for(const type of ['resupply','repairWeapon']){const n=dispatchCampaign(s,{type,operativeId:id});if(!n.lastError)s=n;}
   // Treat actual battle wounds through paid, hourly campaign work. The best
   // surviving doctor is selected from this campaign, not a fixed identity.
   const care={hours:0,dressingsBought:0,cost:0};
   while(true){
    const roster=rosterFor(s).filter(o=>s.squad.includes(o.id));
    const patient=roster.filter(o=>s.operativeState[o.id].hp<o.maxHp||s.operativeState[o.id].bleeding).sort((a,b)=>a.medical-b.medical)[0];if(!patient)break;
    assert.ok(care.hours<48,'the route must recover with finite care before its deadline');
    const doctor=roster.filter(o=>o.id!==patient.id&&o.medical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&s.operativeState[o.id].energy>10).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living, available local doctor is required');
    for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
    if(!s.operativeState[doctor.id].medkits){const quantity=Math.min(20,Math.ceil((patient.maxHp-s.operativeState[patient.id].hp)/doctorRate(doctor,s))+Number(s.operativeState[patient.id].bleeding>0));const before=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:doctor.id,quantity});care.dressingsBought+=quantity;care.cost+=before-s.resources.treasury;}
    assert.equal(careAssignmentReason(s,doctor,'doctor'),'');s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
    const stock=s.operativeState[doctor.id].medkits;s=saved({campaign:order(s,{type:'wait',hours:1})}).campaign;assert.equal(s.operativeState[doctor.id].medkits,stock-1);care.hours++;
   }
   for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
   assert.ok(care.hours>0);assert.ok(care.dressingsBought>0);assert.equal(care.cost,care.dressingsBought*10);
   for(const id of s.squad){const n=dispatchCampaign(s,{type:'resupply',operativeId:id});if(!n.lastError)s=n;}
   for(const id of s.squad){s=order(s,{type:'purchaseEquipment',item:'firearm-1801',quantity:1});const item=s.armoryItems.find(i=>i.contentWeapon?.template===1801);assert.ok(item);s=order(s,{type:'equip',operativeId:id,slot:'weapon',itemId:'firearm-1801',instanceId:item.id});}
   s=order(s,{type:'travel',sector:'tucuman'});
   notes.push({stage:'relief',care,...summary(s)});onCheckpoint?.('relief',s,notes);
  }

 }
 s=order(s,{type:'travel',sector:'cordoba'});let p=approachPost(s,'ines');const before=p.campaign.resources.treasury;p=choosePost(p,'report','finish');assert.equal(p.campaign.resources.treasury,before+400);assert.equal(p.campaign.completed,false,'ending waits for actual scene departure');
 s=saved({campaign:leave(saved(p))}).campaign;assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['encargo','ruta','regreso']);assert.equal(s.phase,0);assert.ok(Object.keys(s.operativeState).every(id=>Number(id)>=2000));assert.equal(s.flags.sanLorenzo,false);assert.equal(s.flags.armyFunded,false);assert.equal(s.pendingBattle,null);
 notes.push({stage:'ending',...summary(s)});onCheckpoint?.('ending',s,notes);return {campaign:s,notes};
}
