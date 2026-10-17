import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {artilleryStorageQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {actBattle,presentedActBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {visit,leave} from './local-contract-fixture.mjs';
import {recoverFreshUspallata} from './fresh-mountain-route.mjs';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';
import {collectRouteMedicalSupplies} from './finite-route-equipment.mjs';
import {previewStrategicRoute} from '../game/strategic-route.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const canonical=c=>{const n=structuredClone(c);for(const key of ['sectorStates','sceneStates'])if(n[key])for(const id of Object.keys(n[key]))n[key][id]=expandCellScene(n[key][id]);return n;};
const saved=c=>{const result=decodeSave(encodeSave(c)).campaign;assert.deepEqual(canonical(result),canonical(c));return result;};
const property=(c,id)=>Object.fromEntries(['alive','hp','bleeding','bandaged','weapon','weaponInstanceId','weaponFittings','condition','blade','ammo','carriedLoaded','inventory','medkits','rations','torches','boleadoras'].map(key=>[key,structuredClone(c.operativeState[id][key]===undefined&&key==='inventory'?{}:c.operativeState[id][key]===undefined&&key==='carriedLoaded'?0:c.operativeState[id][key])]));

// Declare every condition, role, road and finite gun before the factory.
// Monthly hires, a Native bleeding hour and real travel earn this boundary;
// the fixture declares control of the pass and claims no campaign victory.
function setup({enoughLocals=false,noSupport=false,critical=false,clinicSupply=null}={}){
 const d=scaffoldDocuments('uspallata-earned-storage-crew');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','uspallata').replaceAll('"camp"','"mendoza"').replaceAll('camp:','mendoza:'));
 d.content.rules.startingTreasury=20000;d.content.startingTerritory.uspallata.owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.campaignRoles={foundryEngineer:'engineer',marchCommander:'commander'};
 d.world.expansion.buildingTargets={mendoza:0,uspallata:0};d.world.exitLinks=[['mendoza','E',19,8,'uspallata','W',0,8]];
 const people=[['field-doctor',40,20],['field-soldier',0,20],['fallen',0,20],['support',20,30],['rear-physician',80,50],['engineer',0,40],['commander',0,90],['posted',0,20],...(enoughLocals?[['third-local',0,20]]:[])],base=d.content.characters[0];
 d.content.characters=people.map(([id,medical,leadership])=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical,leadership},startingSupplies:{rations:8,torches:1,medkits:clinicSupply?(id==='field-doctor'?3:0):id==='rear-physician'?16:medical>=40?3:1,boleadoras:0},
  startingCondition:{hp:id==='fallen'?1:80,bleeding:id==='fallen'?1:0,bandaged:0,energy:100,fatigue:0}}));
 const resident={...structuredClone(base),id:'representative',name:'Representante de Mendoza',nickname:'Representante',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,
  encounter:{recruitable:false,greeting:'El acuerdo local no adelanta fondos.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}};delete resident.arrivalHours;
 d.content.characters.push(resident);d.content.placements=[{id:'mendoza-representative',character:'representative',mode:'fixed',sectors:['mendoza'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 d.world.incomeSources=[{id:'mendoza-income',name:'Mendoza',source:'Acuerdo local',sectorId:'mendoza',requiredSectors:['mendoza'],dailyAmount:0,representative:{npcId:'authored-representative',name:'Representante de Mendoza',sectorId:'mendoza'}}];
 d.world.sectors.find(sector=>sector.id==='uspallata').biome='mountain';
 d.maps.uspallata.spawns=[{id:'entry',x:18,y:8,side:'player'},{id:'opposition',x:2,y:8,side:'enemy'}];
 d.maps.uspallata.props=[{id:'finite-battery',type:'chest',x:16,y:7,footprint:{width:1,height:1},blocksMovement:true},
  ...(critical?[{id:'critical-trap',type:'chest',x:17,y:10,footprint:{width:1,height:1},blocksMovement:true}]:[])];
 if(critical)d.world.physical.environment.uspallata={doors:[],containers:[{selector:{type:'chest',id:'critical-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:74,breathLoss:0,discoveredBy:[]}}}]};
 d.world.physical.caches.uspallata={chest:'finite-battery',contents:clinicSupply==='finite'?[{item:'medkits',count:20}]:[]};
 d.world.physical.arsenals.uspallata={version:1,sector:'uspallata',chest:'finite-battery',pieces:[
  {id:'arsenal:storage:heavy',type:'field8',side:'player',loaded:false,ammo:3},
  {id:'arsenal:storage:swivel',type:'swivel',side:'player',loaded:true,ammo:1}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:24,reserve:1,raidEveryHours:240,axis:['uspallata']}}};
 const rearAssignment=clinicSupply?'rest':'doctor',declaration=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(definition),[]);
 let c=initialCampaign(42,definition);const ids=Object.fromEntries(rosterFor(c).map(op=>[op.name,op.id])),payments=[];
 for(const [name]of people){
  if(noSupport&&name==='support')continue;
  const id=ids[name],quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;assert.ok(quote.available&&quote.total>0);
  c=order(c,{type:'recruitCivic',id,term:'month',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.total);payments.push(quote.total);
 }
 c=order(c,{type:'squad',ids:[ids['field-doctor'],ids['field-soldier'],ids.fallen]});
 const beforeDeath=clock(c);c=order(c,{type:'wait',hours:1});assert.equal(clock(c),beforeDeath+3600);assert.equal(c.operativeState[ids.fallen].alive,false);assert.equal(c.operativeState[ids.fallen].hp,0);
 c=meetLocalIncomeRepresentative(c,{sourceId:'mendoza-income',operativeId:ids['field-doctor']});assert.ok(c.townIncome.activations['mendoza-income']);
 c=order(c,{type:'createSquad',name:'Puesto de Mendoza',ids:[ids.posted],sector:'mendoza'});
 for(const name of ['engineer','commander',...(noSupport?[]:['support'])])c=order(c,{type:'assignCare',operativeId:ids[name],assignment:'rest'});
 c=order(c,{type:'assignCare',operativeId:ids['rear-physician'],assignment:rearAssignment});
 const locals=[ids['field-doctor'],ids['field-soldier'],...(enoughLocals?[ids['third-local']]:[])];
 c=order(c,{type:'createSquad',name:'Supervivientes del paso',ids:locals,sector:'mendoza'});
 c=order(c,{type:'transport',mode:'posta'});c=order(c,{type:'travel',sector:'uspallata',mode:'posta'});
 c=leaveFiniteCache(takeFiniteCache(visit(c),locals[0],[],{cacheId:'finite-battery'}));
 if(critical){
  const pair=takeFiniteCache(visit(c),ids['field-soldier'],[],{cacheId:'critical-trap'}),patient=pair.battle.units.find(unit=>unit.id===String(ids['field-soldier']));
  assert.equal(patient.hp,6);assert.ok(patient.bleeding>0);assert.equal(pair.battle.props.find(prop=>prop.id==='critical-trap').trap.armed,false);assert.equal(pair.battle.status,'active');
  c=leaveFiniteCache(pair);assert.equal(c.operativeState[ids['field-soldier']].hp,6);assert.ok(c.operativeState[ids['field-soldier']].alive&&c.operativeState[ids['field-soldier']].bleeding>0);
 }
 assert.equal(c.sectorStates.uspallata.artillery.length,2);assert.equal(c.resources.treasury,20000-payments.reduce((sum,n)=>sum+n,0)-150-10);
 assert.deepEqual(d,declaration);return {campaign:saved(c),ids,locals};
}

// Replay only the successful fresh route's actual Native actions. First aid
// visits and the finite battery helper have explicit public trace boundaries.
function replay(start,events){
 let c=saved(start),aid=null;
 for(const event of events){
  if(['freshRouteOrder','freshRouteRenewal'].includes(event.event))c=order(c,event.action);
  if(event.event==='freshMountainAidOrders'){
   aid=visit(c);
   for(const action of event.steps){const next=actBattle(aid.battle,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(aid.battle,action).state,next);aid.battle=next;}
  }
  if(event.event==='freshMountainAidCheckpoint'){
   const synced=syncBattleTime(aid.campaign,aid.battle);assert.equal(synced.error,null);assert.deepEqual(canonical(synced.campaign),canonical(event.campaign));assert.deepEqual(synced.battle,event.battle);c=leave(synced);aid=null;
  }
  if(event.event==='routeBatteryStored'){
   for(const id of c.squad)if(c.operativeState[id].assignment!=='active')c=order(c,{type:'assignCare',id,assignment:'active'});
   assert.equal(artilleryStorageQuote(c,event.sector,event.id).available,true);c=order(c,{type:'storeArtillery',sector:event.sector,artilleryId:event.id});
  }
 }
 return saved(c);
}

test('a Native-earned critical wound and permanent death need finite care and one paid unassigned storage support round trip',()=>{
 const {campaign:start,ids,locals}=setup({critical:true}),before=structuredClone(start),events=[],guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord),dead=property(start,ids.fallen);
 assert.equal(locals.length,2);assert.equal(artilleryProfile(start,guns[0]).crew,3);assert.equal(artilleryStorageQuote(start,'uspallata',guns[0].id).available,false);
 assert.equal(start.squads.some(q=>q.members.includes(ids.support)),false);assert.equal(operativeLocation(start,ids.support),'mendoza');
 const rear=Object.fromEntries(['engineer','commander','rear-physician','posted'].map(name=>{const id=ids[name];return [id,{property:property(start,id),assignment:start.operativeState[id].assignment,home:structuredClone(start.squads.find(q=>q.members.includes(id))),post:structuredClone(start.operativeState[id].residentPosition)}];}));
 const c=recoverFreshUspallata(start,{batteryIds:guns.map(g=>g.id),report:event=>events.push(structuredClone(event))}),arrival=events.find(e=>e.event==='uspallataStorageSupportArrived'),returned=events.find(e=>e.event==='uspallataStorageSupportReturned');
 assert.deepEqual(arrival.ids,[ids.support]);assert.deepEqual(returned.ids,[ids.support]);assert.ok(arrival.quote.valid&&arrival.elapsedSeconds>0&&arrival.elapsedSeconds<=168*3600);
 assert.equal(arrival.quote.action.mode,'posta');assert.ok(arrival.campaign.squad.includes(ids.support));assert.equal(arrival.campaign.squad.length,3);
 assert.equal(operativeLocation(c,ids.support),'mendoza');assert.equal(c.operativeState[ids.support].assignment,start.operativeState[ids.support].assignment);assert.equal(c.squads.some(q=>q.members.includes(ids.support)),false);
 assert.deepEqual(c.squads.find(q=>q.id===arrival.home),start.squads.find(q=>q.id===arrival.home));
 assert.deepEqual(c.artilleryDepots.uspallata,guns);assert.deepEqual(c.sectorStates.uspallata.artillery,[]);assert.deepEqual(c.artilleryDepots.mendoza??[],[]);assert.deepEqual(c.artilleryTransfers??[],[]);
 assert.equal(c.resources.treasury,start.resources.treasury-150-30);assert.ok(clock(c)>clock(start));assert.equal(c.sectors.uspallata.fort,start.sectors.uspallata.fort+1);
 assert.deepEqual(c.contracts,start.contracts);for(const id of start.recruited.filter(id=>start.operativeState[id].alive))assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));
 const aid=events.find(e=>e.event==='freshMountainAidCheckpoint'),strokes=events.filter(e=>e.event==='freshMountainAidOrders').flatMap(e=>e.steps).filter(action=>action.type==='useItem'),care=events.filter(e=>e.event==='mountainMedicalCare');
 assert.ok(strokes.length>0);assert.equal(start.operativeState[ids['field-doctor']].medkits-aid.battle.units.find(unit=>unit.id===String(ids['field-doctor'])).medkits,strokes.length);
 assert.equal(aid.battle.units.find(unit=>unit.id===String(ids['field-soldier'])).hp,15);assert.equal(aid.battle.units.find(unit=>unit.id===String(ids['field-soldier'])).bleeding,0);
 const clinicalStart=events.find(e=>e.event==='freshRouteOrder'&&e.action.type==='assignCare'&&e.action.operativeId===ids['field-soldier']&&e.action.assignment==='patient').campaign,clinicHours=c.hour-clinicalStart.hour;
 const waits=events.filter(e=>e.event==='freshRouteOrder'&&e.action.type==='wait'&&e.campaign.operativeState[ids['field-soldier']].assignment==='patient');let previous=clock(clinicalStart),elapsed=0;
 for(const event of waits){const delta=clock(event.campaign)-previous;assert.ok(delta>=0&&delta<=3600);elapsed+=delta;previous=clock(event.campaign);}
 assert.equal(elapsed,clock(c)-clock(clinicalStart));assert.ok(care.length>0&&care.length<=48&&clinicHours>0&&clinicHours<=48);
 assert.equal(start.operativeState[ids['rear-physician']].medkits-c.operativeState[ids['rear-physician']].medkits,clinicHours);
 assert.equal(c.operativeState[ids['field-soldier']].hp,c.operativeState[ids['field-soldier']].maxHp);assert.equal(c.operativeState[ids['field-soldier']].bleeding,0);
 assert.equal(start.recruited.reduce((n,id)=>n+start.operativeState[id].medkits,0)-c.recruited.reduce((n,id)=>n+c.operativeState[id].medkits,0),strokes.length+clinicHours);
 const held=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!['hp','bleeding','bandaged','medkits'].includes(key)));
 assert.deepEqual(property(c,ids.support),property(start,ids.support));for(const id of locals)assert.deepEqual(held(property(c,id)),held(property(start,id)));assert.deepEqual(property(c,ids.fallen),dead);
 for(const key of ['hp','bleeding','bandaged'])assert.equal(c.operativeState[ids['field-doctor']][key],start.operativeState[ids['field-doctor']][key]);assert.equal(c.operativeState[ids['field-soldier']].medkits,start.operativeState[ids['field-soldier']].medkits);
 for(const [id,record]of Object.entries(rear)){assert.deepEqual(id===String(ids['rear-physician'])?held(property(c,id)):property(c,id),id===String(ids['rear-physician'])?held(record.property):record.property);assert.equal(c.operativeState[id].assignment,record.assignment);assert.deepEqual(c.squads.find(q=>q.members.includes(Number(id))),record.home);assert.deepEqual(c.operativeState[id].residentPosition,record.post);}
 assert.equal(c.operativeState[ids['rear-physician']].hp,start.operativeState[ids['rear-physician']].hp);assert.equal(c.operativeState[ids['rear-physician']].bleeding,0);assert.equal(c.operativeState[ids['rear-physician']].bandaged,start.operativeState[ids['rear-physician']].bandaged);assert.ok(c.operativeState[ids['rear-physician']].medkits>0);
 assert.deepEqual(canonical(replay(start,events)),canonical(c));saved(c);assert.deepEqual(start,before);
});

test('an already sufficient local crew stores the same finite guns without borrowing or moving Mendoza support',()=>{
 const {campaign:start,ids}=setup({enoughLocals:true}),before=structuredClone(start),events=[],guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord);
 assert.equal(artilleryStorageQuote(start,'uspallata',guns[0].id).available,true);
 const c=recoverFreshUspallata(start,{batteryIds:guns.map(g=>g.id),report:event=>events.push(structuredClone(event))});
 assert.equal(events.some(e=>e.event.startsWith('uspallataStorageSupport')),false);assert.equal(events.filter(e=>e.event==='freshRouteOrder'&&e.action.type==='travel').length,1);
 assert.equal(c.resources.treasury,start.resources.treasury-150-10);assert.deepEqual(c.artilleryDepots.uspallata,guns);assert.deepEqual(property(c,ids.support),property(start,ids.support));
 assert.equal(c.operativeState[ids.support].assignment,start.operativeState[ids.support].assignment);assert.equal(c.squads.some(q=>q.members.includes(ids.support)),false);assert.deepEqual(canonical(replay(start,events)),canonical(c));assert.deepEqual(start,before);
});

test('the storage shortage refuses rather than hiring at the pass or borrowing occupied, engineer, physician or command roles',()=>{
 const {campaign:start,ids}=setup({noSupport:true}),before=structuredClone(start),events=[],guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord);
 assert.equal(start.recruited.includes(ids.support),false);
 assert.throws(()=>recoverFreshUspallata(start,{batteryIds:guns.map(g=>g.id),report:event=>events.push(structuredClone(event))}),/eligible unassigned Mendoza support/);
 const actions=events.filter(e=>e.event==='freshRouteOrder').map(e=>e.action);
 assert.equal(actions.some(a=>['travel','recruitCivic','renewContract','storeArtillery'].includes(a.type)),false);assert.equal(events.some(e=>e.event.startsWith('uspallataStorageSupport')),false);
 const last=events.filter(e=>e.event==='freshRouteOrder').at(-1).campaign;
 assert.equal(last.resources.treasury,start.resources.treasury-150);assert.equal(clock(last),clock(start));assert.deepEqual(last.sectorStates.uspallata.artillery.map(storedArtilleryRecord),guns);assert.equal(last.operativeState[ids.fallen].alive,false);
 assert.deepEqual(start,before);
 // The stopped route is terminal. These are raw structural assertions only.
});

test('an empty Mendoza physician completes the actual critical survivor course through a paid finite pass courier',()=>{
 const {campaign:start,ids}=setup({critical:true,clinicSupply:'finite'}),before=structuredClone(start),events=[],guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord);
 const stock=c=>c.recruited.reduce((sum,id)=>sum+c.operativeState[id].medkits,0)+Object.values(c.sectorStates).flatMap(scene=>scene.props??[]).reduce((sum,prop)=>sum+(prop.contents??[]).filter(stack=>stack.item==='medkits').reduce((n,stack)=>n+stack.count,0),0);
 const chest=c=>c.sectorStates.uspallata.props.find(prop=>prop.id==='finite-battery').contents.filter(stack=>stack.item==='medkits').reduce((sum,stack)=>sum+stack.count,0);
 assert.equal(start.operativeState[ids['rear-physician']].medkits,0);assert.ok(chest(start)>0);assert.equal(start.operativeState[ids['field-soldier']].hp,6);assert.ok(start.operativeState[ids['field-soldier']].bleeding>0);
 const c=recoverFreshUspallata(start,{batteryIds:guns.map(g=>g.id),report:event=>events.push(structuredClone(event))}),couriers=events.filter(event=>event.event==='finiteMedicalCourier'),care=events.filter(event=>event.event==='mountainMedicalCare'),supplied=events.filter(event=>event.event==='mountainMedicalCourseSupplied');
 assert.ok(couriers.length>0);assert.ok(couriers.every(event=>event.clinic==='mendoza'&&event.source==='uspallata'&&event.mode==='posta'&&event.quantity>0&&event.elapsedSeconds>0&&event.elapsedSeconds<=48*3600));
 const directTakes=events.filter(event=>event.event==='freshRouteOrder'&&event.action.type==='sectorInventory'&&event.action.sector==='uspallata'&&event.action.direction==='take'&&JSON.parse(event.action.expected).item==='medkits').reduce((sum,event)=>sum+event.action.count,0);
 assert.equal(chest(start)-chest(c),directTakes+couriers.reduce((sum,event)=>sum+event.quantity,0));assert.ok(supplied.length>0&&supplied[0].target>1);assert.ok(care.length>0&&care.length<=48);
 const clinic=events.find(event=>event.event==='mountainMedicalClinicStarted');assert.ok(clock(c)-clock(clinic)<=48*3600);
 const strokes=events.filter(event=>event.event==='freshMountainAidOrders').flatMap(event=>event.steps).filter(action=>action.type==='useItem').length;
 assert.equal(stock(start)-stock(c),strokes+care.length);assert.equal(c.operativeState[ids['field-soldier']].hp,80);assert.equal(c.operativeState[ids['field-soldier']].bleeding,0);
 assert.equal(c.operativeState[ids.fallen].alive,false);assert.deepEqual(c.artilleryDepots.uspallata,guns);assert.equal(c.artilleryDepots.mendoza?.length??0,0);assert.deepEqual(c.artilleryTransfers??[],[]);
 assert.ok(clock(c)>clock(start)&&c.resources.treasury<start.resources.treasury);assert.ok(events.some(event=>event.event==='routeDressingDonation'));
 assert.deepEqual(canonical(recoverFreshUspallata(saved(start),{batteryIds:guns.map(g=>g.id)})),canonical(c));saved(c);assert.deepEqual(start,before);
});

test('an exhausted finite clinic source stops after its actual first-aid and return prefix without refilling the pass cache',()=>{
 const {campaign:start,ids}=setup({critical:true,clinicSupply:'exhausted'}),before=structuredClone(start),events=[],guns=start.sectorStates.uspallata.artillery.map(storedArtilleryRecord);let failure;
 assert.equal(start.operativeState[ids['rear-physician']].medkits,0);assert.equal(start.sectorStates.uspallata.props.find(prop=>prop.id==='finite-battery').contents.length,0);
 try{recoverFreshUspallata(start,{batteryIds:guns.map(g=>g.id),report:event=>events.push(structuredClone(event))});}catch(error){failure=error;}
 assert.match(failure?.message??'',/No remembered finite medical source is admitted/);
 const stopped=events.find(event=>event.event==='medicalCourierStopped');assert.ok(stopped);assert.deepEqual(failure.campaign,stopped.campaign);assert.ok(events.some(event=>event.event==='uspallataStorageSupportReturned'));
 assert.equal(stopped.campaign.operativeState[ids.fallen].alive,false);assert.equal(stopped.campaign.operativeState[ids['field-soldier']].location,'mendoza');assert.equal(stopped.campaign.operativeState[ids['field-soldier']].bleeding,0);assert.ok(stopped.campaign.operativeState[ids['field-soldier']].hp<80);
 assert.equal(stopped.campaign.sectorStates.uspallata.props.find(prop=>prop.id==='finite-battery').contents.length,0);assert.deepEqual(stopped.campaign.artilleryDepots.uspallata,guns);assert.ok(stopped.campaign.resources.treasury<start.resources.treasury);assert.ok(clock(stopped.campaign)>clock(start));
 assert.equal(events.some(event=>event.event==='mountainMedicalCare'),false);assert.deepEqual(start,before);
 // Inspect only the raw terminal prefix. Do not query, save or resume it.
});

test('an insufficient absolute clinic deadline refuses before a paid finite courier leaves or discovers a cache',()=>{
 const {campaign,ids}=setup({clinicSupply:'finite'}),home=order(campaign,{type:'createSquad',name:'Correo médico',ids:[ids['rear-physician']],sector:'mendoza'}),start=order(home,{type:'assignCare',operativeId:ids['rear-physician'],assignment:'active'}),before=structuredClone(start),events=[];
 const quote=previewStrategicRoute(start,start.activeSquadId,'uspallata','posta');assert.equal(quote.valid,true);assert.ok(quote.hours>0);let failure;
 const deadlineSeconds=clock(start)+quote.hours*3600-1;
 try{collectRouteMedicalSupplies(start,ids['rear-physician'],2,{mode:'posta',deadlineSeconds,report:event=>events.push(structuredClone(event))});}catch(error){failure=error;}
 assert.match(failure?.message??'',/remaining absolute clinic deadline/);const stopped=events.find(event=>event.event==='medicalCourierStopped');assert.ok(stopped);assert.deepEqual(failure.campaign,stopped.campaign);
 assert.equal(clock(stopped.campaign),clock(start));assert.equal(stopped.campaign.resources.treasury,start.resources.treasury);assert.equal(stopped.campaign.operativeState[ids['rear-physician']].location,'mendoza');assert.equal(stopped.campaign.operativeState[ids['rear-physician']].medkits,0);
 assert.deepEqual(stopped.campaign.sectorStates,start.sectorStates);assert.equal(stopped.campaign.squads.some(home=>home.journey),false);assert.equal(events.some(event=>event.event==='finiteMedicalCourier'||event.event==='medicalCourierRestOrder'),false);assert.deepEqual(start,before);
 // The raw refusal is terminal. Do not query, encode, replay or resume it.
});

test('a genuinely sleeping courier cannot spend its next rest hour beyond the absolute clinic deadline',()=>{
 const {campaign,ids}=setup({clinicSupply:'finite'}),id=ids['rear-physician'];let c=order(campaign,{type:'createSquad',name:'Correo médico cansado',ids:[id],sector:'mendoza'});
 c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});const opened=visit(c),actor=opened.battle.units.find(unit=>unit.id===String(id)),step=getReachable(opened.battle,actor).find(point=>point.cost>0&&point.path.length===1);
 assert.ok(step);const moved=actBattle(opened.battle,{type:'move',unitId:actor.id,x:step.x,y:step.y,tacticalLevel:step.tacticalLevel??0});assert.equal(moved.lastError,null);assert.ok(moved.units.find(unit=>unit.id===actor.id).energy<actor.energy);
 c=leave({campaign:opened.campaign,battle:moved});c=order(c,{type:'setSleep',operativeId:id,asleep:true});assert.equal(c.operativeState[id].asleep,true);
 const start=c,before=structuredClone(start),events=[];let failure;
 try{collectRouteMedicalSupplies(start,id,2,{mode:'posta',deadlineSeconds:clock(start),report:event=>events.push(structuredClone(event))});}catch(error){failure=error;}
 assert.match(failure?.message??'',/remaining absolute clinic deadline/);const stopped=events.find(event=>event.event==='medicalCourierStopped');assert.ok(stopped);assert.deepEqual(failure.campaign,stopped.campaign);
 assert.equal(clock(stopped.campaign),clock(start));assert.equal(stopped.campaign.resources.treasury,start.resources.treasury);assert.equal(stopped.campaign.operativeState[id].asleep,true);assert.equal(stopped.campaign.operativeState[id].medkits,0);assert.deepEqual(stopped.campaign.sectorStates,start.sectorStates);
 assert.ok(events.some(event=>event.event==='medicalCourierRestStarted'));assert.equal(events.some(event=>event.event==='medicalCourierRestOrder'||event.event==='finiteMedicalCourier'),false);assert.deepEqual(start,before);
 // Inspect only the raw stopped prefix. No failed-state query or continuation.
});
