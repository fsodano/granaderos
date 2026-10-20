import test from 'node:test';
import assert from 'node:assert/strict';
import {restStableRoutePatients} from './stable-route-rest.mjs';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {defaultContentPackage} from '../game/content-package.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {decodeSave,encodeSave} from '../game/save.js';
const admitted=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null);return next;};

// Explicit authored rule controls, separate from the exact earned case above.
// These starting wounds isolate slow rest, renewal and interruption semantics.
function policyInput({historical=false,delayedRelief=false}={}){
 const d=defaultContentPackage();d.id='stable-rest-controls';d.name='Controles de descanso estable';d.rules.startingTreasury=50000;
 d.includeOriginalResidents=false;d.errands=[];d.quests=[];d.campaignRoles={foundryEngineer:null,marchCommander:null};
 d.careRules={...DEFAULT_CARE_RULES,restHealingHours:24};
 if(!historical)d.campaignStory={introduction:'Control de descanso.',victory:'Control terminado.',defeat:'Control perdido.',chapters:[{id:'later',name:'Más adelante',objective:'Esperá al día 999.',conditions:[{type:'day',min:999,max:null}]}],failureConditions:[]};
 for(const character of d.characters.filter(c=>['person-110','person-112'].includes(c.id))){character.arrivalHours=0;character.startingSupplies={rations:2,torches:2,medkits:0,boleadoras:1};}
 const patient=d.characters.find(c=>c.id==='person-110');patient.startingCondition={hp:patient.attributes.maxHp-2,energy:100,fatigue:0,bleeding:0,bandaged:2};
 if(delayedRelief)d.characters.find(c=>c.id==='person-112').arrivalHours=6;
 let s=initialCampaign(42,d);s=order(s,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'recruitCivic',id:112,term:delayedRelief?'day':'week'});return admitted(s);
}
test('actual paid renewals retain every serving survivor and use exact quotes and expected seconds',()=>{
 const start=policyInput(),before=structuredClone(start),result=restStableRoutePatients(start,{patients:[110]}),s=result.campaign;
 assert.equal(result.completed,true);assert.equal(result.hours,48);assert.equal(result.boundHours,48);assert.equal(result.receipt.dressingsUsed,0);
 assert.ok(result.ticks.some(row=>row.elapsedSeconds===0),'The native rest-complete notice is acknowledged without inventing an hour.');
 assert.equal(result.renewals.length,2);assert.ok(result.renewals.every(row=>row.id===110&&row.cost===row.quote.price));
 let replay=start;
 for(const action of result.actions){
  if(action.type==='renewContract'){
   const old=replay.contracts[action.id],quote=contractRenewalQuote(replay,rosterFor(replay).find(op=>op.id===action.id),action.term),cash=replay.resources.treasury;
   assert.equal(action.expectedExpiresAt,old.expiresAt);assert.equal(action.expectedExpiresSecond,old.expiresSecond??0);
   replay=order(admitted(replay),action);assert.equal(replay.resources.treasury,cash-quote.price);assert.equal(replay.contracts[action.id].expiresAt,quote.expiresAt);assert.equal(replay.contracts[action.id].expiresSecond??0,quote.expiresSecond??0);
  }else replay=order(replay,action);
 }
 assert.deepEqual(admitted(replay),s);assert.deepEqual(start,before);
 assert.equal(s.resources.treasury,start.resources.treasury-result.receipt.renewalCost);assert.ok(result.receipt.renewalCost>0);
 for(const id of start.recruited){assert.equal(s.operativeState[id].alive,true);assert.ok(s.recruited.includes(id));assert.ok(contractExpiresSeconds(s.contracts[id])>s.hour*3600+(s.secondOfHour??0));}
});

test('an actual finite marching group interrupts rest at its native encounter and keeps a saved unfinished receipt',()=>{
 const start=policyInput({historical:true});
 // Declared hostile column uses the real finite enemy-reserve/group runner.
 // No victory, casualties, clock or encounter outcome is assigned by the test.
 const group=launchEnemyGroup(start,'coast',start.location);assert.ok(group);const input=admitted(start),before=structuredClone(input);
 const result=restStableRoutePatients(input,{patients:[110]});assert.equal(result.completed,false);assert.match(result.stoppedReason,/actual encounter/);
 assert.ok(result.hours<result.boundHours);assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(result.campaign.hour,group.arrivalAt);
 assert.equal(result.campaign.operativeState[110].hp,input.operativeState[110].hp);assert.equal(result.receipt.dressingsUsed,0);assert.deepEqual(admitted(result.campaign),result.campaign);
 assert.deepEqual(input,before);let callbacks=0;
 const unsettled=restStableRoutePatients(input,{patients:[110],resolveEncounter:campaign=>{callbacks++;return campaign;}});
 assert.equal(callbacks,1);assert.equal(unsettled.completed,false);assert.match(unsettled.stoppedReason,/not settled/);assert.deepEqual(unsettled.campaign.pendingEncounter,result.campaign.pendingEncounter);
});

test('a real delayed paid arrival joins the retained-service ledger during passive recovery',()=>{
 const start=policyInput({delayedRelief:true}),before=structuredClone(start);
 assert.equal(start.recruited.includes(112),false);assert.equal(start.hiringArrivals.length,1);
 const booked=structuredClone(start.hiringArrivals[0]),result=restStableRoutePatients(start,{patients:[110]}),s=result.campaign;
 assert.equal(result.completed,true);assert.equal(result.hours,48);assert.equal(result.receipt.dressingsUsed,0);
 assert.equal(s.hiringArrivals.length,0);assert.equal(s.recruited.includes(112),true);assert.equal(s.operativeState[112].alive,true);
 const renewal=result.renewals.find(row=>row.id===112);assert.ok(renewal);assert.equal(renewal.cost,renewal.quote.price);assert.equal(renewal.hour,start.hour+29);
 assert.equal(booked.dueAt,start.hour+6);assert.equal(s.contracts[112].expiresAt,start.hour+54);assert.ok(contractExpiresSeconds(s.contracts[112])>s.hour*3600);
 assert.equal(s.resources.treasury,start.resources.treasury-result.receipt.renewalCost);assert.deepEqual(start,before);assert.deepEqual(admitted(s),s);
});
