import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {operativeLocation} from '../game/squads.js';
import {getReachable,hasLineOfSight,lookPreview,environmentUsePreview} from '../game/tactical.js';
import {sameSurface,spacePoint} from '../game/tactical-space.js';
import {order,visit,tactical,saved} from './local-contract-fixture.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {attemptCollectRouteItems,collectRouteItems,collectRouteMedicalSupplies,knownRouteMedicalSources,authoredRouteMedicalDiscoveries} from './finite-route-equipment.mjs';

const clinic='camp',source='watch-post',sourceCache='source-cache',clinicCache='clinic-cache',trapChest='source-trap',hiddenChest='hidden-stock';
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const medkits=count=>({item:'medkits',count,weight:.2});
const chest=(id,x,y)=>({id,type:'chest',x,y,footprint:{width:1,height:1},blocksMovement:true});
const medicalTotal=(c,at,id=null)=>sectorInventorySites(c,at).reduce((sum,site)=>sum+sectorInventoryModel(c,site.id,rosterFor(c),id).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0),0);

// All stock, health, terrain, trap effects, ownership and routes are authored
// before either campaign factory. Later setup uses only accepted Native orders.
function declare({stock='ground',clinicStock=0,clinicChest=false,hidden=false,disconnected=false}={}){
 const d=scaffoldDocuments('finite-medical-source-courier'),base=d.content.characters[0];
 d.content.rules.startingTreasury=5000;
 d.content.startingTerritory[source].owner='patriot';
 d.world.arrivalFacilities[source]=['barracks'];d.content.arrivalSites.push({sector:source,facilities:['barracks']});
 d.world.expansion.buildingTargets={[clinic]:0,[source]:0};
 d.world.physical={version:1,caches:{},arsenals:{},environment:{}};
 d.world.exitLinks=disconnected?[]:[[clinic,'E',19,8,source,'W',0,8]];
 if(disconnected)for(const sector of d.world.sectors)sector.neighbors=[];
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const people=[{name:'physician',medical:80,strength:80},{name:'patient',medical:0,wound:4},{name:'scout',medical:0},...(stock==='corpse'?[{name:'carrier',medical:0,kits:3}]:[])];
 d.content.characters=people.map(person=>({...structuredClone(base),id:'courier-'+person.name,name:person.name,nickname:person.name,monthlyPay:300,arrivalHours:0,serviceGuarantee:31,
  attributes:{...base.attributes,maxHp:70,medical:person.medical,strength:person.strength??60},
  startingSupplies:{rations:0,torches:0,medkits:person.kits??0,boleadoras:0},
  startingCondition:{hp:70-(person.wound??0),energy:100,fatigue:0,bleeding:0,bandaged:person.wound??0}}));
 d.maps[source].spawns=[{id:'witness',x:3,y:8,side:'player'},{id:'carrier',x:3,y:9,side:'player'},{id:'opposition',x:16,y:8,side:'enemy'}];
 d.maps[source].items=stock==='ground'?[{id:'source-dressings',type:'medkits',count:3,x:5,y:8}]:[];
 d.maps[source].props=[];d.maps[clinic].props=[];
 if(clinicChest){
  d.maps[clinic].props.push(chest(clinicCache,5,8));
  d.world.physical.caches[clinic]={chest:clinicCache,contents:[...(clinicStock?[medkits(clinicStock)]:[]),{item:'torches',count:1,weight:.4}]};
 }
 if(stock==='cache'){
  d.maps[source].props.push(chest(sourceCache,5,8));
  d.world.physical.caches[source]={chest:sourceCache,contents:[medkits(3),{item:'torches',count:1,weight:.4}]};
 }
 if(stock==='corpse'){
  d.maps[source].props.push(chest(trapChest,5,8));
  d.world.physical.environment[source]={doors:[],containers:[{selector:{type:'chest',id:trapChest},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,discoveredBy:[],damage:100,breathLoss:0}}}]};
 }
 if(hidden){
  d.maps[source].props.push(chest(hiddenChest,8,11));
  d.world.physical.environment[source]??={doors:[],containers:[]};
  d.world.physical.environment[source].containers.push({selector:{type:'chest',id:hiddenChest},configuration:{type:'chest',open:false,locked:false,contents:[medkits(17)]}});
 }
 return d;
}

function observeBody(pair,witnessId,bodyId){
 let p=pair;
 const body=()=>p.battle.units.find(unit=>unit.id===String(bodyId)),witness=()=>p.battle.units.find(unit=>unit.id===String(witnessId));
 assert.equal(body().hp,0);assert.ok(witness().hp>=15&&!witness().unconscious);
 const near=point=>sameSurface(point,body())&&Math.abs(point.x-body().x)+Math.abs(point.y-body().y)<=1&&hasLineOfSight(p.battle,point,body());
 if(!near(witness())){
  const destination=getReachable(p.battle,witness()).filter(near).sort((a,b)=>a.cost-b.cost)[0];
  assert.ok(destination,'The actual paid witness must have an ordinary path to the body.');
  p=tactical(p,{type:'move',unitId:String(witnessId),...spacePoint(destination)});
 }
 assert.ok(near(witness()));
 if(lookPreview(p.battle,witness(),body()).valid)p=tactical(p,{type:'look',unitId:String(witnessId),...spacePoint(body())});
 p=tactical(p,{type:'ambient'});
 assert.equal(body().knownToPlayer,true,'The living witness must discover the actual finite body.');
 return p;
}

function setup(options={}){
 const {stock='ground',discoverSource=true,disconnected=false,mode='march'}=options;
 const declared=declare(options),original=structuredClone(declared),definition=compileCampaignPackage(declared.manifest,declared);
 let c=initialCampaign(8,definition);const roles=Object.fromEntries(rosterFor(c).map(op=>[op.name,op.id]));
 const hire=(id,destination)=>{
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;
  assert.equal(quote.available,true,quote.reason);assert.ok(quote.total>0);
  c=order(c,{type:'recruitCivic',id,term:'week',destination});assert.equal(c.resources.treasury,cash-quote.total);
 };
 hire(roles.physician,clinic);hire(roles.patient,clinic);
 const home=c.activeSquadId;
 if(mode==='posta')c=order(c,{type:'transport',mode:'posta'});
 if(discoverSource){
  hire(roles.scout,source);if(stock==='corpse')hire(roles.carrier,source);
  c=order(c,{type:'createSquad',ids:stock==='corpse'?[roles.scout,roles.carrier]:[roles.scout],sector:source,name:'Reconocimiento real'});
  let p=visit(c);
  if(stock==='cache')p=takeFiniteCache(p,roles.scout,[],{cacheId:sourceCache});
  if(stock==='corpse'){
   const carrier=p.battle.units.find(unit=>unit.id===String(roles.carrier)),ref={kind:'container',id:trapChest};
   assert.equal(carrier.hp,carrier.maxHp);assert.equal(carrier.hp,70);assert.equal(carrier.medkits,3);
   const quote=environmentUsePreview(p.battle,carrier,ref,'open');assert.equal(quote.valid,true,quote.reason);
   p=tactical(p,{type:'useItem',unitId:String(roles.carrier),environment:{...ref,verb:'open'}});
   assert.equal(p.battle.units.find(unit=>unit.id===String(roles.carrier)).hp,0,'The actual authored trap must cause the casualty.');
   assert.equal(p.battle.props.find(prop=>prop.id===trapChest).trap.armed,false);
   p=observeBody(p,roles.scout,roles.carrier);
  }
  p=tactical(p,{type:'explore'});c=leaveFiniteCache(p);
  assert.equal(medicalTotal(c,source,roles.scout),stock==='ground'||stock==='cache'||stock==='corpse'?3:0);
  if(stock==='corpse')assert.equal(c.operativeState[roles.carrier].alive,false);
  c=disconnected?order(c,{type:'dismiss',id:roles.scout}):completeTestTravel(c,{sector:clinic});
  c=order(c,{type:'selectSquad',id:home});
 }
 let p=visit(c);p=tactical(p,{type:'explore'});c=leaveFiniteCache(p);
 c=order(c,{type:'assignCare',id:roles.patient,assignment:'patient'});
 assert.deepEqual(declared,original);
 return {campaign:saved({campaign:c}).campaign,roles,home};
}

function remembered(c,expectedKind,expectedCount){
 const before=structuredClone(c),sources=knownRouteMedicalSources(c,clinic);
 assert.deepEqual(c,before);assert.equal(sources.length,1);assert.equal(sources[0].at,source);assert.equal(sources[0].available,expectedCount);
 assert.equal(sources[0].admission,'remembered');assert.equal(sources[0].accessAdmitted,false);
 assert.ok(sources[0].rows.some(row=>row.kind===expectedKind));
 for(const row of sources[0].rows){
  assert.equal(row.operativeId,null);assert.equal(row.admission,'remembered');assert.equal(row.accessAdmitted,false);
  for(const key of ['reachable','expected','sourceKey','key','action'])assert.equal(Object.hasOwn(row,key),false);
 }
 return sources[0];
}

function collect(start,roles,count,mode='march'){
 const before=structuredClone(start),events=[],result=collectRouteMedicalSupplies(start,roles.physician,count,{mode,report:event=>events.push(event)}),c=result.campaign;
 assert.deepEqual(start,before);assert.equal(result.collected,count);assert.equal(c.operativeState[roles.physician].medkits,start.operativeState[roles.physician].medkits+count);
 assert.equal(operativeLocation(c,roles.physician),clinic);assert.equal(c.activeSquadId,start.activeSquadId);
 assert.equal(c.operativeState[roles.patient].hp,start.operativeState[roles.patient].hp);assert.equal(c.operativeState[roles.patient].assignment,'patient');assert.equal(operativeLocation(c,roles.patient),clinic);
 assert.ok(clock(c)>clock(start));assert.ok(contractExpiresSeconds(c.contracts[roles.physician])>clock(c));
 assert.deepEqual(saved({campaign:c}).campaign,c);assert.ok(events.some(event=>event.event==='finiteMedicalCourier'&&event.source===source&&event.quantity===count));
 return {campaign:c,events};
}

test('an unmanned non-cache sector retains remembered dressings until an actual paid posta courier takes them',()=>{
 const {campaign:start,roles}=setup({mode:'posta'});remembered(start,'ground',3);
 assert.deepEqual(authoredRouteMedicalDiscoveries(start,clinic),[]);
 const {campaign:c,events}=collect(start,roles,2,'posta');remembered(c,'ground',1);
 assert.equal(medicalTotal(c,source),1);
 const trip=events.find(event=>event.event==='finiteMedicalCourier'),renewals=events.filter(event=>event.event==='medicalCourierRenewal').reduce((sum,event)=>sum+event.cost,0);
 assert.equal(start.resources.treasury-c.resources.treasury,10*(trip.outward.path.length+trip.returning.path.length-2)+renewals);
});

test('a real witnessed trap casualty remains dead while a courier recovers its finite remembered dressings',()=>{
 const {campaign:start,roles}=setup({stock:'corpse'});remembered(start,'body',3);
 const {campaign:c}=collect(start,roles,2);remembered(c,'body',1);
 assert.equal(start.operativeState[roles.carrier].alive,false);assert.equal(c.operativeState[roles.carrier].alive,false);
 const body=c.sectorStates[source].units.find(unit=>unit.id===String(roles.carrier));assert.equal(body.hp,0);assert.equal(body.medkits,1);
 assert.equal(medicalTotal(c,source)+c.operativeState[roles.physician].medkits,3);
});

test('an ordinary empty local discovery retains its successful paid prefix before the remote trip',()=>{
 const first=setup({clinicChest:true}),second=setup({clinicChest:true});assert.deepEqual(first.campaign,second.campaign);
 const before=structuredClone(first.campaign),attempt=attemptCollectRouteItems(first.campaign,first.roles.physician,{item:'medkits'},2);
 assert.equal(attempt.supplied,false);assert.equal(attempt.collected,0);assert.ok(clock(attempt.campaign)>clock(first.campaign));
 assert.equal(attempt.campaign.sectorStates[clinic].props.find(prop=>prop.id===clinicCache).open,true);assert.deepEqual(first.campaign,before);
 const expected=collect(attempt.campaign,first.roles,2).campaign,actual=collect(second.campaign,second.roles,2).campaign;
 assert.deepEqual(actual,expected,'The remote plan must start after every accepted local discovery order.');
});

test('the strict wrapper still accepts a finite partial collection and throws its exact ordinary shortage message',()=>{
 const partial=setup({stock:'none',discoverSource:false,clinicChest:true,clinicStock:1}),before=structuredClone(partial.campaign);
 const result=collectRouteItems(partial.campaign,partial.roles.physician,{item:'medkits'},4);
 assert.equal(result.collected,1);assert.deepEqual(Object.keys(result).sort(),['campaign','collected']);assert.deepEqual(partial.campaign,before);
 const empty=setup({stock:'none',discoverSource:false,clinicChest:true}),unchanged=structuredClone(empty.campaign);
 assert.throws(()=>collectRouteItems(empty.campaign,empty.roles.physician,{item:'medkits'},4),{message:'finite local equipment or carrying room is exhausted: camp {"item":"medkits"}'});
 assert.deepEqual(empty.campaign,unchanged);
});

test('the attempt API does not convert a genuine Native refusal into an ordinary shortage',()=>{
 const {campaign:start,roles}=setup({stock:'none',discoverSource:false,clinicChest:true}),courier=order(start,{type:'createSquad',ids:[roles.physician],sector:clinic,name:'Portador presente'}),pending=visit(courier).campaign,before=structuredClone(pending);
 assert.throws(()=>attemptCollectRouteItems(pending,roles.physician,{item:'medkits'},1),/Hay una batalla pendiente/);
 assert.deepEqual(pending,before);
});

test('known cache rows count once and an exhausted chest never regains its authored initial stock',()=>{
 const {campaign:start,roles}=setup({stock:'cache',hidden:true});remembered(start,'container',3);assert.deepEqual(authoredRouteMedicalDiscoveries(start,clinic),[]);
 const {campaign:c}=collect(start,roles,3);
 assert.deepEqual(knownRouteMedicalSources(c,clinic),[]);assert.deepEqual(authoredRouteMedicalDiscoveries(c,clinic),[]);
 const cache=c.sectorStates[source].props.find(prop=>prop.id===sourceCache),hidden=c.sectorStates[source].props.find(prop=>prop.id===hiddenChest);
 assert.deepEqual(cache.contents,[{item:'torches',count:1,weight:.4}]);assert.equal(hidden.open,false);assert.deepEqual(hidden.contents,[medkits(17)]);
});

test('an unvisited pinned authored cache requires real discovery before supplying a courier',()=>{
 const {campaign:start,roles}=setup({stock:'cache',discoverSource:false});assert.deepEqual(knownRouteMedicalSources(start,clinic),[]);
 const fallback=authoredRouteMedicalDiscoveries(start,clinic);assert.equal(fallback.length,1);assert.equal(fallback[0].at,source);assert.equal(fallback[0].authoredCount,3);assert.equal(fallback[0].admission,'discovery-required');assert.equal(fallback[0].accessAdmitted,false);
 const {campaign:c}=collect(start,roles,2);remembered(c,'container',1);
 const cache=c.sectorStates[source].props.find(prop=>prop.id===sourceCache);assert.equal(cache.open,true);assert.equal(cache.knownToPlayer,true);assert.equal(cache.contents.find(stack=>stack.item==='medkits').count,1);
});

test('a closed non-cache chest and a disconnected controlled source cannot enter the courier census',()=>{
 const hidden=setup({stock:'none',hidden:true});assert.deepEqual(knownRouteMedicalSources(hidden.campaign,clinic),[]);assert.deepEqual(authoredRouteMedicalDiscoveries(hidden.campaign,clinic),[]);
 const cut=setup({disconnected:true});assert.equal(medicalTotal(cut.campaign,source),3);
 assert.deepEqual(knownRouteMedicalSources(cut.campaign,clinic),[]);assert.deepEqual(authoredRouteMedicalDiscoveries(cut.campaign,clinic),[]);
});
