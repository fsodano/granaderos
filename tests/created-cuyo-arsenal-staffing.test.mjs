import assert from 'node:assert/strict';
import test from 'node:test';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {returnCreatedCuyoArsenalPhysician,recruitCreatedCuyoArsenalPhysician} from './created-cuyo-artillery.mjs';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {defaultStartingTerritory} from '../game/content-territory.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};

// Declared established-territory subsystem arena. All personnel, terms and
// rural positions below come from public hire, squad and travel orders.
// This is not a fresh campaign, arsenal victory or earned-input fixture.
function staffingArena({depart=true}={}){
 let c=secureArea(initialCampaign(8),'mendoza');
 c=order(c,{type:'recruitCivic',id:100,term:'day',destination:'mendoza'});
 c=order(c,{type:'createSquad',name:'Asamblea local',ids:[100],sector:'mendoza'});const original=c.activeSquadId;
 for(const id of [116,101])c=order(c,{type:'recruitCivic',id,term:'day',destination:'mendoza'});
 c=order(c,{type:'createSquad',name:'Médico y acompañante',ids:[116,101],sector:'mendoza'});const remote=c.activeSquadId;
 if(depart){
  c=order(c,{type:'travel',sector:'cell-6-24',mode:'march',queue:true});
  for(let attempt=0;attempt<8&&c.squads.find(q=>q.id===remote).journey;attempt++)c=order(c,{type:'wait',hours:1});
  assert.equal(c.squads.find(q=>q.id===remote).journey,undefined);assert.equal(c.squads.find(q=>q.id===remote).location,'cell-6-24');
 }
 c=order(c,{type:'selectSquad',id:original});return {campaign:saved(c),original,remote};
}

function assertRecordedReplay(start,result,events){
 const actions=events.filter(event=>event.event==='freshRouteOrder'||event.event==='freshRouteRenewal').map(event=>event.action);
 let replay=saved(start);
 for(const [index,action]of actions.entries()){
  replay=order(replay,action);
  if(index===Math.floor(actions.length/2)){const before=structuredClone(replay);replay=saved(replay);assert.deepEqual(replay,before);}
 }
 assert.deepEqual(replay,result.campaign,'Every actual return and retention order replays through the official midpoint save.');
 assert.deepEqual(saved(result.campaign),result.campaign);return actions;
}

test('an existing qualified local physician preserves the exact campaign without route orders',()=>{
 const {campaign:start}=staffingArena({depart:false}),before=structuredClone(start),events=[];
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)});
 assert.equal(result.returned,false);assert.equal(result.physician,116);assert.equal(result.campaign,start);
 assert.deepEqual(events,[]);assert.deepEqual(start,before);
});

test('the whole existing physician squad makes its real two-hour return without adding morale, supplies or readiness',()=>{
 const {campaign:start,original,remote}=staffingArena(),before=structuredClone(start),events=[];
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.returned,true);assert.equal(result.physician,116);
 const receipt=events.find(event=>event.event==='createdCuyoArsenalPhysicianReturned');assert.ok(receipt);
 assert.deepEqual(receipt.plan.members,[116,101]);assert.deepEqual(receipt.plan.journey.path,['cell-6-24','mendoza']);assert.equal(receipt.plan.hours,2);assert.equal(receipt.seconds,7200);
 assert.equal(clock(c)-clock(start),7200);assert.equal(c.resources.treasury,start.resources.treasury);
 assert.equal(c.activeSquadId,original);assert.deepEqual(c.squad,start.squad);assert.equal(c.location,'mendoza');
 assert.deepEqual(c.squads.find(q=>q.id===remote).members,[116,101]);assert.equal(c.squads.find(q=>q.id===remote).journey,undefined);
 for(const id of [116,101]){
  assert.equal(c.operativeState[id].location,'mendoza');assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].bleeding,0);
  for(const key of ['medkits','inventory','loaded','ammo','ammoStock','condition','weaponMetadata','weaponInstanceId'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
  assert.equal(c.operativeState[id].morale,start.operativeState[id].morale);assert.ok(c.operativeState[id].fatigue>start.operativeState[id].fatigue);assert.ok(c.operativeState[id].energy<100);
 }
 assert.deepEqual(c.artilleryDepots,start.artilleryDepots);assert.deepEqual(c.artilleryTransfers,start.artilleryTransfers);assert.deepEqual(c.sectorStates,start.sectorStates);
 assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);
 const actions=assertRecordedReplay(start,result,events);assert.equal(actions.filter(action=>action.type==='travel').length,1);assert.ok(actions.filter(action=>action.type==='wait').every(action=>action.hours===1));
 const again=returnCreatedCuyoArsenalPhysician(start);assert.deepEqual(again,result);assert.deepEqual(start,before);
});

test('the real return retains every serving term with exact quoted native debits and expiry fields',()=>{
 const arena=staffingArena();let start=arena.campaign;
 for(let attempt=0;attempt<28&&start.hour<22;attempt++)start=order(start,{type:'wait',hours:1});assert.equal(start.hour,22);
 const before=structuredClone(start),events=[],quotes=new Map(start.recruited.map(id=>[id,contractRenewalQuote(start,rosterFor(start).find(op=>op.id===id),'day')]));
 const result=returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),c=result.campaign;
 const paid=events.filter(event=>event.event==='freshRouteRenewal');assert.deepEqual(paid.map(event=>event.id),start.recruited);
 for(const event of paid){
  const quote=quotes.get(event.id);assert.equal(quote.available,true);assert.equal(event.price,quote.price);assert.equal(contractExpiresSeconds(c.contracts[event.id]),contractExpiresSeconds(start.contracts[event.id])+86400);
  assert.ok(c.recruited.includes(event.id)&&c.operativeState[event.id].alive);assert.equal(c.operativeState[event.id].hp,start.operativeState[event.id].hp);
 }
 assert.equal(c.resources.treasury,start.resources.treasury-paid.reduce((sum,event)=>sum+event.price,0));assert.equal(clock(c)-clock(start),7200);
 assertRecordedReplay(start,result,events);assert.deepEqual(start,before);
});

test('a sleeping physician cannot turn a refused public route into an admitted staffing position',()=>{
 const arena=staffingArena(),start=order(arena.campaign,{type:'setSleep',operativeId:116,asleep:true}),before=structuredClone(start),events=[];
 assert.throws(()=>returnCreatedCuyoArsenalPhysician(start,{report:event=>events.push(event)}),/healthy serving physician.*existing squad route/);
 assert.deepEqual(start,before);assert.deepEqual(events,[]);assert.equal(start.operativeState[116].location,'cell-6-24');
});

// Independent fresh subsystem declaration: no recovered campaign, body patch,
// morale grant or invented paid service supplies the capital meeting.
function capitalStaffingArena({filled=false}={}){
 const content=defaultContentPackage(),first=[116,101,102,103,104,108],second=[100,109,110,114,115,...(filled?[119]:[])],paid=[...first,...second],kept=new Set([10,...paid].map(id=>'person-'+id));
 content.headquarters='buenos_aires';content.startingTerritory=defaultStartingTerritory('buenos_aires');content.rules.startingTreasury=100000;
 content.includeOriginalResidents=false;content.errands=[];
 content.campaignStory={introduction:'Encuentro físico declarado.',victory:'Objetivo posterior.',defeat:'La campaña termina.',chapters:[{id:'later',name:'Objetivo posterior',objective:'Continuar tras el control.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 for(const person of content.characters)if(kept.has(person.id)){person.startingCondition={hp:person.attributes.maxHp,bleeding:0,bandaged:0,energy:100,fatigue:0};if(paid.includes(Number(person.id.slice(7))))person.arrivalHours=0;}
 const declaration=structuredClone(content);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content),hireCost=0;
 for(const id of paid){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'week',destination:'buenos_aires'});assert.equal(cash-c.resources.treasury,quote.total);hireCost+=quote.total;}
 c=order(c,{type:'createSquad',name:'Primera columna declarada',ids:first,sector:'buenos_aires'});const firstHome=c.activeSquadId;
 c=order(c,{type:'createSquad',name:'Segunda columna con vacante',ids:second,sector:'buenos_aires'});const secondHome=c.activeSquadId;
 assert.equal(c.resources.treasury,100000-hireCost);assert.equal(c.recruited.includes(10),false);assert.deepEqual(content,declaration);
 return {campaign:saved(c),first,second,firstHome,secondHome,paid};
}

test('the actual five-person capital column physically recruits its second qualified physician without duplicating the serving meeting',()=>{
 const s=capitalStaffingArena(),start=s.campaign,before=structuredClone(start),events=[],deadline=clock(start)+168*3600;
 const result=recruitCreatedCuyoArsenalPhysician(start,{squadId:s.secondHome,deadlineSeconds:deadline,report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.recruited,true);assert.equal(result.physician,10);assert.equal(c.location,'buenos_aires');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.equal(c.recruited.filter(id=>c.operativeState[id].alive).length,12);assert.equal(new Set(c.recruited).size,12);
 assert.deepEqual(c.squads.find(q=>q.id===s.firstHome).members,s.first);assert.deepEqual(c.squads.find(q=>q.id===s.secondHome).members,[...s.second,10]);assert.equal(c.squad.length,6);
 for(const id of [116,10]){assert.ok(rosterFor(c).find(op=>op.id===id).medical>=60);assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'buenos_aires');}
 const meeting=events.find(event=>event.event==='createdCuyoArsenalPhysicianRecruited'),expected=contractQuote(start,rosterFor(start).find(op=>op.id===10),'day');assert.ok(meeting);
 assert.equal(expected.permanent,false,'The declared campaignStory uses the actual authored finite-service profile.');assert.ok(expected.price>0);
 assert.equal(meeting.quote.price,expected.price);assert.equal(meeting.quote.total,expected.total);assert.equal(meeting.quote.hours,expected.hours);assert.equal(meeting.quote.permanent,expected.permanent);
 const signedSeconds=meeting.meetingContract.started*3600+(meeting.meetingContract.startedSecond??0),initialExpiry=contractExpiresSeconds(meeting.meetingContract);
 assert.ok(signedSeconds>=clock(start)&&signedSeconds<=clock(c));assert.equal(meeting.meetingContract.kind,'paid');assert.equal(meeting.meetingContract.term,'day');assert.equal(meeting.meetingContract.paid,expected.price);assert.equal(initialExpiry,signedSeconds+expected.hours*3600);
 assert.ok(contractExpiresSeconds(c.contracts[10])>deadline);assert.equal(c.contracts[10].paid,expected.price);assert.equal(c.operativeState[10].medkits,start.operativeState[10].medkits);
 for(const id of s.paid)for(const key of ['alive','hp','maxHp','bleeding','bandaged','medkits','inventory','condition','weaponMetadata','bladeMetadata','carriedLoaded'])assert.deepEqual(c.operativeState[id][key]??(key==='inventory'?{}:undefined),start.operativeState[id][key]??(key==='inventory'?{}:undefined),id+'.'+key);
 const renewals=events.filter(event=>event.event==='freshRouteRenewal'),physicianRenewals=renewals.filter(event=>event.id===10);
 assert.equal(physicianRenewals.length,Math.max(0,Math.floor((deadline-initialExpiry)/(expected.hours*3600))+1));for(const event of physicianRenewals){assert.equal(event.action.term,'day');assert.equal(event.price,expected.price);}
 assert.equal(c.resources.treasury,start.resources.treasury-expected.total-renewals.reduce((sum,event)=>sum+event.price,0));
 assert.ok(clock(c)>clock(start)&&clock(c)<=deadline);assert.ok(c.conversations.paroissien);assert.equal(c.conversations.paroissien.lastApproach,'recruit');
 assert.deepEqual(saved(c),c);assert.deepEqual(start,before);assert.deepEqual(recruitCreatedCuyoArsenalPhysician(saved(start),{squadId:s.secondHome,deadlineSeconds:deadline}),result);
 const againEvents=[],again=recruitCreatedCuyoArsenalPhysician(c,{squadId:s.secondHome,deadlineSeconds:deadline,report:event=>againEvents.push(event)});assert.equal(again.recruited,false);assert.equal(again.campaign,c);assert.deepEqual(againEvents,[]);
});

test('a full actual capital column cannot invent the reserved physician place or perform a second meeting',()=>{
 const s=capitalStaffingArena({filled:true}),start=s.campaign,before=structuredClone(start),events=[];
 assert.throws(()=>recruitCreatedCuyoArsenalPhysician(start,{squadId:s.secondHome,deadlineSeconds:clock(start)+168*3600,report:event=>events.push(event)}),/one vacant place/);
 assert.deepEqual(start,before);assert.equal(start.recruited.includes(10),false);assert.deepEqual(events,[]);
});
