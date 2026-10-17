import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {defaultStartingTerritory} from '../game/content-territory.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {actBattle,createBattle,presentedActBattle} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {campaignRole} from '../game/campaign-roles.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {visit,leave} from './local-contract-fixture.mjs';
import {attemptRouteDressings} from './route-dressings.mjs';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {mountainReplacementCensus,currentMountainServingRoles,currentMountainBatteryRoles,prepareNativeMountainReserve,NATIVE_MOUNTAIN_RESERVE_BOUNDS} from './fresh-mountain-route.mjs';

const leaderId=118,physicianId=116,roles={leaderId,physicianId},excluded=[leaderId,physicianId],replacements=[100,101,102,103,104,108];
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const actual=decodeSave(encodeSave(c)).campaign;assert.deepEqual(actual,c);return actual;};
const clock=c=>c.hour*3600+(c.secondOfHour??0);

// Availability, optional wounds and the friendly headquarters are declared
// before the factory. All service and work below use actual public orders.
function setup({count=6,wounded=false,jointRoles=false,engineerCommand=false}={}){
 const content=defaultContentPackage(),ids=[leaderId,physicianId,...replacements.slice(0,count),...(jointRoles?[109]:[])],retained=new Set(content.characters.filter(person=>Number(person.id.slice(7))<100||ids.includes(Number(person.id.slice(7)))).map(person=>person.id));
 content.characters=content.characters.filter(person=>retained.has(person.id));content.placements=content.placements.filter(row=>retained.has(row.character));
 content.headquarters='mendoza';content.startingTerritory=defaultStartingTerritory('mendoza');content.rules.startingTreasury=50000;
 for(const id of ids){const person=content.characters.find(person=>person.id===`person-${id}`);assert.ok(person);person.arrivalHours=0;if(wounded&&id===replacements[0])person.startingCondition={hp:50,bleeding:0,bandaged:20,energy:100,fatigue:0};}
 if(jointRoles){
  content.campaignRoles={foundryEngineer:'person-109',marchCommander:null};
  for(const person of content.characters){const id=Number(person.id.slice(7));if(!ids.includes(id))continue;Object.assign(person.attributes,id===118?{leadership:90,medical:91}:id===116?{leadership:69,medical:20}:id===109?{leadership:engineerCommand?72:55,medical:99}:{leadership:20,medical:0});person.startingCondition={hp:person.attributes.maxHp,bleeding:0,bandaged:0,energy:100,fatigue:0};person.startingSupplies={rations:2,torches:2,medkits:2,boleadoras:1};}
 }
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content);const hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id,term:'day',destination:'mendoza'});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id,quote});}
 for(let offset=0;offset<ids.length;offset+=6)c=order(c,{type:'createSquad',ids:ids.slice(offset,offset+6),sector:'mendoza',name:'Dotación real '+offset});
 assert.deepEqual(content,declaration);assert.deepEqual(currentMountainServingRoles(c,roles).leader.id,leaderId);return {campaign:saved(c),ids,hires};
}

test('six ready paid people include two separate roles and cannot certify six replacements',()=>{
 const {campaign:start}=setup({count:4}),before=structuredClone(start),all=mountainReplacementCensus(start),actual=mountainReplacementCensus(start,{exclude:excluded});
 assert.equal(all.ready.length,6);assert.equal(actual.ready.length,4);assert.deepEqual(new Set(actual.ready.map(row=>row.op.id)),new Set(replacements.slice(0,4)));assert.ok(excluded.every(id=>actual.rows.find(row=>row.op.id===id).reason==='separate-serving-role'));
 assert.strictEqual(prepareNativeMountainReserve(start),start,'The old unexcluded total can still say six without six replacements.');
 const fresh=saved(start),events=[];assert.throws(()=>prepareNativeMountainReserve(fresh,{exclude:excluded,report:event=>events.push(event)}),/Enough actual healthy serving reserves/);assert.deepEqual(events,[]);assert.deepEqual(fresh,start);assert.deepEqual(start,before);
});

test('six distinct actual local replacements preserve both serving roles and need no new orders',()=>{
 const {campaign:start,hires}=setup(),before=structuredClone(start),census=mountainReplacementCensus(start,{exclude:excluded}),events=[];
 assert.equal(census.ready.length,6);assert.deepEqual(new Set(census.ready.map(row=>row.op.id)),new Set(replacements));assert.ok(census.ready.every(row=>row.local&&row.serving&&row.quote.price===0&&row.daily>0));
 for(const row of hires)assert.equal(start.contracts[row.id].paid,row.quote.price);
 assert.strictEqual(prepareNativeMountainReserve(start,{exclude:excluded,report:event=>events.push(event)}),start);assert.deepEqual(events,[]);assert.deepEqual(currentMountainServingRoles(start,roles),{leader:rosterFor(start).find(op=>op.id===leaderId),physician:rosterFor(start).find(op=>op.id===physicianId)});assert.deepEqual(start,before);saved(start);
 assert.deepEqual(NATIVE_MOUNTAIN_RESERVE_BOUNDS,{count:6,preMarchRestHours:72,travelHours:168,readinessRestHours:600});
});

test('a declared real wound and an actual working duty remain outside the replacement census',()=>{
 for(const wound of [true,false]){
  const state=setup({wounded:wound});let c=state.campaign;if(!wound)c=order(c,{type:'assignWork',operativeId:replacements[0],assignment:'practice',skill:'marksmanship'});
  const before=structuredClone(c),census=mountainReplacementCensus(c,{exclude:excluded}),row=census.rows.find(row=>row.op.id===replacements[0]);
  assert.equal(row.reason,wound?'not-full-health':'unavailable-duty');assert.equal(census.ready.length,5);assert.ok(!census.ready.some(candidate=>excluded.includes(candidate.op.id)));assert.deepEqual(c,before);saved(c);
 }
});

test('serving role validation uses actual current service after ordinary clock advancement',()=>{
 const {campaign:start}=setup(),before=structuredClone(start),initialExpiry=contractExpiresSeconds(start.contracts[leaderId]);let c=start;
 for(let n=0;c.recruited.includes(leaderId)&&n<40;n++)c=order(c,{type:'wait',hours:1});
 assert.ok(clock(c)>=initialExpiry);assert.equal(c.recruited.includes(leaderId),false);assert.equal(c.operativeState[leaderId].alive,true);assert.throws(()=>currentMountainServingRoles(c,roles),/actual local capable service/);
 const current=mountainReplacementCensus(c,{exclude:excluded});assert.ok(!current.ready.some(row=>excluded.includes(row.op.id)));assert.deepEqual(start,before);saved(c);
});

// This component earns contracts, finite supply and the actual eight-person
// approach in a fresh campaign. The separate declared two-gun arena proves
// battery role/deployment admission; it is not a recovered-arsenal route win.
const roleBatteryScene={id:'paid-role-battery',width:40,height:24,seed:45,exploration:true,deferContact:true,enemies:[],
 tiles:Array.from({length:40*24},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0})),
 exits:[{id:'role:return',edge:'E',destination:'mendoza',entryEdge:'W',entryAnchor:{x:0,y:7}}],
 artillery:[{id:'role-heavy',type:'field8',side:'player',x:38,y:11,loaded:true,ammo:2},{id:'role-small',type:'swivel',side:'player',x:38,y:8,loaded:true,ammo:2}]};
const paired=(campaign,battle)=>{const actual=syncBattleTime(campaign,battle);assert.equal(actual.error,null);const pair={campaign:actual.campaign,battle:actual.battle},restored=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(restored,pair);return restored;};
function enterPaidRoles(c,actions){
 assert.equal(c.pendingBattle.hour,c.hour);assert.equal(c.pendingBattle.secondOfHour,c.secondOfHour??0);
 let pair=paired(c,enterSector(c.pendingBattle,c.sectorStates.uspallata,{placement:true}));
 for(const action of actions){const next=actBattle(pair.battle,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(pair.battle,action).state,next);pair=paired(pair.campaign,next);}
 return pair;
}

test('joint paid roles supply a distinct nonreserve doctor and deploy all eight actual mountain arrivals',()=>{
 let {campaign:c,hires}=setup({jointRoles:true,engineerCommand:true});const selected=currentMountainBatteryRoles(c),roleIds={leaderId:selected.leader.id,physicianId:selected.physician.id,battery:true},reserveId=campaignRole(c,'foundryEngineer').id,rearId=116;
 assert.equal(roleIds.leaderId,reserveId);assert.equal(roleIds.physicianId,118);assert.equal(reserveId,109);assert.equal(hires.length,9);
 assert.ok(hires.every(({id,quote})=>quote.available&&c.contracts[id].paid===quote.price&&contractExpiresSeconds(c.contracts[id])>clock(c)));
 const census=mountainReplacementCensus(c,{exclude:[roleIds.leaderId,roleIds.physicianId,rearId]});assert.equal(census.ready.length,6);assert.deepEqual(new Set(census.ready.map(row=>row.op.id)),new Set(replacements));
 c=leave(visit(c));const start=saved(c),before=structuredClone(start),orders=[],rear=structuredClone(c.operativeState[rearId]),rearHome=c.squads.find(q=>q.members.includes(rearId)).id;
 const material=s=>s.recruited.reduce((n,id)=>n+(s.operativeState[id].medkits??0),0)+sectorInventoryModel(s,'mendoza',rosterFor(s),roleIds.physicianId).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0),total=material(c);
 const result=attemptRouteDressings(c,roleIds.physicianId,15,{discover:false,reserves:{[rearId]:rear.medkits},onOrder:({campaign,action})=>{orders.push(structuredClone(action));assert.equal(material(campaign),total);}});assert.equal(result.supplied,true);c=result.campaign;
 assert.equal(c.operativeState[roleIds.physicianId].medkits,15);assert.ok(orders.some(action=>action.direction==='drop'));assert.ok(orders.some(action=>action.direction==='take'));assert.equal(material(c),total);
 const supplyOrders=orders.length,field=[roleIds.leaderId,roleIds.physicianId,...replacements],columns=[],step=action=>{c=order(c,action);orders.push(structuredClone(action));};
 for(const members of [field.slice(0,6),field.slice(6)]){step({type:'createSquad',ids:members,sector:'mendoza',name:'Roles reales '+columns.length});columns.push(c.activeSquadId);}
 currentMountainServingRoles(c,{...roleIds,requiredDressings:15});step({type:'transport',mode:'posta'});
 for(const id of columns){step({type:'selectSquad',id});step({type:'attack',sector:'uspallata',queue:true,mode:'posta'});}
 for(let n=0;n<16&&!columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');n++)step({type:'wait',hours:1});
 assert.ok(columns.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));step({type:'beginAssault',sector:'uspallata'});
 assert.deepEqual(new Set(c.pendingBattle.squad.map(u=>u.id)),new Set(field));assert.equal(c.pendingBattle.squad.length,8);assert.equal(c.pendingBattle.squad.find(u=>u.id===roleIds.physicianId).medkits,15);assert.ok(c.pendingBattle.squad.find(u=>u.id===roleIds.physicianId).medical>=60);
 assert.equal(c.squads.find(q=>q.id===rearHome).location,'mendoza');assert.ok(c.squads.find(q=>q.id===rearHome).members.includes(rearId));assert.equal(c.operativeState[rearId].location,'mendoza');for(const key of ['hp','bleeding','medkits','weapon','inventory','assignment'])assert.deepEqual(c.operativeState[rearId][key],rear[key]);
 assert.ok(clock(c)>clock(start)&&clock(c)-clock(start)<=16*3600);assert.equal(c.resources.treasury,start.resources.treasury-170);assert.deepEqual(c.contracts,start.contracts);
 const deployment=[{type:'spreadDeployment'},{type:'confirmDeployment'}],pair=enterPaidRoles(c,deployment);assert.equal(pair.battle.deploymentComplete,true);assert.equal(pair.battle.units.filter(u=>u.side==='player'&&!u.militia).length,8);
 let repeated=saved(start);for(const [i,action]of orders.entries()){repeated=order(repeated,action);if(i===supplyOrders-1)repeated=saved(repeated);}assert.deepEqual(enterPaidRoles(repeated,deployment),pair);assert.deepEqual(start,before);
 const declared=structuredClone(roleBatteryScene),squad=c.pendingBattle.squad.map((u,i)=>({...u,id:String(u.id),x:39,y:8+i,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}})),initial=createBattle(squad,declared);assert.equal(beginSectorDeployment(initial,{squad}),true);
 for(const supplied of c.pendingBattle.squad){const actual=initial.units.find(u=>u.id===String(supplied.id));for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','medical','medkits','weapon','loaded','inventory','offHand','equipmentCursor'])assert.deepEqual(actual[key],supplied[key],`The fresh battery factory preserves supplied ${supplied.id} ${key}.`);assert.deepEqual(unitAmmunitionByType(actual),unitAmmunitionByType(supplied),`The fresh battery factory preserves every finite ammunition type for ${supplied.id}.`);}
 const events=[],battery=createdUspallataBattery(initial,{reserveIds:[String(reserveId)],reserveDestination:'mendoza',report:e=>events.push(e)}),deployed=battery.deploy(initial);assert.equal(battery.roles.physicianId,String(roleIds.physicianId));assert.deepEqual(battery.roles.reserves,[String(reserveId)]);assert.equal(battery.roles.crews.reduce((n,crew)=>n+crew.ids.length,0),4);assert.equal(battery.roles.screens.length,2);
 assert.equal(deployed.units.find(u=>u.id===String(roleIds.physicianId)).medkits,15);assert.deepEqual(deployed.artillery,initial.artillery);assert.equal(deployed.elapsedSeconds,0);assert.equal(new Set(deployed.units.filter(u=>u.side==='player').map(u=>`${u.x},${u.y}`)).size,8);
 for(const old of initial.units.filter(u=>u.side==='player'))for(const key of ['hp','maxHp','bleeding','medical','medkits','weapon','loaded','ammoMusket','ammoPistol','inventory'])assert.deepEqual(deployed.units.find(u=>u.id===old.id)[key],old[key]);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(initial)));for(const event of events.filter(e=>e.event==='uspallataDeploymentOrder')){const next=actBattle(replay,event.action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(replay,event.action).state,next);replay=validateBattleSnapshot(JSON.parse(JSON.stringify(next)));}assert.deepEqual(replay,deployed);assert.deepEqual(declared,roleBatteryScene);
});

test('the medical-60 nonreserve contract preserves generic medical-20 and permits an engineer commander',()=>{
 for(const engineerCommand of [false,true]){
  const {campaign:start}=setup({jointRoles:true,engineerCommand}),before=structuredClone(start),selected=currentMountainBatteryRoles(start);
  assert.equal(selected.leader.id,engineerCommand?109:116);assert.equal(selected.physician.id,118);assert.deepEqual(currentMountainServingRoles(start,roles),{leader:rosterFor(start).find(op=>op.id===leaderId),physician:rosterFor(start).find(op=>op.id===physicianId)});
  assert.throws(()=>currentMountainServingRoles(start,{...roles,battery:true}),/required medical skill/);assert.throws(()=>currentMountainServingRoles(start,{leaderId:118,physicianId:109,battery:true}),/engineer reserve/);assert.throws(()=>currentMountainServingRoles(start,{leaderId:selected.leader.id,physicianId:118,battery:true,requiredDressings:15}),/finite departure dressings/);
  assert.deepEqual(start,before);saved(start);
 }
});

test('joint recovered-battery roles refuse an actual working or expired sole nonreserve physician',()=>{
 for(const working of [true,false]){
  const {campaign:start}=setup({jointRoles:true}),before=structuredClone(start);let c=start;
  if(working)c=order(c,{type:'assignWork',operativeId:118,assignment:'practice',skill:'marksmanship'});
  else{const expiry=contractExpiresSeconds(c.contracts[118]);for(let n=0;c.recruited.includes(118)&&n<40;n++)c=order(c,{type:'wait',hours:1});assert.ok(clock(c)>=expiry);assert.equal(c.recruited.includes(118),false);}
  const current=structuredClone(c);assert.throws(()=>currentMountainBatteryRoles(c),/distinct current serving/);assert.deepEqual(c,current);assert.deepEqual(start,before);saved(c);
 }
});
