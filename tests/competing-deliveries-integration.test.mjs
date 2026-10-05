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
import {applyQuestWithdrawalOrders,questWithdrawalChoice} from '../game/quest-withdrawal.js';
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
function talk(pair,npcId,history,withdrawal){
 const action={type:'talkNPC',unitId:100,npcId,approach:withdrawal?'questWithdraw':'quest',...(withdrawal?{questWithdrawal:withdrawal}:{}),sectorState:pair.battle};
 const campaign=dispatchCampaign(pair.campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
 history?.push({kind:'talk',npcId,...(withdrawal?{withdrawal:structuredClone(withdrawal)}:{})});return save({campaign,battle:applyQuestWithdrawalOrders(campaign,pair.battle)});
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
  else if(event.kind==='talk')pair=talk(pair,event.npcId,undefined,event.withdrawal);
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
function startingCampaign(secured=false,content=defaultContentPackage()){
 const campaign=initialCampaign(42,content);
 // Separate declared territorial boundary, before the first admitted order.
 // This proves the town gate and never claims a native conquest or victory.
 // Actual academy progression adds eight to Buenos Aires during arrival.
 // Start that town at 34 and Ensenada at 42; keep the earned academy receipt.
 if(secured)for(const at of ['buenos_aires','retiro','ensenada'])Object.assign(campaign.sectors[at],{owner:'patriot',loyalty:at==='ensenada'?42:34});
 return save({campaign});
}
function paidArrival(initial,history,destinations={},term='week'){
 let pair=initial;
 for(const id of IDS){
  const quote=contractQuote(pair.campaign,rosterFor(pair.campaign).find(actor=>actor.id===id),term);assert.ok(quote.available);
  assert.equal(quote.price,term==='day'?id===100?36:60:id===100?252:420);
  pair=campaignOrder(pair,{type:'recruitCivic',id,term,destination:destinations[id]??'retiro'},history);
 }
 assert.deepEqual(pair.campaign.hiringArrivals.map(arrival=>[arrival.operativeId,arrival.dueAt]),[[100,6],[110,6]]);
 pair=campaignOrder(pair,{type:'wait',hours:6},history);assert.equal(pair.campaign.resources.treasury,term==='day'?3104:2528);
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


test('native paid partial delivery can be withdrawn once with exact retained custody and saved terminal consequences',t=>{
 const initial=startingCampaign(),history=[],branch=BRANCHES[0];let pair=paidArrival(initial,history,{},'day');
 const cash=pair.campaign.resources.treasury,contracts=structuredClone(pair.campaign.contracts),issuedHealth=health(pair),kits=IDS.map(id=>campaignKit(pair,id)),income=structuredClone(pair.campaign.townIncome);
 pair=visit(pair,history);const gifts=IDS.map(id=>structuredClone(unit(pair,id).outfit));
 pair=approach(pair,100,branch.npcId,history);pair=talk(pair,branch.npcId,history);
 const request=()=>({type:'talkNPC',unitId:100,npcId:branch.npcId,approach:'questWithdraw',questWithdrawal:{questId:QUEST,beneficiaryId:'cuartel',deliveredCount:1},sectorState:pair.battle});
 rejectCampaign(pair,request());assert.equal(questWithdrawalChoice(pair.campaign,questForNPC(pair.campaign,branch.npcId),branch.npcId),null,'offering without actual gifts cannot cost support');
 pair=deliver(pair,100,branch,history);const partial=save(pair),choice=questForNPC(pair.campaign,branch.npcId).withdrawalChoice;
 assert.deepEqual(choice,{questId:QUEST,beneficiaryId:'cuartel',deliveredCount:1});
 const beforeGift=replay(initial,history.slice(0,-1)),unacknowledged=actBattle(beforeGift.battle,history.at(-1).action);assert.equal(unacknowledged.lastError,null);
 rejectCampaign({campaign:beforeGift.campaign,battle:unacknowledged},{...request(),sectorState:unacknowledged});
 rejectCampaign(pair,{...request(),unitId:110});
 rejectCampaign(pair,{...request(),questWithdrawal:{...choice,deliveredCount:0}});
 const beforeLoyalty=Object.fromEntries(['buenos_aires','retiro','ensenada'].map(id=>[id,pair.campaign.sectors[id].loyalty]));
 pair=talk(pair,branch.npcId,history,choice);
 const fullHistory=[];let full=deliver(partial,110,branch,fullHistory);assert.equal(npc(full,branch.npcId).questGifts.length,2);
 rejectCampaign(full,{type:'talkNPC',unitId:110,npcId:branch.npcId,approach:'questWithdraw',questWithdrawal:choice,sectorState:full.battle});
 assert.deepEqual(replay(partial,fullHistory),full,'a genuine second gift makes the earlier withdrawal choice stale');
 const record=pair.campaign.quests[QUEST],events=pair.campaign.cityLoyaltyEvents.filter(e=>e.kind==='questWithdrawal'),terminal=save(pair);
 const deathHistory=[];let afterDeath=issue(terminal,{type:'weapon',unitId:'100',slot:'primary'},deathHistory),shots=0;
 for(let actions=0;npc(afterDeath,branch.npcId).hp>0&&actions<16;actions++){
  const shooter=unit(afterDeath,100),contact=npc(afterDeath,branch.npcId);
  afterDeath=issue(afterDeath,shooter.jammed?{type:'reprime',unitId:'100'}:shooter.loaded===0?{type:'reload',unitId:'100'}:{type:'firePoint',unitId:'100',x:contact.x,y:contact.y,tacticalLevel:contact.tacticalLevel??0,aim:0},deathHistory);
  if(!shooter.jammed&&shooter.loaded>0)shots++;
 }
 const gunOnlyHealth=npc(afterDeath,branch.npcId).hp;
 // The bounded gun-only probe left the native contact alive. Keep those real
 // injuries and continue with the owned blade; do not replace the outcome.
 afterDeath=issue(afterDeath,{type:'weapon',unitId:'100',slot:'blade'},deathHistory);
 for(let strokes=0;npc(afterDeath,branch.npcId).hp>0&&strokes<8;strokes++){
  afterDeath=approach(afterDeath,100,branch.npcId,deathHistory);
  afterDeath=issue(afterDeath,{type:'melee',unitId:'100',targetId:branch.npcId,targetKind:'npc'},deathHistory);
 }
 assert.equal(npc(afterDeath,branch.npcId).hp,0,'a bounded branch earns actual contact death through finite gun orders and the owned blade');assert.ok(shots>0&&shots<=10);
 assert.deepEqual(afterDeath.campaign.quests[QUEST],record);assert.deepEqual(npc(afterDeath,branch.npcId).questGifts,[gifts[0]]);
 assert.equal(unit(afterDeath,100).loaded+ammoCount(unit(afterDeath,100)),10-shots);assert.equal(afterDeath.campaign.resources.treasury,cash);
 assert.deepEqual(replay(terminal,deathHistory),afterDeath,'the contact death and unchanged terminal receipt replay through real orders');
 afterDeath=leave(afterDeath,deathHistory);afterDeath=visit(afterDeath,deathHistory);assert.equal(npc(afterDeath,branch.npcId).hp,0);assert.deepEqual(afterDeath.campaign.quests[QUEST],record);afterDeath=leave(afterDeath,deathHistory);assert.deepEqual(replay(terminal,deathHistory),afterDeath);

 assert.equal(record.status,'withdrawn');assert.equal(record.beneficiaryId,'cuartel');assert.equal(record.completedAt,null);
 assert.equal(record.withdrawal.deliveredCount,1);assert.equal(record.withdrawal.actualSupportLoss,4);assert.equal(events.length,1);assert.equal(events[0].delta,-4);
 for(const id of ['buenos_aires','retiro'])assert.equal(pair.campaign.sectors[id].loyalty,beforeLoyalty[id]-4);
 assert.equal(pair.campaign.sectors.ensenada.loyalty,beforeLoyalty.ensenada);
 assert.deepEqual(pair.battle.questWithdrawals,{[QUEST]:1});assert.deepEqual(npc(pair,branch.npcId).questGifts,[gifts[0]]);assert.deepEqual(unit(pair,110).outfit,gifts[1]);
 assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.townIncome,income);assert.equal(dailyIncome(pair.campaign),0);
 rejectCampaign(pair,request());rejectCampaign(pair,{...request(),approach:'quest',questWithdrawal:undefined});
 for(const change of [p=>delete p.battle.questWithdrawals,p=>p.battle.questWithdrawals[QUEST]=2,p=>delete p.campaign.pendingBattle.questWithdrawals,p=>delete p.campaign.quests[QUEST].withdrawal,p=>p.campaign.quests[QUEST].withdrawal.deliveredCount=0,p=>p.campaign.quests[QUEST].withdrawal.deliveredCount=2,p=>p.battle.npcs.find(n=>n.id===branch.npcId).questGifts.pop(),p=>p.battle.npcs.find(n=>n.id===branch.npcId).questGifts.push(structuredClone(gifts[1])),p=>p.campaign.quests[QUEST].withdrawal.actualSupportLoss=0,p=>p.campaign.quests[QUEST].withdrawnSecond=3599,p=>p.campaign.cityLoyaltyEvents.find(e=>e.kind==='questWithdrawal').delta=-5,p=>p.campaign.cityLoyaltyEvents.find(e=>e.kind==='questWithdrawal').anchors[0].after+=1]){
  const forged=structuredClone(pair);change(forged);assert.throws(()=>save(forged));
 }
 const trusted=syncBattleTime(pair.campaign,pair.battle);assert.equal(trusted.error,null);
 const forged={campaign:trusted.campaign,battle:structuredClone(trusted.battle)};delete forged.battle.questWithdrawals;
 const rejectedSync=syncBattleTime(forged.campaign,forged.battle);assert.ok(rejectedSync.error);assert.deepEqual(rejectedSync.campaign,forged.campaign);assert.deepEqual(rejectedSync.battle,forged.battle);
 rejectCampaign(forged,{type:'syncTacticalTime',battleId:forged.campaign.pendingBattle.id,elapsedSeconds:forged.battle.elapsedSeconds,sectorState:forged.battle});
 rejectCampaign(forged,{type:'leaveSector',battleId:forged.campaign.pendingBattle.id,sectorState:forged.battle,survivors:forged.battle.units.filter(u=>u.side==='player')});
 const resumed=structuredClone(pair);resumed.campaign.pendingBattle.resumeSnapshot=structuredClone(resumed.battle);assert.deepEqual(save(resumed),resumed);
 for(const change of [s=>delete s.questWithdrawals,s=>s.questWithdrawals[QUEST]=2,s=>s.npcs.find(n=>n.id===branch.npcId).questGifts.pop()]){
  const invalid=structuredClone(resumed);change(invalid.campaign.pendingBattle.resumeSnapshot);const before=structuredClone(invalid);
  assert.throws(()=>save(invalid));const result=syncBattleTime(invalid.campaign,invalid.battle);assert.ok(result.error);assert.deepEqual(invalid,before);
  rejectCampaign(invalid,{type:'syncTacticalTime',battleId:invalid.campaign.pendingBattle.id,elapsedSeconds:invalid.battle.elapsedSeconds});
 }

 pair=issue(pair,{type:'equipLoot',unitId:'110',slot:'outfit',inventoryKey:null},history);
 const key=Object.keys(unit(pair,110).inventory).find(k=>unit(pair,110).inventory[k].outfit==='poncho');
 pair=issue(pair,{type:'weapon',unitId:'110',slot:'item',item:`inventory:${key}`},history);pair=approach(pair,110,branch.npcId,history);
 const original=structuredClone(unit(pair,110).inventory[key]);
 pair=issue(pair,{type:'useItem',unitId:'110',targetId:branch.npcId},history);
 assert.match(getNpcGiftResult(terminal.battle,pair.battle)?.text??pair.battle.log.at(-1),/retirado/);
 assert.deepEqual(unit(pair,110).inventory[key],original,'a terminal physical refusal retains the complete undelivered garment');
 pair=leave(pair,history);pair=visit(pair,history);assert.deepEqual(npc(pair,branch.npcId).questGifts,[gifts[0]]);assert.deepEqual(pair.battle.questWithdrawals,{[QUEST]:1});pair=leave(pair,history);
 assert.deepEqual(pair.campaign.quests[QUEST],record);assert.deepEqual(pair.campaign.cityLoyaltyEvents.filter(e=>e.kind==='questWithdrawal'),events);
 // Saved-admission compatibility control only: later royalist ownership does
 // not rewrite an existing terminal receipt. This is not earned occupation.
 const occupied=structuredClone(pair);occupied.campaign.sectors.retiro.owner='royalist';
 const occupationControl=save(occupied);assert.deepEqual(occupationControl.campaign.quests[QUEST],record);assert.deepEqual(occupationControl.campaign.cityLoyaltyEvents.filter(e=>e.kind==='questWithdrawal'),events);
 assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(pair.campaign.contracts,contracts);assert.deepEqual(health(pair),issuedHealth);
 for(const [index,id]of IDS.entries())assert.deepEqual(campaignKit(pair,id),kits[index]);
 assert.deepEqual(replay(initial,history),pair,'all native paid actions replay through complete official campaign/tactical saves');
 assert.deepEqual(save(partial),partial);assert.deepEqual(save(terminal),terminal);
 t.diagnostic(JSON.stringify({scenario:'fresh default seed42; real day hires and six-hour arrival; no prepared control or outcome',prices:[36,60],cash,orders:history.length,withdrawalTime:{hour:record.withdrawnAt,second:record.withdrawnSecond},finalTime:{hour:pair.campaign.hour,second:pair.campaign.secondOfHour},status:record.status,cost:events[0],delivered:gifts[0],retained:gifts[1],health:health(pair),rounds:IDS.map(id=>campaignKit(pair,id).rounds),laterDeath:{gunOnlyHealth,shots,orders:deathHistory.length,health:health(afterDeath),rounds:IDS.map(id=>campaignKit(afterDeath,id).rounds),treasury:afterDeath.campaign.resources.treasury,terminal:afterDeath.campaign.quests[QUEST].status},occupationControl:'declared saved-admission compatibility only, not earned occupation'}));
});

for(const rewardChoice of [false,true])test(`declared ${rewardChoice?'cash/civic':'single-recipient'} physical errand permits a clipped withdrawal without changing old omitted behavior`,t=>{
 const content=defaultContentPackage(),definition=content.errands.find(q=>q.id===QUEST);delete definition.beneficiaries;
 definition.reward={treasury:0,loyalty:false};definition.withdrawal={supportCost:20};if(rewardChoice)definition.rewardChoice={reimbursement:40};
 // Declared low support boundary BEFORE official admission and every paid order.
 // Original ownership stays intact; this is not earned conquest or political history.
 const declared=initialCampaign(42,content);declared.sectors.buenos_aires.loyalty=0;declared.sectors.retiro.loyalty=1;
 const initial=save({campaign:declared}),history=[];let pair=paidArrival(initial,history,{},'day');pair=visit(pair,history);pair=deliver(pair,100,BRANCHES[0],history);
 const choice=questForNPC(pair.campaign,'local-retiro').withdrawalChoice;assert.deepEqual(choice,{questId:QUEST,deliveredCount:1});
 const cash=pair.campaign.resources.treasury,original=structuredClone(unit(pair,110).outfit);pair=talk(pair,'local-retiro',history,choice);
 const r=pair.campaign.quests[QUEST],e=pair.campaign.cityLoyaltyEvents.find(e=>e.kind==='questWithdrawal');
 assert.equal(r.beneficiaryId,undefined);assert.equal(r.status,'withdrawn');assert.ok(r.withdrawal.actualSupportLoss>0&&r.withdrawal.actualSupportLoss<20);
 assert.equal(r.withdrawal.actualSupportLoss,e.before-e.after);assert.equal(e.after,0);assert.equal(e.delta,-20);assert.equal(pair.campaign.resources.treasury,cash);assert.deepEqual(unit(pair,110).outfit,original);
 const forged=structuredClone(pair);forged.campaign.cityLoyaltyEvents.find(e=>e.kind==='questWithdrawal').anchors[0].after=1;assert.throws(()=>save(forged));
 pair=leave(pair,history);pair=visit(pair,history);pair=leave(pair,history);assert.deepEqual(pair.campaign.quests[QUEST],r);assert.deepEqual(replay(initial,history),pair);
 const oldContent=structuredClone(content);delete oldContent.errands.find(q=>q.id===QUEST).withdrawal;
 const oldInitial=startingCampaign(false,oldContent),oldHistory=[];let old=paidArrival(oldInitial,oldHistory,{},'day');old=visit(old,oldHistory);old=deliver(old,100,BRANCHES[0],oldHistory);
 assert.equal(questForNPC(old.campaign,'local-retiro').withdrawalChoice,undefined);assert.equal(old.battle.questWithdrawals,undefined);
 rejectCampaign(old,{type:'talkNPC',unitId:100,npcId:'local-retiro',approach:'questWithdraw',questWithdrawal:choice,sectorState:old.battle});
 old=deliver(old,110,BRANCHES[0],oldHistory);assert.equal(old.campaign.quests[QUEST].status,rewardChoice?'offered':'completed');
 if(rewardChoice){const action={type:'talkNPC',unitId:110,npcId:'local-retiro',approach:'quest',questResolution:'cash',sectorState:old.battle};const campaign=dispatchCampaign(old.campaign,action);assert.equal(campaign.lastError,null);old=save({campaign,battle:old.battle});assert.equal(old.campaign.quests[QUEST].questResolution,'cash');assert.equal(old.campaign.resources.treasury,3104+40);}
 assert.deepEqual(old.campaign.cityLoyaltyEvents.filter(e=>e.kind==='questWithdrawal'),[]);
 t.diagnostic(JSON.stringify({scenario:'declared single recipient definition and low initial support; native paid kits, no outcome changes',rewardChoice,cost:20,actualLoss:r.withdrawal.actualSupportLoss,anchors:e.anchors,cash,orders:history.length,oldOmissionStatus:old.campaign.quests[QUEST].status}));
});
