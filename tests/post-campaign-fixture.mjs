import {completeTestTravel} from './campaign-test-helpers.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {approachNPC} from './approach-npc.mjs';
import {firstAidPlan} from '../game/first-aid.js';
import {doctorRate,careAssignmentReason} from '../game/medical-care.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {actBattle,endTurn,getReachable,actionCosts,hasLineOfSight} from '../game/tactical.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {fight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';
import {order,saved,visit,leave,sync} from './local-contract-fixture.mjs';
import {collectPhysicalCacheItems} from './finite-care-cache.mjs';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {weaponAmmoType,availableAmmunition} from '../game/ammunition-types.js';
export const postContent=()=>parseContentPackage(readFileSync(new URL('../web/public/campaigns/la-ruta-de-las-postas.json',import.meta.url),'utf8'));
const tactical=(p,a)=>{const battle=a.type==='endTurn'?endTurn(p.battle):actBattle(p.battle,a);assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:p.campaign,battle});};
const summary=s=>({hour:s.hour,second:s.secondOfHour??0,funds:s.resources.treasury,controlled:Object.keys(s.sectors).filter(k=>s.sectors[k].owner==='patriot'),chapters:s.campaignProgress.completed.map(c=>c.chapter),squad:[...s.squad],wounds:s.recruited.filter(id=>s.operativeState[id].alive&&(s.operativeState[id].hp<s.operativeState[id].maxHp||s.operativeState[id].bleeding)).map(id=>({id,hp:s.operativeState[id].hp,maxHp:s.operativeState[id].maxHp,bleeding:s.operativeState[id].bleeding})),deaths:Object.keys(s.operativeState).filter(id=>!s.operativeState[id].alive),completed:s.completed,defeated:s.defeated});
function postAssaultOrder(battle,unit){
 if(unit.medical<80||unit.marksmanship>=60)return hiredAssaultOrder(battle,unit,{reconBudget:16});
 const cost=actionCosts(battle,unit),patients=battle.units.filter(u=>u.side===unit.side&&u.id!==unit.id&&!u.routed&&!u.departure&&!u.surrendered&&sameSurface(unit,u)&&firstAidPlan(unit,u).valid).sort((a,b)=>a.hp-b.hp);
 const patient=patients[0];
 if(patient){
  if(Math.hypot(unit.x-patient.x,unit.y-patient.y)<=1.5&&hasLineOfSight(battle,unit,patient)){
   if(unit.activeSlot==='medical'&&unit.ap>=cost.heal)return {type:'useItem',unitId:unit.id,targetId:patient.id};
   if(unit.activeSlot!=='medical'&&unit.ap>=cost.weapon+cost.heal)return {type:'weapon',unitId:unit.id,slot:'medical'};
  }
  const reachable=getReachable(battle,unit),distance=p=>Math.hypot(p.x-patient.x,p.y-patient.y);
  const next=reachable.filter(p=>sameSurface(p,patient)&&p.cost>0&&p.cost<=Math.min(16,unit.ap-cost.heal)&&distance(p)<distance(unit)).sort((a,b)=>distance(a)-distance(b)||a.cost-b.cost)[0];
  if(next)return {type:'move',unitId:unit.id,...spacePoint(next)};
 }
 const riflemen=battle.units.some(u=>u.id!==unit.id&&u.side===unit.side&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.surrendered&&!u.departure);
 return riflemen?null:hiredAssaultOrder(battle,unit,{reconBudget:16});
}
export function approachPost(s,person){
 let p=visit(s);const npc=p.battle.npcs.find(n=>n.contentId===person);assert.ok(npc,person);assert.ok(npc.hp>0,person);
 const candidates=p.battle.units.filter(u=>u.side==='player'&&u.hp>0&&!u.unconscious&&!u.routed).flatMap(u=>getReachable(p.battle,u).filter(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1).map(spot=>({u,spot}))).sort((a,b)=>a.spot.cost-b.spot.cost);assert.ok(candidates.length,person);
 const {u}=candidates[0];p=sync({campaign:p.campaign,battle:approachNPC(p.battle,u.id,npc.id)});return {...p,speaker:u.id,npc:npc.id};
}
export function choosePost(p,node,choice){return {...p,campaign:order(p.campaign,{type:'talkNPC',npcId:p.npc,unitId:p.speaker,approach:'dialogue',dialogueNode:node,dialogueChoice:choice,sectorState:p.battle})};}
export function readyPostCampaign(){
 const d=postContent();let s=initialCampaign(8,d);assert.equal(s.location,'cordoba');assert.deepEqual(Object.keys(s.sectors).filter(id=>s.sectors[id].owner==='patriot'),['cordoba']);assert.deepEqual(s.recruited,[]);
 // The 6,000-peso package pays for a medic and four strong riflemen,
 // leaving a real reserve for losses, dressings and the next contract.
 const hires=d.characters.filter(c=>c.recruitmentSource==='contract').sort((a,b)=>Number(b.attributes.medical>=80)-Number(a.attributes.medical>=80)||b.attributes.marksmanship-a.attributes.marksmanship).slice(0,5);
 for(const c of hires)s=order(s,{type:'recruitCivic',id:operativeIdForCharacter(d,c.id),term:'week',destination:'cordoba'});
 assert.equal(s.hiringArrivals.length,hires.length);s=saved({campaign:order(s,{type:'wait',hours:6})}).campaign;
 let p=approachPost(s,'ines');p=choosePost(choosePost(p,'offer','ask'),'directions','back');p=choosePost(p,'offer','accept');
 s=saved({campaign:leave(saved(p))}).campaign;assert.equal(contentQuestStatus(s,'postas'),'active');assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['encargo']);return s;
}
export function finishPostCampaign({onCheckpoint}={}){
 let s=readyPostCampaign();const notes=[{stage:'accepted',...summary(s)}];onCheckpoint?.('accepted',s,notes);
 for(const [sector,contact,quest]of [['tucuman','mateo','posta-tucuman'],['salta','elena','posta-salta']]){
  s=order(s,{type:'attack',sector});const request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},previous=s.sectorStates[sector];
  // Advance the firing line in short bounds. The medic supports wounded
  // allies through paid movement and finite dressings. A lone survivor
  // still has to search and finish the fight through actual orders.
  const result=fight(request,previous,{controller:postAssaultOrder});assert.equal(result.battle.status,'victory',JSON.stringify({sector,turn:result.battle.turn,mode:result.battle.mode,actions:result.actions,units:result.battle.units.map(u=>({id:u.id,hp:u.hp,side:u.side,x:u.x,y:u.y,ammo:u.ammo,loaded:u.loaded,weapon:u.weapon,activeSlot:u.activeSlot,unconscious:u.unconscious,routed:u.routed})),log:result.battle.log.slice(-8)}));
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
   // Reserve 400 pesos for actual treatment and supply before the next march.
   const arrivals=[];
   for(const id of available){const quote=contractQuote(s,rosterFor(s).find(o=>o.id===id),'week');if(quote.price+400>s.resources.treasury)break;s=order(s,{type:'recruitCivic',id,term:'week',destination:sector});arrivals.push(id);}
   if(arrivals.length)s=order(s,{type:'wait',hours:6});
   // Treat actual battle wounds through paid, hourly campaign work. The best
   // surviving doctor is selected from this campaign, not a fixed identity.
   const care={hours:0,dressingsBought:0,dressingsFound:0,dressingsUsed:0,repairPointsSpent:0,repairHours:0,cost:0};
   while(true){
    const roster=rosterFor(s).filter(o=>s.squad.includes(o.id));
    const patient=roster.filter(o=>s.operativeState[o.id].hp<o.maxHp||s.operativeState[o.id].bleeding).sort((a,b)=>a.medical-b.medical)[0];if(!patient)break;
    assert.ok(care.hours<48,'the route must recover with finite care before its deadline');
    const doctor=roster.filter(o=>o.id!==patient.id&&o.medical>=20&&s.operativeState[o.id].hp>=15&&!s.operativeState[o.id].bleeding&&s.operativeState[o.id].energy>10).sort((a,b)=>b.medical-a.medical)[0];assert.ok(doctor,'a living, available local doctor is required');
    for(const o of roster)s=order(s,{type:'assignCare',id:o.id,assignment:'active'});
    if(!s.operativeState[doctor.id].medkits){const quantity=Math.max(1,Math.min(20,Math.ceil((patient.maxHp-s.operativeState[patient.id].hp)/doctorRate(doctor,s))+Number(s.operativeState[patient.id].bleeding>0))),found=collectPhysicalCacheItems(s,doctor.id,{item:'medkits'},quantity);s=found.campaign;care.dressingsFound+=found.collected;}
    assert.equal(careAssignmentReason(s,doctor,'doctor'),'');s=order(s,{type:'assignCare',id:doctor.id,assignment:'doctor'});s=order(s,{type:'assignCare',id:patient.id,assignment:'patient'});
    const stock=s.operativeState[doctor.id].medkits;s=saved({campaign:order(s,{type:'wait',hours:1})}).campaign;assert.equal(s.operativeState[doctor.id].medkits,stock-1);care.hours++;care.dressingsUsed++;
   }
   for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
   assert.ok(rosterFor(s).filter(o=>s.squad.includes(o.id)).every(o=>s.operativeState[o.id].hp===o.maxHp&&!s.operativeState[o.id].bleeding),'all actual survivors must be healthy before departure');assert.equal(care.cost,care.dressingsBought*10);if(!care.hours)assert.equal(care.dressingsBought,0);
   s=completeTestTravel(s,{sector:'cordoba'});
   while(s.squad.some(id=>s.operativeState[id].condition<100||s.operativeState[id].jammed)){
    assert.ok(care.repairHours<48,'actual weapon repair must finish with finite kits');
    const roster=rosterFor(s).filter(o=>s.squad.includes(o.id)),target=roster.find(o=>s.operativeState[o.id].condition<100||s.operativeState[o.id].jammed),mechanic=roster.filter(o=>o.mechanical>=20&&s.operativeState[o.id].hp>=15&&(s.operativeState[o.id].energy??100)>10&&!s.operativeState[o.id].asleep).sort((a,b)=>b.mechanical-a.mechanical)[0];assert.ok(mechanic,'a living qualified mechanic is required');
    if(!repairMaterialPoints(s.operativeState[mechanic.id]))s=collectPhysicalCacheItems(s,mechanic.id,{kind:'repair-kit'},1).campaign;
    // Finding the finite kit advances real time and can finish earlier work.
    // Select the next actual damaged weapon instead of assigning stale work.
    if(s.operativeState[target.id].condition===100&&!s.operativeState[target.id].jammed)continue;
    // Equipment repair clears a real firearm jam with finite tools, even
    // when its condition is already 100. Primary repair only restores wear.
    s=order(s,{type:'assignWork',operativeId:mechanic.id,assignment:'repair',targetId:target.id,repairScope:s.operativeState[target.id].jammed?'equipment':'primary'});const points=repairMaterialPoints(s.operativeState[mechanic.id]);s=advanceCampaignHours(s,1);const spent=points-repairMaterialPoints(s.operativeState[mechanic.id]);assert.ok(spent>0);care.repairPointsSpent+=spent;care.repairHours++;
    s=order(s,{type:'assignCare',id:mechanic.id,assignment:'active'});
   }
   // Keep actual survivors' and replacements' rifles after finite repair.
   // Collect compatible cartridges still present in the real Córdoba cache.
   for(const id of s.squad){const record=s.operativeState[id],op=rosterFor(s).find(o=>o.id===id);const ammoType=weaponAmmoType({...op,...record}),rounds=availableAmmunition(record,op);if(ammoType&&rounds<10){const found=collectPhysicalCacheItems(s,id,{kind:'ammunition',ammoType},10-rounds);s=found.campaign;}}
   s=completeTestTravel(s,{sector:'tucuman'});
   // Finish real sleep at the staging sector before starting another march.
   // A medical assignment or a travel notice can pause the previous wait.
   for(const id of s.squad)if(!s.operativeState[id].asleep&&(s.operativeState[id].fatigue>0||s.operativeState[id].energy<100))s=order(s,{type:'setSleep',operativeId:id,asleep:true});
   for(let hour=0;s.squad.some(id=>s.operativeState[id].asleep)&&hour<72;hour++)s=advanceCampaignHours(s,1);
   assert.ok(s.squad.every(id=>!s.operativeState[id].asleep&&s.operativeState[id].energy===100),'the actual column must finish recovery before Salta');
   // The attack approach takes 12 hours. Leave in time to reach Salta in
   // daylight after the medical delay; waiting spends real campaign time.
   const arrivalHour=(s.hour+12)%24,daylightWait=arrivalHour<6?6-arrivalHour:arrivalHour>=20?30-arrivalHour:0;
   if(daylightWait)s=order(s,{type:'wait',hours:daylightWait});
   notes.push({stage:'relief',care,daylightWait,...summary(s)});onCheckpoint?.('relief',s,notes);
  }

 }
 s=completeTestTravel(s,{sector:'cordoba'});let p=approachPost(s,'ines');const before=p.campaign.resources.treasury;p=choosePost(p,'report','finish');assert.equal(p.campaign.resources.treasury,before+400);assert.equal(p.campaign.completed,false,'ending waits for actual scene departure');
 s=saved({campaign:leave(saved(p))}).campaign;assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['encargo','ruta','regreso']);assert.equal(s.phase,0);assert.ok(Object.keys(s.operativeState).every(id=>Number(id)>=2000));assert.equal(s.flags.sanLorenzo,false);assert.equal(s.flags.armyFunded,false);assert.equal(s.pendingBattle,null);
 notes.push({stage:'ending',...summary(s)});onCheckpoint?.('ending',s,notes);return {campaign:s,notes};
}
