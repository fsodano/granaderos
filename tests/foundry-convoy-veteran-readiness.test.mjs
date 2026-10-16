import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage,defaultContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation,operativeInTransit} from '../game/squads.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {carriedAmmunition,fieldAmmunitionByType,unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime,COMBAT_ROUND_SECONDS} from '../game/time.js';
import {createBattle,actBattle,presentedActBattle,actionCosts,lookPreview,canSee,teamCanSee,getReachable,firearmShotOptions,stanceCost,reloadPlan,medicalUsePreview,artilleryContact,artilleryCrewPlan} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {knownRouteShotSafety,knownRouteBystanderShotSafety} from './route-fire-safety.mjs';
import {publicRouteView,usefulRouteFiringPosture} from './route-infantry-progress.mjs';
import {paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {visit,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';
import {selectFoundryConvoyVeterans,prepareFoundryConvoyVeterans,prepareFoundryConvoyAssault,prepareFoundryConvoyArmament,resolveFoundryConvoyTucumanEncounter,prepareFoundryConvoyRest,resolveFoundryBatteryEncounter,recoverFoundryCannons,foundryConvoyDefenseController,prepareFoundryBatteryRear} from './fresh-cuyo-route.mjs';
import {prepareNorthernHospitalFortification} from './northern-hospital-fortification.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {northernClinicDefenseOrder} from './northern-route.mjs';
import {aidFoundryBatteryRear} from './fresh-cuyo-route.mjs';

const preferred=[11,1,103,111,125,127,140,144,8,122,139,116],engineer=2,reserve=100;
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>{const result=decodeSave(encodeSave(c)).campaign;assert.deepEqual(result,c);return result;};
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const property=(c,id)=>Object.fromEntries(['hp','alive','bleeding','bandaged','weapon','condition','weaponInstanceId','weaponFittings','blade','carriedLoaded','ammo','inventory','medkits','rations','torches','boleadoras'].map(key=>[key,structuredClone(c.operativeState[id][key]===undefined&&key==='inventory'?{}:c.operativeState[id][key]===undefined&&key==='carriedLoaded'?0:c.operativeState[id][key])]));

// Every identity, road, wound, reserve, price and role precedes compilation
// and the fresh factory. Paid hires and an actual Native bleeding hour earn
// the casualty; no captured campaign or post-factory condition patch is used.
function setup({casualty=false,short=false,missingVeterans=0,protectedPeople=false,availableReserve=false,reserveArrival=0,reserveMonthlyPay=30}={}){
 const d=scaffoldDocuments('foundry-convoy-veteran-readiness');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"mendoza"').replaceAll('camp:','mendoza:').replaceAll('watch-post','cordoba'));
 d.manifest.scenario='granaderos-historical-v1';d.content.rules.startingTreasury=20000;
 d.content.startingTerritory.cordoba={...d.content.startingTerritory.cordoba,owner:'patriot'};
 d.content.campaignRoles={foundryEngineer:'person-2',marchCommander:null};
 d.world.exitLinks=[['mendoza','E',19,8,'cordoba','W',0,8]];
 d.world.expansion.buildingTargets={mendoza:0,cordoba:0};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const extras=protectedPeople?[100,101,102,104,105,106]:short&&!availableReserve?[]:[reserve];
 const people=[...preferred.slice(0,12-(short?1:missingVeterans)),engineer,...extras],base=d.content.characters[0];
 d.content.characters=people.map(id=>({...structuredClone(base),id:`person-${id}`,name:`Personal ${id}`,nickname:`Personal ${id}`,monthlyPay:id===reserve?reserveMonthlyPay:30,arrivalHours:id===reserve?reserveArrival:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:id===127?80:0},
  startingSupplies:{rations:8,torches:1,medkits:id===127?3:1,boleadoras:0},
  startingCondition:{hp:casualty&&id===1?1:protectedPeople&&id===125?60:80,bleeding:casualty&&id===1?1:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const payments=[],actions=[];
 const act=action=>{c=order(c,action);actions.push(structuredClone(action));};
 for(const id of people){
  if(availableReserve&&id===reserve)continue;
  const op=rosterFor(c).find(op=>op.id===id),quote=contractQuote(c,op,'month'),cash=c.resources.treasury;
  assert.equal(quote.available,true);assert.ok(quote.total>0);act({type:'recruitCivic',id,term:'month',destination:'mendoza'});
  assert.equal(c.resources.treasury,cash-quote.total);assert.equal(c.contracts[id].paid,quote.price);payments.push(quote.total);
 }
 assert.equal(c.resources.treasury,20000-payments.reduce((sum,value)=>sum+value,0));
 if(casualty){
  assert.equal(c.operativeState[1].alive,true);assert.equal(c.operativeState[1].hp,1);
  const before=clock(c);act({type:'wait',hours:1});assert.equal(clock(c),before+3600);
  assert.equal(c.operativeState[1].alive,false);assert.equal(c.operativeState[1].hp,0);
 }
 if(protectedPeople){
  const home=c.activeSquadId;act({type:'transport',mode:'posta'});
  act({type:'createSquad',name:'Reserva remota',ids:[102],sector:'mendoza'});act({type:'travel',sector:'cordoba',mode:'posta'});
  act({type:'createSquad',name:'Reserva en camino',ids:[101],sector:'mendoza'});act({type:'travel',sector:'cordoba',mode:'posta',queue:true});
  act({type:'selectSquad',id:home});
  act({type:'assignCare',operativeId:127,assignment:'doctor'});act({type:'assignCare',operativeId:125,assignment:'patient'});
  act({type:'assignWork',operativeId:140,assignment:'practice',skill:'marksmanship'});
 }
 assert.deepEqual(d,declaration);return {campaign:saved(c),actions,payments};
}

test('the intact paid twelve retain their original order and leave the living engineer at Mendoza',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),field=selectFoundryConvoyVeterans(start);
 assert.deepEqual(field,preferred);assert.equal(field.includes(engineer),false);assert.equal(field.includes(reserve),false);
 assert.deepEqual(start,before);assert.deepEqual(saved(start),start);
});

test('an actual paid local replacement fills a Native-earned casualty without restoring its life, morale or property',()=>{
 const {campaign:start}=setup({casualty:true}),before=structuredClone(start),dead=property(start,1),field=selectFoundryConvoyVeterans(start);
 assert.equal(field.length,12);assert.equal(field.includes(1),false);assert.equal(field.includes(reserve),true);assert.equal(field.includes(engineer),false);
 assert.ok(preferred.filter(id=>id!==1).every(id=>field.includes(id)));assert.ok(contractExpiresSeconds(start.contracts[reserve])>clock(start));
 const paid=start.resources.treasury,held=Object.fromEntries(start.recruited.map(id=>[id,property(start,id)])),morale=Object.fromEntries(start.recruited.map(id=>[id,start.operativeState[id].morale]));
 let c=start;const actions=[],issue=action=>{c=order(c,action);actions.push(action);};
 for(let offset=0;offset<12;offset+=6)issue({type:'createSquad',name:'Recuperación del convoy',ids:field.slice(offset,offset+6),sector:'mendoza'});
 for(const operativeId of field)issue({type:'assignCare',operativeId,assignment:'active'});
 assert.equal(c.resources.treasury,paid);assert.equal(clock(c),clock(start));assert.deepEqual(c.contracts,start.contracts);
 for(const id of start.recruited){assert.deepEqual(property(c,id),held[id]);assert.equal(c.operativeState[id].morale,morale[id]);}
 assert.deepEqual(c.squads.flatMap(home=>home.members).filter(id=>field.includes(id)).sort((a,b)=>a-b),[...field].sort((a,b)=>a-b));
 // The replacement is in the second real six-person column. Its ordinary
 // round trip pays the same posta fees and uses the declared reciprocal road.
 const departure=clock(c);issue({type:'transport',mode:'posta'});const travelCash=c.resources.treasury;
 issue({type:'travel',sector:'cordoba',mode:'posta'});assert.equal(operativeLocation(c,reserve),'cordoba');
 issue({type:'travel',sector:'mendoza',mode:'posta'});assert.equal(operativeLocation(c,reserve),'mendoza');
 assert.ok(clock(c)>departure);assert.equal(c.resources.treasury,travelCash-20);assert.deepEqual(property(c,1),dead);
 for(const id of field)for(const key of ['weapon','inventory','ammo','carriedLoaded','medkits'])assert.deepEqual(property(c,id)[key],held[id][key]);
 let replay=start;for(const action of actions)replay=order(saved(replay),action);assert.deepEqual(saved(replay),saved(c));assert.deepEqual(start,before);
});

test('clinical duties, required engineer, remote reserves and a real journey are not replacement sources',()=>{
 const {campaign:start}=setup({protectedPeople:true}),before=structuredClone(start);
 assert.equal(start.operativeState[127].assignment,'doctor');assert.equal(start.operativeState[125].assignment,'patient');assert.equal(start.operativeState[140].assignment,'practice');
 assert.equal(operativeLocation(start,102),'cordoba');assert.equal(operativeInTransit(start,101),true);
 const field=selectFoundryConvoyVeterans(start);assert.equal(field.length,12);
 for(const id of [engineer,127,125,140,101,102])assert.equal(field.includes(id),false);
 assert.deepEqual(start,before);saved(start);
});

test('fewer than twelve legal living locals refuses before any formation, payment or clock change',()=>{
 const {campaign:start}=setup({short:true}),before=structuredClone(start);
 assert.throws(()=>selectFoundryConvoyVeterans(start),/actual twelve available veterans/);
 assert.deepEqual(start,before);
 // The stopped helper is terminal. No failed-state query, codec or replay.
});

test('an intact convoy force needs no replacement payment or clock advance',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),result=prepareFoundryConvoyVeterans(start);
 assert.deepEqual(result.field,preferred);assert.deepEqual(result.hires,[]);assert.deepEqual(result.campaign,before);assert.deepEqual(start,before);
});

test('a Native-earned convoy casualty is replaced by one actual immediate paid hire with finite property and saved replay',()=>{
 const {campaign:start}=setup({casualty:true,availableReserve:true}),before=structuredClone(start),dead=property(start,1),events=[];
 assert.equal(start.recruited.includes(reserve),false);
 const quote=contractQuote(start,rosterFor(start).find(op=>op.id===reserve),'day'),held=Object.fromEntries(Object.keys(start.operativeState).map(id=>[id,property(start,Number(id))]));
 const result=prepareFoundryConvoyVeterans(start,{report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.field.length,12);assert.equal(result.field.includes(reserve),true);assert.equal(result.field.includes(1),false);assert.equal(result.field.includes(engineer),false);
 assert.equal(result.hires.length,1);assert.equal(result.hires[0].id,reserve);assert.equal(result.hires[0].debited,quote.total);assert.equal(quote.total>0,true);
 assert.equal(c.resources.treasury,start.resources.treasury-quote.total);assert.equal(clock(c),clock(start));assert.equal(operativeLocation(c,reserve),'mendoza');
 assert.equal(c.recruited.filter(id=>id===reserve).length,1);assert.equal(c.hiringArrivals.some(hire=>hire.operativeId===reserve),false);
 assert.equal(c.contracts[reserve].paid,quote.price);assert.equal(contractExpiresSeconds(c.contracts[reserve]),clock(start)+24*3600);
 for(const id of Object.keys(held))assert.deepEqual(property(c,Number(id)),held[id]);assert.deepEqual(property(c,1),dead);
 assert.equal(events.filter(event=>event.event==='routeHireBooked').length,1);assert.equal(events.find(event=>event.event==='routeHiresReady').hours,0);
 const replay=order(saved(start),{type:'recruitCivic',id:reserve,term:'day',destination:'mendoza'});assert.deepEqual(saved(replay),saved(c));
 const repeated=prepareFoundryConvoyVeterans(c);assert.deepEqual(repeated.hires,[]);assert.deepEqual(repeated.campaign,c);assert.deepEqual(start,before);
});

test('a delayed replacement cannot hide a clock advance inside convoy selection',()=>{
 const {campaign:start}=setup({short:true,availableReserve:true,reserveArrival:1}),before=structuredClone(start);
 assert.throws(()=>prepareFoundryConvoyVeterans(start),/affordable immediate paid replacement/);assert.deepEqual(start,before);
 // The stopped helper is terminal. No failed-state query, codec or replay.
});

test('an unaffordable real replacement preserves the convoy shortage and treasury',()=>{
 const {campaign:start}=setup({short:true,availableReserve:true,reserveMonthlyPay:1000000}),before=structuredClone(start);
 const quote=contractQuote(start,rosterFor(start).find(op=>op.id===reserve),'day');assert.equal(quote.available,true);assert.ok(quote.total>start.resources.treasury);
 assert.throws(()=>prepareFoundryConvoyVeterans(start),/affordable immediate paid replacement/);assert.deepEqual(start,before);
 // The stopped helper is terminal. No failed-state query, codec or replay.
});

test('a partial paid replacement prefix is retained as raw failure evidence without continuing the stopped convoy',()=>{
 const {campaign:start}=setup({missingVeterans:2,availableReserve:true}),before=structuredClone(start),events=[];
 const quote=contractQuote(start,rosterFor(start).find(op=>op.id===reserve),'day');
 assert.throws(()=>prepareFoundryConvoyVeterans(start,{report:event=>events.push(event)}),/affordable immediate paid replacement/);
 const stopped=events.find(event=>event.event==='foundryConvoyStopped');assert.ok(stopped);assert.equal(stopped.hires.length,1);
 assert.equal(stopped.hires[0].id,reserve);assert.equal(stopped.hires[0].debited,quote.total);
 assert.equal(stopped.campaign.resources.treasury,start.resources.treasury-quote.total);assert.equal(clock(stopped.campaign),clock(start));
 assert.equal(stopped.campaign.recruited.filter(id=>id===reserve).length,1);assert.equal(stopped.campaign.contracts[reserve].paid,quote.price);
 assert.deepEqual(start,before);
 // Raw observation only. Never query, save, replay or resume the failed prefix.
});

// These separate fresh declarations exercise the real preparation entry point.
// Existing nine veteran-selection controls remain unchanged. No saved route,
// injected campaign state, after-factory stock, wound or time assignment is used.
function assaultSetup({empty=true,cacheRounds=24,startHour=12,raid=false,raidHours=22,mixed=false,roofRest=false,batteryReturn=false,raidSector='tucuman'}={}){
 const d=scaffoldDocuments('declared-convoy-assault');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"mendoza"').replaceAll('camp:','mendoza:').replaceAll('watch-post','tucuman'));
 d.content.rules.startingTreasury=50000;d.content.rules.deploymentCartridges=12;
 d.content.startingTerritory.tucuman.owner='patriot';d.content.startingTerritory.salta={owner:'royalist',loyalty:25};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const sector=structuredClone(d.world.sectors.find(row=>row.id==='tucuman'));
 Object.assign(sector,{id:'salta',name:'Salta',grid:'23,17',neighbors:['tucuman']});d.world.sectors.push(sector);
 d.world.sectors.find(row=>row.id==='tucuman').neighbors=['mendoza','salta'];
 const cell=d.world.cells.find(row=>row.col===22&&row.row===16);Object.assign(cell,{name:'Salta',location:'salta',locality:'salta',anchor:true,district:true});
 d.world.places.salta={lon:22,lat:17,label:'Salta',dx:12,dy:0};
 d.world.districts.salta=[{id:'salta:0',sectorId:'salta',col:22,row:16,name:'Salta',x:cell.x,y:cell.y,urban:false}];
 d.world.landscapes.salta='settlement';d.world.ruralSectors.push('salta');
 d.world.expansion.buildingTargets={mendoza:0,tucuman:0,salta:0};
 d.world.exitLinks=[['mendoza','E',19,8,'tucuman','W',0,8],['tucuman','E',19,8,'salta','W',0,8]];
 d.maps.salta={...structuredClone(d.maps.tucuman),id:'salta',title:'Salta'};
 if(raidSector==='cordoba'){
  // A real owned non-HQ locality gives the unsupported-encounter control
  // its own lawful road, map, arrival facility and finite scheduled raid.
  const point=d.world.cells.find(row=>row.col===19&&row.row===17);
  Object.assign(point,{name:'Córdoba',location:'cordoba',locality:'cordoba',anchor:true,district:true});
  d.world.sectors.push({...structuredClone(sector),id:'cordoba',name:'Córdoba',grid:point.grid,neighbors:['tucuman']});
  d.world.sectors.find(row=>row.id==='tucuman').neighbors.push('cordoba');
  d.world.places.cordoba={lon:19,lat:16,label:'Córdoba',dx:12,dy:0};
  d.world.districts.cordoba=[{id:'cordoba:0',sectorId:'cordoba',col:point.col,row:point.row,name:'Córdoba',x:point.x,y:point.y,urban:false}];
  d.world.landscapes.cordoba='settlement';d.world.ruralSectors.push('cordoba');d.world.expansion.rural.push('cordoba');d.world.expansion.buildingTargets.cordoba=0;
  d.world.exitLinks.push(['tucuman','S',10,15,'cordoba','N',10,0]);
  d.maps.cordoba={...structuredClone(d.maps.tucuman),id:'cordoba',title:'Córdoba'};
  d.content.startingTerritory.cordoba={owner:'patriot',loyalty:65};
 }
 const weapon=defaultContentPackage().weapons.find(row=>row.id==='firearm-1801');d.content.weapons.push(structuredClone(weapon));
 const base=d.content.characters[0],names=Array.from({length:12},(_,i)=>'veteran-'+i);
 d.content.characters=names.map((name,i)=>({...structuredClone(base),id:name,name,nickname:name,monthlyPay:30,arrivalHours:0,weapon:empty&&i===0?null:'firearm-1801',
  attributes:{...base.attributes,maxHp:80,strength:90,marksmanship:90,medical:roofRest&&i===0?80:20},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:2},startingCondition:{hp:80,energy:100,fatigue:0,bleeding:0,bandaged:0}}));
 if(raid&&!roofRest){
  d.content.characters.push({...structuredClone(d.content.characters[1]),id:'local-guard',name:'local-guard',nickname:'local-guard'});
  d.world.arrivalFacilities[raidSector]=['barracks'];d.content.arrivalSites.push({sector:raidSector,facilities:['barracks']});
 }
 if(roofRest){
  d.maps.tucuman.upperSurfaces=Array.from({length:30},(_,i)=>({id:'convoy-roof-'+i,x:7+i%6,y:3+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
  d.maps.tucuman.climbLinks=[{id:'convoy-public-access',kind:'climb',from:{x:7,y:2,tacticalLevel:0},to:{x:7,y:3,tacticalLevel:1}}];
  d.maps.tucuman.props=[{id:'convoy-roof-cartridges',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
  d.world.physical.caches.tucuman={chest:'convoy-roof-cartridges',contents:[{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos finitos del descanso',weight:.04,count:72}]};
 }
 if(batteryReturn){
  // The settlement fringe has 48 connected west-edge cells. The rural
  // cliff strip admitted only eight, fewer than the actual thirteen locals.
  d.world.expansion.rural=d.world.expansion.rural.filter(id=>id!=='tucuman');
  d.maps.tucuman.props=[{id:'convoy-bronze',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
  d.world.physical.caches.tucuman={chest:'convoy-bronze',contents:[]};
  d.world.physical.arsenals.tucuman={version:1,sector:'tucuman',chest:'convoy-bronze',pieces:[{id:'arsenal:convoy:bronze',type:'bronze4',side:'player',loaded:false,ammo:4}]};
 }
 if(mixed){
  d.maps.tucuman.props=[{id:'tucuman-reserve',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
  d.world.physical.caches.tucuman={chest:'tucuman-reserve',contents:[{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Reserva finita de Tucumán',weight:.04,count:72}]};
 }
 const cacheId='convoy-long-gun';
 d.maps.mendoza.props=[{id:cacheId,type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.caches.mendoza={chest:cacheId,contents:[...(empty?[{item:'weapon',weapon:1801,loaded:0,condition:93,jammed:false,count:1,weight:4}]:[]),...(cacheRounds?[{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos finitos',weight:.04,count:cacheRounds}]:[])]};
 if(raid)d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raidHours,axis:[raidSector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const field=names.map(name=>operativeIdForCharacter(content,name));
 for(const id of field){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id,term:'month',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.total);}
 const guard=raid&&!roofRest?operativeIdForCharacter(content,'local-guard'):null;
 if(guard!==null){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===guard),'month'),cash=c.resources.treasury;assert.ok(quote.available&&quote.total>0);c=order(c,{type:'recruitCivic',id:guard,term:'month',destination:raidSector});assert.equal(c.resources.treasury,cash-quote.total);assert.equal(operativeLocation(c,guard),raidSector);}
 c=order(c,{type:'transport',mode:'posta'});
 if(roofRest){
  const selected=c.activeSquadId,scout=field[0],home=c.squads.find(q=>q.members.includes(scout));
  c=order(c,{type:'createSquad',name:'Mapa público del descanso',ids:[scout],sector:'mendoza'});c=order(c,{type:'travel',sector:'tucuman',mode:'posta'});
  c=leave(takeFiniteCache(visit(c),scout,[],{cacheId:'convoy-roof-cartridges'}));assert.ok(c.sectorStates.tucuman.upperSurfaces.length>=12);
  const chest=c.sectorStates.tucuman.props.find(prop=>prop.id==='convoy-roof-cartridges');assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents[0].count,72);
  c=order(c,{type:'travel',sector:'mendoza',mode:'posta'});if(home)c=order(c,{type:'assignToSquad',operativeId:scout,squadId:home.id});c=order(c,{type:'selectSquad',id:selected});
 }
 if(empty){
  const id=field[1];c=order(c,{type:'unloadAmmunition',operativeId:id});c=order(c,{type:'ammunition',operativeId:id,family:'ammoMusket',quantity:12,direction:'store'});
  const body=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);assert.equal(body.loaded+ammoCount(body,'ammoMusket'),0);assert.equal(c.ammunitionStores.mendoza.ammoMusket,12);
 }
 for(const operativeId of field)c=order(c,{type:'assignCare',operativeId,assignment:'rest'});
 for(let request=0;clock(c)<startHour*3600&&request<40;request++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,startHour*3600-clock(c))});
 assert.equal(clock(c),startHour*3600);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 assert.deepEqual(d,declaration);return {campaign:saved(c),field,cacheId,guard};
}

test('the same fresh twelve recover one real gun, refill finite empty loads and pay for reloads before daylight Salta entry',()=>{
 const {campaign:start,field,cacheId}=assaultSetup(),before=structuredClone(start),events=[];
 const result=prepareFoundryConvoyAssault(start,{field,report:event=>events.push(event)}),c=result.campaign,e=result.evidence;
 assert.deepEqual(start,before);assert.deepEqual(e.field,field);assert.equal(e.columns.length,2);assert.ok(e.journeyRequests<=168&&e.restRequests<=72&&e.approachRequests<=72);assert.ok(e.daylightWaits>0);
 assert.ok(c.hour%24>=6&&c.hour%24<=10);assert.equal(c.pendingBattle.squad.length,12);assert.deepEqual(new Set(c.pendingBattle.squad.map(op=>Number(op.id))),new Set(field));
 for(const person of c.pendingBattle.squad){assert.equal(person.weapon,1801);assert.equal(person.loaded,1);assert.equal(person.loaded+ammoCount(person,'ammoMusket'),12);assert.equal(person.hp,80);assert.equal(person.medkits,2);}
 assert.ok(events.some(event=>event.event==='finitePrimaryRecovered'&&event.operativeId===field[0]));assert.ok(events.some(event=>event.event==='finishedReload'));
 const chest=c.sectorStates.mendoza.props.find(prop=>prop.id===cacheId);assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents.filter(row=>row.weapon).reduce((n,row)=>n+row.count,0),0);assert.equal(chest.contents.filter(row=>row.ammoType==='musket_75').reduce((n,row)=>n+row.count,0),12);
 assert.equal(c.ammunitionStores.mendoza.ammoMusket,0);assert.equal(c.resources.treasury,start.resources.treasury-40-450);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.recruited,start.recruited);
 const fort=events.find(event=>event.event==='foundryConvoyRestPrepared').fortification;assert.equal(fort.cost,450);assert.equal(fort.fromLevel,0);assert.equal(fort.orders.length,3);assert.equal(fort.endSeconds,fort.startSeconds);assert.equal(c.sectors.tucuman.fort,3);
 assert.deepEqual(c.artilleryDepots??{},start.artilleryDepots??{});assert.deepEqual(c.artilleryTransfers??[],start.artilleryTransfers??[]);
 const pair=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.salta));assert.equal(pair.error,null);assert.equal(pair.battle.night,false);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
 assert.deepEqual(prepareFoundryConvoyAssault(saved(start),{field}),result,'Repeat only the independently declared successful fresh start through the same paid preparation.');
});

test('already supplied convoy veterans keep finite property and need no extra supply or daylight wait on a ready morning',()=>{
 const {campaign:start,field}=assaultSetup({empty:false,cacheRounds:0,startHour:0}),before=structuredClone(start),events=[];
 const result=prepareFoundryConvoyAssault(start,{field,report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.evidence.daylightWaits,0);assert.equal(events.some(event=>event.event==='finitePrimaryRecovered'||event.event==='ammunitionCacheDiscovered'||event.event==='finishedReload'),false);
 assert.ok(result.evidence.armament.every(row=>row.events.every(event=>event.event!=='finitePrimaryRecovered'&&event.event!=='finishedReload')));
 for(const id of field){assert.equal(c.operativeState[id].medkits,2);assert.equal(c.operativeState[id].hp,80);assert.equal(c.operativeState[id].alive,true);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury-40-450);assert.deepEqual(start,before);
 assert.equal(events.filter(event=>event.event==='northernHospitalFortified').reduce((sum,event)=>sum+event.cost,0),450);assert.equal(c.sectors.tucuman.fort,3);
 assert.equal(c.pendingBattle.squad.length,12);const pair=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.salta));assert.equal(pair.error,null);assert.equal(pair.battle.night,false);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});

test('a real finite convoy ammunition shortage is terminal before any departure or assault',()=>{
 const {campaign:start,field}=assaultSetup({cacheRounds:0}),before=structuredClone(start),events=[];
 assert.throws(()=>prepareFoundryConvoyAssault(start,{field,report:event=>events.push(event)}),/Finite ammunition shortage/);
 assert.ok(events.some(event=>event.event==='finitePrimaryRecovered'&&event.operativeId===field[0]));
 assert.equal(events.some(event=>event.event==='freshRouteOrder'&&['travel','attack','beginAssault'].includes(event.action.type)),false);assert.deepEqual(start,before);
 // The accepted collection prefix is not queried, saved, replayed or resumed.
});

test('an actual scheduled Tucuman interruption stops an observer before any Salta assault and retains its raw prefix',()=>{
 const {campaign:start,field,guard}=assaultSetup({raid:true}),before=structuredClone(start),failure=Object.freeze(new Error('fresh real convoy raid boundary'));let captured=null;
 assert.throws(()=>prepareFoundryConvoyAssault(start,{field,report:event=>{if(event.event==='foundryConvoyEncounter'){captured=event.campaign;throw failure;}}}),error=>error===failure);
 assert.ok(captured);assert.equal(captured.pendingEncounter?.sector,'tucuman');assert.equal(captured.pendingBattle,null);assert.ok(captured.enemyGroups.some(group=>group.id===captured.pendingEncounter.groupId&&group.initialStrength===3));
 assert.ok(captured.recruited.length===13);assert.equal(captured.operativeState[guard].alive,true);assert.equal(captured.operativeState[guard].location,'tucuman');assert.ok(!captured.squads.some(home=>home.journey&&home.members.includes(guard)));assert.deepEqual(start,before);
 // Raw accepted-interruption observation only. No Native query, codec, replay
 // or continuation follows this exact terminal callback error.
});


test('a real mixed-column defense re-arms only the local six from finite stock and preserves the paid ready approach',()=>{
 const {campaign:declared,field,guard}=assaultSetup({empty:false,cacheRounds:0,startHour:0,raid:true,raidHours:10,mixed:true});let c=declared;const columns=[];
 for(let offset=0;offset<12;offset+=6){c=order(c,{type:'createSquad',name:'Columna mixta '+offset,ids:field.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);}
 for(const id of field)c=order(c,{type:'assignCare',id,assignment:'active'});
 for(const id of columns){c=order(c,{type:'selectSquad',id});c=order(c,{type:'travel',sector:'tucuman',queue:true,mode:'posta'});}
 for(let request=0;columns.some(id=>c.squads.find(home=>home.id===id).journey)&&request<168;request++)c=order(c,{type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(home=>home.id===id).location==='tucuman'&&!c.squads.find(home=>home.id===id).journey));
 for(const id of field)c=order(c,{type:'assignCare',id,assignment:'rest'});
 for(let request=0;field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep)&&request<72;request++)c=order(c,{type:'wait',hours:1});
 assert.ok(field.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep));
 for(const id of field)c=order(c,{type:'assignCare',id,assignment:'active'});
 c=order(c,{type:'selectSquad',id:columns[0]});c=order(c,{type:'attack',sector:'salta',queue:true,mode:'posta'});
 for(let request=0;c.squads.find(home=>home.id===columns[0]).journey?.status!=='ready'&&request<72;request++)c=order(c,{type:'wait',hours:1});
 assert.equal(c.squads.find(home=>home.id===columns[0]).journey?.status,'ready');
 for(let request=0;!c.pendingEncounter&&request<72;request++)c=order(c,{type:'wait',hours:1});
 assert.equal(c.pendingEncounter?.sector,'tucuman');assert.equal(c.squads.find(home=>home.id===columns[0]).journey.status,'ready');assert.equal(c.squads.find(home=>home.id===columns[1]).journey,undefined);
 const ready=structuredClone(c.squads.find(home=>home.id===columns[0])),beforeDefense=saved(c),defended=resolveFoundryConvoyTucumanEncounter(beforeDefense);
 assert.equal(defended.summary.status,'victory');c=defended.campaign;assert.deepEqual(c.squads.find(home=>home.id===columns[0]),ready);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const rounds=(state,ids)=>ids.reduce((sum,id)=>{const op=carriedAmmunition(rosterFor(state).find(op=>op.id===id),state.operativeState[id]);return sum+op.loaded+ammoCount(op,'ammoMusket');},0),local=field.slice(6);
 assert.ok(rounds(c,local)<rounds(beforeDefense,local),'The real local defense must spend actual field rounds.');
 const scene=state=>state.sceneStates?.tucuman??state.sectorStates.tucuman;
 const finiteStock=state=>(state.ammunitionStores.tucuman?.ammoMusket??0)+(fieldAmmunitionByType(scene(state)).musket_75??0)+scene(state).units.filter(unit=>unit.hp<=0&&!unit.departure&&!unit.fled).reduce((sum,unit)=>sum+(unitAmmunitionByType(unit).musket_75??0),0);
 const input=saved(c),original=structuredClone(input),beforeChest=scene(input).props.find(prop=>prop.id==='tucuman-reserve');assert.ok(beforeChest);const beforeStock=beforeChest.contents.reduce((sum,row)=>sum+row.count,0),events=[];assert.equal(beforeStock,72);
 const result=prepareFoundryConvoyArmament(input,{field,columns,sector:'tucuman',report:event=>events.push(event)});c=result.campaign;
 assert.deepEqual(result.evidence.columns,[columns[1]]);assert.deepEqual(result.evidence.committed,[columns[0]]);assert.deepEqual(c.squads.find(home=>home.id===columns[0]),ready);
 for(const id of field){const op=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);assert.ok(c.operativeState[id].alive&&!c.operativeState[id].bleeding);assert.equal(op.loaded,1);assert.equal(op.loaded+ammoCount(op,'ammoMusket'),12);}
 const gain=rounds(c,local)-rounds(input,local),transfers=events.filter(event=>event.family==='ammoMusket'&&event.action);assert.ok(gain>0);assert.ok(transfers.length>0);
 for(const transfer of transfers){
  const {action,quantity}=transfer;assert.equal(transfer.sector,'tucuman');assert.equal(transfer.cost,0);assert.ok(Number.isSafeInteger(quantity)&&quantity>0);assert.equal(action.direction,'take');
  if(action.type==='ammunition'){assert.equal(transfer.sourceKind,'depot');assert.equal(action.family,'ammoMusket');assert.equal(action.quantity,quantity);}
  else{assert.equal(action.type,'sectorInventory');assert.ok(['body','container','ground','serviceReturn'].includes(transfer.sourceKind));assert.equal(action.count,quantity);assert.equal(action.sector,'tucuman');assert.equal(typeof action.sourceKey,'string');const stack=JSON.parse(action.expected);assert.equal(stack.kind,'ammunition');assert.equal(stack.ammoType,'musket_75');assert.ok(stack.count>=quantity);}
 }
 assert.equal(finiteStock(input)-finiteStock(c),gain);assert.equal(transfers.reduce((sum,event)=>sum+event.quantity,0),gain);
 const afterStock=scene(c).props.find(prop=>prop.id==='tucuman-reserve').contents.reduce((sum,row)=>sum+row.count,0),chestDebit=transfers.filter(event=>event.action.sourceKey?.startsWith('container:tucuman-reserve:')).reduce((sum,event)=>sum+event.quantity,0);assert.equal(beforeStock-afterStock,chestDebit);
 assert.ok(events.some(event=>event.event==='finishedReload'));assert.equal(c.resources.treasury,input.resources.treasury);assert.deepEqual(c.contracts,input.contracts);assert.equal(c.operativeState[guard].alive,true);
 for(const id of [...field.slice(0,6),guard])assert.deepEqual(property(c,id),property(input,id),'Re-arming the local six cannot consume a committed soldier or local guard possession.');
 assert.deepEqual(input,original);assert.deepEqual(prepareFoundryConvoyArmament(saved(input),{field,columns,sector:'tucuman'}),result);saved(c);
});


// Each new case starts from its own declaration/factory and ordinary paid
// arrivals. No failed campaign or after-factory body/stock assignment is used.
function arriveConvoy(start,field){
 let c=start;const columns=[];
 for(let offset=0;offset<12;offset+=6){c=order(c,{type:'createSquad',name:'Convoy declarado '+offset,ids:field.slice(offset,offset+6),sector:'mendoza'});columns.push(c.activeSquadId);}
 for(const id of field)c=order(c,{type:'assignCare',id,assignment:'active'});
 for(const id of columns){c=order(c,{type:'selectSquad',id});c=order(c,{type:'travel',sector:'tucuman',mode:'posta',queue:true});}
 for(let hour=0;hour<168&&columns.some(id=>c.squads.find(home=>home.id===id).journey);hour++)c=order(c,{type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(home=>home.id===id).location==='tucuman'&&!c.squads.find(home=>home.id===id).journey));return {campaign:c,columns};
}

test('the actual paid twelve stage known roof cover before a real rest raid inside the same72 hours and still enter Salta',()=>{
 const {campaign:start,field}=assaultSetup({empty:false,cacheRounds:0,startHour:12,raid:true,raidHours:17,roofRest:true}),before=structuredClone(start),events=[];
 const result=prepareFoundryConvoyAssault(start,{field,report:event=>events.push(event)}),c=result.campaign,rest=events.find(event=>event.event==='foundryConvoyRestPrepared');
 assert.ok(rest?.staging?.restored);assert.equal(rest.staging.positions.length,12);assert.equal(new Set(rest.staging.positions.map(p=>`${p.tacticalLevel}:${p.x}:${p.y}`)).size,12);
 assert.ok(rest.staging.steps>0&&rest.staging.steps<=64*12);assert.ok(rest.staging.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));assert.ok(rest.staging.endSeconds-rest.staging.startSeconds<=3600);
 assert.ok(rest.endSeconds-rest.startSeconds<=72*3600);assert.equal(rest.deadlineSeconds,rest.startSeconds+72*3600);assert.ok(rest.defenses.some(row=>row.status==='victory'));
 assert.equal(rest.fortification.cost,450);assert.equal(rest.fortification.fromLevel,0);assert.equal(rest.fortification.orders.length,3);assert.equal(rest.fortification.endSeconds,rest.fortification.startSeconds);assert.equal(c.sectors.tucuman.fort,3);
 const response=events.find(event=>event.event==='freshRouteOrder'&&event.action.type==='respondToEncounter');assert.equal(response.action.choice,'tactical');assert.equal(response.campaign.pendingBattle.defenseFort,3);assert.equal(response.campaign.pendingBattle.squad.length,12);
 const stage=events.findIndex(event=>event.event==='freshRouteCheckpoint'&&event.stage==='foundry-convoy-roof-rest'),raid=events.findIndex(event=>event.event==='foundryConvoyEncounter');assert.ok(stage>=0&&raid>stage);
 const defense=events.find(event=>event.event==='freshRouteCheckpoint'&&event.stage==='foundry-convoy-tucuman-defense');assert.ok(defense);assert.ok(field.every(id=>defense.campaign.operativeState[id].alive));
 const rounds=state=>field.reduce((sum,id)=>{const carried=carriedAmmunition(rosterFor(state).find(op=>op.id===id),state.operativeState[id]);return sum+carried.loaded+ammoCount(carried,'ammoMusket');},0);
 assert.ok(rounds(defense.campaign)<rounds(start),'The actual defense spends finite field rounds before replacement.');
 const cartridges=state=>state.sectorStates.tucuman.props.find(prop=>prop.id==='convoy-roof-cartridges').contents.reduce((sum,row)=>sum+row.count,0),debit=cartridges(start)-cartridges(c);
 assert.ok(debit>0);assert.equal(debit,events.filter(event=>event.family==='ammoMusket'&&event.action?.sourceKey?.startsWith('container:convoy-roof-cartridges:')).reduce((sum,event)=>sum+event.quantity,0));
 assert.deepEqual(new Set(c.pendingBattle.squad.map(op=>Number(op.id))),new Set(field));assert.equal(c.pendingBattle.squad.length,12);assert.ok(field.every(id=>c.operativeState[id].alive&&contractExpiresSeconds(c.contracts[id])>clock(c)));
 assert.ok(field.reduce((sum,id)=>sum+c.operativeState[id].medkits,0)<=field.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),'The same finite medical packs cannot be replenished by staging or defense.');
 for(const op of c.pendingBattle.squad)assert.ok(op.loaded>0&&op.loaded+ammoCount(op,'ammoMusket')>=12);
 const paired=syncBattleTime(c,enterSector(c.pendingBattle,c.sectorStates.salta));assert.equal(paired.error,null);assert.deepEqual(decodeSave(encodeSave(paired.campaign,paired.battle)),{campaign:paired.campaign,battle:paired.battle});
 assert.deepEqual(prepareFoundryConvoyAssault(saved(start),{field}),result);assert.deepEqual(start,before);
});

test('a known roof cannot spend a paid staging step beyond the original convoy rest deadline',()=>{
 const s=assaultSetup({empty:false,cacheRounds:0,startHour:12,roofRest:true}),arrival=arriveConvoy(s.campaign,s.field),start=arrival.campaign,before=structuredClone(start),events=[];let failure;
 try{prepareFoundryConvoyRest(start,{field:s.field,deadlineSeconds:clock(start)+1,report:event=>events.push(event)});}catch(error){failure=error;}
 assert.match(failure?.message??'',/paid step exceeds/);assert.equal(events.some(event=>event.event==='freshRouteOrder'&&['wait','attack','travel'].includes(event.action.type)),false);assert.equal(events.some(event=>event.event==='foundryConvoyRestPrepared'),false);assert.deepEqual(start,before);
 assert.equal(events.filter(event=>event.event==='northernHospitalFortified').reduce((sum,event)=>sum+event.cost,0),450);
 // The nested stopped pair is retained only as raw diagnostics, never queried.
});

test('the existing battery resolver settles an actual northern interruption before paid finite gun travel and keeps its complete record',()=>{
 const s=assaultSetup({empty:false,cacheRounds:0,startHour:0,raid:true,raidHours:10,batteryReturn:true}),arrival=arriveConvoy(s.campaign,s.field);let c=arrival.campaign;
 assert.equal(c.recruited.length,13);assert.ok(c.recruited.every(id=>operativeLocation(c,id)==='tucuman'));
 const gunId='arsenal:convoy:bronze',discoveryStart=clock(c),discoveryCash=c.resources.treasury;
 assert.equal(c.pendingEncounter,null);assert.equal(c.artilleryArsenalRecoveries.tucuman,undefined);
 c=leave(takeFiniteCache(visit(c),c.squad[0],[],{cacheId:'convoy-bronze'}));
 const chest=c.sectorStates.tucuman.props.find(prop=>prop.id==='convoy-bronze'),gun=c.sectorStates.tucuman.artillery.find(piece=>piece.id===gunId);
 assert.ok(chest.open&&chest.knownToPlayer);assert.deepEqual(chest.artilleryRecovered,[gunId]);assert.ok(c.artilleryArsenalRecoveries.tucuman);
 assert.ok(gun);assert.equal(gun.type,'bronze4');assert.equal(gun.side,'player');assert.equal(gun.loaded,false);assert.equal(gun.ammo,4);
 const parcel=storedArtilleryRecord(gun);assert.ok(clock(c)>discoveryStart);assert.equal(c.resources.treasury,discoveryCash);assert.equal(c.pendingEncounter,null);
 const storedAt=clock(c);c=order(c,{type:'storeArtillery',sector:'tucuman',artilleryId:gunId});c=order(c,{type:'configureArtillery',types:[]});
 assert.equal(clock(c),storedAt);assert.equal(c.resources.treasury,discoveryCash);assert.equal(c.sectorStates.tucuman.artillery.some(piece=>piece.id===gunId),false);assert.deepEqual(c.artilleryDepots.tucuman.find(piece=>piece.id===gunId),parcel);assert.deepEqual(c.artillerySelection,[]);assert.equal(c.artillerySelectionExplicit,true);
 for(let hour=0;hour<24&&!c.pendingEncounter;hour++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'tucuman');
 assert.deepEqual(c.artilleryDepots.tucuman.find(piece=>piece.id===gunId),parcel,'The exact discovered four-charge parcel stays in its real depot before the response.');
 const start=saved(c),before=structuredClone(start),events=[],result=recoverFoundryCannons(start,1,{report:event=>events.push(event)});
 assert.equal(result.pendingEncounter,null);assert.equal(result.pendingBattle,null);assert.equal(result.location,'mendoza');assert.ok(clock(result)>clock(start));assert.ok(result.resources.treasury<start.resources.treasury);
 assert.ok(events.some(event=>event.event==='foundryBatteryEncounterResolved'&&event.sector==='tucuman'));assert.ok(events.some(event=>event.event==='routeBatteryEncounterResolved'));
 const response=events.find(event=>event.event==='freshRouteOrder'&&event.action.type==='respondToEncounter'),defense=events.find(event=>event.event==='battleFinished'&&event.sector==='tucuman');assert.equal(response.action.choice,'tactical');assert.equal(response.campaign.pendingBattle.squad.length,13);assert.equal(defense.status,'victory');assert.ok(defense.actions>0);
 const rounds=state=>s.field.reduce((sum,id)=>{const body=carriedAmmunition(rosterFor(state).find(op=>op.id===id),state.operativeState[id]);return sum+body.loaded+ammoCount(body,'ammoMusket');},0);assert.ok(rounds(result)<rounds(start),'The real tactical defense must debit finite personal rounds while the depot gun keeps all four charges.');
 const shipment=events.find(event=>event.event==='routeBatteryShipment'&&event.id===gunId);assert.ok(shipment);assert.equal(shipment.from,'tucuman');assert.equal(shipment.to,'mendoza');assert.deepEqual(shipment.record,parcel);assert.deepEqual(result.artilleryDepots.mendoza.find(gun=>gun.id===shipment.id),parcel);assert.equal(result.artilleryDepots.tucuman.some(piece=>piece.id===gunId),false);assert.equal(result.artilleryTransfers.some(transfer=>transfer.id===gunId),false);assert.equal(shipment.record.ammo+Number(shipment.record.loaded),4);
 assert.ok(s.field.every(id=>result.operativeState[id].alive&&result.recruited.includes(id)&&contractExpiresSeconds(result.contracts[id])>clock(result)));assert.deepEqual(start,before);saved(result);
 assert.deepEqual(recoverFoundryCannons(saved(start),1),result);
});

test('a real unsupported battery encounter remains terminal before response or transport',()=>{
 const s=assaultSetup({empty:false,cacheRounds:0,startHour:0,raid:true,raidHours:10,raidSector:'cordoba'});let c=s.campaign;
 for(let hour=0;hour<24&&!c.pendingEncounter;hour++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'cordoba');assert.equal(operativeLocation(c,s.guard),'cordoba');
 const before=structuredClone(c),events=[];assert.throws(()=>resolveFoundryBatteryEncounter(c,{report:event=>events.push(event)}),/Only the existing northern battery encounters/);assert.deepEqual(events,[]);assert.deepEqual(c,before);
});

test('a freshly declared supplied convoy roof physician pays finite adjacent aid before fire without leaving its roof cell',()=>{
 const field=Array.from({length:12},(_,i)=>({id:'declared-'+i,name:'Convoy '+i,weapon:1801,blade:1813,hp:i===1?10:80,maxHp:80,bleeding:i===1?1:0,bandaged:0,medical:i===0?80:0,medkits:i===0?2:0,ammo:11,loaded:1,energy:100,fatigue:0,x:4+i%6,y:4+Math.floor(i/6),tacticalLevel:1,stance:'crouched',movementMode:'crouch',activeSlot:'primary'}));
 const options={id:'declared-convoy-medical-cover',sector:'declared-convoy-medical-cover',width:20,height:16,hour:12,seed:8,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),upperSurfaces:Array.from({length:24},(_,i)=>({id:'declared-convoy-roof-'+i,x:4+i%6,y:4+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25})),enemies:[{id:'declared-contact',name:'Contacto',side:'enemy',weapon:1800,hp:80,maxHp:80,loaded:1,ammo:2,x:14,y:8,medical:0,medkits:0,energy:100,fatigue:0,bleeding:0,bandaged:0,patrol:false}],artillery:[]};
 const declaration=structuredClone({field,options}),initial=createBattle(field,options),before=structuredClone(initial),controller=foundryConvoyDefenseController(initial),doctor=initial.units.find(unit=>unit.id==='declared-0'),patient=initial.units.find(unit=>unit.id==='declared-1');
 const hand=controller(initial,doctor);assert.deepEqual(hand,{type:'weapon',unitId:doctor.id,slot:'medical'});const armed=actBattle(initial,hand);assert.equal(armed.lastError,null);assert.deepEqual(presentedActBattle(initial,hand).state,armed);
 const quote=actionCosts(armed,armed.units.find(unit=>unit.id===doctor.id)),aid=controller(armed,armed.units.find(unit=>unit.id===doctor.id));assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:patient.id});
 const healed=actBattle(armed,aid);assert.equal(healed.lastError,null);assert.deepEqual(presentedActBattle(armed,aid).state,healed);assert.equal(healed.units.find(unit=>unit.id===doctor.id).medkits,doctor.medkits-1);assert.ok(healed.units.find(unit=>unit.id===patient.id).hp>patient.hp||healed.units.find(unit=>unit.id===patient.id).bleeding<patient.bleeding);assert.equal(healed.units.find(unit=>unit.id===doctor.id).ap,armed.units.find(unit=>unit.id===doctor.id).ap-quote.heal);
 assert.deepEqual(['x','y','tacticalLevel'].map(key=>healed.units.find(unit=>unit.id===doctor.id)[key]),['x','y','tacticalLevel'].map(key=>doctor[key]));assert.deepEqual(initial,before);assert.deepEqual({field,options},declaration);
});

// Twelve independent defenders declare every post, wound, item, facing and
// resident before Native construction. No original route or failed battle is
// an input. The ground variant has the same actual count and finite issues.
function convoyRoofArena({lane=false,blocked=false,ground=false}={}){
 const width=40,height=20,base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,weapon:1800,blade:1813,loaded:1,ammo:8,condition:100,medical:0,medkits:0,stance:'standing',movementMode:'walk',facing:2,activeSlot:'primary',marksmanship:100,dexterity:100,agility:100,strength:80,patrol:false,overwatch:false};
 const posts=[['guard',lane?5:8,6],['observer',lane?7:19,lane?4:8],['physician',20,9],['patient',20,8],['reserve1',21,ground?12:8],['reserve2',22,ground?11:8],['reserve3',21,9],['reserve4',22,9],['reserve5',23,7],['reserve6',23,8],['reserve7',23,9],['courier',ground?25:23,ground?12:10]];
 const field=posts.map(([id,x,y])=>({...base,id,name:id,x,y,tacticalLevel:ground&&['physician','patient','reserve1','reserve2','courier'].includes(id)?0:1,
  ...(id==='guard'&&lane?{facing:blocked?2:0}:{}),...(id==='observer'?{weapon:0,loaded:0,ammo:0,activeSlot:'unarmed',facing:lane?0:2}:{}),
  ...(id==='physician'?{medical:90,medkits:3,activeSlot:ground?'medical':'primary'}:{}),...(id==='patient'&&ground?{hp:30,bleeding:3}:{}),...(id==='courier'?{weapon:1804,ammo:4}:{}),}));
 const roofWidth=lane?(blocked?9:4):4,roofX=lane?4:8;
 const upperSurfaces=[...Array.from({length:roofWidth*5},(_,i)=>{const x=roofX+i%roofWidth,y=4+Math.floor(i/roofWidth);return {id:'convoy-watch:'+i,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:blocked&&!(x===5&&y===6)?0:30};}),...Array.from({length:24},(_,i)=>({id:'convoy-ward:'+i,x:18+i%6,y:7+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:30}))];
 const options={id:'declared-convoy-roof-orders',width,height,hour:12,seed:45,upperSurfaces,climbLinks:lane?[]:[{id:'convoy-west-access',kind:'climb',from:{x:7,y:6,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}}],
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',name:'Contacto declarado',x:lane?(blocked?11:5):1,y:lane?(blocked?6:2):6,tacticalLevel:blocked?1:0,hp:500,maxHp:500,bleeding:0,bandaged:0,energy:100,fatigue:0,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false}],
  npcs:blocked?[{id:'resident',name:'Habitante conocido',x:8,y:6,tacticalLevel:1,hp:100,maxHp:100,bleeding:0,bandaged:0,civilianHealthVersion:1,civilianWoundVersion:1,energy:100,unconscious:false,stance:'standing'}]:[],
  artillery:ground?[{id:'convoy-ground-gun',type:'bronze4',side:'player',x:22,y:12,facing:0,loaded:false,ammo:2}]:[]};
 const declaration=structuredClone({field,options}),battle=createBattle(field,options);assert.deepEqual({field,options},declaration);assert.equal(battle.units.filter(unit=>unit.side==='player').length,12);if(!ground)assert.ok(battle.units.filter(unit=>unit.side==='player').every(unit=>unit.tacticalLevel===1));assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
const convoyUnit=(battle,id='guard')=>battle.units.find(unit=>unit.id===id),convoyRounds=unit=>Object.values(unitAmmunitionByType(unit)).reduce((sum,count)=>sum+count,0);
function convoyRoofReplay(start,orders){
 let direct=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,direct);restored=actBattle(restored,action);assert.equal(restored.lastError,null);restored=validateBattleSnapshot(JSON.parse(JSON.stringify(restored)));assert.deepEqual(restored,direct);}
 return direct;
}
function convoySafeFire(battle,controller){
 let current=battle,unit=convoyUnit(current),action=controller(current,unit);const orders=[];
 for(let step=0;action?.type==='stance'&&step<2;step++){
  assert.ok(['crouched','prone'].includes(action.stance));assert.equal(usefulRouteFiringPosture(publicRouteView(current,unit),unit,action,{shotSafety:knownRouteBystanderShotSafety}),true);
  const previous=unit,paid=stanceCost(unit,action.stance);orders.push(action);current=convoyRoofReplay(battle,orders);unit=convoyUnit(current);assert.equal(unit.ap,previous.ap-paid);assert.deepEqual(spacePoint(unit),spacePoint(previous));assert.equal(convoyRounds(unit),convoyRounds(previous));action=controller(current,unit);
 }
 assert.equal(action?.type,'fire');const target=convoyUnit(current,action.targetId),shot=firearmShotOptions(current,unit,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));
 assert.ok(shot?.chance>=25&&shot.damageFactor>0);assert.equal(knownRouteBystanderShotSafety(current,unit,target)(shot),true);assert.deepEqual(firearmBystanderRisk(current,unit,target,action.hitLocation??'torso'),{direct:[],scatter:[]});return {battle:current,unit,orders,fire:action};
}
function convoyHeldGoods(start,after,except=[]){
 for(const key of ['tiles','upperSurfaces','climbLinks','artillery'])assert.deepEqual(after[key],start[key]);
 for(const unit of start.units.filter(unit=>unit.side==='player'&&!except.includes(unit.id))){const current=convoyUnit(after,unit.id);assert.deepEqual(spacePoint(current),spacePoint(unit));for(const key of ['hp','maxHp','bleeding','bandaged','weapon','blade','loaded','ammo','inventory','medkits','condition'])assert.deepEqual(current[key],unit[key]);}
}

test('a restored convoy roof pays its authored west lookout before safe finite fire and Native reload work',()=>{
 const start=convoyRoofArena(),before=structuredClone(start),controller=foundryConvoyDefenseController(start),guard=convoyUnit(start),target=convoyUnit(start,'target');assert.equal(guard.facing,2);assert.equal(teamCanSee(start,'player',target),false);
 const look=controller(start,guard);assert.deepEqual(look,{type:'look',unitId:guard.id,x:7,y:6,tacticalLevel:0});const quote=lookPreview(start,guard,look);assert.equal(quote.valid,true);assert.equal(quote.prepare,false);assert.ok(quote.pa>0);assert.deepEqual(controller(start,guard),look);
 const observed=convoyRoofReplay(start,[look]),watcher=convoyUnit(observed);assert.equal(watcher.ap,guard.ap-quote.pa);assert.equal(watcher.facing,quote.facing);assert.equal(observed.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);assert.equal(canSee(observed,watcher,convoyUnit(observed,'target')),true);
 const prefix=convoySafeFire(observed,controller),cost=actionCosts(prefix.battle,prefix.unit,convoyUnit(prefix.battle,prefix.fire.targetId)),orders=[look,...prefix.orders,prefix.fire],fired=convoyRoofReplay(start,orders),shooter=convoyUnit(fired);
 assert.equal(shooter.ap,prefix.unit.ap-cost.fire-(prefix.fire.aim??0)*cost.aim);assert.equal(convoyRounds(shooter),convoyRounds(guard)-1);assert.equal(shooter.condition,guard.condition-1);assert.deepEqual(spacePoint(shooter),spacePoint(guard));
 const reload=controller(fired,shooter),work=reloadPlan(shooter,fired);assert.equal(reload?.type,'reload');assert.ok(work.pa>0);orders.push(reload);const after=convoyRoofReplay(start,orders),loaded=convoyUnit(after);assert.equal(loaded.ap,shooter.ap-work.pa);assert.ok(loaded.loaded>shooter.loaded||loaded.reloadProgress>0);assert.equal(convoyRounds(loaded),convoyRounds(shooter));assert.equal(loaded.medkits,guard.medkits);assert.equal(loaded.hp,guard.hp);assert.equal(after.elapsedSeconds,observed.elapsedSeconds);
 convoyHeldGoods(start,after,['guard']);assert.deepEqual(convoyRoofReplay(start,orders),after);assert.deepEqual(start,before);
});

test('convoy roof movement pays an actual covered firing lane while a known resident blocks the unsafe alternative',()=>{
 const start=convoyRoofArena({lane:true}),before=structuredClone(start),controller=foundryConvoyDefenseController(start),guard=convoyUnit(start),move=controller(start,guard);assert.equal(move?.type,'move');
 const view=publicRouteView(start,guard),path=getReachable(view,guard).find(point=>sameCell(point,move));assert.ok(path?.cost>0&&path.cost<=20&&Math.hypot(path.x-guard.x,path.y-guard.y)<=3);assert.ok(path.path.every(point=>sameSurface(point,guard)&&surfaceAt(view,point).cover>=surfaceAt(view,guard).cover));
 const quote=paidHospitalRoofWalkPreview(view,guard,path);assert.ok(quote);const moved=convoyRoofReplay(start,[move]),walker=convoyUnit(moved);assert.equal(walker.ap,quote.actor.ap);assert.equal(walker.energy,quote.actor.energy);assert.equal(walker.facing,quote.actor.facing);assert.deepEqual(spacePoint(walker),spacePoint(path));assert.equal(moved.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const prefix=convoySafeFire(moved,controller),orders=[move,...prefix.orders,prefix.fire],after=convoyRoofReplay(start,orders);assert.equal(convoyRounds(convoyUnit(after)),convoyRounds(guard)-1);assert.equal(convoyUnit(after).tacticalLevel,1);convoyHeldGoods(start,after,['guard']);assert.deepEqual(start,before);
 const blocked=convoyRoofArena({lane:true,blocked:true}),blockedBefore=structuredClone(blocked),hold=foundryConvoyDefenseController(blocked),actor=convoyUnit(blocked),target=convoyUnit(blocked,'target');assert.equal(canSee(blocked,actor,blocked.npcs[0]),true);assert.ok(firearmBystanderRisk(blocked,actor,target,'torso').direct.some(body=>body.id==='resident'));assert.equal(hold(blocked,actor),null);assert.deepEqual(blocked,blockedBefore);
});

test('every actual convoy ground actor keeps the exact coastal policy including paid adjacent medical work and cannon contacts',()=>{
 const start=convoyRoofArena({ground:true}),before=structuredClone(start),controller=foundryConvoyDefenseController(start),ordinary=coastalBatteryController(start,{sharedArtillerySight:true}),ground=start.units.filter(unit=>unit.side==='player'&&(unit.tacticalLevel??0)===0);
 assert.equal(ground.length,5);assert.deepEqual(ground.filter(unit=>artilleryContact(start,unit,start.artillery[0])).map(unit=>unit.id).sort(),['reserve1','reserve2']);for(const unit of ground)assert.deepEqual(controller(start,unit),ordinary(start,unit));
 const doctor=convoyUnit(start,'physician'),patient=convoyUnit(start,'patient'),aid=controller(start,doctor),quote=medicalUsePreview(start,doctor,patient);assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:patient.id});
 const after=convoyRoofReplay(start,[aid]),treated=convoyUnit(after,patient.id),medic=convoyUnit(after,doctor.id);assert.equal(medic.ap,doctor.ap-quote.cost);assert.equal(medic.medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(treated.hp,quote.treatment.hpAfter);assert.equal(treated.bleeding,quote.treatment.bleedingAfter);assert.deepEqual(spacePoint(medic),spacePoint(doctor));
 for(const unit of after.units.filter(unit=>unit.side==='player'&&(unit.tacticalLevel??0)===0))assert.deepEqual(controller(after,unit),ordinary(after,unit));convoyHeldGoods(start,after,[doctor.id,patient.id]);assert.deepEqual(start,before);
});

// Independent battery-rear declarations: five actual Tucumán locals and a
// separately paid two-person courier home. All property and wounds precede
// compilation; the finite gun, map knowledge, unloaded charges and posts are
// obtained only through ordinary accepted orders below.
function batteryRearSetup({empty=false,crew=false,raid=false,nearRaid=false,noClinicalGroup=false}={}){
 const d=scaffoldDocuments('finite-battery-five-person-rear');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:').replaceAll('watch-post','tucuman'));
 d.manifest.scenario='granaderos-historical-v1';d.content.rules.startingTreasury=50000;d.content.rules.deploymentCartridges=empty?0:9;
 d.content.startingTerritory.tucuman.owner='patriot';d.content.startingTerritory.mendoza={owner:'patriot',loyalty:65};d.content.campaignRoles={foundryEngineer:'person-2',marchCommander:null};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 const point=d.world.cells.find(cell=>cell.col===22&&cell.row===16),template=structuredClone(d.world.sectors.find(row=>row.id==='tucuman'));
 Object.assign(point,{name:'Mendoza',location:'mendoza',locality:'mendoza',anchor:true,district:true});d.world.sectors.push({...template,id:'mendoza',name:'Mendoza',grid:point.grid,neighbors:['cordoba','tucuman']});
 d.world.sectors.find(row=>row.id==='cordoba').neighbors=['tucuman','mendoza'];d.world.sectors.find(row=>row.id==='tucuman').neighbors=['cordoba','mendoza'];
 d.world.places.mendoza={lon:22,lat:17,label:'Mendoza',dx:12,dy:0};d.world.districts.mendoza=[{id:'mendoza:0',sectorId:'mendoza',col:22,row:16,name:'Mendoza',x:point.x,y:point.y,urban:false}];
 d.world.landscapes.mendoza='settlement';d.world.ruralSectors.push('mendoza');d.world.expansion.rural=d.world.expansion.rural.filter(id=>id!=='tucuman');d.world.expansion.buildingTargets={cordoba:0,tucuman:0,mendoza:0};
 d.world.exitLinks=[['cordoba','E',19,8,'tucuman','W',0,8],['tucuman','E',19,8,'mendoza','W',0,8],['cordoba','S',10,15,'mendoza','N',10,0]];
 d.maps.mendoza={...structuredClone(d.maps.tucuman),id:'mendoza',title:'Mendoza'};d.world.arrivalFacilities.tucuman=['barracks'];d.content.arrivalSites.push({sector:'tucuman',facilities:['barracks']});
 const local=[11,144,0,134,110],couriers=[2,100],base=d.content.characters[0],rifle=defaultContentPackage().weapons.find(row=>row.id==='firearm-1801');d.content.weapons.push(structuredClone(rifle));
 d.content.characters=[...couriers,...local].map(id=>({...structuredClone(base),id:'person-'+id,name:'Servicio '+id,nickname:'Servicio '+id,monthlyPay:30,arrivalHours:0,weapon:'firearm-1801',attributes:{...base.attributes,maxHp:80,strength:90,marksmanship:90,medical:id===0?90:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:id===0?3:0},startingCondition:{hp:crew&&id===134?60:80,energy:100,fatigue:0,bleeding:0,bandaged:0}}));
 d.maps.tucuman.upperSurfaces=Array.from({length:30},(_,i)=>({id:'battery-rear-roof-'+i,x:7+i%6,y:3+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 if(noClinicalGroup)d.maps.tucuman.upperSurfaces=Array.from({length:8},(_,i)=>({id:'battery-rear-line-'+i,x:7+i,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps.tucuman.climbLinks=[{id:'battery-rear-access',kind:'climb',from:{x:7,y:2,tacticalLevel:0},to:{x:7,y:3,tacticalLevel:1}}];
 d.maps.tucuman.props=[{id:'battery-rear-chest',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];d.world.physical.caches.tucuman={chest:'battery-rear-chest',contents:[]};
 d.world.physical.arsenals.tucuman={version:1,sector:'tucuman',chest:'battery-rear-chest',pieces:[{id:'arsenal:five-rear:1',type:'bronze4',side:'player',loaded:false,ammo:4}]};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?2:240,axis:['tucuman']}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(8,content);const paid=[];
 for(const id of [...couriers,...local]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'month'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'month',destination:local.includes(id)?'tucuman':'cordoba'});assert.equal(c.resources.treasury,cash-quote.total);paid.push({id,quote});}
 c=order(c,{type:'createSquad',name:'Mensajería real',sector:'cordoba',ids:couriers});const selected=c.activeSquadId;
 const homes=[];for(const ids of [local.slice(0,2),local.slice(2)]){c=order(c,{type:'createSquad',name:'Retaguardia real',sector:'tucuman',ids});homes.push(c.activeSquadId);}
 c=prepareNorthernHospitalFortification(c,{sector:'tucuman'}).campaign;c=order(c,{type:'selectSquad',id:homes[0]});c=leave(takeFiniteCache(visit(c),local[0],[],{cacheId:'battery-rear-chest'}));
 const gun=c.sectorStates.tucuman.artillery.find(piece=>piece.id==='arsenal:five-rear:1');assert.ok(gun);const parcel=storedArtilleryRecord(gun);
 if(crew){
  let pair=visit(c);
  for(const id of local.slice(0,2)){
   const unit=pair.battle.units.find(u=>u.id===String(id)),actual=pair.battle.artillery.find(g=>g.id===gun.id),destination=getReachable(pair.battle,unit).filter(p=>(p.tacticalLevel??0)===0&&!sameCell(p,actual)&&artilleryContact(pair.battle,{...unit,...spacePoint(p)},actual)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(destination);
   if(!sameCell(unit,destination)){pair.battle=actBattle(pair.battle,{type:'move',unitId:unit.id,...spacePoint(destination)});assert.equal(pair.battle.lastError,null);}
   assert.ok(artilleryContact(pair.battle,pair.battle.units.find(u=>u.id===String(id)),pair.battle.artillery.find(g=>g.id===gun.id)));
  }
  const actualCrew=artilleryCrewPlan(pair.battle,pair.battle.units.find(u=>u.id===String(local[0])),pair.battle.artillery.find(g=>g.id===gun.id),1,true);assert.equal(actualCrew.reason,null);assert.deepEqual(actualCrew.crew.sort(),local.slice(0,2).map(String).sort());
  c=leave(pair);c=stageRouteRoofDefenders(c,[0]);c=order(c,{type:'assignCare',operativeId:134,assignment:'patient'});c=order(c,{type:'assignCare',operativeId:0,assignment:'doctor'});
 }else{c=order(c,{type:'storeArtillery',sector:'tucuman',artilleryId:gun.id});assert.deepEqual(c.artilleryDepots.tucuman.find(piece=>piece.id===gun.id),parcel);}
 if(!crew&&!empty)for(const id of [11,0,134])c=order(c,{type:'unloadAmmunition',operativeId:id});
 c=order(c,{type:'selectSquad',id:selected});for(const id of couriers)c=order(c,{type:'assignCare',operativeId:id,assignment:'rest'});
 if(nearRaid){
  for(let n=0;!c.enemyGroups.some(g=>g.status==='marching'&&g.target==='tucuman')&&n<4;n++)c=order(c,{type:'wait',hours:1});
  const group=c.enemyGroups.find(g=>g.status==='marching'&&g.target==='tucuman');assert.ok(group);const target=group.arrivalAt*3600-1;
  for(let n=0;clock(c)<target&&n<8;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});assert.equal(clock(c),target);
 }
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(d,declaration);return {campaign:saved(c),local,couriers,selected,homes,gunId:gun.id,parcel,paid};
}
const batteryRearRounds=c=>c.recruited.reduce((sum,id)=>{const body=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);return sum+body.loaded+ammoCount(body,'ammoMusket');},0);

test('five actual local rear soldiers pay finite reload and roof cover before battery travel releases the first real raid',()=>{
 const s=batteryRearSetup({raid:true}),start=s.campaign,before=structuredClone(start),events=[],initialRounds=batteryRearRounds(start);
 assert.equal(start.squad.length,2);assert.ok(start.squad.every(id=>s.couriers.includes(id)));assert.equal(s.local.filter(id=>start.operativeState[id].carriedLoaded===0).length,3);
 const c=recoverFoundryCannons(start,1,{report:event=>events.push(event)}),prepared=events.findIndex(event=>event.event==='foundryBatteryRearPrepared'),travel=events.findIndex(event=>event.event==='routeBatteryTravelOrder'&&['wait','travel'].includes(event.action.type));
 assert.ok(prepared>=0&&travel>prepared);const rear=events[prepared];assert.deepEqual(new Set(rear.ids),new Set(s.local));assert.ok(rear.staging.restored);assert.equal(rear.staging.positions.length,5);assert.ok(rear.endSeconds>rear.startSeconds&&rear.endSeconds-rear.startSeconds<=3600);
 assert.ok(rear.reloads.some(event=>event.orders.some(action=>action.type==='reload')));assert.ok(rear.staging.orders.some(row=>row.action.type==='climb'));assert.equal(new Set(rear.staging.positions.map(p=>`${p.tacticalLevel}:${p.x},${p.y}`)).size,5);
 assert.deepEqual(new Set(rear.staging.landingGuardIds),new Set([11,144,134,110]));assert.equal(rear.staging.publicPosts.length,4);for(const post of rear.staging.publicPosts){assert.equal(post.tacticalLevel,post.access.tacticalLevel);const distance=Math.hypot(post.x-post.access.x,post.y-post.access.y);assert.ok(distance>1.5&&distance<=4);assert.ok(rear.staging.positions.every(point=>!sameSurface(point,post.access)||Math.hypot(point.x-post.access.x,point.y-post.access.y)>1.5));}
 assert.equal(rear.staging.physicianId,0);const physicianPost=rear.staging.physicianPost;assert.equal(physicianPost.id,0);assert.deepEqual(new Set(physicianPost.neighbors),new Set([11,144,134,110]));for(const id of physicianPost.neighbors){const post=rear.staging.publicPosts.find(point=>point.id===id);assert.ok(post&&sameSurface(post,physicianPost)&&Math.hypot(post.x-physicianPost.x,post.y-physicianPost.y)<=1.5);}assert.ok(rear.staging.orders.some(row=>row.kind==='battle'&&row.action.unitId==='0'&&['move','climb'].includes(row.action.type)));
 const checkpoint=events.find(event=>event.event==='freshRouteCheckpoint'&&event.stage==='foundry-battery-rear-readiness');assert.equal(batteryRearRounds(checkpoint.campaign),initialRounds);for(const id of s.local){assert.ok(checkpoint.campaign.operativeState[id].carriedLoaded>0);assert.ok(checkpoint.campaign.operativeState[id].residentPosition.tacticalLevel>0);}
 assert.ok(sameCell(checkpoint.campaign.operativeState[0].residentPosition,physicianPost));for(const id of physicianPost.neighbors){const post=checkpoint.campaign.operativeState[id].residentPosition;assert.ok(sameSurface(post,physicianPost)&&Math.hypot(post.x-physicianPost.x,post.y-physicianPost.y)<=1.5);}
 const response=events.find(event=>event.event==='freshRouteOrder'&&event.action.type==='respondToEncounter');assert.equal(response.campaign.pendingBattle.squad.length,5);assert.deepEqual(new Set(response.campaign.pendingBattle.squad.map(op=>Number(op.id))),new Set(s.local));assert.equal(response.campaign.pendingBattle.defenseFort,3);assert.ok(events.some(event=>event.event==='battleFinished'&&event.sector==='tucuman'&&event.status==='victory'));
 const medicine=events.find(event=>event.event==='foundryConvoyDefenseMedicine');assert.ok(medicine);const aid=medicine.orders.filter(action=>action.unitId!==action.targetId);assert.ok(aid.length>0,'The actual successful raid must include finite nonself first aid.');assert.ok(aid.every(action=>action.unitId==='0'&&s.local.includes(Number(action.targetId))));assert.equal(medicine.before.find(unit=>unit.id==='0').medkits,3);assert.ok(medicine.before.filter(unit=>unit.id!=='0').every(unit=>unit.medkits===0));const spent=medicine.before.reduce((sum,unit)=>sum+unit.medkits,0)-medicine.after.reduce((sum,unit)=>sum+unit.medkits,0);assert.ok(spent>0&&spent<=3&&spent>=aid.length);assert.equal(medicine.after.find(unit=>unit.id==='0').medkits,3-spent);assert.equal(c.operativeState[0].medkits,3-spent);
 assert.ok(batteryRearRounds(c)<initialRounds);assert.deepEqual(c.artilleryDepots.mendoza.find(g=>g.id===s.gunId),s.parcel);assert.equal(c.artilleryDepots.tucuman.some(g=>g.id===s.gunId),false);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 for(const id of [...s.local,...s.couriers]){assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.deepEqual(start,before);saved(c);assert.deepEqual(recoverFoundryCannons(saved(start),1),c);
});

test('bounded rear preparation keeps actual complete gun contacts, earlier physician post and local care duties',()=>{
 const s=batteryRearSetup({crew:true}),start=s.campaign,before=structuredClone(start),rounds=batteryRearRounds(start),r=prepareFoundryBatteryRear(start),c=r.campaign;
 assert.deepEqual(r.receipt.crewIds,[11,144]);for(const id of [11,144,0])assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 assert.deepEqual(r.receipt.staging.ids,[134,110]);assert.equal(c.operativeState[0].assignment,'doctor');assert.equal(c.operativeState[134].assignment,'patient');for(const id of [134,110])assert.ok(c.operativeState[id].residentPosition.tacticalLevel>0);
 assert.deepEqual(r.receipt.staging.landingGuardIds,[110]);assert.deepEqual(r.receipt.staging.publicPosts.map(post=>post.id),[110]);assert.ok(!r.receipt.staging.positions.some(point=>sameCell(point,r.receipt.staging.publicPosts[0].access)));
 assert.equal(c.activeSquadId,s.selected);assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.sectorStates.tucuman.artillery,start.sectorStates.tucuman.artillery);assert.equal(batteryRearRounds(c),rounds);
 for(const id of start.recruited)for(const key of ['hp','bleeding','bandaged','medkits','alive','captured','assignment'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);assert.deepEqual(start,before);saved(c);assert.deepEqual(prepareFoundryBatteryRear(saved(start)),r);
});

test('an empty actual rear firearm remains a terminal finite shortage without a cache or cartridge grant',()=>{
 const s=batteryRearSetup({empty:true}),start=s.campaign,before=structuredClone(start),events=[];let error;
 try{prepareFoundryBatteryRear(start,{report:event=>events.push(event)});}catch(failure){error=failure;}
 assert.match(error?.message??'',/finite loaded charge/);assert.equal(events.some(event=>event.event==='foundryBatteryRearPrepared'),false);assert.equal(events.some(event=>event.event==='routeBatteryShipment'),false);assert.equal(batteryRearRounds(start),0);assert.deepEqual(start,before);
 // The raw failure is terminal. No query, save, replay or continuation follows.
});

test('reloads refuse before the next Native paid action would exceed the same roof-preparation deadline',()=>{
 const s=batteryRearSetup(),start=s.campaign,before=structuredClone(start),events=[];let error;
 try{prepareFoundryBatteryRear(start,{deadlineSeconds:clock(start)+1,report:event=>events.push(event)});}catch(failure){error=failure;}
 assert.match(error?.message??'',/next paid reload step/);assert.deepEqual(error.boundedPreMarchReload.orders,[]);assert.equal(error.boundedPreMarchReload.startSeconds,error.boundedPreMarchReload.endSeconds);assert.equal(events.some(event=>event.event==='foundryBatteryRearPrepared'),false);assert.deepEqual(start,before);
 // Diagnostic references are inspected as raw values only.
});

test('a real raid released by bounded reload time stops before another visit or battery shipment',()=>{
 const s=batteryRearSetup({raid:true,nearRaid:true}),start=s.campaign,before=structuredClone(start),events=[];let error;
 try{prepareFoundryBatteryRear(start,{report:event=>events.push(event)});}catch(failure){error=failure;}
 assert.match(error?.message??'',/actual (arrival|encounter)|Actual contact/);assert.ok(error.campaign&&error.boundedPreMarchReload);assert.equal(events.some(event=>event.event==='foundryBatteryRearPrepared'),false);assert.equal(events.some(event=>event.event==='routeBatteryShipment'),false);assert.deepEqual(start,before);JSON.stringify({campaign:error.campaign,battle:error.battle,receipt:error.boundedPreMarchReload});
 // The interrupted actual prefix is never queried, saved, replayed or resumed.
});

test('bounded rear admission reserves the quoted exploration reload and its separate possible enemy-first round',()=>{
 const s=batteryRearSetup();let c=order(s.campaign,{type:'selectSquad',id:s.homes[0]});const pair=visit(c),unit=pair.battle.units.find(u=>u.id==='11'),quote=reloadPlan(unit,pair.battle);
 assert.equal(pair.battle.mode,'exploration');assert.ok(quote.pa>0);assert.equal(quote.pa,quote.totalPA);const equipmentSeconds=Math.max(1,Math.ceil(quote.pa*.06));assert.ok(equipmentSeconds>0);
 c=leave(pair);c=order(c,{type:'selectSquad',id:s.selected});const start=saved(c),before=structuredClone(start),events=[],deadlineSeconds=clock(start)+equipmentSeconds+COMBAT_ROUND_SECONDS-1;let error;
 try{prepareFoundryBatteryRear(start,{deadlineSeconds,report:event=>events.push(event)});}catch(failure){error=failure;}
 assert.match(error?.message??'',/next paid reload step/);assert.deepEqual(error.boundedPreMarchReload.orders,[]);assert.equal(error.boundedPreMarchReload.startSeconds,error.boundedPreMarchReload.endSeconds);assert.equal(events.some(event=>event.event==='finishedReload'),false);assert.equal(events.some(event=>event.event==='foundryBatteryRearPrepared'),false);assert.deepEqual(start,before);
 // This is real fresh quote admission. No contact or stopped pair is replayed.
});

test('a full loaded supplied rear physician pays the ordinary switch from actual medical hands without spending linen or a charge',()=>{
 const s=batteryRearSetup({crew:true});let c=order(s.campaign,{type:'selectSquad',id:s.homes[1]});for(const id of c.squad)if(c.operativeState[id].assignment!=='active')c=order(c,{type:'assignCare',operativeId:id,assignment:'active'});const pair=visit(c),doctor=pair.battle.units.find(u=>u.id==='0');assert.ok(doctor.loaded>0&&doctor.medkits>0);assert.equal(reloadPlan(doctor,pair.battle).totalPA,0);
 pair.battle=actBattle(pair.battle,{type:'weapon',unitId:'0',slot:'medical'});assert.equal(pair.battle.lastError,null);assert.equal(pair.battle.units.find(u=>u.id==='0').activeSlot,'medical');c=leave(pair);c=order(c,{type:'assignCare',operativeId:0,assignment:'doctor'});c=order(c,{type:'assignCare',operativeId:134,assignment:'patient'});c=order(c,{type:'selectSquad',id:s.selected});
 const start=saved(c),before=structuredClone(start),events=[],rounds=batteryRearRounds(start),r=prepareFoundryBatteryRear(start,{report:event=>events.push(event)}),after=r.campaign,switched=r.receipt.reloads.find(event=>event.ids.includes(0));
 assert.equal(start.operativeState[0].activeSlot,'medical');assert.ok(switched);assert.deepEqual(switched.orders,[{type:'weapon',unitId:'0',slot:'primary'}]);assert.equal(switched.endSeconds-switched.startSeconds,1);assert.equal(after.operativeState[0].activeSlot,'primary');assert.equal(after.operativeState[0].assignment,'doctor');assert.equal(after.operativeState[134].assignment,'patient');assert.equal(after.operativeState[0].medkits,start.operativeState[0].medkits);assert.equal(after.operativeState[0].carriedLoaded,start.operativeState[0].carriedLoaded);assert.equal(batteryRearRounds(after),rounds);
 for(const id of [11,144,0])assert.deepEqual(after.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.deepEqual(after.squads,start.squads);assert.equal(after.activeSquadId,s.selected);assert.equal(after.resources.treasury,start.resources.treasury);assert.deepEqual(after.contracts,start.contracts);assert.deepEqual(start,before);saved(after);assert.deepEqual(prepareFoundryBatteryRear(saved(start)),r);
});

// Independent public miss-path declarations, not a retained raid or its RNG.
// The nearby patient earns real finite aid before the loaded rifle is selected.
// Only the second fresh declaration moves the other known friend off the lane.
function physicianFireArena({scatter=false}={}){
 const width=22,height=16,base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,weapon:1802,blade:1813,loaded:1,ammo:8,condition:100,activeSlot:'primary',stance:'prone',movementMode:'prone',facing:2,marksmanship:100,dexterity:100,agility:100,strength:80,medical:0,medkits:0,patrol:false,overwatch:false,tacticalLevel:1};
 const field=[{...base,id:'physician',name:'Sanitario declarado',x:1,y:4,medical:90,medkits:3,activeSlot:'medical'},
  {...base,id:'patient',name:'Paciente declarado',x:1,y:5,hp:60,bleeding:2,weapon:0,loaded:0,ammo:0,activeSlot:'unarmed',stance:'standing',movementMode:'walk'},
  {...base,id:'friend',name:'Compañero conocido',x:8,y:scatter?5:9,weapon:0,loaded:0,ammo:0,activeSlot:'unarmed',stance:'standing',movementMode:'walk'}];
 const options={id:'independent-convoy-physician-fire',width,height,hour:12,seed:45,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),upperSurfaces:Array.from({length:width*height},(_,i)=>({id:'physician-roof:'+i,x:i%width,y:Math.floor(i/width),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:30})),climbLinks:[],npcs:[],artillery:[],
  enemies:[{id:'target',name:'Contacto declarado',x:8,y:4,tacticalLevel:1,hp:500,maxHp:500,bleeding:0,bandaged:0,energy:100,fatigue:0,weapon:0,loaded:0,ammo:0,medical:0,medkits:0,stance:'standing',facing:6,patrol:false,overwatch:false}]};
 const declaration=structuredClone({field,options}),battle=createBattle(field,options);assert.deepEqual({field,options},declaration);assert.equal(battle.mode,'combat');assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function physicianFirePrefix(start){
 const controller=foundryConvoyDefenseController(start),doctor=convoyUnit(start,'physician'),patient=convoyUnit(start,'patient'),quote=medicalUsePreview(start,doctor,patient);assert.equal(quote.allowed,true);
 const aid=controller(start,doctor);assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:patient.id});const healed=convoyRoofReplay(start,[aid]),treated=convoyUnit(healed,patient.id),medic=convoyUnit(healed,doctor.id);
 assert.ok(quote.treatment.dressingsUsed>0);assert.equal(medic.medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(medic.ap,doctor.ap-quote.cost);assert.equal(treated.hp,quote.treatment.hpAfter);assert.equal(treated.bleeding,quote.treatment.bleedingAfter);assert.equal(treated.bandaged,quote.treatment.bandagedAfter);assert.equal(healed.elapsedSeconds,start.elapsedSeconds+COMBAT_ROUND_SECONDS);
 const primary=controller(healed,medic);assert.deepEqual(primary,{type:'weapon',unitId:doctor.id,slot:'primary'});const armed=convoyRoofReplay(start,[aid,primary]),actor=convoyUnit(armed,doctor.id);assert.equal(actor.activeSlot,'primary');assert.equal(actor.ap,medic.ap-actionCosts(healed,medic).weapon);assert.equal(actor.medkits,medic.medkits);assert.equal(convoyRounds(actor),convoyRounds(doctor));assert.equal(armed.elapsedSeconds,healed.elapsedSeconds);
 for(const unit of start.units.filter(unit=>unit.side==='player'))assert.deepEqual(spacePoint(convoyUnit(armed,unit.id)),spacePoint(unit));
 return {controller,battle:armed,doctor:actor,orders:[aid,primary]};
}

test('a roof physician pays adjacent finite aid then holds an ordinary rifle miss path through a known friend',()=>{
 const start=physicianFireArena({scatter:true}),before=structuredClone(start),prefix=physicianFirePrefix(start),battle=prefix.battle,doctor=prefix.doctor,copy=structuredClone(battle),ordinary=northernClinicDefenseOrder(battle,doctor);assert.equal(ordinary?.type,'fire');
 const target=convoyUnit(battle,ordinary.targetId),option=firearmShotOptions(battle,doctor,target,ordinary.aim??0).find(option=>option.aim===(ordinary.aim??0)&&option.hitLocation===(ordinary.hitLocation??'torso'));assert.equal(knownRouteShotSafety(battle,doctor,target)(option),true);assert.ok(firearmBystanderRisk(battle,doctor,target,ordinary.hitLocation).scatter.some(body=>body.id==='friend'));assert.equal(knownRouteBystanderShotSafety(battle,doctor,target)(option),false);
 assert.equal(prefix.controller(battle,doctor),null);assert.equal(prefix.controller(battle,doctor),null);assert.deepEqual(battle,copy);assert.equal(convoyUnit(battle,'friend').hp,convoyUnit(start,'friend').hp);assert.equal(doctor.medkits,convoyUnit(start,'physician').medkits-1);assert.equal(convoyRounds(doctor),convoyRounds(convoyUnit(start,'physician')));assert.deepEqual(convoyRoofReplay(start,prefix.orders),battle);assert.deepEqual(start,before);
 // The refused shot is never executed. Only the real successful aid/equip
 // prefix is presented, validated and replayed from this fresh declaration.
});

test('a roof physician keeps the exact safe ordinary shot after finite adjacent aid and pays its real charge and AP',()=>{
 const start=physicianFireArena(),before=structuredClone(start),prefix=physicianFirePrefix(start),battle=prefix.battle,doctor=prefix.doctor,ordinary=northernClinicDefenseOrder(battle,doctor);assert.equal(ordinary?.type,'fire');const action=prefix.controller(battle,doctor);assert.deepEqual(action,ordinary);
 const target=convoyUnit(battle,action.targetId),option=firearmShotOptions(battle,doctor,target,action.aim??0).find(option=>option.aim===(action.aim??0)&&option.hitLocation===(action.hitLocation??'torso'));assert.equal(knownRouteBystanderShotSafety(battle,doctor,target)(option),true);assert.deepEqual(firearmBystanderRisk(battle,doctor,target,action.hitLocation),{direct:[],scatter:[]});
 const cost=actionCosts(battle,doctor,target),after=convoyRoofReplay(start,[...prefix.orders,action]),fired=convoyUnit(after,doctor.id);assert.equal(fired.ap,doctor.ap-cost.fire-(action.aim??0)*cost.aim);assert.equal(convoyRounds(fired),convoyRounds(doctor)-1);assert.equal(fired.condition,doctor.condition-1);assert.equal(fired.medkits,doctor.medkits);assert.equal(after.elapsedSeconds,battle.elapsedSeconds);assert.deepEqual(spacePoint(fired),spacePoint(doctor));
 for(const id of ['patient','friend']){assert.equal(convoyUnit(after,id).hp,convoyUnit(battle,id).hp);assert.equal(convoyUnit(after,id).medkits,convoyUnit(battle,id).medkits);assert.deepEqual(spacePoint(convoyUnit(after,id)),spacePoint(convoyUnit(battle,id)));}assert.deepEqual(start,before);
});

test('a fresh five-person rear pays one complete adjacent physician group from its actual two homes',()=>{
 const s=batteryRearSetup(),start=s.campaign,before=structuredClone(start),rounds=batteryRearRounds(start),r=prepareFoundryBatteryRear(start),c=r.campaign,staging=r.receipt.staging,plan=staging.physicianGroup;
 assert.equal(staging.visits[0].groupId,s.homes[1]);assert.equal(plan.groupId,s.homes[1]);assert.deepEqual(staging.visits[0].initial.units.filter(unit=>unit.side==='player').map(unit=>Number(unit.id)).sort((a,b)=>a-b),[0,110,134]);
 const initialDoctor=staging.visits[0].initial.units.find(unit=>unit.id==='0');assert.ok(getReachable(staging.visits[0].initial,initialDoctor).some(point=>sameCell(point,plan.physician)));
 assert.equal(plan.physician.id,0);assert.equal(plan.rifles.length,4);assert.deepEqual(new Set(plan.rifles.map(post=>post.id)),new Set([11,144,134,110]));assert.equal(new Set([plan.physician,...plan.rifles].map(post=>`${post.tacticalLevel}:${post.x},${post.y}`)).size,5);
 assert.deepEqual(new Set(staging.physicianPost.neighbors),new Set([11,144,134,110]));for(const post of plan.rifles){assert.ok(sameCell(c.operativeState[post.id].residentPosition,post));assert.ok(sameSurface(post,plan.physician)&&Math.hypot(post.x-plan.physician.x,post.y-plan.physician.y)<=1.5);const actual=staging.publicPosts.find(point=>point.id===post.id);assert.ok(actual&&sameCell(actual,post));assert.ok(Math.hypot(post.x-actual.access.x,post.y-actual.access.y)>1.5&&Math.hypot(post.x-actual.access.x,post.y-actual.access.y)<=4);}
 assert.ok(sameCell(c.operativeState[0].residentPosition,plan.physician));for(const visitRow of staging.visits)for(const post of visitRow.positions)assert.ok(visitRow.initial.units.some(unit=>unit.id===String(post.id)));for(const post of staging.positions)for(const actual of staging.publicPosts)assert.ok(!sameSurface(post,actual.access)||Math.hypot(post.x-actual.access.x,post.y-actual.access.y)>1.5);
 const paid=staging.orders.filter(row=>row.kind==='battle'&&['move','climb'].includes(row.action.type));assert.ok(paid.length>0&&paid.some(row=>row.action.unitId==='0'));assert.ok(staging.steps>0&&staging.steps<=64*5);assert.ok(staging.orders.length<=600);assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=3600);
 assert.equal(batteryRearRounds(c),rounds);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.artilleryDepots,start.artilleryDepots);for(const id of start.recruited)for(const key of ['hp','alive','bleeding','bandaged','medkits','assignment','weapon','condition','weaponInstanceId'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);
 assert.deepEqual(start,before);saved(c);assert.deepEqual(prepareFoundryBatteryRear(saved(start)),r);
});

test('a fresh narrow roof refuses a physician group before paying any incomplete post',()=>{
 const s=batteryRearSetup({noClinicalGroup:true}),start=s.campaign,before=structuredClone(start),scene=start.sectorStates.tucuman,upper=scene.climbLinks.map(link=>(link.to.tacticalLevel??0)>(link.from.tacticalLevel??0)?link.to:link.from),legal=scene.upperSurfaces.filter(point=>!point.blocked&&!upper.some(access=>(point.tacticalLevel??0)===(access.tacticalLevel??0)&&Math.hypot(point.x-access.x,point.y-access.y)<=1.5));
 assert.ok(legal.length>=5);assert.ok(legal.every(point=>legal.filter(other=>other!==point&&(point.tacticalLevel??0)===(other.tacticalLevel??0)&&Math.hypot(point.x-other.x,point.y-other.y)<=1.5).length<4));const events=[];let error;
 try{prepareFoundryBatteryRear(start,{report:event=>events.push(event)});}catch(failure){error=failure;}
 assert.match(error?.message??'',/complete reachable adjacent rifle group/);const receipt=error.routeRoofDefenders;assert.equal(receipt.physicianId,0);assert.equal(receipt.visits[0].groupId,s.homes[1]);assert.equal(receipt.physicianGroup,null);assert.deepEqual(receipt.positions,[]);assert.equal(receipt.orders.some(row=>row.kind==='battle'&&['move','climb'].includes(row.action.type)),false);assert.ok(receipt.endSeconds<=receipt.until);assert.equal(events.some(event=>event.event==='foundryBatteryRearPrepared'),false);assert.deepEqual(start,before);
 // Only raw stopped-prefix values are inspected. No game query, save, replay
 // or continuation follows the actual finite geometry refusal.
});

// Independent declarations reproduce scarcity and wound ordering before the
// factory. No captured raid or later health, dressing or AP patch is used.
function batteryFieldAidArena({combat=false,critical=false,kits=2,unsafe=false,crowded=false,contact=false}={}){
 const width=14,height=10,level=combat?1:0,base={maxHp:80,hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,weapon:1800,blade:1813,loaded:1,ammo:8,condition:100,activeSlot:'primary',stance:'prone',movementMode:'prone',facing:2,marksmanship:90,dexterity:90,agility:90,strength:80,medical:0,medkits:0,patrol:false,overwatch:false,tacticalLevel:level};
 const field=[{...base,id:'physician',x:3,y:3,medical:90,medkits:kits,hp:combat?80:30,bleeding:combat?0:5,activeSlot:combat?'medical':'primary'},
  {...base,id:'hourly-urgent',x:4,y:3,hp:critical?6:42,bleeding:critical?3:5},
  {...base,id:'raw-ratio-urgent',x:3,y:4,hp:31,bleeding:4},
  {...base,id:'later',x:2,y:3,hp:34,bleeding:3},
  {...base,id:'last',x:3,y:2,hp:66,bleeding:2}];
 if(combat&&!crowded){field[1].x=2;field[1].y=2;field[2].x=2;field[2].y=4;}
 if(unsafe)field.push({...base,id:'lane-friend',x:7,y:6,weapon:0,loaded:0,ammo:0,activeSlot:'unarmed',stance:'standing',movementMode:'walk'});
 if(combat)for(const unit of field)if(unit.id!=='physician'&&unit.id!=='hourly-urgent'){unit.hp=80;unit.bleeding=0;}
 const options={id:'declared-battery-field-aid',width,height,hour:12,seed:45,exploration:!combat,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),upperSurfaces:combat?Array.from({length:width*height},(_,i)=>({id:'battery-aid-roof:'+i,x:i%width,y:Math.floor(i/width),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:30})):[],artillery:[],npcs:[],enemies:combat?[{...base,id:'target',side:'enemy',x:10,y:8,hp:500,maxHp:500,weapon:0,loaded:0,ammo:0,stance:'standing',movementMode:'walk'}]:[]};
 if(contact){
  Object.assign(options.enemies[0],{x:4,y:4,hp:100,maxHp:100});
  for(const unit of field)if(unit.id!=='physician')Object.assign(unit,{stance:'standing',movementMode:'walk'});
 }
 const declaration=structuredClone({field,options}),battle=createBattle(field,options);assert.deepEqual({field,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('the battery reserve pays safe rifle work instead of noncritical aid and keeps actual critical aid payable',()=>{
 const start=batteryFieldAidArena({combat:true}),before=structuredClone(start),doctor=convoyUnit(start,'physician'),ordinary=foundryConvoyDefenseController(start)(start,doctor);
 assert.equal(ordinary?.type,'useItem');assert.deepEqual(foundryConvoyDefenseController(start,{reserveFieldDressings:0})(start,doctor),ordinary);const held=foundryConvoyDefenseController(start,{reserveFieldDressings:2}),switching=held(start,doctor);assert.deepEqual(switching,{type:'weapon',unitId:doctor.id,slot:'primary'});const armed=convoyRoofReplay(start,[switching]),actor=convoyUnit(armed,doctor.id);assert.equal(actor.ap,doctor.ap-actionCosts(start,doctor).weapon);assert.equal(actor.medkits,doctor.medkits);
 const shot=held(armed,actor);assert.equal(shot?.type,'fire');const target=convoyUnit(armed,shot.targetId),option=firearmShotOptions(armed,actor,target,shot.aim??0).find(option=>option.aim===(shot.aim??0)&&option.hitLocation===(shot.hitLocation??'torso'));assert.equal(knownRouteBystanderShotSafety(armed,actor,target)(option),true);const fired=convoyRoofReplay(start,[switching,shot]),cost=actionCosts(armed,actor,target);assert.equal(convoyUnit(fired,doctor.id).ap,actor.ap-cost.fire-(shot.aim??0)*cost.aim);assert.equal(convoyRounds(convoyUnit(fired,doctor.id)),convoyRounds(doctor)-1);assert.equal(convoyUnit(fired,doctor.id).medkits,2);assert.deepEqual(start,before);
 const critical=batteryFieldAidArena({combat:true,critical:true}),criticalBefore=structuredClone(critical),medic=convoyUnit(critical,'physician'),policy=foundryConvoyDefenseController(critical,{reserveFieldDressings:2}),aid=policy(critical,medic);assert.equal(aid?.type,'useItem');assert.equal(aid.targetId,'hourly-urgent');
 const quote=medicalUsePreview(critical,medic,convoyUnit(critical,aid.targetId));assert.equal(quote.allowed,true);assert.equal(quote.treatment.critical,true);const after=convoyRoofReplay(critical,[aid]);assert.equal(convoyUnit(after,medic.id).medkits,medic.medkits-quote.treatment.dressingsUsed);assert.ok(convoyUnit(after,aid.targetId).hp>convoyUnit(critical,aid.targetId).hp);assert.deepEqual(critical,criticalBefore);
});

test('finite battery field aid protects the bleeding physician and the earliest actual hourly loss before delivery',()=>{
 const start=batteryFieldAidArena(),before=structuredClone(start),orders=[],events=[];
 assert.ok(convoyUnit(start,'raw-ratio-urgent').hp/convoyUnit(start,'raw-ratio-urgent').bleeding<convoyUnit(start,'hourly-urgent').hp/convoyUnit(start,'hourly-urgent').bleeding);
 const survival=unit=>Math.ceil(unit.hp/Math.ceil(unit.bleeding*25/100));assert.ok(survival(convoyUnit(start,'hourly-urgent'))<survival(convoyUnit(start,'raw-ratio-urgent')));
 const result=aidFoundryBatteryRear({battle:start},{execute:(pair,action)=>{orders.push(structuredClone(action));return {battle:convoyRoofReplay(pair.battle,[action])};},report:event=>events.push(event)}),after=result.battle;
 assert.deepEqual(orders.filter(action=>action.type==='useItem').map(action=>[action.unitId,action.targetId]),[['physician','physician'],['physician','hourly-urgent']]);assert.equal(orders[0].type,'weapon');assert.equal(convoyUnit(after,'physician').medkits,0);assert.equal(convoyUnit(after,'physician').bleeding,0);assert.equal(convoyUnit(after,'hourly-urgent').bleeding,0);
 for(const id of ['raw-ratio-urgent','later','last']){assert.equal(convoyUnit(after,id).bleeding,convoyUnit(start,id).bleeding);assert.equal(convoyUnit(after,id).medkits,0);}for(const unit of after.units){assert.ok(unit.hp>0);assert.ok(sameCell(unit,convoyUnit(start,unit.id)));for(const key of ['weapon','loaded','ammo','condition','inventory'])assert.deepEqual(unit[key],convoyUnit(start,unit.id)[key]);}
 assert.ok(after.elapsedSeconds>start.elapsedSeconds);assert.equal(events[0].dressingsSpent,2);assert.equal(events[0].remainingPatients.length,3);assert.deepEqual(convoyRoofReplay(start,orders),after);assert.deepEqual(start,before);
});

test('field aid with no remaining dressing retains actual wounds and emits no paid order or false completion',()=>{
 const start=batteryFieldAidArena({kits:0}),before=structuredClone(start),events=[];let orders=0;const result=aidFoundryBatteryRear({battle:start},{execute:()=>{orders++;throw Error('No finite dressing admits an order.');},report:event=>events.push(event)});
 assert.equal(result.battle,start);assert.equal(orders,0);assert.equal(events[0].dressingsSpent,0);assert.equal(events[0].remainingPatients.length,5);assert.equal(events[0].elapsedSeconds,0);assert.deepEqual(start,before);
});

test('a physician retaining real dressings holds a rifle lane blocked by an actual known friend',()=>{
 const start=batteryFieldAidArena({combat:true,unsafe:true}),before=structuredClone(start),doctor=convoyUnit(start,'physician'),held=foundryConvoyDefenseController(start,{reserveFieldDressings:2}),switching=held(start,doctor);assert.deepEqual(switching,{type:'weapon',unitId:doctor.id,slot:'primary'});const armed=convoyRoofReplay(start,[switching]),copy=structuredClone(armed),actor=convoyUnit(armed,doctor.id),target=convoyUnit(armed,'target');assert.ok(firearmBystanderRisk(armed,actor,target,'torso').direct.some(body=>body.id==='lane-friend'));
 assert.equal(held(armed,actor),null);assert.deepEqual(armed,copy);assert.equal(actor.medkits,2);assert.equal(convoyRounds(actor),convoyRounds(doctor));assert.deepEqual(start,before);
});

test('a prone reserve physician pays a useful standing shot above adjacent prone friends and keeps actual dressings',()=>{
 const start=batteryFieldAidArena({combat:true,crowded:true}),before=structuredClone(start),doctor=convoyUnit(start,'physician'),policy=foundryConvoyDefenseController(start,{reserveFieldDressings:2}),primary=policy(start,doctor);
 assert.deepEqual(primary,{type:'weapon',unitId:doctor.id,slot:'primary'});const armed=convoyRoofReplay(start,[primary]),actor=convoyUnit(armed,doctor.id),target=convoyUnit(armed,'target');
 assert.ok(firearmBystanderRisk(armed,actor,target,'torso').scatter.some(body=>body.id==='hourly-urgent'||body.id==='raw-ratio-urgent'));
 const rise=policy(armed,actor);assert.deepEqual(rise,{type:'stance',unitId:doctor.id,stance:'standing'});const upright=convoyRoofReplay(start,[primary,rise]),standing=convoyUnit(upright,doctor.id);
 assert.equal(standing.ap,actor.ap-stanceCost(actor,'standing'));assert.equal(standing.medkits,2);assert.equal(convoyRounds(standing),convoyRounds(actor));assert.ok(sameCell(standing,actor));
 const fire=policy(upright,standing);assert.equal(fire?.type,'fire');const aimed=convoyUnit(upright,fire.targetId),option=firearmShotOptions(upright,standing,aimed,fire.aim??0).find(option=>option.aim===(fire.aim??0)&&option.hitLocation===(fire.hitLocation??'torso'));assert.equal(knownRouteBystanderShotSafety(upright,standing,aimed)(option),true);
 const after=convoyRoofReplay(start,[primary,rise,fire]),fired=convoyUnit(after,doctor.id),cost=actionCosts(upright,standing,aimed);assert.equal(fired.ap,standing.ap-cost.fire-(fire.aim??0)*cost.aim);assert.equal(convoyRounds(fired),convoyRounds(doctor)-1);assert.equal(fired.medkits,2);
 for(const id of ['hourly-urgent','raw-ratio-urgent','later','last'])assert.equal(convoyUnit(after,id).hp,convoyUnit(start,id).hp);assert.deepEqual(start,before);
});

test('a reserve physician uses a paid held-stock strike against actual close contact when the rifle lane is unsafe',()=>{
 const start=batteryFieldAidArena({combat:true,crowded:true,contact:true}),before=structuredClone(start),doctor=convoyUnit(start,'physician'),policy=foundryConvoyDefenseController(start,{reserveFieldDressings:2}),primary=policy(start,doctor);
 assert.deepEqual(primary,{type:'weapon',unitId:doctor.id,slot:'primary'});const armed=convoyRoofReplay(start,[primary]),actor=convoyUnit(armed,doctor.id),target=convoyUnit(armed,'target'),risk=firearmBystanderRisk(armed,actor,target,'torso');assert.ok(risk.scatter.some(body=>body.id==='hourly-urgent'||body.id==='raw-ratio-urgent'));
 const strike=policy(armed,actor);assert.deepEqual(strike,{type:'melee',unitId:doctor.id,targetId:target.id});const costs=actionCosts(armed,actor),after=convoyRoofReplay(start,[primary,strike]),struck=convoyUnit(after,doctor.id);
 assert.ok(convoyUnit(after,target.id).hp<target.hp);assert.equal(struck.ap,actor.ap-costs.melee);assert.equal(struck.stance,'standing');assert.equal(struck.activeSlot,'primary');assert.equal(struck.medkits,2);assert.equal(convoyRounds(struck),convoyRounds(doctor));assert.equal(struck.condition,doctor.condition);assert.ok(sameCell(struck,doctor));
 for(const id of ['hourly-urgent','raw-ratio-urgent','later','last'])assert.equal(convoyUnit(after,id).hp,convoyUnit(start,id).hp);assert.deepEqual(start,before);
});
