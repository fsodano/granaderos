import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,questForNPC} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,canSee,getNpcGiftResult} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {ammoCount} from '../game/ammo-types.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {militiaEligibility} from '../game/militia.js';
import {dailyIncome} from '../game/economy.js';

const QUEST='retiro-uniformes',IDS=[100,110];
const BRANCHES=[{id:'cuartel',npcId:'local-retiro',sector:'retiro',other:'ensenada'},
 {id:'puerto',npcId:'local-ensenada',sector:'ensenada',other:'retiro'}];
const save=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const stamp=state=>state.hour*3600+(state.secondOfHour??0);
const unit=(pair,id)=>pair.battle.units.find(actor=>actor.id===String(id));
const npc=(pair,id)=>pair.battle.npcs.find(actor=>actor.id===id);
const kit=actor=>({loaded:actor.loaded,ammunition:structuredClone(actor.ammunition),rounds:actor.loaded+ammoCount(actor),condition:actor.condition});
const campaignKit=(pair,id)=>kit(carriedAmmunition(rosterFor(pair.campaign).find(actor=>actor.id===id),pair.campaign.operativeState[id]));
const health=pair=>IDS.map(id=>({id,hp:pair.campaign.operativeState[id].hp,bleeding:pair.campaign.operativeState[id].bleeding}));

function campaignOrder(pair,action,history){
 const before=structuredClone(pair),campaign=dispatchCampaign(pair.campaign,action);
 assert.equal(campaign.lastError,null,`${action.type}: ${campaign.lastError}`);assert.deepEqual(pair,before);
 history?.push({kind:'campaign',action:structuredClone(action)});return save({campaign});
}
function visit(pair,history){
 const campaign=dispatchCampaign(pair.campaign,{type:'visitSector'});assert.equal(campaign.lastError,null,campaign.lastError);
 history?.push({kind:'visit'});return save({campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location])});
}
function issue(pair,action,history,inspect){
 const before=structuredClone(pair),battle=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
 assert.equal(battle.lastError,null,`${action.type}: ${battle.lastError}`);
 assert.deepEqual(presented.state,battle,'presentation cannot change a paid order or its physical custody');assert.deepEqual(pair,before);
 inspect?.(pair.battle,battle);
 const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);
 history?.push({kind:'battle',action:structuredClone(action)});return save({campaign:synced.campaign,battle:synced.battle});
}
function talk(pair,npcId,history){
 const action={type:'talkNPC',unitId:100,npcId,approach:'quest',sectorState:pair.battle};
 const campaign=dispatchCampaign(pair.campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
 history?.push({kind:'talk',npcId});return save({campaign,battle:pair.battle});
}
function leave(pair,history){
 const campaign=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,
  sectorState:pair.battle,survivors:pair.battle.units.filter(actor=>actor.side==='player')});
 assert.equal(campaign.lastError,null,campaign.lastError);history?.push({kind:'leave'});return save({campaign});
}
function approach(pair,id,npcId,history){
 for(let attempt=0;attempt<240;attempt++){
  const actor=unit(pair,id),contact=npc(pair,npcId);assert.ok(actor&&contact);
  if(Math.abs(actor.x-contact.x)+Math.abs(actor.y-contact.y)<=1){
   if(canSee(pair.battle,actor,contact))return pair;
   pair=issue(pair,{type:'look',unitId:actor.id,x:contact.x,y:contact.y},history);continue;
  }
  const reachable=getReachable(pair.battle,actor),adjacent=reachable.filter(p=>Math.abs(p.x-contact.x)+Math.abs(p.y-contact.y)===1).sort((a,b)=>a.cost-b.cost)[0];
  if(adjacent?.path.length){pair=issue(pair,{type:'move',unitId:actor.id,...adjacent.path[0]},history);continue;}
  const options=pair.battle.tiles.filter(tile=>tile.type==='door'&&!tile.open&&!tile.locked).flatMap(door=>reachable.filter(p=>Math.abs(p.x-door.x)+Math.abs(p.y-door.y)===1).map(p=>({door,p})))
   .sort((a,b)=>(a.p.cost+Math.abs(a.door.x-contact.x)+Math.abs(a.door.y-contact.y))-(b.p.cost+Math.abs(b.door.x-contact.x)+Math.abs(b.door.y-contact.y)));
  const next=options[0];assert.ok(next,`the real contact ${npcId} has a legal approach`);
  pair=issue(pair,next.p.path.length?{type:'move',unitId:actor.id,...next.p.path[0]}:{type:'door',unitId:actor.id,doorId:next.door.doorId},history);
 }
 assert.fail(`the real contact ${npcId} was not reached within 240 ordinary orders`);
}
function deliver(pair,id,branch,history){
 const outfit=structuredClone(unit(pair,id).outfit);assert.equal(outfit.outfit,'poncho');assert.equal(outfit.count,1);
 pair=issue(pair,{type:'equipLoot',unitId:String(id),slot:'outfit',inventoryKey:null},history);
 const key=Object.keys(unit(pair,id).inventory).find(key=>unit(pair,id).inventory[key].kind==='outfit'&&unit(pair,id).inventory[key].outfit==='poncho');assert.ok(key);
 pair=issue(pair,{type:'weapon',unitId:String(id),slot:'item',item:`inventory:${key}`},history);
 pair=approach(pair,id,branch.npcId,history);
 const count=npc(pair,branch.npcId).questGifts?.length??0;
 pair=issue(pair,{type:'useItem',unitId:String(id),targetId:branch.npcId},history);
 assert.equal(npc(pair,branch.npcId).questGifts.length,count+1);
 assert.deepEqual(npc(pair,branch.npcId).questGifts.at(-1),outfit,'the NPC keeps the complete original garment record');
 assert.equal(unit(pair,id).outfit,null);return pair;
}
function replay(initial,history){
 let pair=save(initial);
 for(const event of history){
  if(event.kind==='campaign')pair=campaignOrder(pair,event.action);
  else if(event.kind==='visit')pair=visit(pair);
  else if(event.kind==='battle')pair=issue(pair,event.action);
  else if(event.kind==='talk')pair=talk(pair,event.npcId);
  else pair=leave(pair);
 }
 return pair;
}
function rejectCampaign(pair,action){
 const next=dispatchCampaign(pair.campaign,action);assert.ok(next.lastError);
 assert.deepEqual({...next,lastError:pair.campaign.lastError},pair.campaign,'a rejected strategic order has no cost or consequence');return next;
}
function rejectTrustedSync(pair,change){
 // Keep the dispatch-produced campaign object: its fast-clock trust must not
 // bypass receipt checks, even when the submitted elapsed time is unchanged.
 const trusted=syncBattleTime(pair.campaign,pair.battle);assert.equal(trusted.error,null,trusted.error);
 const forged={campaign:trusted.campaign,battle:trusted.battle};change(forged);
 const before=structuredClone(forged),result=syncBattleTime(forged.campaign,forged.battle);
 assert.ok(result.error,'forged issued/resume choices cannot pass a trusted zero-delta clock');
 assert.match(result.error,/destino|destinos/i);assert.deepEqual(forged,before,'rejection must not advance time or consume items');
}
function startingCampaign(secured=false){
 const campaign=initialCampaign(42,defaultContentPackage());
 // Separate declared territorial boundary, before the first admitted order.
 // This proves the town gate and never claims a native conquest or victory.
 // Actual academy progression adds eight to Buenos Aires during arrival.
 // Start that town at 34 and Ensenada at 42; keep the earned academy receipt.
 if(secured)for(const at of ['buenos_aires','retiro','ensenada'])Object.assign(campaign.sectors[at],{owner:'patriot',loyalty:at==='ensenada'?42:34});
 return save({campaign});
}
function paidArrival(initial,history,destinations={}){
 let pair=initial;
 for(const id of IDS){
  const quote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(actor=>actor.id===id),'week');assert.ok(quote.available);
  assert.equal(quote.price,id===100?252:420);
  pair=campaignOrder(pair,{type:'recruitCivic',id,term:'week',destination:destinations[id]??'retiro'},history);
 }
 assert.deepEqual(pair.campaign.hiringArrivals.map(arrival=>[arrival.operativeId,arrival.dueAt]),[[100,6],[110,6]]);
 pair=campaignOrder(pair,{type:'wait',hours:6},history);assert.equal(pair.campaign.resources.treasury,2528);
 assert.deepEqual(health(pair),[{id:100,hp:70,bleeding:0},{id:110,hp:85,bleeding:0}]);
 for(const id of IDS)assert.equal(campaignKit(pair,id).rounds,10);
 return pair;
}

test('native paid Retiro couriers commit two original ponchos by physical delivery, confirm locally, and preserve the choice through official replay and reentry',t=>{
 const initial=startingCampaign(),history=[],branch=BRANCHES[0];let pair=paidArrival(initial,history);
 const cash=pair.campaign.resources.treasury,contracts=structuredClone(pair.campaign.contracts),issuedHealth=health(pair),kits=IDS.map(id=>campaignKit(pair,id));
 const beforeLoyalty=Object.fromEntries(['buenos_aires','retiro','ensenada'].map(at=>[at,pair.campaign.sectors[at].loyalty])),income=structuredClone(pair.campaign.townIncome);
 pair=visit(pair,history);const issued=IDS.map(id=>structuredClone(unit(pair,id).outfit)),originalPockets=IDS.map(id=>structuredClone(unit(pair,id).inventory));
 pair=approach(pair,100,branch.npcId,history);pair=talk(pair,branch.npcId,history);
 assert.equal(pair.campaign.quests[QUEST].beneficiaryId,undefined,'speech alone never chooses custody');
 rejectTrustedSync(save(pair),forged=>{
  forged.campaign.pendingBattle.questBeneficiaries[QUEST]=branch.id;forged.battle.questBeneficiaries[QUEST]=branch.id;
  delete forged.campaign.quests[QUEST].beneficiaryId;forged.campaign.conversations[branch.npcId].giftCount=0;
  npc(forged,branch.npcId).questGifts=[];
 });
 pair=deliver(pair,100,branch,history);const partial=save(pair);
 assert.equal(pair.battle.questBeneficiaries[QUEST],branch.id);assert.equal(pair.campaign.pendingBattle.questBeneficiaries[QUEST],branch.id);
 assert.equal(pair.campaign.quests[QUEST].beneficiaryId,branch.id);assert.equal(pair.campaign.quests[QUEST].status,'offered');
 assert.equal(questForNPC(pair.campaign,branch.npcId).resolutionReady,false);
 rejectCampaign(pair,{type:'talkNPC',unitId:100,npcId:branch.npcId,approach:'quest',sectorState:pair.battle});
 for(const change of [p=>delete p.battle.questBeneficiaries[QUEST],p=>p.battle.questBeneficiaries[QUEST]='puerto',p=>delete p.campaign.quests[QUEST].beneficiaryId]){
  const invalid=structuredClone(partial);change(invalid);assert.throws(()=>save(invalid),'a saved partial commitment cannot disappear or change its recipient');
 }
 rejectTrustedSync(partial,forged=>{forged.campaign.pendingBattle.resumeSnapshot=structuredClone(forged.battle);forged.campaign.pendingBattle.resumeSnapshot.questBeneficiaries[QUEST]='puerto';});
 pair=deliver(pair,110,branch,history);pair=approach(pair,100,branch.npcId,history);
 assert.equal(pair.campaign.quests[QUEST].status,'offered','two accepted items still need an actual adjacent confirmation');
 assert.equal(questForNPC(pair.campaign,branch.npcId).resolutionReady,true);assert.deepEqual(npc(pair,branch.npcId).questGifts,issued);
 pair=talk(pair,branch.npcId,history);assert.equal(pair.campaign.quests[QUEST].status,'completed');
 assert.equal(pair.campaign.quests[QUEST].beneficiaryId,branch.id);assert.equal(pair.campaign.quests[QUEST].questResolution,undefined);
 for(const at of ['buenos_aires','retiro'])assert.equal(pair.campaign.sectors[at].loyalty,beforeLoyalty[at]+8);
 assert.equal(pair.campaign.sectors.ensenada.loyalty,beforeLoyalty.ensenada);
 const events=structuredClone(pair.campaign.cityLoyaltyEvents);assert.equal(events.filter(event=>event.eventId===`npc-${QUEST}`).length,1);
 const completedAt=stamp(pair.campaign);rejectCampaign(pair,{type:'talkNPC',unitId:100,npcId:branch.npcId,approach:'quest',sectorState:pair.battle});
 pair=leave(pair,history);const stale=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:partial.campaign.pendingBattle.id,sectorState:partial.battle,survivors:partial.battle.units.filter(actor=>actor.side==='player')});assert.ok(stale.lastError);assert.deepEqual(stale.quests,pair.campaign.quests);
 pair=visit(pair,history);assert.deepEqual(npc(pair,branch.npcId).questGifts,issued);pair=leave(pair,history);
 assert.deepEqual(pair.campaign.cityLoyaltyEvents,events);assert.deepEqual(pair.campaign.townIncome,income);
 assert.equal(pair.campaign.resources.treasury,cash);assert.equal(dailyIncome(pair.campaign),0);assert.deepEqual(pair.campaign.contracts,contracts);assert.deepEqual(health(pair),issuedHealth);
 for(const [index,id]of IDS.entries()){assert.deepEqual(campaignKit(pair,id),kits[index]);assert.equal(pair.campaign.operativeState[id].outfit,null);assert.deepEqual(pair.campaign.operativeState[id].inventory,originalPockets[index],'delivery removes the poncho and retains every original pocket record');}
 assert.deepEqual(replay(initial,history),pair,'all paid hires, physical orders and conversations replay through official saves');
 t.diagnostic(JSON.stringify({scenario:'native default seed42 Retiro visit; no conquest',prices:[252,420],treasury:cash,orders:history.length,arrivalHour:6,deliverySeconds:completedAt-6*3600,totalSeconds:stamp(pair.campaign),health:health(pair),rounds:IDS.map(id=>campaignKit(pair,id).rounds),received:issued,beneficiary:branch.id}));
});

test('prepared paid couriers in separate towns keep the opposite original poncho after a real refused offer and official replay',t=>{
 const initial=startingCampaign(true),history=[];let pair=paidArrival(initial,history,{110:'ensenada'});
 const cash=pair.campaign.resources.treasury,contracts=structuredClone(pair.campaign.contracts),issuedHealth=health(pair),kits=IDS.map(id=>campaignKit(pair,id));
 const otherPoncho=structuredClone(pair.campaign.operativeState[110].outfit);
 pair=campaignOrder(pair,{type:'createSquad',ids:[110],sector:'ensenada',name:'Correo del puerto'},history);const portSquad=pair.campaign.activeSquadId;
 pair=campaignOrder(pair,{type:'selectSquad',id:'squad-1'},history);pair=visit(pair,history);
 const firstPoncho=structuredClone(unit(pair,100).outfit);pair=deliver(pair,100,BRANCHES[0],history);pair=leave(pair,history);
 assert.equal(pair.campaign.quests[QUEST].beneficiaryId,'cuartel');assert.equal(pair.campaign.quests[QUEST].status,'offered');
 pair=campaignOrder(pair,{type:'selectSquad',id:portSquad},history);pair=visit(pair,history);
 assert.deepEqual(pair.battle.units.filter(actor=>actor.side==='player').map(actor=>actor.id),['110']);
 pair=issue(pair,{type:'equipLoot',unitId:'110',slot:'outfit',inventoryKey:null},history);
 const key=Object.keys(unit(pair,110).inventory).find(key=>unit(pair,110).inventory[key].kind==='outfit'&&unit(pair,110).inventory[key].outfit==='poncho');assert.ok(key);
 pair=issue(pair,{type:'weapon',unitId:'110',slot:'item',item:`inventory:${key}`},history);pair=approach(pair,110,'local-ensenada',history);
 const before=save(pair),pockets=structuredClone(unit(pair,110).inventory);let refusal;
 pair=issue(pair,{type:'useItem',unitId:'110',targetId:'local-ensenada'},history,(previous,battle)=>{
  refusal=getNpcGiftResult(previous,battle);assert.equal(refusal?.status,'refused');assert.equal(refusal.npcId,'local-ensenada');
  assert.match(refusal.text,/primera entrega.*otro destinatario/i);
 });
 assert.deepEqual(unit(pair,110).inventory,pockets);assert.deepEqual(unit(pair,110).inventory[key],otherPoncho);
 assert.equal(npc(pair,'local-ensenada').questGifts?.length??0,0);assert.equal(pair.battle.questBeneficiaries[QUEST],'cuartel');
 assert.ok(stamp(pair.campaign)>stamp(before.campaign),'the real attempted conversation consumes ordinary tactical time');
 const refusalSeconds=stamp(pair.campaign)-stamp(before.campaign);
 pair=leave(pair,history);assert.deepEqual(pair.campaign.sectorStates.retiro.npcs.find(contact=>contact.id==='local-retiro').questGifts,[firstPoncho]);
 assert.deepEqual(pair.campaign.operativeState[110].inventory[key],otherPoncho);assert.equal(pair.campaign.operativeState[110].outfit,null);
 assert.equal(pair.campaign.quests[QUEST].status,'offered');assert.equal(pair.campaign.quests[QUEST].beneficiaryId,'cuartel');
 assert.ok(!pair.campaign.cityLoyaltyEvents.some(event=>event.eventId===`npc-${QUEST}`),'neither partial custody nor a refusal gives the quest reward');
 assert.equal(pair.campaign.resources.treasury,cash);assert.equal(dailyIncome(pair.campaign),0);assert.deepEqual(health(pair),issuedHealth);assert.deepEqual(pair.campaign.contracts,contracts);
 for(const [index,id]of IDS.entries())assert.deepEqual(campaignKit(pair,id),kits[index]);
 assert.deepEqual(replay(initial,history),pair,'the two physical recipients and unchanged opposite pocket replay through official saves');
 t.diagnostic(JSON.stringify({scenario:'initial secured towns; paid split-destination couriers; no conquest',prices:[252,420],arrivalHour:6,treasury:cash,orders:history.length,refusalSeconds,beneficiary:'cuartel',acceptedPoncho:firstPoncho,retainedOppositePoncho:otherPoncho,health:health(pair),rounds:IDS.map(id=>campaignKit(pair,id).rounds)}));
});

for(const branch of BRANCHES)test(`declared secured towns permit only the ${branch.id} delivery to unlock a real paid militia course`,t=>{
 const initial=startingCampaign(true),history=[];let pair=paidArrival(initial,history);
 const issuedHealth=health(pair),kits=IDS.map(id=>campaignKit(pair,id)),contracts=structuredClone(pair.campaign.contracts);
 if(branch.sector!==pair.campaign.location)pair=campaignOrder(pair,{type:'travel',sector:branch.sector},history);
 assert.equal(pair.campaign.location,branch.sector);assert.equal(pair.campaign.pendingBattle,null);
 const before=Object.fromEntries(['buenos_aires','retiro','ensenada'].map(at=>[at,pair.campaign.sectors[at].loyalty])),cash=pair.campaign.resources.treasury,income=structuredClone(pair.campaign.townIncome);
 assert.equal(militiaEligibility(pair.campaign,branch.sector).eligible,false);assert.equal(militiaEligibility(pair.campaign,branch.other).eligible,false);
 pair=visit(pair,history);const issued=IDS.map(id=>structuredClone(unit(pair,id).outfit));
 pair=approach(pair,100,branch.npcId,history);pair=talk(pair,branch.npcId,history);
 for(const id of IDS)pair=deliver(pair,id,branch,history);
 pair=approach(pair,100,branch.npcId,history);assert.equal(questForNPC(pair.campaign,branch.npcId).resolutionReady,true);
 pair=talk(pair,branch.npcId,history);assert.deepEqual(npc(pair,branch.npcId).questGifts,issued);pair=leave(pair,history);
 const loyaltyEvents=structuredClone(pair.campaign.cityLoyaltyEvents);
 pair=visit(pair,history);assert.equal(pair.battle.questBeneficiaries[QUEST],branch.id);assert.deepEqual(npc(pair,branch.npcId).questGifts,issued);pair=leave(pair,history);
 assert.deepEqual(pair.campaign.cityLoyaltyEvents,loyaltyEvents,'reentry retains the chosen receipt without another town reward');
 for(const at of ['buenos_aires','retiro','ensenada'])assert.equal(pair.campaign.sectors[at].loyalty,before[at]+(branch.id==='cuartel'?at!=='ensenada'?8:0:at==='ensenada'?8:0));
 assert.equal(militiaEligibility(pair.campaign,branch.sector).eligible,true);assert.equal(militiaEligibility(pair.campaign,branch.other).eligible,false);
 assert.match(rejectCampaign(pair,{type:'militia',sector:branch.other,rank:0,trainerId:100}).lastError,/50%.*lealtad/);
 pair=campaignOrder(pair,{type:'militia',sector:branch.sector,rank:0,trainerId:100},history);
 assert.equal(pair.campaign.resources.treasury,cash-60);assert.deepEqual(pair.campaign.sectors[branch.sector].militia,[0,0,0]);
 assert.equal(pair.campaign.militiaTraining.length,1);const course=pair.campaign.militiaTraining[0];
 assert.equal(course.sector,branch.sector);assert.equal(course.count,3);assert.equal(course.remaining,course.duration);assert.equal(course.trainerId,100);
 assert.deepEqual(pair.campaign.townIncome,income);assert.equal(dailyIncome(pair.campaign),0);
 assert.deepEqual(health(pair),issuedHealth);assert.deepEqual(pair.campaign.contracts,contracts);
 for(const [index,id]of IDS.entries()){assert.deepEqual(campaignKit(pair,id),kits[index]);assert.equal(pair.campaign.operativeState[id].outfit,null);}
 assert.deepEqual(replay(initial,history),pair);
 t.diagnostic(JSON.stringify({scenario:'initial secured BA/Retiro support34 and Ensenada42; actual academy8 retained; no conquest',branch:branch.id,arrivalHour:6,confirmationHour:course.started,loyaltyBefore:before,loyaltyAfter:Object.fromEntries(Object.keys(before).map(at=>[at,pair.campaign.sectors[at].loyalty])),treasury:pair.campaign.resources.treasury,courseCost:60,trainees:course.count,orders:history.length,health:health(pair),rounds:IDS.map(id=>campaignKit(pair,id).rounds)}));
});
