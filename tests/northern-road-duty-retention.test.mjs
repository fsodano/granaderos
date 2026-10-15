import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {hiringTravelHours} from '../game/hiring-arrivals.js';
import {defaultProfile} from '../game/character-profile.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {restoreNorthernRoad,completeNorthernRoadArrival} from './recovery-road-route.mjs';
import {northernReunionDutyKeepers} from './fresh-northern-recovery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const result=decodeSave(encodeSave(c)).campaign;assert.deepEqual(result,c);return result;};

function paidRoadParty(){
 let c=initialCampaign(42);
 const candidates=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&civicStatus(c,op.id).available&&hiringTravelHours(c,op.id)===0)
  .map(op=>({op,quote:contractQuote(c,op,'day')})).filter(row=>row.quote.available&&row.quote.total<=200).sort((a,b)=>a.quote.total-b.quote.total||a.op.id-b.op.id).slice(0,3);
 assert.equal(candidates.length,3);
 for(const {op,quote}of candidates){const cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id:op.id,term:'day',destination:c.location});assert.equal(c.resources.treasury,cash-quote.total);assert.ok(c.recruited.includes(op.id));}
 const keepers=candidates.slice(0,2).map(row=>row.op.id),temporary=candidates[2].op.id;
 c=order(c,{type:'squad',ids:keepers});
 c=order(c,{type:'createOfficer',name:'Oficial del camino',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 const permanent=c.squad.find(id=>!keepers.includes(id));assert.ok(permanent!==undefined);assert.equal(c.contracts[permanent].kind,'patriot');assert.equal(c.contracts[permanent].expiresAt,null);
 return {campaign:saved(c),keepers,temporary,permanent};
}

// Stop immediately after the real native formation order. The remainder of
// this shipping route is covered by the unchanged whole campaign tests.
function firstRoadFormation(start,keepServing){
 const stop=new Error('observed actual road formation');let action;
 assert.throws(()=>restoreNorthernRoad(start,{...(keepServing===undefined?{}:{keepServing}),report:event=>{
  if(event.event==='northernRoadOrder'&&event.action.type==='squad'){action=event.action;throw stop;}
 }}),error=>error===stop);
 assert.ok(action);return {action,campaign:order(start,action)};
}

test('actual permanent recruits join intended road duty while an unrelated paid reserve stays outside the native field party',()=>{
 const {campaign:start,keepers,temporary,permanent}=paidRoadParty(),before=structuredClone(start),duty=northernReunionDutyKeepers(start,keepers);
 assert.deepEqual(duty,[...keepers,permanent]);assert.ok(!duty.includes(temporary));
 const {action,campaign}=firstRoadFormation(start,duty);
 assert.deepEqual(action.ids,[permanent,...keepers]);assert.deepEqual(campaign.squad,action.ids);assert.ok(campaign.squad.every(id=>duty.includes(id)));
 assert.deepEqual(campaign.recruited,start.recruited);assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.operativeState,start.operativeState);
 assert.deepEqual(campaign.resources,start.resources);assert.equal(clock(campaign),clock(start));assert.equal(campaign.operativeState[temporary].alive,true);
 assert.deepEqual(saved(campaign),campaign);assert.deepEqual(start,before);
});

test('road formation without an explicit retained cohort keeps its existing actual local-party behavior',()=>{
 const {campaign:start,temporary,permanent,keepers}=paidRoadParty(),before=structuredClone(start);
 const {action,campaign}=firstRoadFormation(start);
 assert.deepEqual(action.ids,[permanent,...keepers,temporary]);assert.ok(campaign.squad.includes(temporary));
 assert.deepEqual(campaign.operativeState,start.operativeState);assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.resources,start.resources);
 assert.equal(clock(campaign),clock(start));assert.deepEqual(start,before);
});

function expiringJourney(){
 const documents=scaffoldDocuments('current-road-duty'),guide=documents.content.characters[0];
 documents.content.startingTerritory['watch-post'].owner='patriot';documents.world.arrivalFacilities['watch-post']=['barracks'];
 documents.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});documents.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 documents.world.expansion.buildingTargets={camp:0,'watch-post':0};
 documents.content.characters=Array.from({length:3},(_,i)=>({...structuredClone(guide),id:'road-duty-'+i,name:'Servicio del camino '+i,nickname:'Servicio '+i}));
 const declared=structuredClone(documents),definition=compileCampaignPackage(documents.manifest,documents);let c=initialCampaign(42,definition);
 const ids=rosterFor(c).map(op=>op.id);assert.equal(ids.length,3);
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id,term:'day',destination:'camp'});assert.equal(c.resources.treasury,cash-quote.total);}
 const party=ids.slice(0,2),temporary=ids[2];c=order(c,{type:'squad',ids:party});
 for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 let zero=0;for(let attempt=0;clock(c)<23*3600&&attempt<30;attempt++){
  const from=clock(c);c=order(c,{type:'wait',hours:Math.ceil((23*3600-from)/3600)});zero=clock(c)===from?zero+1:0;assert.ok(zero<3);
 }
 assert.equal(clock(c),23*3600);for(const id of party)c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});
 c=order(c,{type:'travel',sector:'watch-post',queue:true});assert.deepEqual(documents,declared);
 return {campaign:saved(c),party,temporary};
}

test('the bounded real road journey pays only its retained party and lets unrelated temporary service expire normally',()=>{
 const {campaign:start,party,temporary}=expiringJourney(),before=structuredClone(start),events=[];
 const {campaign:finished,defendedTarget}=completeNorthernRoadArrival(start,{target:'watch-post',keepServing:party,report:event=>events.push(event)});
 assert.equal(defendedTarget,false);assert.deepEqual(start,before);assert.equal(finished.location,'watch-post');assert.deepEqual(finished.squad,party);
 assert.equal(finished.pendingEncounter,null);assert.equal(finished.pendingBattle,null);assert.equal(finished.squads.find(q=>q.id===finished.activeSquadId).journey,undefined);
 let replay=start,fees=0;
 for(const event of events){
  if(event.event==='northernHandoverRenewal'){
   assert.ok(party.includes(event.action.id));const person=rosterFor(replay).find(op=>op.id===event.action.id),quote=contractRenewalQuote(replay,person,'day'),expiry=contractExpiresSeconds(replay.contracts[person.id]),cash=replay.resources.treasury;
   assert.deepEqual(event.quote,quote);assert.equal(event.cost,quote.price);replay=order(replay,event.action);assert.equal(replay.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(replay.contracts[person.id]),expiry+86400);fees+=quote.price;
  }else if(event.event==='northernHandoverOrder')replay=order(replay,event.action);
 }
 assert.ok(fees>0);assert.deepEqual(replay,finished);assert.equal(finished.resources.treasury,start.resources.treasury-fees);
 for(const id of party){assert.ok(finished.recruited.includes(id)&&contractExpiresSeconds(finished.contracts[id])>clock(finished));for(const key of ['hp','maxHp','bleeding','medkits','inventory','carriedLoaded','weaponDropped'])assert.deepEqual(finished.operativeState[id][key],start.operativeState[id][key]);}
 assert.equal(finished.operativeState[temporary].alive,true);assert.ok(!finished.recruited.includes(temporary));assert.equal(finished.contracts[temporary],undefined);
 assert.deepEqual(saved(finished),finished);assert.deepEqual(completeNorthernRoadArrival(saved(start),{target:'watch-post',keepServing:party}).campaign,finished);
});
