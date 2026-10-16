import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {boundaryPassable} from '../game/tactical-exits.js';
import {visit} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {stockAmmunitionLedger,stageCreatedCuyoDefensePosts} from './created-cuyo-route.mjs';
import {prepareStockCuyoBatteryReserve} from './stock-cuyo-reserve-readiness.mjs';
import {prefetchStockCuyoReserveAmmunition,stockCuyoReserveAmmoPlan} from './stock-cuyo-reserve-ammunition.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';

const sector='cordoba',source='san_nicolas',family='ammoMusket',localCache='rear-cartridges',remoteCache='known-cartridges';
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=pair=>{const next=decodeSave(encodeSave(pair.campaign,pair.battle??null));assert.deepEqual(next,{campaign:pair.campaign,battle:pair.battle??null});return next;};
const carried=(c,id)=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
const rounds=(c,id)=>carried(c,id).loaded+ammoCount(carried(c,id),family);
const ammo=count=>({item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos finitos',weight:.04,count});
const chest=(id,x,y)=>({id,type:'chest',x,y,footprint:{width:1,height:1},blocksMovement:true});

// All stocks, weapons, optional full pack, medical wound, physical road and
// raid schedule are declared before compilation/factory. Discovery, actual
// first issues, roof posts and the empty eight-slot home are earned below.
function setup({remoteStock=12,knownSource=true,short=true,offFamily=false,fullCarrier=false,onlyBoxedCarrier=false,nearExpiry=false,raid=false,dropped=false,createdStaging=false}={}){
 const d=scaffoldDocuments('declared-cuyo-rear-ammunition');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post',source).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=10;d.content.headquarters=source;d.world.defaultHeadquarters=source;d.content.startingTerritory[source].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.arrivalFacilities[source]=['barracks'];d.content.arrivalSites.push({sector:source,facilities:['barracks']});d.world.expansion.buildingTargets={[sector]:0,[source]:0};d.world.exitLinks=[[sector,'E',19,8,source,'W',0,8]];
 d.world.physical.caches={[sector]:{chest:localCache,contents:[ammo(offFamily?10:8),{item:'torches',count:1,weight:.4}]},[source]:{chest:remoteCache,contents:[...(remoteStock?[ammo(remoteStock)]:[]),{item:'torches',count:2,weight:.4}]}};
 d.maps[sector].props=[chest(localCache,5,8)];d.maps[source].props=[chest(remoteCache,5,8)];
 d.maps[sector].upperSurfaces=Array.from({length:32},(_,i)=>({id:'reserve-roof-'+i,x:7+i%8,y:4+Math.floor(i/8),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
 d.maps[sector].climbLinks=[{id:'rear-public-climb',kind:'climb',from:{x:7,y:3,tacticalLevel:0},to:{x:7,y:4,tacticalLevel:1}}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:raid?12:240,axis:[sector]}}};
 const definitions=defaultContentPackage().weapons;for(const id of ['firearm-1800','firearm-1802'])d.content.weapons.push(structuredClone(definitions.find(weapon=>weapon.id===id)));
 const base=d.content.characters[0],names=['carrier','recipient','primary-reserve','physician','patient',...Array.from({length:8},(_,i)=>'guard-'+i)];
 d.content.characters=names.map((name,i)=>({...structuredClone(base),id:name,name,nickname:name,monthlyPay:300,serviceGuarantee:0,arrivalHours:0,weapon:offFamily&&i===0?'firearm-1802':'firearm-1800',
  attributes:{...base.attributes,maxHp:80,strength:i===0?95:70,medical:i===3?90:0},startingSupplies:{rations:fullCarrier&&i===0?24:0,torches:0,medkits:i===3?3:0,boleadoras:0},
  startingCondition:{hp:i===4?74:80,energy:100,fatigue:0,bleeding:0,bandaged:i===4?6:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(8,content);const ids=rosterFor(c).map(op=>op.id),[carrier,recipient,primary,physician,patient]=ids,hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id,term:'day',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 c=order(c,{type:'transport',mode:'posta'});c=order(c,{type:'createSquad',ids:[carrier],sector,name:'Exploración de cartuchos'});const scoutHome=c.activeSquadId;
 const travel=to=>{c=order(c,{type:'travel',sector:to,mode:'posta',queue:true});for(let n=0;c.squads.find(q=>q.id===c.activeSquadId).journey&&n<16;n++)c=order(c,{type:'wait',hours:1});assert.equal(c.location,to);};
 if(knownSource){travel(source);c=leaveFiniteCache(takeFiniteCache(visit(c),carrier,[],{cacheId:remoteCache}));assert.ok(c.sectorStates[source].props.find(p=>p.id===remoteCache).knownToPlayer);travel(sector);}
 c=leaveFiniteCache(takeFiniteCache(visit(c),carrier,[],{cacheId:localCache}));
 if(offFamily){const m=sectorInventoryModel(c,sector,rosterFor(c),carrier),row=m.entries.find(row=>row.reachable&&JSON.parse(row.expected).ammoType==='musket_75');assert.ok(row);c=order(c,{type:'sectorInventory',sector,operativeId:carrier,direction:'take',sourceKey:row.key,expected:row.expected,count:2});}
 if(short){c=order(c,{type:'unloadAmmunition',operativeId:recipient});c=order(c,{type:'ammunition',operativeId:recipient,family,quantity:10,direction:'store'});c=order(c,{type:'ammunition',operativeId:primary,family,quantity:10,direction:'take'});assert.equal(rounds(c,recipient),0);assert.equal(rounds(c,primary),20);assert.equal(c.ammunitionStores[sector][family],0);}
 const mainIds=[carrier,physician,patient];c=order(c,{type:'createSquad',ids:mainIds,sector,name:'Columna de los cañones'});const main=c.activeSquadId;
 const rear=ids.filter(id=>!mainIds.includes(id));for(let offset=0;offset<rear.length;offset+=6)c=order(c,{type:'createSquad',ids:rear.slice(offset,offset+6),sector,name:'Guardia de retaguardia '+offset});
 let staging=null;if(createdStaging){const input=c,before=structuredClone(c),events=[];c=stageCreatedCuyoDefensePosts(c,{report:event=>events.push(event)});assert.deepEqual(input,before);staging={events};}else c=stageRouteRoofDefenders(c,ids);const guard=ids[5],guardHome=c.squads.find(q=>q.members.includes(guard)),members=[...guardHome.members];
 while(c.squads.length<8)c=order(c,{type:'createSquad',ids:[guard],sector,name:'Grupo vacío reutilizable'});
 c=order(c,{type:'assignToSquad',operativeId:guard,squadId:guardHome.id});c=order(c,{type:'selectSquad',id:guardHome.id});c=order(c,{type:'squad',ids:members});c=order(c,{type:'selectSquad',id:main});
 if(nearExpiry){for(let n=0;n<32&&Math.min(...ids.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c)>3600;n++)c=order(c,{type:'wait',hours:1});const left=Math.min(...ids.map(id=>contractExpiresSeconds(c.contracts[id])))-clock(c);assert.ok(left>0&&left<=3600);}
 for(const id of ids)c=order(c,{type:'assignCare',operativeId:id,assignment:id===physician?'doctor':id===patient?'patient':'rest'});
 if(dropped){
  const home=c.squads.find(q=>q.members.includes(recipient)),members=[...home.members],empty=c.squads.find(q=>q.location===sector&&!q.members.length&&!q.journey);assert.ok(empty);c=order(c,{type:'selectSquad',id:empty.id});c=order(c,{type:'squad',ids:[recipient]});c=order(c,{type:'assignCare',operativeId:recipient,assignment:'active'});
  const entered=visit(c),battle=actBattle(entered.battle,{type:'drop',unitId:String(recipient),item:'primary',count:1});assert.equal(battle.lastError,null);const pair=syncBattleTime(entered.campaign,battle);assert.equal(pair.error,null);c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')});assert.equal(c.operativeState[recipient].weaponDropped,true);
  c=order(c,{type:'assignToSquad',operativeId:recipient,squadId:home.id});c=order(c,{type:'selectSquad',id:home.id});c=order(c,{type:'squad',ids:members});c=order(c,{type:'assignCare',operativeId:recipient,assignment:'rest'});c=order(c,{type:'selectSquad',id:main});
 }
 if(fullCarrier||onlyBoxedCarrier)for(const id of ids)if(![carrier,physician,patient].includes(id))c=order(c,{type:'assignWork',operativeId:id,assignment:'practice',skill:'marksmanship'});
 assert.equal(c.squads.length,8);assert.ok(c.squads.some(q=>q.id===scoutHome&&!q.members.length&&q.location===sector));assert.ok(ids.every(id=>c.operativeState[id].residentPosition?.tacticalLevel===1));assert.deepEqual(d,declaration);
 const posts=rear.map(id=>({id,...spacePoint(c.operativeState[id].residentPosition)}));return {campaign:saved({campaign:c}).campaign,ids,carrier,recipient,primary,physician,patient,main,posts,hires,staging};
}

function replay(start,result){
 let campaign=start,battle=null;
 // Replay the explicitly delimited successful rearm leaf from the fresh
 // successful start. Never execute a recorded returned or refused checkpoint.
 for(const transition of result.receipt.rearms){assert.equal(transition.completed,true);assert.equal(transition.beforeOrderIndex,0);const next=recoverRoutePrimary(campaign,transition.id);assert.deepEqual(next,transition.after);campaign=next;}
 for(const [index,row]of result.receipt.orders.entries()){
  if(row.kind==='campaign'){
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,battle);
   campaign=order(campaign,row.action);
   if(row.action.type==='visitSector'){battle=enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location]);const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;}
   if(row.action.type==='leaveSector')battle=null;
  }else{
   const direct=actBattle(battle,row.action),shown=presentedActBattle(battle,row.action).state,validated=actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),row.action);assert.equal(direct.lastError,null);assert.deepEqual(shown,direct);assert.deepEqual(validated,direct);const pair=syncBattleTime(campaign,direct);assert.equal(pair.error,null);campaign=pair.campaign;battle=pair.battle;
  }
  if(index===Math.floor(result.receipt.orders.length/2)){const pair=saved({campaign,battle});campaign=pair.campaign;battle=pair.battle;}
 }
 assert.deepEqual(saved({campaign,battle}).campaign,result.campaign);
}

test('separate created-Cuyo squad visits retain thirteen distinct paid roof posts and a real courier exit and return without moving another owner',()=>{
 const state=setup({createdStaging:true}),start=state.campaign,before=structuredClone(start),events=state.staging.events.filter(event=>event.event==='createdCuyoDefensePosition'),points=state.ids.map(id=>({id,...spacePoint(start.operativeState[id].residentPosition)})),key=point=>`${point.tacticalLevel}:${point.x}:${point.y}`,access=start.sectorStates[sector].climbLinks.flatMap(link=>[link.from,link.to]);
 assert.equal(state.hires.length,13);assert.equal(events.length,13);assert.equal(new Set(events.map(event=>event.squadId)).size,3);assert.equal(new Set(points.map(key)).size,13);assert.ok(points.every(point=>point.tacticalLevel>0&&!access.some(endpoint=>sameCell(point,endpoint))));
 for(const event of events)assert.deepEqual(spacePoint(start.operativeState[event.id].residentPosition),event.after);assert.ok(events.some(event=>!sameCell(event.before,event.after)));
 const ledger=stockAmmunitionLedger(start),result=prefetchStockCuyoReserveAmmunition(start,state.posts),r=result.receipt,c=result.campaign,admitted=r.admissions.find(row=>row.admitted);
 assert.equal(r.restored,true);assert.ok(admitted?.quote);assert.equal(r.plan.deficit[family],2);assert.equal(r.journeys.length,2);assert.ok(r.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));
 assert.ok(boundaryPassable(start.sectorStates[sector],admitted.quote.departure,admitted.quote.road.edge));assert.ok(sameCell(admitted.quote.returning.path.at(-1),start.operativeState[r.carrierId].residentPosition));for(const path of [admitted.quote.departure.path,admitted.quote.returning.path])assert.ok(path.every(point=>!admitted.quote.reserved.some(post=>sameCell(post,point))));
 for(const point of points)assert.deepEqual(spacePoint(c.operativeState[point.id].residentPosition),spacePoint(point));assert.equal(new Set(state.ids.map(id=>key(c.operativeState[id].residentPosition))).size,13);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.operativeState[state.physician].assignment,'doctor');assert.equal(c.operativeState[state.patient].assignment,'patient');assert.equal(rounds(c,state.primary),20);assert.equal(rounds(c,state.recipient),0);assert.equal(c.ammunitionStores[sector][family],2);assert.deepEqual(stockAmmunitionLedger(c),ledger);
 assert.equal(c.resources.treasury,start.resources.treasury-20-r.renewals.reduce((n,row)=>n+row.quote.price,0));assert.ok(clock(c)>clock(start)&&clock(c)<=r.deadlineSeconds);assert.ok(r.postSeconds>0&&r.postSeconds<=3600);replay(start,result);saved({campaign:c});assert.deepEqual(start,before);
});

test('the real two-round rear deficit pays known-source travel and renewals, then returns every home, roof and primary reserve before strict local allocation',()=>{
 const state=setup({nearExpiry:true}),start=state.campaign,before=structuredClone(start),ledger=stockAmmunitionLedger(start),result=prefetchStockCuyoReserveAmmunition(start,state.posts),c=result.campaign,r=result.receipt;
 assert.equal(r.plan.target,10);assert.equal(r.plan.deficit[family],2);assert.ok(state.ids.includes(r.carrierId));assert.ok(![state.carrier,state.physician,state.patient].includes(r.carrierId),'The preferred boxed post and both actual clinical roles cannot become the admitted courier.');assert.ok(['active','rest'].includes(start.operativeState[r.carrierId].assignment));assert.equal(rosterFor(start).find(op=>op.id===r.carrierId).medical,0);assert.equal(r.journeys.length,2);assert.ok(r.journeys.every(row=>row.quote.hours===4&&row.to-row.from===4*3600));assert.ok(r.renewals.length>0);
 const preferred=r.admissions.find(row=>row.id===state.carrier),admitted=r.admissions.find(row=>row.id===r.carrierId&&row.admitted);assert.equal(preferred.admitted,false);assert.equal(preferred.quote,null);assert.ok(admitted?.quote);assert.ok(r.admissions.every(row=>row.from===row.to),'Ordinary solo Native planning visits do not invent preparation time.');assert.ok(r.postSeconds>0&&r.postSeconds<=3600);
 for(const row of r.admissions.filter(row=>row.admitted)){assert.ok(boundaryPassable(start.sectorStates[sector],row.quote.departure,row.quote.road.edge));assert.ok(row.quote.departure.path.every(point=>!row.quote.reserved.some(post=>sameCell(post,point))));assert.ok(row.quote.returning.path.every(point=>!row.quote.reserved.some(post=>sameCell(post,point))));assert.ok(sameCell(row.quote.returning.path.at(-1),start.operativeState[row.id].residentPosition));}
 assert.equal(r.pickups.reduce((n,row)=>n+row.count,0),2);assert.equal(r.deposits.reduce((n,row)=>n+row.count,0),2);assert.equal(c.ammunitionStores[sector][family],2);assert.equal(rounds(c,state.recipient),0);assert.equal(rounds(c,state.primary),20);
 assert.equal(c.resources.treasury,start.resources.treasury-20-r.renewals.reduce((n,row)=>n+row.quote.price,0));assert.ok(clock(c)>clock(start)+8*3600);assert.ok(clock(c)<=r.deadlineSeconds);assert.equal(c.operativeState[state.patient].hp,c.operativeState[state.patient].maxHp);assert.equal(c.operativeState[state.physician].assignment,'doctor');assert.equal(c.operativeState[state.patient].assignment,'patient');
 assert.equal(r.orders.some(row=>row.action.type==='createSquad'),false);assert.ok(r.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'));assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,state.main);assert.deepEqual(c.squad,start.squad);
 for(const id of state.ids){assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(carried(c,id).loaded,carried(start,id).loaded);assert.equal(ammoCount(carried(c,id),family),ammoCount(carried(start,id),family));assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 assert.deepEqual(stockAmmunitionLedger(c),ledger);replay(start,result);assert.deepEqual(prefetchStockCuyoReserveAmmunition(saved({campaign:start}).campaign,state.posts),result);assert.deepEqual(start,before);
 const ready=prepareStockCuyoBatteryReserve(c,state.posts),after=ready.campaign;assert.equal(rounds(after,state.recipient),10);assert.equal(rounds(after,state.primary),20);assert.deepEqual(stockAmmunitionLedger(after),ledger);assert.equal(after.resources.treasury,c.resources.treasury);assert.deepEqual(after.contracts,c.contracts);assert.deepEqual(after.squads,c.squads);assert.equal(clock(after),clock(c));saved({campaign:after});
});

test('thirteen already supplied soldiers and an admitted off-primary local donation require no prefetch orders or trip',()=>{
 for(const options of [{short:false},{offFamily:true}]){
  const state=setup(options),start=state.campaign,before=structuredClone(start),posts=options.short===false?state.ids.map(id=>({id,...spacePoint(start.operativeState[id].residentPosition)})):state.posts,result=prefetchStockCuyoReserveAmmunition(start,posts);
  assert.equal(state.ids.length,13);assert.strictEqual(result.campaign,start);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.receipt.journeys,[]);assert.equal(result.receipt.reason,'local-stock-covers-reserve');
  if(options.offFamily){const plan=stockCuyoReserveAmmoPlan(start,state.posts);assert.equal(plan.families[family].donors.reduce((n,row)=>n+row.count,0),2);assert.equal(plan.deficit[family],0);const ready=prepareStockCuyoBatteryReserve(start,state.posts);assert.equal(ready.preparation.donations.reduce((n,row)=>n+row.count,0),2);assert.equal(rounds(ready.campaign,state.recipient),10);assert.equal(rounds(ready.campaign,state.primary),20);assert.deepEqual(stockAmmunitionLedger(ready.campaign),stockAmmunitionLedger(start));}
  assert.deepEqual(start,before);
 }
});

test('an actually dropped finite primary is recovered once before measuring and fetching the real remote rear deficit',()=>{
 const state=setup({dropped:true}),start=state.campaign,before=structuredClone(start),ledger=stockAmmunitionLedger(start),result=prefetchStockCuyoReserveAmmunition(start,state.posts),r=result.receipt;
 assert.equal(start.operativeState[state.recipient].weaponDropped,true);assert.equal(r.rearms.length,1);assert.equal(r.rearms[0].id,state.recipient);assert.equal(r.rearms[0].completed,true);assert.equal(r.rearms[0].nativeOrderTape,null);assert.equal(r.rearms[0].cost,0);assert.equal(r.rearms[0].after.operativeState[state.recipient].weaponDropped,false);assert.equal(r.plan.deficit[family],2);assert.equal(r.pickups.reduce((n,row)=>n+row.count,0),2);assert.equal(result.campaign.operativeState[state.recipient].weaponDropped,false);assert.equal(result.campaign.ammunitionStores[sector][family],2);assert.equal(rounds(result.campaign,state.primary),20);assert.deepEqual(stockAmmunitionLedger(result.campaign),ledger);replay(start,result);assert.deepEqual(start,before);
 const ready=prepareStockCuyoBatteryReserve(result.campaign,state.posts);assert.equal(rounds(ready.campaign,state.recipient),10);assert.equal(rounds(ready.campaign,state.primary),20);assert.deepEqual(stockAmmunitionLedger(ready.campaign),ledger);saved({campaign:ready.campaign});
});

test('unknown or exhausted remote stocks cannot borrow a compatible primary reserve or create a paid trip',()=>{
 for(const options of [{knownSource:false},{remoteStock:0},{remoteStock:1}]){
  const state=setup(options),before=structuredClone(state.campaign);assert.equal(rounds(state.campaign,state.primary),20);let failure;try{prefetchStockCuyoReserveAmmunition(state.campaign,state.posts);}catch(error){failure=error;}
  assert.match(failure?.message??'',/No controlled known finite ammunition source/);assert.deepEqual(failure.reserveAmmunitionPrefetch.orders,[]);assert.strictEqual(failure.campaign,state.campaign);assert.equal(failure.battle,null);assert.deepEqual(state.campaign,before);
 }
});

test('a full free carrier refuses before any journey, source debit, donation or reserve change',()=>{
 const state=setup({fullCarrier:true}),before=structuredClone(state.campaign),record=state.campaign.operativeState[state.carrier],model=sectorInventoryModel(state.campaign,sector,rosterFor(state.campaign),state.carrier);assert.equal(record.hp,record.maxHp);assert.equal(record.asleep,false);assert.ok(record.energy>=75&&record.fatigue<=40);assert.equal(record.assignment,'rest');assert.equal(model.operativeId,state.carrier);assert.equal(model.reason,null);assert.throws(()=>applyItemQuantity(model.personal,ammo(2)));let failure;try{prefetchStockCuyoReserveAmmunition(state.campaign,state.posts);}catch(error){failure=error;}
 assert.match(failure?.message??'',/free fit nonclinical carrier needs room/);assert.deepEqual(failure.reserveAmmunitionPrefetch.orders,[]);assert.strictEqual(failure.campaign,state.campaign);assert.equal(failure.battle,null);assert.deepEqual(state.campaign,before);
});

test('an independent only-boxed free carrier closes its real solo visit and refuses before any paid departure or source transfer',()=>{
 const state=setup({onlyBoxedCarrier:true}),start=state.campaign,before=structuredClone(start),person=start.operativeState[state.carrier],model=sectorInventoryModel(start,sector,rosterFor(start),state.carrier);assert.equal(person.assignment,'rest');assert.equal(person.hp,person.maxHp);assert.ok(person.energy>=75,'Paid roof staging must leave the actual carrier above the unchanged admission floor.');assert.ok(person.fatigue<=40,'Paid roof staging keeps the unchanged carrier fatigue allowance.');assert.equal(model.reason,null);assert.doesNotThrow(()=>applyItemQuantity(model.personal,ammo(2)));
 for(const id of state.ids)if(![state.carrier,state.physician,state.patient].includes(id))assert.equal(start.operativeState[id].assignment,'practice');
 let failure;try{prefetchStockCuyoReserveAmmunition(start,state.posts);}catch(error){failure=error;}
 assert.match(failure?.message??'',/publicly quoted departure and return/);const r=failure.reserveAmmunitionPrefetch;assert.equal(r.admissions.length,1);assert.equal(r.admissions[0].id,state.carrier);assert.equal(r.admissions[0].admitted,false);assert.equal(r.admissions[0].quote,null);assert.equal(r.admissions[0].from,r.admissions[0].to);assert.deepEqual(r.journeys,[]);assert.deepEqual(r.pickups,[]);assert.deepEqual(r.deposits,[]);assert.equal(r.orders.some(row=>row.action.type==='travel'),false);assert.equal(r.orders.some(row=>row.kind==='battle'),false);assert.ok(r.orders.some(row=>row.action.type==='visitSector'));assert.ok(r.orders.some(row=>row.action.type==='leaveSector'));assert.ok(r.orders.every(row=>row.accepted));assert.equal(failure.battle,null);assert.equal(failure.campaign.pendingBattle,null);assert.equal(failure.campaign.pendingEncounter,null);assert.equal(clock(failure.campaign),clock(start));assert.equal(failure.campaign.resources.treasury,start.resources.treasury);assert.deepEqual(failure.campaign.squads,start.squads);assert.deepEqual(failure.campaign.squad,start.squad);assert.equal(failure.campaign.activeSquadId,start.activeSquadId);assert.deepEqual(failure.campaign.contracts,start.contracts);
 for(const id of state.ids){assert.deepEqual(failure.campaign.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(failure.campaign.operativeState[id].assignment,start.operativeState[id].assignment);assert.deepEqual(failure.campaign.operativeState[id].inventory,start.operativeState[id].inventory);assert.equal(failure.campaign.operativeState[id].carriedLoaded,start.operativeState[id].carriedLoaded);assert.equal(failure.campaign.operativeState[id].medkits,start.operativeState[id].medkits);}
 assert.deepEqual(failure.campaign.ammunitionStores,start.ammunitionStores);assert.deepEqual(failure.campaign.sectorStates[source],start.sectorStates[source]);assert.deepEqual(start,before);
 // The actual refused prefix is inspected as plain records only. No save,
 // Native quote, helper re-entry or replay consumes that refused campaign.
});

test('a real announced raid stops the paid courier at its actual partial campaign without crediting the undelivered parcel',()=>{
 const state=setup({raid:true}),before=structuredClone(state.campaign);let failure;try{prefetchStockCuyoReserveAmmunition(state.campaign,state.posts);}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/real encounter stops/);assert.ok(failure.campaign.pendingEncounter);assert.equal(failure.battle,null);assert.ok(clock(failure.campaign)>clock(state.campaign));assert.equal(failure.reserveAmmunitionPrefetch.orders.at(-1).action.type,'wait');assert.equal(failure.reserveAmmunitionPrefetch.orders.at(-1).accepted,true);assert.deepEqual(failure.reserveAmmunitionPrefetch.deposits,[]);assert.equal(failure.campaign.ammunitionStores[sector]?.[family]??0,0);assert.deepEqual(state.campaign,before);
 // The retained failed output is inspected only. It is never saved, queried,
 // resumed or passed to any second helper invocation.
});
