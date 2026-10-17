import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,presentedActBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {ammoCount} from '../game/ammo-types.js';
import {performFreshMountainFirstAid} from './fresh-mountain-route.mjs';
import {leave} from './local-contract-fixture.mjs';

const save=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,next.lastError);return next;};
const actor=(b,id)=>b.units.find(u=>u.id===String(id));
const clock=c=>c.hour*3600+(c.secondOfHour??0);

function declaredCareArena(blocked){
 let c=initialCampaign(42,defaultContentPackage());const prices=[];
 for(const id of [130,100]){
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day');assert.ok(quote.available);
  prices.push({id,price:quote.price});c=order(c,{type:'recruitCivic',id,term:'day'});
 }
 c=order(c,{type:'wait',hours:6});assert.ok([130,100].every(id=>c.recruited.includes(id)));
 // Declared post-arrival clinical fixture, not earned wounds or a campaign win.
 // All kit, ammunition, cash, skills, terms and seed remain the actual paid ones.
 // The initial full-width wall is the interruption control's only geometry change.
 const prepared=structuredClone(c);
 Object.assign(prepared.operativeState[130],{hp:55,bleeding:2,bandaged:0});
 Object.assign(prepared.operativeState[100],{hp:12,bleeding:1,bandaged:0});
 c=order(prepared,{type:'visitSector'});const r=c.pendingBattle,width=24,height=12;
 const battle=createBattle(r.squad.map(u=>({...u,x:u.id===130?1:5,y:2,facing:2})),{
  ...r,width,height,exploration:true,deferContact:true,props:[],buildings:[],decor:[],
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),
   ...(blocked&&i%width===3?{type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}:{type:'grass',blocked:false,cover:0})})),
  npcs:r.npcs.map((n,i)=>({...n,x:20+i,y:10})),
 });
 if(r.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(r.finiteArtilleryArsenal);
 const pair=save({campaign:c,battle});
 assert.equal(pair.campaign.resources.treasury,3200-prices.reduce((sum,row)=>sum+row.price,0));
 assert.equal(actor(pair.battle,130).medkits,2);assert.equal(actor(pair.battle,100).medkits,2);
 assert.equal(actor(pair.battle,130).loaded+ammoCount(actor(pair.battle,130)),10);
 return {pair,prices};
}

function replay(start,steps){
 let pair=save(start);
 for(const action of steps){
  const before=structuredClone(pair),next=actBattle(pair.battle,action);
  assert.equal(next.lastError,null,next.lastError);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,next);
  assert.deepEqual(pair,before,'replay preserves the admitted source');
  const synced=syncBattleTime(pair.campaign,next);assert.equal(synced.error,null,synced.error);
  pair=save(synced);
 }
 return pair;
}

function unchangedFinite(start,after){
 assert.equal(after.campaign.resources.treasury,start.campaign.resources.treasury);
 assert.deepEqual(after.campaign.contracts,start.campaign.contracts);
 assert.equal(after.battle.seed,start.battle.seed);
 for(const id of [130,100]){
  const a=actor(after.battle,id),b=actor(start.battle,id);
  for(const key of ['loaded','ammo','condition','weapon','weaponInstanceId','weaponFittings','inventory','outfit','headwear','legwear'])assert.deepEqual(a[key],b[key],`${id} ${key}`);
 }
}

test('the shared mountain aid seam reports finite successful orders and admits their exact saved clock before ordinary departure',t=>{
 const {pair,prices}=declaredCareArena(false),before=structuredClone(pair),events=[];
 const campaign=performFreshMountainFirstAid(pair,{stage:'declared-success',report:event=>events.push(event)});
 assert.deepEqual(pair,before);
 const raw=events.find(e=>e.event==='freshMountainAidOrders'),checkpoint=events.find(e=>e.event==='freshMountainAidCheckpoint');
 assert.ok(raw&&checkpoint);assert.equal(events.indexOf(raw),0);assert.ok(raw.steps.length>0);
 assert.deepEqual(raw.steps,raw.attemptedSteps);assert.equal(raw.stoppedReason,null);assert.deepEqual(raw.untreated,[]);
 assert.equal(raw.rejectedStep,null);assert.equal(raw.clockSynchronized,false);assert.equal(checkpoint.clockSynchronized,true);
 const admitted=save(checkpoint),replayed=replay(pair,raw.steps);assert.deepEqual(replayed,admitted);
 unchangedFinite(pair,admitted);
 assert.equal(actor(admitted.battle,130).medkits,0);assert.equal(actor(admitted.battle,100).medkits,2);
 for(const id of [130,100]){assert.ok(actor(admitted.battle,id).hp>=15);assert.equal(actor(admitted.battle,id).bleeding,0);}
 assert.equal(actor(admitted.battle,130).hp,55,'noncritical first aid does not heal the doctor');
 assert.equal(campaign.pendingBattle,null);assert.deepEqual(save({campaign:leave(replayed)}).campaign,save({campaign}).campaign);
 assert.deepEqual(expandCellScene(campaign.sectorStates.retiro).tiles,admitted.battle.tiles);
 t.diagnostic(JSON.stringify({fixture:'paid native day hires, declared initial clinical wounds/flat arena before official admission; no campaign victory claim',prices,treasury:campaign.resources.treasury,acceptedOrders:raw.steps.length,seconds:clock(admitted.campaign)-clock(pair.campaign),doctorKits:[2,actor(admitted.battle,130).medkits],patientHp:[12,actor(admitted.battle,100).hp],departure:'ordinary leave',savedReplayEqual:true}));
});

test('a real paid self-treatment followed by a blocked patient reports the stopped pair and every accepted order before refusing departure',t=>{
 const {pair,prices}=declaredCareArena(true),before=structuredClone(pair),events=[];let stopped;
 assert.throws(()=>performFreshMountainFirstAid(pair,{stage:'declared-interruption',report:event=>events.push(event)}),error=>{stopped=error;return /camino abierto/.test(error.message);});
 assert.deepEqual(pair,before);
 const raw=events.find(e=>e.event==='freshMountainAidOrders'),checkpoint=events.find(e=>e.event==='freshMountainAidCheckpoint'),stop=events.find(e=>e.event==='freshRouteStopped');
 assert.ok(raw&&checkpoint&&stop);assert.ok(events.indexOf(raw)<events.indexOf(checkpoint)&&events.indexOf(checkpoint)<events.indexOf(stop));
 assert.ok(raw.steps.some(a=>a.type==='useItem'&&a.unitId==='130'&&a.targetId==='130'));
 assert.equal(raw.rejectedStep,null);assert.deepEqual(raw.steps,raw.attemptedSteps,'this physical blockage stops planning, so every attempted order was actually accepted');
 assert.equal(raw.steps.filter(a=>a.type==='useItem').length,1);
 assert.ok(raw.untreated.some(u=>u.id==='100'));assert.match(raw.stoppedReason,/camino abierto/);
 const admitted=save(checkpoint),replayed=replay(pair,raw.steps);assert.deepEqual(replayed,admitted);assert.deepEqual(stopped.pair,{campaign:checkpoint.campaign,battle:checkpoint.battle});
 assert.deepEqual(stopped.steps,raw.steps);assert.deepEqual(save(stop),admitted);assert.ok(admitted.campaign.pendingBattle,'an interrupted treatment cannot silently leave');
 unchangedFinite(pair,admitted);assert.equal(actor(admitted.battle,130).medkits,1);assert.equal(actor(admitted.battle,130).hp,55);assert.equal(actor(admitted.battle,130).bleeding,0);
 assert.equal(actor(admitted.battle,100).hp,12);assert.equal(actor(admitted.battle,100).bleeding,1);assert.equal(actor(admitted.battle,100).medkits,2);
 t.diagnostic(JSON.stringify({fixture:'same paid native force; declared wall before initial official admission blocks access to the critical patient',prices,treasury:admitted.campaign.resources.treasury,acceptedOrders:raw.steps.length,seconds:clock(admitted.campaign)-clock(pair.campaign),doctorKits:[2,actor(admitted.battle,130).medkits],untreated:raw.untreated,stoppedReason:raw.stoppedReason,pendingBattle:admitted.campaign.pendingBattle.id,savedReplayEqual:true}));
});

import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {performFreshMountainLocalFirstAid} from './fresh-mountain-route.mjs';
import {visit as nativeCareVisit} from './local-contract-fixture.mjs';

// Nine paid locals, six critical patients in one full home, one physician and
// two healthy guards. Every condition, finite issue, skill and flat map precedes
// compilation and initialCampaign; all bandaged values start at zero.
function declaredMultiHomeCare({kits=12,medical=90}={}){
 const sector='los_patos',d=scaffoldDocuments('declared-mountain-multi-home-care');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0],names=['field-physician',...Array.from({length:6},(_,i)=>'critical-patient-'+i),'field-guard-a','field-guard-b'];
 d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.enemyStrategy={version:1,theaters:{}};
 d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=names.map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,serviceGuarantee:0,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:i===0?70:20,medical:i===0?medical:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?kits:0},
  startingCondition:{hp:i>0&&i<7?14:i===0?70:20,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id,doctor=id(names[0]),patients=names.slice(1,7).map(id),guards=names.slice(7).map(id),ids=names.map(id),hires=[];
 for(const person of ids){const quote=contractQuote(c,people.find(op=>op.id===person),'week'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id:person,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id:person,price:quote.total});}
 c=order(c,{type:'createSquad',sector,ids:patients,name:'Seis pacientes reales'});const patientHome=c.activeSquadId;
 c=order(c,{type:'createSquad',sector,ids:[doctor,...guards],name:'Médico y dos guardias'});const doctorHome=c.activeSquadId;
 c=order(c,{type:'assignCare',operativeId:doctor,assignment:'rest'});
 assert.equal(c.hiringArrivals.length,0);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.deepEqual(d,declaration);
 assert.ok(patients.every(person=>c.operativeState[person].hp===14&&c.operativeState[person].bandaged===0));
 assert.equal(c.operativeState[doctor].medkits,kits);assert.equal(c.resources.treasury,20000-hires.reduce((sum,row)=>sum+row.price,0));
 return {campaign:save({campaign:c}).campaign,sector,doctor,patients,guards,ids,patientHome,doctorHome,hires};
}

function replayMultiHomeCare(start,events){
 let c=save({campaign:start}).campaign,pair=null,midpoints=0;
 for(const event of events){
  if(['freshRouteOrder','freshRouteRenewal'].includes(event.event)){assert.equal(pair,null);c=order(c,event.action);assert.deepEqual(c,event.campaign);}
  else if(event.event==='freshMountainLocalAidVisit'){assert.equal(pair,null);pair=nativeCareVisit(c);assert.deepEqual(pair,{campaign:event.campaign,battle:event.battle});}
  else if(event.event==='freshMountainAidOrders'){assert.ok(pair);assert.equal(event.rejectedStep,null);assert.equal(event.stoppedReason,null);assert.deepEqual(event.untreated,[]);pair=replay(pair,event.steps);}
  else if(event.event==='freshMountainAidCheckpoint'){assert.deepEqual(pair,save({campaign:event.campaign,battle:event.battle}));}
  else if(event.event==='freshMountainAidSavedMidpoint'){assert.deepEqual(pair,{campaign:event.campaign,battle:event.battle});midpoints++;}
  else if(event.event==='freshMountainLocalAidDeparted'){c=leave(pair);assert.deepEqual(c,event.campaign);pair=null;}
 }
 assert.equal(pair,null);return {campaign:c,midpoints};
}

test('a full critical-only home among nine actual locals receives finite paid physician batches and restores every original home and duty',()=>{
 const setup=declaredMultiHomeCare(),start=setup.campaign,before=structuredClone(start),events=[];
 const c=performFreshMountainLocalFirstAid(start,{report:event=>events.push(structuredClone(event))}),receipt=events.find(event=>event.event==='freshMountainLocalAidCompleted').receipt;
 assert.equal(receipt.completed,true);assert.equal(receipt.groups.length,2);assert.ok(receipt.groups.every(group=>group.ids.length<=6&&group.ids.includes(setup.doctor)));
 assert.deepEqual(new Set(receipt.groups.flatMap(group=>group.patients)),new Set(setup.patients));
 assert.ok(events.filter(event=>event.event==='freshMountainLocalAidVisit').every(event=>event.battle.status==='active'&&event.battle.mode==='exploration'&&event.battle.units.some(unit=>unit.id===String(setup.doctor)&&unit.hp>=15&&!unit.unconscious)));
 const uses=events.filter(event=>event.event==='freshMountainAidOrders').flatMap(event=>event.steps).filter(action=>action.type==='useItem');assert.ok(uses.length>0&&uses.length<=12);
 assert.equal(start.operativeState[setup.doctor].medkits-c.operativeState[setup.doctor].medkits,uses.length);assert.ok(c.operativeState[setup.doctor].medkits>=0);
 for(const id of setup.ids){assert.equal(c.operativeState[id].alive,true);assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);for(const key of ['loaded','ammo','weapon','condition','outfit','headwear','legwear'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);}
 assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.resources.treasury,start.resources.treasury);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.equal(clock(c)-clock(start),receipt.groups.reduce((sum,group)=>sum+group.to-group.from,0));assert.ok(clock(c)>clock(start));
 const replayed=replayMultiHomeCare(start,events);assert.equal(replayed.midpoints,2);assert.deepEqual(replayed.campaign,c);
 assert.deepEqual(performFreshMountainLocalFirstAid(save({campaign:start}).campaign),c);assert.deepEqual(start,before);
});

test('finite multi-home aid stops at its actual spent dressing and retains the untreated cohort without a saved failed midpoint',()=>{
 const {campaign:start,doctor,patients}=declaredMultiHomeCare({kits:1}),before=structuredClone(start),events=[];let failure;
 assert.throws(()=>performFreshMountainLocalFirstAid(start,{report:event=>events.push(structuredClone(event))}),error=>{failure=error;return /vendas|Vendaje|camino/.test(error.message);});
 assert.ok(failure?.pair&&failure.mountainLocalAid);assert.equal(failure.mountainLocalAid.completed,false);assert.equal(failure.mountainLocalAid.groups.length,1);
 assert.equal(failure.steps.filter(action=>action.type==='useItem').length,1);assert.equal(failure.pair.battle.units.find(unit=>unit.id===String(doctor)).medkits,0);
 assert.ok(failure.pair.campaign.pendingBattle);assert.ok(patients.some(id=>failure.pair.campaign.operativeState[id].hp<15));
 assert.equal(events.some(event=>event.event==='freshMountainAidSavedMidpoint'),false);assert.equal(events.some(event=>event.event==='freshMountainLocalAidCompleted'),false);
 assert.equal(failure.pair.campaign.resources.treasury,start.resources.treasury);assert.deepEqual(start,before);
});

test('a declared force with no eligible physician refuses multi-home care before regrouping or entering a critical-only home',()=>{
 const {campaign:start}=declaredMultiHomeCare({medical:0}),before=structuredClone(start),events=[];let failure;
 assert.throws(()=>performFreshMountainLocalFirstAid(start,{report:event=>events.push(structuredClone(event))}),error=>{failure=error;return /conscious local physician/.test(error.message);});
 assert.equal(failure.mountainLocalAid.completed,false);assert.deepEqual(failure.mountainLocalAid.orders,[]);assert.deepEqual(failure.mountainLocalAid.groups,[]);assert.equal(failure.campaign.pendingBattle,null);
 assert.deepEqual(failure.campaign,start);assert.equal(events.some(event=>event.event==='freshMountainLocalAidVisit'),false);assert.deepEqual(start,before);
});

import {discoverRouteCache} from './finite-route-equipment.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';

// Keep the earlier three controls and their declared setup exact. This separate
// fresh declaration needs two dressings from a container whose indices shift.
function declaredReindexedCare(){
 const sector='los_patos',d=scaffoldDocuments('declared-mountain-reindexed-care');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',sector));
 const base=d.content.characters[0],names=['cache-physician',...Array.from({length:6},(_,i)=>'cache-patient-'+i),'cache-guard-a','cache-guard-b'];
 const chestId='finite-reindexed-dressings',contents=[{item:'medkits',count:1,weight:.2},{item:'torches',count:4,weight:.4},{item:'medkits',count:1,weight:.2}];
 d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.enemyStrategy={version:1,theaters:{}};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.maps[sector].props=[{id:chestId,type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];d.world.physical.caches[sector]={chest:chestId,contents:structuredClone(contents)};
 d.content.characters=names.map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,serviceGuarantee:0,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:i===0?70:20,medical:i===0?90:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:0},
  startingCondition:{hp:i===1||i===2?14:i===0?70:20,bleeding:0,bandaged:0,energy:100,fatigue:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id,ids=names.map(id),doctor=ids[0],patients=ids.slice(1,7),guards=ids.slice(7),hires=[];
 const hire=person=>{const quote=contractQuote(c,people.find(op=>op.id===person),'week'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id:person,term:'week',destination:sector});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id:person,price:quote.total});};
 hire(doctor);c=order(c,{type:'createSquad',sector,ids:[doctor],name:'Explorador de la reserva'});
 const discoveryStart=clock(c);c=discoverRouteCache(c,doctor);assert.ok(clock(c)>discoveryStart);assert.equal(c.operativeState[doctor].medkits,0);
 const chest=c.sectorStates[sector].props.find(prop=>prop.id===chestId);assert.equal(chest.knownToPlayer,true);assert.equal(chest.open,true);assert.deepEqual(chest.contents,contents);
 for(const person of ids.slice(1))hire(person);
 c=order(c,{type:'createSquad',sector,ids:patients,name:'Pacientes y reserva'});c=order(c,{type:'createSquad',sector,ids:[doctor,...guards],name:'Médico de la reserva'});c=order(c,{type:'assignCare',operativeId:doctor,assignment:'rest'});
 assert.ok(ids.every(person=>c.operativeState[person].bandaged===0));assert.ok(ids.slice(1,3).every(person=>c.operativeState[person].hp===14));assert.equal(c.resources.treasury,20000-hires.reduce((sum,row)=>sum+row.price,0));assert.deepEqual(d,declaration);
 return {campaign:save({campaign:c}).campaign,sector,ids,doctor,chestId,contents};
}

test('known finite dressings re-quote shifting container keys and preserve the intervening item through actual care and replay',()=>{
 const setup=declaredReindexedCare(),start=setup.campaign,before=structuredClone(start),events=[],model=sectorInventoryModel(start,setup.sector,rosterFor(start),setup.doctor),medical=model.entries.filter(row=>JSON.parse(row.expected).item==='medkits');
 assert.equal(medical.length,2);assert.ok(medical.every(row=>row.reachable&&row.count===1));assert.deepEqual(medical.map(row=>row.key),[`container:${setup.chestId}:0`,`container:${setup.chestId}:2`]);
 const c=performFreshMountainLocalFirstAid(start,{report:event=>events.push(structuredClone(event))}),takes=events.filter(event=>event.event==='freshRouteOrder'&&event.action.type==='sectorInventory'&&event.action.direction==='take'),recovery=events.filter(event=>event.event==='andesFiniteDressingsRecovered');
 assert.equal(takes.length,2);assert.deepEqual(takes.map(event=>event.action.count),[1,1]);assert.deepEqual(takes.map(event=>event.action.sourceKey),[`container:${setup.chestId}:0`,`container:${setup.chestId}:1`]);assert.deepEqual(takes.map(event=>JSON.parse(event.action.expected)),[setup.contents[0],setup.contents[2]]);
 assert.deepEqual(recovery.map(event=>({count:event.count,sourceCount:event.sourceCount,remaining:event.remaining})),[{count:1,sourceCount:1,remaining:0},{count:1,sourceCount:1,remaining:0}]);
 const chest=campaign=>campaign.sectorStates[setup.sector].props.find(prop=>prop.id===setup.chestId);
 assert.deepEqual(chest(takes[0].campaign).contents,[setup.contents[1],setup.contents[2]]);assert.deepEqual(chest(takes[1].campaign).contents,[setup.contents[1]]);assert.deepEqual(chest(c).contents,[setup.contents[1]]);
 const reused=sectorInventoryModel(takes[0].campaign,setup.sector,rosterFor(takes[0].campaign),setup.doctor).entries.find(row=>row.key===medical[0].key);assert.deepEqual(JSON.parse(reused.expected),setup.contents[1]);
 const uses=events.filter(event=>event.event==='freshMountainAidOrders').flatMap(event=>event.steps).filter(action=>action.type==='useItem');assert.equal(uses.length,2);assert.equal(c.operativeState[setup.doctor].medkits,0);assert.ok(setup.ids.every(id=>c.operativeState[id].alive&&c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding));
 assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);
 assert.deepEqual(replayMultiHomeCare(start,events).campaign,c);assert.deepEqual(performFreshMountainLocalFirstAid(save({campaign:start}).campaign),c);assert.deepEqual(start,before);
});
