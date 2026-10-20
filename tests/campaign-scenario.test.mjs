import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {initialCampaign,dispatchCampaign,serializeCampaign,restoreCampaign,campaignDate,recruitmentStatus,campaignObjectives,rosterFor,isSupplied} from '../game/campaign.js';
import {scenarioIdFor,isHistoricalCampaign,missionScenesFor,scenarioFor} from '../game/campaign-scenario.js';
import {missionStatus} from '../game/missions.js';
import {royalistIntel,oppositionFor} from '../game/narrative.js';
import {historicalRequiredActors} from '../game/historical-loss.js';
import {policyStatus} from '../game/politics.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {hasWorkshop} from '../game/campaign-headquarters.js';
import {grenadeOffer} from '../game/equipment.js';
import {defaultErrands} from '../game/quest-definitions.js';
import {militiaTransferPreview} from '../game/militia-distribution.js';
import {militiaArrivalEntry,militiaArrivalTerrain,validMilitiaArrival} from '../game/militia-arrival.js';
import {artilleryTransportPath} from '../game/artillery-transport.js';
import {validateArtilleryMerchants} from '../game/artillery-trading.js';
import {sectorExits} from '../game/tactical-exits.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {enterSector} from '../game/world.js';
import {ammunitionLoadsFor} from '../game/ammo-types.js';
import {invaderEntry} from '../game/invader-entry.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {flotillaSectorAllowed,transferOptions,transportIssuesFor} from '../game/logistics.js';

const read=path=>JSON.parse(readFileSync(new URL(`../campaigns/granaderos/${path}`,import.meta.url),'utf8'));
const manifest=read('manifest.json');
const installed=()=>compileCampaignPackage(manifest,{content:read(manifest.content),world:read(manifest.world),maps:Object.fromEntries(read(manifest.maps).maps.map(row=>[row.id,read(`maps/${row.path}`)])),presentation:read(manifest.presentation),assets:read(manifest.assets)});
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const officer=state=>order(state,{type:'createOfficer',name:'Ana Prueba',answers:{origin:'estancia',doctrine:'line_marksman',crisis:'rescue'}});
function generic({story=true}={}){
 const content=defaultContentPackage();
 content.id='scenario-test';content.name='Puesto del río';content.scenario='generic-v1';
 content.rules.startingHour=0;
 content.characters=[{...content.characters.find(c=>c.id==='person-3'),name:'Alex',nickname:'Alex',role:'Infantería',biography:'Custodia el puesto.',monthlyPay:30,recruitmentSource:'contract',service:'contract',progression:'experience',traits:[],abilities:[],arrivalHours:0}];
 content.placements=[];content.quests=[];content.errands=[];content.roadsideDiscoveries=[];content.includeOriginalResidents=false;content.campaignRoles={foundryEngineer:null,marchCommander:null};
 if(story)content.campaignStory={...defaultCampaignStory(),chapters:[{id:'hold',name:'Sostener el puesto',objective:'Conservar el puesto durante la campaña.',conditions:[{type:'day',min:1000,max:null}]}]};
 return content;
}

test('the installed historical package retains formation, mission admission, commander and victory progression',()=>{
 let state=officer(initialCampaign(1812,installed()));
 assert.equal(isHistoricalCampaign(state),true);assert.equal(state.phase,1);assert.equal(state.flags.academy,true);
 assert.deepEqual(campaignDate(state),{year:1812,month:3,day:1,hour:9});
 assert.match(recruitmentStatus(state,0,true).reason,/defensa autónoma/);
 state.location='san_nicolas';state.squads[0].location=state.location;state.sectors.san_nicolas.owner='patriot';
 state=order(state,{type:'attack',sector:'san_lorenzo'});
 assert.equal(state.pendingBattle.missionId,'san_lorenzo');
 const invalidRequest=structuredClone(state);invalidRequest.pendingBattle.campaignPackage=structuredClone(invalidRequest.pendingBattle.campaignPackage);invalidRequest.pendingBattle.campaignPackage.name='Otra campaña';assert.throws(()=>restoreCampaign(serializeCampaign(invalidRequest)),/contenido del despliegue/);assert.equal(state.pendingBattle.missionAllies.length,1);assert.equal(state.pendingBattle.missionAllies[0].id,57);
 const restored=restoreCampaign(serializeCampaign(state));assert.deepEqual(restored,state);assert.equal(restored.pendingBattle.campaignPackage,restored.contentCampaign.package);
 const report=scriptedBattleReport(state),invalidReport=structuredClone(report);invalidReport.sectorState.localityIds=['foreign-locality'];
 assert.match(dispatchCampaign(state,invalidReport).lastError,/localidades/);
 const invalidResume=structuredClone(state);invalidResume.pendingBattle.resumeSnapshot=invalidReport.sectorState;
 assert.throws(()=>restoreCampaign(serializeCampaign(invalidResume)),/localidades/);
 state=order(state,report);
 assert.equal(state.flags.sanLorenzo,true);assert.equal(state.phase,2);assert.equal(missionStatus(state,'san_lorenzo').completed,true);
 assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
 const invalidRetained=structuredClone(state);invalidRetained.sectorStates.san_lorenzo.localityIds=['foreign-locality'];
 assert.throws(()=>restoreCampaign(serializeCampaign(invalidRetained)),/localidades/);
 const legacyRetained=structuredClone(state);delete legacyRetained.sectorStates.san_lorenzo.localityIds;
 assert.deepEqual(restoreCampaign(serializeCampaign(legacyRetained)),state);
});

test('the installed stock package preserves ordinary paid recruitment and actual firearm allocations',()=>{
 const deployments=[null,installed()].map(content=>{
  let state=order(initialCampaign(1812,content),{type:'recruitCivic',id:110,term:'week'});
  assert.equal(state.hiringArrivals.length,0);assert.deepEqual(state.recruited,[110]);
  state=order(state,{type:'attack',sector:'buenos_aires'});return state;
 });
 const physical=unit=>Object.fromEntries(['hp','weapon','blade','loaded','ammo','rations','torches','medkits','boleadoras','condition','bladeCondition'].map(key=>[key,unit[key]]));
 const mechanics=unit=>({loads:ammunitionLoadsFor(unit),profiles:ammunitionLoadsFor(unit).map(load=>Object.fromEntries(['damage','range','fireAP','aimAP','reloadAP','readyAP','capacity','stockAP','stockDamage','stockReach','materialRangeSlope','projectileEnergy','projectileAirDrag','loadPattern'].map(key=>[key,weaponSpecification({...unit,ammunitionChoice:load.family})?.[key]])))});
 const [ordinary,pinned]=deployments;
 assert.deepEqual(pinned.resources,ordinary.resources);assert.equal(pinned.phase,ordinary.phase);
 const relativeContracts=state=>Object.fromEntries(Object.entries(state.contracts).map(([id,contract])=>[id,{...contract,started:contract.started-state.hour,expiresAt:contract.expiresAt===null?null:contract.expiresAt-state.hour}]));
 assert.deepEqual(relativeContracts(pinned),relativeContracts(ordinary));
 const [ordinaryBattle,pinnedBattle]=deployments.map(state=>enterSector(state.pendingBattle));
 for(const side of ['player','enemy']){
  const oldUnits=ordinaryBattle.units.filter(unit=>unit.side===side),newUnits=pinnedBattle.units.filter(unit=>unit.side===side);
  assert.deepEqual(newUnits.map(physical),oldUnits.map(physical));assert.deepEqual(newUnits.map(mechanics),oldUnits.map(mechanics));
 }
 assert.deepEqual(restoreCampaign(serializeCampaign(pinned)),pinned);
});

test('an explicit generic campaign keeps stable content IDs outside historical slots and runs without stock events',()=>{
 const content=generic(),id=operativeIdForCharacter(content,'person-3');
 assert.ok(id>=2000);
 let state=initialCampaign(42,content),relations=structuredClone(state.reputation);
 assert.deepEqual(Object.keys(state.operativeState),[String(id)]);assert.equal(state.operativeState[3],undefined);
 state=order(state,{type:'wait',hours:169});
 assert.equal(state.hour,169);assert.equal(state.phase,0);assert.equal(state.enemyGroups.length,0);assert.equal(state.politics,undefined);assert.deepEqual(state.reputation,relations);
 assert.deepEqual(state.enemyReserves.remaining,{});
 assert.deepEqual(missionScenesFor(state),{});assert.equal(missionStatus(state,'yatasto'),null);assert.deepEqual(royalistIntel(state),[]);assert.deepEqual(historicalRequiredActors(state),[]);assert.equal(policyStatus(state).taxDue,false);
 assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
 state=order(state,{type:'recruitCivic',id,term:'week'});assert.ok(state.recruited.includes(id));assert.equal(state.phase,0);
 assert.equal(state.flags.academy,undefined);
 assert.equal(hasWorkshop(state,'retiro'),true);assert.equal(hasWorkshop(state,'cordoba'),false);assert.equal(hasWorkshop(state,'mendoza'),false);
 assert.ok(Object.values(state.merchants).every(merchant=>merchant.grenades.arsenal===0));assert.equal(grenadeOffer(state,rosterFor(state)[0],isSupplied).available,false);
 const withoutErrands=structuredClone(content);delete withoutErrands.errands;assert.deepEqual(defaultErrands(withoutErrands),[]);
 assert.deepEqual(scenarioFor(state).assault.validationContext(state,{missionId:'san_lorenzo'}),null);
});

test('generic free play does not require custom chapters to exclude historical actions, gates and opposition',()=>{
 let state=initialCampaign(42,generic({story:false}));
 assert.deepEqual(campaignObjectives(state).map(c=>c.id),['free-play']);
 state=order(state,{type:'wait',hours:169});assert.equal(state.phase,0);assert.equal(state.defeated,false);assert.equal(state.enemyGroups.length,0);
 const before=structuredClone(state.resources);
 for(const action of [{type:'academy'},{type:'policy',kind:'tax'},{type:'diplomacy',kind:'emancipation'},{type:'visitMission',mission:'yatasto'},{type:'attack',sector:'san_lorenzo'}]){
  const rejected=dispatchCampaign(state,action);assert.ok(rejected.lastError);assert.deepEqual(rejected.resources,before);assert.equal(rejected.pendingBattle,null);
 }
 const opposition=oppositionFor({theater:'north',squad:[{}],difficulty:1,enemyCount:4},state);
 assert.equal(opposition.enemyCommand,'opposition');assert.equal(opposition.enemies.length,4);
 assert.ok(opposition.enemies.every(unit=>unit.name.startsWith('Combatiente adversario')));
 assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
});

test('custom chapters override an inherited historical scenario and its mandatory actors',()=>{
 const content=structuredClone(installed());content.campaignStory={...defaultCampaignStory(),chapters:[{id:'hold',name:'Esperar',objective:'Esperar el parte.',conditions:[{type:'day',min:1000,max:null}]}]};
 // This copy deliberately retains the stock cast and its resident errands.
 content.includeOriginalResidents=true;
 assert.equal(scenarioIdFor(content),'generic-v1');
 let state=initialCampaign(42,content);state.operativeState[57].hp=0;state.operativeState[57].alive=false;
 state=order(state,{type:'wait',hours:169});
 assert.equal(state.phase,0);assert.equal(state.defeated,false);assert.equal(state.enemyGroups.length,0);assert.deepEqual(historicalRequiredActors(state),[]);assert.equal(missionStatus(state,'san_lorenzo'),null);
 assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
});

test('selected scenarios govern invader ingress and legacy city receipts without generic history',()=>{
 const stock=installed(),custom=generic({story:false});
 for(const [sector,command,edge]of [['salta','north','N'],['jujuy','north','W'],['humahuaca','north','W'],['ensenada','naval','S']]){
  const ordinary=invaderEntry({sector,enemyCommand:command});
  assert.equal(ordinary.entryEdge,edge);
  assert.deepEqual(invaderEntry({sector,enemyCommand:command,campaignPackage:stock}),ordinary);
  assert.deepEqual(invaderEntry({sector,enemyCommand:command,campaignPackage:custom}),{entryEdge:'W',entryAnchor:{x:0,y:8}});
 }
 const adjusted=structuredClone(stock),road=adjusted.world.exitLinks.find(link=>link[0]==='salta'&&link[4]==='jujuy');
 assert.ok(road);road.splice(1,3,'E',19,5);road.splice(5,3,'W',0,5);
 assert.deepEqual(invaderEntry({sector:'salta',enemyCommand:'north',campaignPackage:adjusted}),{entryEdge:'E',entryAnchor:{x:19,y:5}});
 const receipt={sectorId:'ensenada',cityId:'buenos_aires'};
 assert.equal(scenarioFor(stock).legacyCityReceipt(receipt),true);
 assert.equal(scenarioFor(stock).legacyCityReceipt({...receipt,cityId:'another-city'}),false);
 assert.equal(scenarioFor(custom).legacyCityReceipt(receipt),false);
 const blocked={blockade:true,enemyGroups:[]};
 assert.equal(scenarioFor(stock).blockaded(blocked,{theater:'coast'}),true);
 assert.equal(scenarioFor(custom).blockaded(blocked,{theater:'coast'}),false);
 scenarioFor(custom).clearVictoryBlockade(blocked,{theater:'coast'});assert.equal(blocked.blockade,true);
 scenarioFor(stock).clearVictoryBlockade(blocked,{theater:'coast'});assert.equal(blocked.blockade,false);
 assert.deepEqual(scenarioFor(custom).retreatAxis(),[]);
 assert.deepEqual(scenarioFor(stock).retreatAxis(),['humahuaca','jujuy','salta','tucuman']);
 assert.equal(flotillaSectorAllowed({campaignPackage:stock},'retiro'),true);
 const field=enterSector({sector:'salta',seed:45,campaignPackage:custom,enemyCommand:'north',defenseGroupId:'incoming',squad:[{id:'defender'}],enemies:Array.from({length:3},(_,i)=>({id:`incoming-${i}`}))});
 assert.ok(field.units.filter(unit=>unit.side==='enemy').every(unit=>boundaryMatches(field,unit,'W')));
});

test('generic flotilla navigation uses selected theater or port policy and never implicit stock coast',()=>{
 const content=generic({story:false});content.world=read(manifest.world);
 const places=['retiro','buenos_aires'];content.world.theaters.push({id:'waterway',name:'Vía navegable'});
 for(const sector of content.world.sectors)if(places.includes(sector.id))sector.theater='waterway';
 for(const cell of content.world.cells)if(places.includes(cell.locality))cell.theater='waterway';
 content.world.travel.flotillaTheaters=[];
 delete content.world.travel.transportIssues;
 content.world.arrivalFacilities.retiro=['barracks'];content.world.arrivalFacilities.buenos_aires=['barracks'];
 content.arrivalSites=[{sector:'retiro',facilities:['barracks']}];
 content.imports={port:null,minHours:72,maxHours:120};
 const ready=definitions=>{const state=initialCampaign(42,definitions);state.routes.flotilla=true;state.sectors.buenos_aires.owner='patriot';return state;};
 const state=ready(content);
 assert.equal(transportIssuesFor(state).route_cut,'Una ocupación corta el camino entre los depósitos.');
 assert.equal(transportIssuesFor().route_cut,'Los realistas interrumpen el camino entre los depósitos.');
 assert.equal(transportIssuesFor(state).snow,'Los pasos están cerrados por la nieve.');
 assert.equal(transportIssuesFor().snow,'Los pasos andinos están cerrados por la nieve.');
 assert.equal(flotillaSectorAllowed(state,'retiro'),false);assert.equal(flotillaSectorAllowed(state,'ensenada'),true,'authored port facilities independently allow navigation');
 assert.equal(artilleryTransportPath(state,'retiro','buenos_aires','flotilla'),null);
 assert.equal(transferOptions(state,'reserve','buenos_aires').find(mode=>mode.id==='flotilla').code,'flotilla_route');
 const configuredContent=structuredClone(content);configuredContent.world.travel.flotillaTheaters=['waterway'];const configured=ready(configuredContent);
 assert.deepEqual(artilleryTransportPath(configured,'retiro','buenos_aires','flotilla'),places);
 assert.equal(transferOptions(configured,'reserve','buenos_aires').find(mode=>mode.id==='flotilla').available,true);
 assert.deepEqual(restoreCampaign(serializeCampaign(configured)),configured);
 const portsContent=structuredClone(content);for(const id of places)portsContent.world.arrivalFacilities[id].push('port');const ports=ready(portsContent);
 assert.deepEqual(artilleryTransportPath(ports,'retiro','buenos_aires','flotilla'),places);
 const coastalContent=structuredClone(content);coastalContent.world.arrivalFacilities.ensenada=[];const coastal=ready(coastalContent);
 assert.equal(flotillaSectorAllowed(coastal,'ensenada'),false,'a stock theater name alone grants no generic route');
});

test('generic save admission rejects stock mission receipts and phase records',()=>{
 const state=initialCampaign(42,generic());
 for(const mutate of [s=>s.missions.yatasto={stage:'completed',completed:true},s=>s.sceneStates.yatasto={},s=>s.missionAllies.san_lorenzo={},s=>s.phase=1]){
  const invalid=structuredClone(state);mutate(invalid);assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/escenas|avance/);
 }
 assert.throws(()=>scenarioIdFor({scenario:'untrusted-script'}),/escenario/);
 assert.equal(scenarioIdFor(null),'granaderos-historical-v1');
});


test('clock orders share frozen definitions while copying mutable state and the content wrapper',()=>{
 const state=initialCampaign(42,installed()),next=order(state,{type:'wait',hours:1});
 assert.equal(Object.isFrozen(state.contentCampaign.package),true);
 assert.equal(next.contentCampaign.package,state.contentCampaign.package);
 assert.notEqual(next.contentCampaign,state.contentCampaign);assert.notEqual(next.sectors,state.sectors);
 assert.equal(state.hour,9);assert.equal(next.hour,10);
 const altered=structuredClone(state);altered.contentCampaign.package.name='Mutable test package';
 const copied=order(altered,{type:'wait',hours:1});
 assert.notEqual(copied.contentCampaign.package,altered.contentCampaign.package);
 copied.contentCampaign.package.name='Changed copy';assert.equal(altered.contentCampaign.package.name,'Mutable test package');
});

test('selected world roads and city identities govern militia custody and artillery delivery',()=>{
 const ids={retiro:'outpost',buenos_aires:'river_town',mendoza:'forge_town'};
 const remap=value=>typeof value==='string'?ids[value]??value:Array.isArray(value)?value.map(remap):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[ids[key]??key,remap(child)])):value;
 const content=generic({story:false});content.world=remap(read(manifest.world));content.headquarters='outpost';content.startingTerritory=remap(content.startingTerritory);content.arrivalSites=remap(content.arrivalSites);
 content.startingTerritory.river_town={owner:'patriot',loyalty:65};
 for(const place of content.world.sectors)if(place.id==='outpost'||place.id==='river_town'){place.name=place.id==='outpost'?'Puesto Norte':'Pueblo del Río';delete place.shortName;}
 const road=content.world.exitLinks.find(link=>link[0]==='river_town'&&link[4]==='outpost');road.splice(1,3,'W',0,5);road.splice(5,3,'E',19,5);
 let state=initialCampaign(42,content),id=operativeIdForCharacter(content,'person-3');state=order(state,{type:'recruitCivic',id,term:'week'});
 state.sectors.outpost.militia=[2,0,0];assert.equal(militiaTransferPreview(state,{from:'outpost',to:'river_town',rank:0,count:1}).valid,true);
 state=order(state,{type:'transferMilitia',from:'outpost',to:'river_town',rank:0,count:1});
 const defender=state.garrisons.river_town[0];assert.deepEqual(defender.militiaArrival,{from:'outpost',to:'river_town'});assert.equal(state.sectors.outpost.militia[0],1);assert.equal(state.sectors.river_town.militia[0],1);
 assert.match(state.log[0].text,/Puesto Norte.*Pueblo del Río/);assert.deepEqual(militiaArrivalEntry('outpost','river_town',state),{edge:'W',x:0,y:5});assert.equal(militiaArrivalEntry('retiro','river_town',state),null);
 const field={sectorId:'river_town',width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false})),wallEdges:[],props:[],exits:sectorExits('river_town',null,state)};
 const arrival=militiaArrivalTerrain(field,defender,state);assert.deepEqual(arrival.anchor,{x:0,y:5});assert.deepEqual({x:arrival.cells[0].x,y:arrival.cells[0].y},arrival.anchor);assert.equal(validMilitiaArrival(defender,'river_town',field),true);assert.equal(validMilitiaArrival({...defender,militiaArrival:{from:'retiro',to:'river_town'}},'river_town',field),false);
 assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
 state.routes.carts=true;state.artilleryDepots={outpost:[{id:'custom-piece',type:'swivel',side:'player',loaded:true,ammo:2}]};state.artilleryMerchants={river_town:{guns:[]}};assert.doesNotThrow(()=>validateArtilleryMerchants(state));
 assert.deepEqual(artilleryTransportPath(state,'outpost','river_town','carts'),['outpost','river_town']);assert.equal(artilleryTransportPath(state,'retiro','river_town','carts'),null);
 state=order(state,{type:'transportArtillery',sector:'outpost',artilleryId:'custom-piece',to:'river_town',mode:'carts',source:'depot'});assert.equal(state.artilleryTransfers.length,1);assert.equal(state.artilleryDepots.outpost.length,0);state=order(state,{type:'wait',hours:18});assert.equal(state.artilleryTransfers.length,0);assert.deepEqual(state.artilleryDepots.river_town,[{id:'custom-piece',type:'swivel',side:'player',loaded:true,ammo:2}]);assert.match(state.log.find(row=>row.text.includes('llega al depósito')).text,/Pueblo del Río/);assert.deepEqual(restoreCampaign(serializeCampaign(state)),state);
});
