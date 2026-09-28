import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
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
  for(const u of p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.routed&&!u.unconscious&&u.medkits&&(u.bleeding||u.hp<u.maxHp-15)))p=tactical(p,{type:'heal',unitId:u.id});
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
   let care=visit(s);
   for(const id of s.squad)for(let i=0;i<2;i++){const u=care.battle.units.find(u=>u.id===String(id));if(u.hp>0&&!u.unconscious&&!u.routed&&u.medkits&&(u.bleeding||u.hp<u.maxHp))care=tactical(care,{type:'heal',unitId:u.id});}
   s=leave(saved(care));
   for(const id of s.squad){const n=dispatchCampaign(s,{type:'resupply',operativeId:id});if(!n.lastError)s=n;}
   s=order(s,{type:'travel',sector:'tucuman'});
   notes.push({stage:'relief',...summary(s)});onCheckpoint?.('relief',s,notes);
  }

 }
 s=order(s,{type:'travel',sector:'cordoba'});let p=approachPost(s,'ines');const before=p.campaign.resources.treasury;p=choosePost(p,'report','finish');assert.equal(p.campaign.resources.treasury,before+400);assert.equal(p.campaign.completed,false,'ending waits for actual scene departure');
 s=saved({campaign:leave(saved(p))}).campaign;assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['encargo','ruta','regreso']);assert.equal(s.phase,0);assert.ok(Object.keys(s.operativeState).every(id=>Number(id)>=2000));assert.equal(s.flags.sanLorenzo,false);assert.equal(s.flags.armyFunded,false);assert.equal(s.pendingBattle,null);
 notes.push({stage:'ending',...summary(s)});onCheckpoint?.('ending',s,notes);return {campaign:s,notes};
}
