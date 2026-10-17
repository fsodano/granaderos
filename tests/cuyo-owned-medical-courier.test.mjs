import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {actBattle} from '../game/tactical.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {createFreshRouteOrders} from './fresh-cuyo-route.mjs';
import {collectKnownCuyoDressings,knownCuyoDressingSources} from './cuyo-known-medical-courier.mjs';
import {recoverCreatedCuyoLocalPatients} from './created-cuyo-route.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};
const total=c=>c.recruited.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0)+Object.values(c.sectorStates).reduce((sum,b)=>sum+(b.groundItems??[]).filter(g=>g.item==='medkits'||g.type==='medkits').reduce((n,g)=>n+g.count,0),0);

// Every wound, source quantity and route is authored before initialCampaign.
// Recruitment, reconnaissance, assignments, travel and treatment below are
// actual Native orders. There is no captured route or returned-state edit.
function setup({stock=8,assignment='rest',raid=false,nearExpiry=false,clearSource=true,carrierWound=0,carrierRations=0,physicianRations=0,secondCarrier=false}={}){
 const d=scaffoldDocuments('declared-owned-cuyo-courier'),base=d.content.characters[0];
 d.content.rules.startingTreasury=5000;d.world.physical.caches={};d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 d.world.exitLinks=[['camp','E',19,8,'watch-post','W',0,8]];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const specs=[{name:'physician',medical:60},{name:'carrier',medical:assignment==='doctor'?60:0,strength:90,wound:carrierWound,kits:assignment==='doctor'?1:0},{name:'patient1',medical:0,wound:4},{name:'patient2',medical:0,wound:7},{name:'donor',medical:0,kits:stock},...(secondCarrier?[{name:'reliefCarrier',medical:0,strength:60}]:[])];
 d.content.characters=specs.map((s,i)=>({...structuredClone(base),id:'courier-'+s.name.toLowerCase(),name:s.name,nickname:s.name,arrivalHours:0,monthlyPay:300,serviceGuarantee:31,
  attributes:{...base.attributes,medical:s.medical,strength:s.strength??base.attributes.strength},startingSupplies:{rations:s.name==='carrier'?carrierRations:s.name==='physician'?physicianRations:0,torches:0,medkits:s.kits??0,boleadoras:0},
  startingCondition:{hp:base.attributes.maxHp-(s.wound??0),energy:100,fatigue:0,bleeding:0,bandaged:s.wound??0}}));
 if(raid)d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:4,axis:['watch-post']}}};
 const documents=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let c=initialCampaign(42,definition);const roster=rosterFor(c),ids=roster.map(op=>op.id),roles=Object.fromEntries(roster.map(op=>[op.name,op.id]));
 const {physician,carrier,donor,patient1:p1,patient2:p2}=roles;
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:id===donor?'watch-post':'camp'});assert.equal(c.resources.treasury,cash-quote.total);}
 c=order(c,{type:'transport',mode:'posta'});
 c=order(c,{type:'createSquad',ids:[donor],sector:'watch-post',name:'Reserva de vendas'});const remote=c.activeSquadId;
 const clear=()=>{const pair=visit(c),battle=actBattle(pair.battle,{type:'explore'});assert.equal(battle.lastError,null);c=leave({...pair,battle});};
 if(clearSource)clear();const home=c.squads.find(q=>q.location==='camp'&&q.members.includes(physician)).id;c=order(c,{type:'selectSquad',id:home});clear();
 c=order(c,{type:'assignCare',operativeId:carrier,assignment});
 if(assignment==='doctor'){
  c=order(c,{type:'assignCare',operativeId:p1,assignment:'patient'});const deadline=clock(c)+3600;
  for(let n=0;clock(c)<deadline&&n<5;n++)c=order(c,{type:'wait',hours:1});assert.equal(clock(c),deadline);assert.equal(c.operativeState[carrier].medkits,0);
 }
 if(nearExpiry){const deadline=clock(c)+23*3600;for(let n=0;clock(c)<deadline&&n<30;n++)c=order(c,{type:'wait',hours:Math.ceil((deadline-clock(c))/3600)});assert.equal(clock(c),deadline);}
 assert.deepEqual(d,documents);return {campaign:saved(c),ids,physician,carrier,donor,reliefCarrier:roles.reliefCarrier,patients:[p1,p2],home,remote};
}
function run(start,physician,requested,options={}){
 let campaign=start;const events=[],route=createFreshRouteOrders(()=>campaign,next=>{campaign=next;},{report:e=>events.push(e)});
 const result=collectKnownCuyoDressings(()=>campaign,route.order,physician,requested,{ownedCarried:true,donorReserve:1,...options,report:e=>events.push(e)});
 return {campaign:result,events};
}
function replay(start,campaign,events){let c=start;const actions=events.filter(e=>['freshRouteOrder','freshRouteRenewal'].includes(e.event)).map(e=>e.action);for(const [i,a]of actions.entries()){c=order(c,a);if(i===Math.floor(actions.length/2))c=saved(c);}assert.deepEqual(saved(c),campaign);}
function physical(before,after){for(const id of before.recruited)for(const key of ['alive','captured','hp','maxHp','bleeding','inventory','carriedLoaded','carriedJammed','primaryWeapon','bladeWeapon','weaponInstanceId','condition'])assert.deepEqual(after.operativeState[id][key],before.operativeState[id][key],`${id}: ${key}`);}

test('an owned-source opt-in pays a real roundtrip, donor parcel and renewal while preserving reserve and resting carrier membership',()=>{
 const {campaign:start,physician,carrier,donor,home,remote}=setup({nearExpiry:true}),before=structuredClone(start),oldGroups=start.squads.map(q=>({id:q.id,members:[...q.members],location:q.location}));
 assert.deepEqual(knownCuyoDressingSources(start,physician),[]);assert.equal(knownCuyoDressingSources(start,physician,{ownedCarried:true,donorReserve:1})[0].owned,7);
 assert.throws(()=>run(start,physician,4,{ownedCarried:false}),/No known controlled finite medical source/);
 const {campaign:c,events}=run(start,physician,4),arrivals=events.filter(e=>e.event==='cuyoKnownCourierArrival');assert.equal(arrivals.length,2);assert.ok(arrivals.every(e=>e.arrivedSeconds>e.departedSeconds&&e.quote.valid));
 assert.equal(clock(c)-clock(start),arrivals.reduce((sum,e)=>sum+(e.arrivedSeconds-e.departedSeconds),0));assert.equal(total(c),total(start));assert.equal(c.operativeState[donor].medkits,4);assert.equal(c.operativeState[physician].medkits,4);assert.equal(c.operativeState[carrier].medkits,0);
 assert.equal(c.operativeState[donor].location,'watch-post');assert.deepEqual(c.squads.find(q=>q.id===remote),start.squads.find(q=>q.id===remote));assert.equal(c.operativeState[carrier].assignment,'rest');assert.equal(c.activeSquadId,home);
 assert.deepEqual(c.squads.filter(q=>q.members.length).map(q=>({id:q.id,members:q.members,location:q.location})),oldGroups.filter(q=>q.members.length));
 const actions=events.filter(e=>e.event==='freshRouteOrder').map(e=>e.action),drop=actions.findIndex(a=>a.type==='sectorInventory'&&a.operativeId===donor&&a.direction==='drop');assert.ok(drop>0);assert.equal(actions[drop].count,4);assert.equal(actions[drop+1].direction,'take');assert.equal(actions[drop+1].operativeId,carrier);assert.equal(actions[drop+1].count,4);
 const renewals=events.filter(e=>e.event==='freshRouteRenewal');assert.ok(renewals.length>0);const fees=arrivals.reduce((sum,e)=>sum+(e.quote.path.length-1)*10,0);assert.equal(c.resources.treasury,start.resources.treasury-fees-renewals.reduce((sum,e)=>sum+e.price,0));
 for(const id of start.recruited)assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));physical(start,c);assert.deepEqual(start,before);replay(start,c,events);
});

test('first shortage fetches one actual wound-based batch before finite local care instead of entering costly natural rest',()=>{
 const {campaign:start,ids,donor,patients}=setup(),before=structuredClone(start),events=[];
 const c=recoverCreatedCuyoLocalPatients(start,ids.filter(id=>id!==donor),{restOnShortage:true,report:e=>events.push(e)});
 assert.equal(events.filter(e=>e.event==='cuyoKnownCourierReturned').length,1);assert.equal(events.filter(e=>e.event==='cuyoKnownCourierArrival').length,2);assert.equal(events.some(e=>e.event==='createdCuyoStableRest'),false);
 const delivered=events.find(e=>e.event==='cuyoKnownCourierReturned').count;assert.equal(delivered,3,'4 and 7 real missing HP need one plus two 5-HP care hours.');
 const ticks=events.filter(e=>e.event==='createdCuyoLocalCare');assert.equal(ticks.filter(e=>e.seconds>0).length,3);assert.equal(ticks.reduce((sum,e)=>sum+e.healed,0),11);assert.equal(total(c),total(start)-3);assert.equal(c.operativeState[donor].medkits,5);
 for(const id of patients){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}assert.deepEqual(start,before);replay(start,c,events);
});

test('a source at its explicit reserve leaves the established stable-rest fallback and never creates a courier',()=>{
 const {campaign:start,ids,physician,donor}=setup({stock:1}),before=structuredClone(start),events=[];assert.deepEqual(knownCuyoDressingSources(start,physician,{ownedCarried:true,donorReserve:1}),[]);
 const c=recoverCreatedCuyoLocalPatients(start,ids.filter(id=>id!==donor),{restOnShortage:true,report:e=>events.push(e)});assert.equal(events.some(e=>e.event==='cuyoKnownCourierReturned'),false);assert.equal(events.find(e=>e.event==='createdCuyoStableRest').ready,true);assert.equal(c.operativeState[donor].medkits,1);assert.equal(total(c),total(start));assert.deepEqual(start,before);replay(start,c,events);
});

test('a real courier encounter exposes the actual paid partial campaign and never falls through to stable-rest success',()=>{
 const {campaign:start,physician}=setup({raid:true}),before=structuredClone(start);let campaign=start;const events=[],route=createFreshRouteOrders(()=>campaign,next=>{campaign=next;},{report:e=>events.push(e)});let caught;
 try{collectKnownCuyoDressings(()=>campaign,route.order,physician,3,{ownedCarried:true,donorReserve:1,report:e=>events.push(e)});}catch(error){caught=error;}
 assert.ok(caught);assert.ok(campaign.pendingEncounter);assert.strictEqual(caught.campaign,campaign);assert.ok(clock(campaign)>clock(start));assert.equal(events.some(e=>e.event==='cuyoKnownCourierReturned'),false);assert.equal(events.filter(e=>e.event==='freshRouteOrder').at(-1).action.type,'wait');
 assert.deepEqual(start,before);
});

test('uncleared owned stock and an unfit local carrier refuse before any paid courier order or stock change',()=>{
 for(const options of [{clearSource:false},{carrierWound:1}]){
  const {campaign:start,physician}=setup(options),before=structuredClone(start);let c=start;const actions=[],route=createFreshRouteOrders(()=>c,next=>{c=next;},{report:e=>actions.push(e)});
  if(options.clearSource===false)assert.deepEqual(knownCuyoDressingSources(start,physician,{ownedCarried:true}),[]);
  assert.throws(()=>collectKnownCuyoDressings(()=>c,route.order,physician,2,{ownedCarried:true}),options.clearSource===false?/No known controlled finite medical source/:/healthy awake local carrier/);
  assert.deepEqual(actions,[]);assert.strictEqual(c,start);assert.deepEqual(start,before);
 }
});

test('a full strongest carrier is skipped for an actual carrier who can pay travel and fit the entire parcel',()=>{
 const {campaign:start,physician,carrier,reliefCarrier,donor}=setup({carrierRations:24,secondCarrier:true}),before=structuredClone(start);
 assert.ok(rosterFor(start).find(op=>op.id===carrier).strength>rosterFor(start).find(op=>op.id===reliefCarrier).strength);
 const {campaign:c,events}=run(start,physician,3);assert.equal(events.find(e=>e.event==='cuyoKnownCourierReturned').carrier,reliefCarrier);assert.equal(c.operativeState[carrier].rations,24);assert.equal(c.operativeState[donor].medkits,5);assert.equal(c.operativeState[physician].medkits,3);assert.equal(total(c),total(start));assert.deepEqual(start,before);replay(start,c,events);
});

test('an all-full carrier set or full physician refuses the complete parcel before any paid order or donation',()=>{
 for(const options of [{carrierRations:24},{physicianRations:24}]){
  const {campaign:start,physician}=setup(options),before=structuredClone(start);let c=start;const events=[],route=createFreshRouteOrders(()=>c,next=>{c=next;},{report:e=>events.push(e)});
  assert.throws(()=>collectKnownCuyoDressings(()=>c,route.order,physician,3,{ownedCarried:true}),options.carrierRations?/carrier with room/:undefined);
  assert.deepEqual(events,[]);assert.strictEqual(c,start);assert.deepEqual(start,before);
 }
});

test('the unchanged scene-only default still fetches a genuine known parcel without admitting more owned stock',()=>{
 let {campaign:c,physician,donor}=setup({assignment:'active'});c=order(c,{type:'sectorInventory',sector:'watch-post',operativeId:donor,direction:'drop',item:'medkits',count:3});const start=saved(c),before=structuredClone(start);
 const result=run(start,physician,3,{ownedCarried:false});assert.equal(result.campaign.operativeState[donor].medkits,5);assert.equal(result.campaign.operativeState[physician].medkits,3);assert.equal(result.events.some(e=>e.event==='cuyoKnownCourierDonation'),false);assert.equal(total(result.campaign),total(start));assert.deepEqual(start,before);replay(start,result.campaign,result.events);
});

test('a doctor who actually spent the last dressing gets paid active travel and a legal rest assignment after delivery',()=>{
 const {campaign:start,physician,carrier}=setup({assignment:'doctor'}),before=structuredClone(start);assert.equal(start.operativeState[carrier].assignment,'doctor');assert.equal(start.operativeState[carrier].medkits,0);
 const {campaign:c,events}=run(start,physician,3);assert.equal(c.operativeState[carrier].assignment,'rest');assert.equal(c.operativeState[carrier].medkits,0);assert.equal(c.operativeState[physician].medkits,3);
 const assignments=events.filter(e=>e.event==='freshRouteOrder'&&e.action.type==='assignCare'&&e.action.operativeId===carrier).map(e=>e.action.assignment);assert.deepEqual(assignments,['active','rest']);assert.equal(total(c),total(start));assert.deepEqual(start,before);replay(start,c,events);
});
