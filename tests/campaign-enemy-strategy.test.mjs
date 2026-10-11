import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {enemyReserveLimitsFor} from '../game/enemy-reserves.js';
import {enemyGroupLegHoursFor} from '../game/campaign-scenario.js';
import {validateEnemyStrategy} from '../game/campaign-enemy-strategy.js';
import {validateCampaignWorld,validateCampaignDefinitionFields} from '../game/campaign-definition.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const wait=(s,hours)=>order(s,{type:'wait',hours});
const reload=s=>restoreCampaign(serializeCampaign(s));
function documents({reserve=8,axis=['approach','watch-post'],cadence=2}={}){
 const d=scaffoldDocuments('strategy-fixture'),world=d.world;
 const sector={...structuredClone(world.sectors[1]),id:'approach',name:'Camino de acceso',grid:'18,17',neighbors:['camp','watch-post']};world.sectors.push(sector);for(const s of world.sectors.slice(0,2))s.neighbors.push('approach');
 const cell=world.cells.find(c=>c.col===17&&c.row===16);Object.assign(cell,{name:sector.name,anchor:true,district:true,location:'approach',locality:'approach'});world.places.approach={lon:17,lat:17,label:sector.name};world.districts.approach=[{id:'approach:0',sectorId:'approach',col:17,row:16,name:sector.name,x:cell.x,y:cell.y,urban:false}];world.arrivalFacilities.approach=[];world.ruralSectors.push('approach');world.landscapes.approach='settlement';world.expansion.rural.push('approach');
 d.maps.approach={...structuredClone(d.maps.camp),id:'approach',title:sector.name};d.content.startingTerritory.approach={owner:'royalist',loyalty:25};d.content.startingTerritory['watch-post'].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve,raidEveryHours:cadence,axis}}};return d;
}
const start=options=>{const d=documents(options);return initialCampaign(42,compileCampaignPackage(d.manifest,d));};

test('an authored invasion travels its connected path, occupies an undefended locality and consumes finite reserves across saves',()=>{
 let s=start();assert.deepEqual(enemyReserveLimitsFor(s),{frontier:8});assert.deepEqual(enemyGroupLegHoursFor(s),{frontier:1});
 s=reload(wait(s,2));assert.equal(s.enemyGroups.length,1);const group=s.enemyGroups[0];assert.deepEqual(group.route,['approach','watch-post']);assert.equal(group.origin,'off-map');assert.equal(group.command,'opposition');assert.equal(group.status,'marching');assert.equal(group.arrivalAt,4);assert.equal(s.enemyReserves.remaining.frontier,0);
 s=reload(wait(s,1));assert.equal(s.enemyGroups[0].routeIndex,1);assert.equal(s.sectors['watch-post'].owner,'patriot');
 s=reload(wait(s,1));assert.equal(s.sectors['watch-post'].owner,'royalist');assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.encounterHistory[0].groupId,group.id);assert.equal(s.encounterHistory[0].outcome,'defeat');assert.equal(s.sectors.camp.owner,'patriot');assert.equal(s.defeated,false);
 s=wait(reload(s),8);assert.equal(s.enemyGroups.length,1);assert.equal(s.enemyReserves.remaining.frontier,0);assert.equal(launchEnemyGroup(s,'frontier','watch-post'),null);assert.deepEqual(reload(s),s);
});

test('the real encounter pauses waiting, creates a local tactical defense and retains the authored group through save',()=>{
 let s=start();s.sectors['watch-post'].militia=[0,0,3];s=reload(wait(s,10));assert.equal(s.hour,4);assert.equal(s.pendingEncounter.sector,'watch-post');assert.equal(s.enemyGroups[0].status,'waiting');
 s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});assert.equal(s.pendingBattle.sector,'watch-post');assert.equal(s.pendingBattle.defenseGroupId,s.enemyGroups[0].id);assert.equal(s.pendingBattle.garrison.length,3);
 const battle=enterSector(s.pendingBattle),p=decodeSave(encodeSave(s,battle));assert.equal(p.battle.units.filter(u=>u.side==='enemy').length,8);assert.equal(p.battle.units.filter(u=>u.militia).length,3);assert.equal(p.campaign.enemyReserves.remaining.frontier,0);assert.deepEqual(p.campaign.enemyGroups[0].route,['approach','watch-post']);assert.equal(p.campaign.enemyGroups[0].status,'engaged');
});

test('a final group uses only the remaining finite budget and resolved groups never refund it',()=>{
 let s=start({reserve:33,cadence:100});const first=launchEnemyGroup(s,'frontier','watch-post',{immediate:true});assert.equal(first.initialStrength,30);assert.equal(s.enemyReserves.remaining.frontier,3);first.status='defeated';first.resolvedAt=s.hour;for(const u of first.units)u.hp=0;
 const second=launchEnemyGroup(s,'frontier','watch-post',{immediate:true});assert.equal(second.initialStrength,3);assert.equal(second.units.length,3);assert.equal(s.enemyReserves.remaining.frontier,0);second.status='defeated';second.resolvedAt=s.hour;for(const u of second.units)u.hp=0;
 s=reload(s);const next=s.nextEnemyGroupId;assert.equal(launchEnemyGroup(s,'frontier','watch-post',{immediate:true}),null);assert.equal(s.nextEnemyGroupId,next);s=wait(s,1);assert.equal(s.enemyReserves.remaining.frontier,0);assert.deepEqual(reload(s).enemyGroups,s.enemyGroups);
});

test('generic packages without strategy do not inherit historical regions, reserve pools or scheduled raids',()=>{
 const d=documents();delete d.world.enemyStrategy;let s=initialCampaign(42,compileCampaignPackage(d.manifest,d));assert.deepEqual(enemyReserveLimitsFor(s),{});assert.deepEqual(enemyGroupLegHoursFor(s),{});s=wait(s,6);assert.deepEqual(s.enemyGroups,[]);assert.deepEqual(s.enemyReserves.remaining,{});assert.throws(()=>launchEnemyGroup(s,'north','watch-post'),/ruta/);
});

test('save admission rejects forged routes, commands, origins, regional policies and budgets',()=>{
 const s=wait(start(),2),wire=serializeCampaign(s);
 const mutations=[s=>s.enemyGroups[0].route=['watch-post'],s=>s.enemyGroups[0].command='royalist-north',s=>s.enemyGroups[0].origin='humahuaca',s=>s.enemyGroups[0].theater='north',s=>s.enemyReserves.remaining.frontier=9,s=>s.contentCampaign.package.world.enemyStrategy.theaters.frontier.legHours=0,s=>s.contentCampaign.package.world.enemyStrategy.theaters.frontier.axis.reverse(),s=>s.contentCampaign.package.world.enemyStrategy.theaters.frontier.reserve=0,s=>s.contentCampaign.package.world.enemyStrategy.theaters.frontier.raidEveryHours=-1];
 for(const mutate of mutations){const forged=JSON.parse(wire);mutate(forged);assert.throws(()=>restoreCampaign(JSON.stringify(forged)));}
});

test('strategy data rejects malformed regions, disconnected or cross-region axes and invalid bounds',()=>{
 const mutations=[d=>d.world.enemyStrategy=null,d=>d.world.enemyStrategy.version=2,d=>d.world.enemyStrategy.extra=true,d=>d.world.enemyStrategy.theaters=[],d=>{d.world.enemyStrategy.theaters.north=d.world.enemyStrategy.theaters.frontier;delete d.world.enemyStrategy.theaters.frontier;},d=>d.world.enemyStrategy.theaters.frontier.legHours=0,d=>d.world.enemyStrategy.theaters.frontier.legHours=241,d=>d.world.enemyStrategy.theaters.frontier.legHours=1.5,d=>d.world.enemyStrategy.theaters.frontier.reserve=-1,d=>d.world.enemyStrategy.theaters.frontier.reserve=100001,d=>d.world.enemyStrategy.theaters.frontier.raidEveryHours=0,d=>d.world.enemyStrategy.theaters.frontier.raidEveryHours=876001,d=>d.world.enemyStrategy.theaters.frontier.axis=[],d=>d.world.enemyStrategy.theaters.frontier.axis=['missing'],d=>d.world.enemyStrategy.theaters.frontier.axis=['approach','approach'],d=>{d.world.sectors[2].neighbors=['camp'];d.world.sectors[1].neighbors=['camp'];},d=>{d.world.theaters.push({id:'other',name:'Otra región'});d.world.sectors[2].theater='other';},d=>d.world.enemyStrategy.theaters.frontier.code='eval()'];
 for(const mutate of mutations){const d=documents();mutate(d);assert.ok(validateEnemyStrategy(d.world.enemyStrategy,d.world).length);assert.throws(()=>compileCampaignPackage(d.manifest,d),/Estrategia enemiga/);}
});

const hqAxisError=/world\.enemyStrategy\.theaters\.frontier\.axis:.*cuartel general/;
test('world and package admission reject an invasion axis through the default headquarters',()=>{
 const d=documents({axis:['camp','watch-post']});assert.ok(validateEnemyStrategy(d.world.enemyStrategy,d.world).some(e=>hqAxisError.test(e)));assert.ok(validateCampaignWorld(d.world).some(e=>hqAxisError.test(e)));assert.throws(()=>compileCampaignPackage(d.manifest,d),hqAxisError);
});

test('package and pinned definition admission reject the effective content headquarters anywhere on an invasion axis',()=>{
 const d=documents();d.content.headquarters='watch-post';d.world.arrivalFacilities['watch-post']=['barracks'];assert.deepEqual(validateCampaignWorld(d.world),[]);assert.throws(()=>compileCampaignPackage(d.manifest,d),hqAxisError);
 const definitions={...d.content,scenario:'generic-v1',world:d.world,maps:d.maps,presentation:d.presentation,assets:d.assets};assert.ok(validateCampaignDefinitionFields(definitions).some(e=>hqAxisError.test(e)));
});

test('an overridden headquarters does not block the dormant world default from an otherwise valid axis',()=>{
 const d=documents({axis:['camp','approach']});d.content.headquarters='watch-post';d.world.arrivalFacilities['watch-post']=['barracks'];const definitions=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateCampaignDefinitionFields(definitions),[]);assert.equal(initialCampaign(42,definitions).location,'watch-post');
});
