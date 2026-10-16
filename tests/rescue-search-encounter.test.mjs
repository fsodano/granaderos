import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {applyMapCommands} from '../game/map-commands.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {cordobaClinicGroundCrew,cordobaClinicDefenseOrder} from './cordoba-clinic-combat-readiness.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {createBattle,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview,stanceCost,getReachable,lookPreview,actBattle,presentedActBattle,endTurn,presentedEndTurn,climbPreview,firearmShotOptions,actionCosts,medicalUsePreview,canSee,hasLineOfSight} from '../game/tactical.js';
import {spacePoint,sameCell,sameSurface,surfaceAt} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {order,visit,tactical,saved,leave} from './local-contract-fixture.mjs';
import {prepareRescueClinicGuards,rescueClinicDefenseController} from './rescue-clinic-readiness.mjs';
import {knownRouteBystanderShotSafety} from './route-fire-safety.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {handoverRescueClinicDressings,prepareRescueClinicDefense,prepareRescueCordobaRear,resolveRescueRecoveryEncounter,rescueCordobaDefenseController} from './rescue-recovery.mjs';

import {publicRouteView,usefulRouteRifleShot,usefulRouteFiringPosture} from './route-infantry-progress.mjs';

import {paidHospitalRoofWalkPreview} from './coordinated-hospital-battery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// Every actor, weapon, finite dressing, roof, trap and raid is declared before
// compilation. Native travel and the real trap earn the body; no saved campaign
// or post-factory health, clock, force or supply assignment is used.
function documents({raid=true,stock=8}={}){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('rescue-search-control')).replaceAll('watch-post','tucuman'));
 const base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=20;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory.tucuman={owner:'patriot',loyalty:65};
 d.world.arrivalFacilities.tucuman=['barracks'];d.content.arrivalSites.push({sector:'tucuman',facilities:['barracks']});
 d.content.weapons.push({id:'guard-musket',template:1801,name:'Mosquete de la guardia',damage:32,fireAP:11,aimAP:2,reloadAP:22,range:12,readyAP:0,capacity:1,weight:4,price:0,art:base.portrait});
 d.content.characters=['carrier','guard-west','guard-east','fallen'].map(id=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,
  weapon:id==='fallen'?null:'guard-musket',attributes:{...base.attributes,maxHp:70,strength:100,leadership:90,marksmanship:95,mechanical:0,medical:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:id==='fallen'?stock:0}}));
 d.world.expansion.buildingTargets.tucuman=0;
 const roof=applyMapCommands(d.maps.tucuman,[{type:'addBuilding',building:{id:'clinic-roof',x:7,y:2,width:6,height:5,kind:'house',architecture:'house',roof:'terrace'}}]);
 assert.deepEqual(roof.errors,[]);d.maps.tucuman=roof.document;
 d.maps.tucuman.props.push({id:'finite-trap',type:'chest',x:4,y:12,footprint:{width:1,height:1},blocksMovement:true});
 d.world.physical.environment.tucuman={doors:[],containers:[{selector:{type:'chest',id:'finite-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 if(raid)d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:29,axis:['tucuman']}}};
 return d;
}

function collection(options={}){
 const declaration=documents(options),beforeDeclaration=structuredClone(declaration),content=compileCampaignPackage(declaration.manifest,declaration);
 assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id;
 const carrier=id('carrier'),fallen=id('fallen'),guards=[id('guard-west'),id('guard-east')],ids=[carrier,...guards,fallen];
 for(const person of ids)c=order(c,{type:'recruitCivic',id:person,term:'month'});
 c=order(c,{type:'squad',ids});c=order(c,{type:'travel',sector:'tucuman'});assert.equal(c.location,'tucuman');assert.equal(c.pendingEncounter,null);
 c=order(c,{type:'squad',ids:[fallen]});let p=visit(c);
 const actor=()=>p.battle.units.find(unit=>unit.id===String(fallen)),trap=p.battle.props.find(prop=>prop.id==='finite-trap');assert.ok(trap);
 for(let request=0;Math.hypot(actor().x-trap.x,actor().y-trap.y)>1.5&&request<32;request++){
  const point=getReachable(p.battle,actor()).filter(point=>Math.hypot(point.x-trap.x,point.y-trap.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(point);
  const before=spacePoint(actor());p=saved(tactical(p,{type:'move',unitId:String(fallen),...spacePoint(point)}));assert.equal(sameCell(actor(),before),false);
 }
 assert.ok(Math.hypot(actor().x-trap.x,actor().y-trap.y)<=1.5);
 if(lookPreview(p.battle,actor(),trap).valid)p=saved(tactical(p,{type:'look',unitId:String(fallen),...spacePoint(trap)}));
 p=saved(tactical(p,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:trap.id,verb:'open'}}));assert.equal(actor().hp,0);assert.equal(actor().medkits,options.stock??8);
 c=leave(p);assert.equal(c.operativeState[fallen].alive,false);
 c=order(c,{type:'createSquad',name:'Correo real de la clínica',ids:[carrier],sector:'tucuman'});
 const prepared=prepareRescueClinicGuards(c,{courier:carrier});c=prepared.campaign;
 assert.deepEqual(new Set(prepared.evidence.ids),new Set(guards));assert.ok(prepared.evidence.roofEvidence.positions.every(point=>point.tacticalLevel>0));
 for(const person of [carrier,...guards])c=order(c,{type:'assignCare',operativeId:person,assignment:'rest'});
 const target=30*3600-1;
 for(let request=0;clock(c)<target&&request<40;request++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});
 assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);
 for(const person of [carrier,...guards]){
  if(c.operativeState[person].asleep)c=order(c,{type:'setSleep',operativeId:person,asleep:false});
  c=order(c,{type:'assignCare',operativeId:person,assignment:'active'});
 }
 if(options.raid!==false){
  const groups=c.enemyGroups.filter(group=>group.target==='tucuman');assert.equal(groups.length,1);
  assert.equal(groups[0].status,'marching');assert.equal(groups[0].initialStrength,3);assert.equal(groups[0].arrivalAt,30);
  assert.equal(c.enemyReserves.remaining.frontier,0);
 }
 assert.equal(c.pendingEncounter,null);
 const found=recoverVisibleRouteDressings(c,carrier,options.stock===0?1:8);
 assert.equal(found.collected,options.stock??8);assert.ok(found.evidence.elapsedSeconds>1);
 assert.equal(found.campaign.operativeState[fallen].alive,false);assert.equal(found.campaign.pendingBattle,null);
 if(options.raid!==false){assert.equal(found.campaign.pendingEncounter?.sector,'tucuman');assert.equal(found.campaign.enemyGroups.find(group=>group.id===found.campaign.pendingEncounter.groupId).status,'waiting');}
 else assert.equal(found.campaign.pendingEncounter,null);
 assert.deepEqual(declaration,beforeDeclaration);
 return {found,carrier,fallen,guards,prepared};
}

test('successful public collection settles the actual arrived clinic raid before one finite handover and exactly replays',()=>{
 const {found,carrier,fallen}=collection(),input=saved({campaign:found.campaign}).campaign,before=structuredClone(input);
 const result=handoverRescueClinicDressings(input,{courier:carrier,collected:found.collected}),c=result.campaign;
 assert.deepEqual(input,before);assert.equal(result.donated,8);assert.equal(result.defense.status,'victory');assert.equal(result.defense.exactNativeReplay,true);assert.ok(result.defense.orders.length>0);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.enemyGroups.find(group=>group.id===result.defense.groupId).status,'defeated');
 assert.ok(c.encounterHistory.some(row=>row.groupId===result.defense.groupId&&row.outcome==='victory'));
 assert.equal(c.operativeState[fallen].alive,false);assert.equal(c.operativeState[carrier].medkits,0);assert.ok(c.recruited.includes(carrier)&&c.operativeState[carrier].alive&&!c.operativeState[carrier].captured);
 const publicStock=sectorInventoryModel(c,'tucuman',rosterFor(c),carrier).entries.filter(row=>row.kind==='ground'&&JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0);assert.equal(publicStock,8);
 assert.deepEqual(result.handover,{type:'sectorInventory',sector:'tucuman',operativeId:carrier,direction:'drop',item:'medkits',count:8});
 assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(handoverRescueClinicDressings(saved({campaign:before}).campaign,{courier:carrier,collected:8}),result);
});

test('a successful collection with no actual encounter transfers the same finite stock without extra time or payment',()=>{
 const {found,carrier,fallen}=collection({raid:false}),input=found.campaign,before=structuredClone(input);
 const result=handoverRescueClinicDressings(input,{courier:carrier,collected:8});
 assert.equal(result.defense,null);assert.equal(result.donated,8);assert.equal(clock(result.campaign),clock(input));assert.equal(result.campaign.resources.treasury,input.resources.treasury);
 assert.equal(result.campaign.operativeState[carrier].medkits,0);assert.equal(result.campaign.operativeState[fallen].alive,false);assert.deepEqual(input,before);
 assert.deepEqual(handoverRescueClinicDressings(saved({campaign:before}).campaign,{courier:carrier,collected:8}),result);
});

test('an empty public collection still settles its real arrived raid without inventing a dressing transfer',()=>{
 const {found,carrier,fallen}=collection({stock:0}),result=handoverRescueClinicDressings(found.campaign,{courier:carrier,collected:0});
 assert.equal(result.defense.status,'victory');assert.equal(result.donated,0);assert.equal(result.handover,null);assert.equal(result.campaign.pendingEncounter,null);assert.equal(result.campaign.pendingBattle,null);
 assert.equal(result.campaign.operativeState[carrier].medkits,0);assert.equal(result.campaign.operativeState[fallen].alive,false);
});

test('an encounter callback that leaves the actual encounter unresolved stops before any transfer',()=>{
 const {found,carrier}=collection();let calls=0,error;
 try{handoverRescueClinicDressings(found.campaign,{courier:carrier,collected:8,resolveEncounter:campaign=>{calls++;assert.equal(campaign,found.campaign);return {campaign,evidence:null};}});}catch(actual){error=actual;}
 assert.equal(calls,1);assert.ok(error);assert.match(error.message,/settle the actual clinic encounter/);
 assert.equal(error.rescueClinicHandover.campaign,found.campaign);assert.equal(error.rescueClinicHandover.handover,null);
 // The refused/unfinished prefix is retained only as a raw diagnostic reference.
});

test('a resolver callback error remains the exact terminal error even when diagnostic fields cannot be attached',()=>{
 const {found,carrier}=collection(),failure=Object.freeze(new Error('fresh callback stop'));let calls=0;
 assert.throws(()=>handoverRescueClinicDressings(found.campaign,{courier:carrier,collected:8,resolveEncounter:campaign=>{calls++;assert.equal(campaign,found.campaign);throw failure;}}),error=>error===failure);
 assert.equal(calls,1);
 // No Native query, codec, replay or continuation follows this caught error.
});

test('an actual excessive handover refusal retains its raw Native result and stops without using it',()=>{
 const {found,carrier}=collection({raid:false});let error;
 try{handoverRescueClinicDressings(found.campaign,{courier:carrier,collected:9});}catch(actual){error=actual;}
 assert.ok(error);assert.equal(error.rescueClinicHandover.handover.count,9);
 assert.ok(error.rescueClinicHandover.campaign.lastError);assert.notEqual(error.rescueClinicHandover.campaign,found.campaign);
 // Inspect the actual error fields only; never query, save or resume this result.
});

// Separate fresh declarations leave the six collection controls above intact.
// The clinic starts with real finite supplies and full, explicitly valid bodies;
// every hire, paid defense level, roof move and raid arrival is a Native order.
function clinicDefense({treasury=20000,level=0,raid=false,landingFormation=false}={}){
 const d=documents({raid}),idsByName=['carrier','guard-west','guard-east',...(landingFormation?['clinic-doctor','clinic-patient']:[])];
 if(landingFormation)for(const name of ['clinic-doctor','clinic-patient'])d.content.characters.push({...structuredClone(d.content.characters[1]),id:name,name,nickname:name});
 d.content.rules.startingTreasury=treasury;
 d.content.characters=d.content.characters.filter(person=>idsByName.includes(person.id)).map(person=>({...person,
  ...(landingFormation?{attributes:{...person.attributes,medical:person.id==='clinic-doctor'?90:0}}:{}),
  startingCondition:{hp:landingFormation&&person.id==='clinic-patient'?60:70,bleeding:0,bandaged:landingFormation&&person.id==='clinic-patient'?10:0,energy:100,fatigue:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:landingFormation&&person.id==='clinic-doctor'?3:2}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id;
 const carrier=id('carrier'),guards=[id('guard-west'),id('guard-east')],ids=[carrier,...guards,...(landingFormation?[id('clinic-doctor'),id('clinic-patient')]:[])];let hireCost=0;
 for(const person of ids){
  const quote=contractQuote(c,people.find(row=>row.id===person),'month'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);
  c=order(c,{type:'recruitCivic',id:person,term:'month'});assert.equal(c.resources.treasury,cash-quote.total);hireCost+=quote.total;
 }
 assert.equal(c.resources.treasury,treasury-hireCost);
 c=order(c,{type:'squad',ids});c=order(c,{type:'travel',sector:'tucuman'});assert.equal(c.location,'tucuman');assert.equal(c.pendingEncounter,null);
 c=order(c,{type:'createSquad',name:'Guardia pagada de la clínica',ids:guards,sector:'tucuman'});
 c=order(c,{type:'createSquad',name:'Correo de la clínica',ids:[carrier],sector:'tucuman'});
 for(let n=0;n<level;n++)c=order(c,{type:'fortify',sector:'tucuman'});
 assert.equal(c.sectors.tucuman.fort,level);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,carrier,guards,ids};
}

test('the rescue clinic buys three actual defenses before free staging and its real raid admits paid roof cover',()=>{
 const {campaign:start,carrier,guards,ids}=clinicDefense({raid:true}),before=structuredClone(start);
 const result=prepareRescueClinicDefense(start,{courier:carrier}),c=result.campaign,paid=result.fortification,staged=result.evidence;
 assert.equal(paid.fromLevel,0);assert.equal(paid.cost,450);assert.equal(paid.orders.length,3);assert.equal(paid.startSeconds,clock(start));assert.equal(paid.endSeconds,clock(start));
 for(const row of paid.orders){assert.deepEqual(row.action,{type:'fortify',sector:'tucuman'});assert.equal(row.cost,150);assert.equal(row.from,row.to);}
 assert.equal(c.sectors.tucuman.fort,3);assert.equal(staged.cost,0);assert.equal(staged.netCashChange,staged.incomeReceived);
 assert.equal(c.resources.treasury,start.resources.treasury-450+staged.incomeReceived);assert.equal(clock(c),clock(start)+staged.elapsedSeconds);
 assert.deepEqual(new Set(staged.ids),new Set(guards));assert.equal(staged.roofEvidence.positions.length,2);assert.ok(staged.roofEvidence.positions.every(point=>point.tacticalLevel>0));
 assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.recruited,start.recruited);assert.equal(c.activeSquadId,start.activeSquadId);
 for(const person of ids){assert.equal(c.operativeState[person].hp,start.operativeState[person].hp);assert.equal(c.operativeState[person].medkits,2);assert.equal(c.operativeState[person].alive,true);assert.equal(c.operativeState[person].captured,false);}
 assert.deepEqual(start,before);assert.deepEqual(saved({campaign:c}).campaign,c);
 assert.deepEqual(prepareRescueClinicDefense(saved({campaign:start}).campaign,{courier:carrier}),result,'Only the accepted fresh setup is replayed through the same paid preparation.');
 let current=c;
 for(const operativeId of ids)current=order(current,{type:'assignCare',operativeId,assignment:'rest'});
 for(let requests=0;!current.pendingEncounter&&requests<40;requests++)current=order(current,{type:'wait',hours:1});
 assert.equal(current.pendingEncounter?.sector,'tucuman');assert.equal(current.enemyReserves.remaining.frontier,0);
 for(const person of ids)assert.ok(contractExpiresSeconds(current.contracts[person])>clock(current));
 current=order(current,{type:'respondToEncounter',groupId:current.pendingEncounter.groupId,choice:'tactical'});
 const request=current.pendingBattle,previous=structuredClone(current.sectorStates.tucuman),battle=enterSector(request,current.sectorStates.tucuman);
 assert.equal(request.defenseFort,3);assert.equal(request.enemies.length,3);assert.deepEqual(new Set(request.squad.map(person=>Number(person.id))),new Set(ids));
 for(const point of staged.roofEvidence.positions){
  const actor=battle.units.find(unit=>unit.id===String(point.id));assert.ok(sameCell(actor,point));
  assert.equal(surfaceAt(previous,point).cover,0);assert.equal(surfaceAt(battle,point).cover,30);
  assert.equal(actor.medkits,2);assert.equal(actor.hp,70);
 }
 const pair=syncBattleTime(current,battle);assert.equal(pair.error,null);assert.deepEqual(saved(pair),{campaign:pair.campaign,battle:pair.battle});
});

test('an already fortified rescue clinic pays nothing again and retains the separate free staging oracle',()=>{
 const {campaign:start,carrier,ids}=clinicDefense({level:3}),before=structuredClone(start),result=prepareRescueClinicDefense(start,{courier:carrier});
 assert.equal(result.fortification.fromLevel,3);assert.equal(result.fortification.cost,0);assert.deepEqual(result.fortification.orders,[]);assert.equal(result.fortification.startSeconds,result.fortification.endSeconds);
 assert.equal(result.campaign.sectors.tucuman.fort,3);assert.equal(result.evidence.cost,0);assert.equal(result.evidence.netCashChange,result.evidence.incomeReceived);
 assert.equal(result.campaign.resources.treasury,start.resources.treasury+result.evidence.incomeReceived);assert.equal(clock(result.campaign),clock(start)+result.evidence.elapsedSeconds);
 for(const person of ids){assert.equal(result.campaign.operativeState[person].hp,70);assert.equal(result.campaign.operativeState[person].medkits,2);}
 assert.deepEqual(result.campaign.contracts,start.contracts);assert.deepEqual(result.campaign.recruited,start.recruited);assert.deepEqual(start,before);
 assert.deepEqual(saved({campaign:result.campaign}).campaign,result.campaign);
});

test('an unaffordable rescue clinic refuses its full real defense bill before any staging or paid order',()=>{
 const {campaign:start,carrier}=clinicDefense({treasury:800}),before=structuredClone(start);assert.ok(start.resources.treasury<450);let failure;
 try{prepareRescueClinicDefense(start,{courier:carrier});}catch(error){failure=error;}
 assert.match(failure?.message??'',/Actual funds must cover every remaining hospital fortification level/);
 assert.equal(failure.campaign,start);assert.deepEqual(failure.hospitalFortification.orders,[]);assert.equal(failure.hospitalFortification.cost,0);assert.deepEqual(start,before);
 // Raw refusal fields only. No Native query, save or continuation follows it.
});

test('paid public landing posts retain an existing west guard and clinic roles before fort3 blocks both climbs and a real safe shot spends one round',()=>{
 for(const variant of ['west','north','fire']){
 const s=clinicDefense({raid:true,landingFormation:true}),person=name=>rosterFor(s.campaign).find(op=>op.contentId===name).id,doctor=person('clinic-doctor'),patient=person('clinic-patient'),westGuard=s.guards[0];let c=s.campaign;
 const homes=structuredClone(c.squads),selected=c.activeSquadId,home=c.squads.find(q=>q.members.includes(westGuard));
 c=order(c,{type:'selectSquad',id:home.id});c=order(c,{type:'squad',ids:[westGuard,doctor,patient]});let p=visit(c);
 const links=p.battle.climbLinks.filter(link=>link.id.startsWith('clinic-roof:')),upper=link=>(link.to.tacticalLevel??0)>(link.from.tacticalLevel??0)?link.to:link.from,lower=link=>upper(link)===link.to?link.from:link.to;
 assert.equal(links.length,2);const west=links.find(link=>link.id.endsWith(':west'));assert.ok(west);const access=variant==='north'?links.find(link=>link!==west):west;assert.ok(access);
 const stage=(id,point)=>{const unitId=String(id);p=tactical(p,{type:'movement',unitId,movement:'walk'});for(let steps=0;!sameCell(p.battle.units.find(u=>u.id===unitId),point);steps++){assert.ok(steps<64);const unit=p.battle.units.find(u=>u.id===unitId),route=getReachable(p.battle,unit,{stopAt:q=>sameCell(q,point)})[0];assert.ok(route);p=tactical(p,{type:'move',unitId,...spacePoint(route)});}p=tactical(p,{type:'stance',unitId,stance:'crouched'});};
 stage(westGuard,upper(west));
 for(const id of [doctor,patient]){const unit=p.battle.units.find(u=>u.id===String(id)),point=p.battle.upperSurfaces.filter(q=>!q.blocked&&!links.some(link=>sameCell(q,upper(link)))&&!p.battle.units.some(other=>other.id!==unit.id&&other.hp>0&&sameCell(other,q))&&getReachable(p.battle,unit,{stopAt:r=>sameCell(r,q)})[0]).sort((a,b)=>b.y-a.y||b.x-a.x)[0];assert.ok(point);stage(id,point);}
 c=leave(p);for(const original of homes){c=order(c,{type:'selectSquad',id:original.id});c=order(c,{type:'squad',ids:original.members});}c=order(c,{type:'selectSquad',id:selected});assert.deepEqual(c.squads,homes);
 // The ordinary courier also pays to reach the public ground access. No
 // future battle position, AP, cover or visibility is assigned by this setup.
 p=visit(c);const courierId=String(s.carrier);p=tactical(p,{type:'movement',unitId:courierId,movement:'walk'});
 for(let steps=0;!sameCell(p.battle.units.find(u=>u.id===courierId),lower(access));steps++){assert.ok(steps<64);const route=getReachable(p.battle,p.battle.units.find(u=>u.id===courierId),{stopAt:q=>sameCell(q,lower(access))})[0];assert.ok(route);p=tactical(p,{type:'move',unitId:courierId,...spacePoint(route)});}c=leave(p);
 c=order(c,{type:'assignCare',operativeId:doctor,assignment:'doctor'});c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});
 const start=c,before=structuredClone(start),result=prepareRescueClinicDefense(start,{courier:s.carrier}),prepared=result.campaign,posts=result.evidence.roofEvidence.landingPosts;
 assert.equal(result.fortification.cost,450);assert.equal(prepared.resources.treasury,start.resources.treasury-450+result.evidence.incomeReceived);assert.ok(clock(prepared)>clock(start));assert.equal(posts.length,2);assert.equal(new Set(posts.map(post=>post.id)).size,2);
 assert.equal(posts.find(post=>post.linkId===west.id).id,westGuard);assert.equal(posts.find(post=>post.linkId===west.id).retained,true);assert.ok(posts.some(post=>!post.retained));assert.ok(result.evidence.roofEvidence.actions.some(action=>action.type==='move'&&action.unitId===String(s.guards[1])));
 for(const id of [westGuard,doctor,patient,s.carrier])assert.deepEqual(prepared.operativeState[id].residentPosition,start.operativeState[id].residentPosition);
 assert.equal(prepared.operativeState[doctor].assignment,'doctor');assert.equal(prepared.operativeState[patient].assignment,'patient');assert.deepEqual(prepared.squads,start.squads);assert.deepEqual(prepared.contracts,start.contracts);
 for(const id of s.ids)for(const key of ['hp','alive','bleeding','bandaged','medkits','inventory','weapon','condition','carriedLoaded','ammo'])assert.deepEqual(prepared.operativeState[id][key],start.operativeState[id][key],`${id}:${key}`);
 assert.deepEqual(start,before);assert.deepEqual(prepareRescueClinicDefense(saved({campaign:start}).campaign,{courier:s.carrier}),result);
 c=prepared;for(const operativeId of s.ids)c=order(c,{type:'assignCare',operativeId,assignment:'rest'});for(let hours=0;!c.pendingEncounter&&hours<40;hours++)c=order(c,{type:'wait',hours:1});assert.equal(c.pendingEncounter?.sector,'tucuman');
 c=order(c,{type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});const request=c.pendingBattle,previous=structuredClone(c.sectorStates.tucuman),initial=enterSector(request,c.sectorStates.tucuman);let battle=initial;
 assert.equal(request.defenseFort,3);assert.equal(request.squad.length,5);const policy=rescueClinicDefenseController(initial);assert.equal(policy.roles.physicianId,String(doctor));assert.equal(policy.roles.rifleIds.includes(String(s.carrier)),false);
 for(const post of posts){assert.ok(sameCell(battle.units.find(u=>u.id===String(post.id)),post));assert.equal(surfaceAt(previous,post).cover,0);assert.equal(surfaceAt(battle,post).cover,30);}
 if(variant!=='fire'){
  const courier=battle.units.find(u=>u.id===courierId);assert.ok(sameCell(courier,lower(access)));assert.equal(courier.stance,'standing');const quote=climbPreview(battle,courier,{linkId:access.id});assert.equal(quote.valid,false);assert.match(quote.reason,/bloqueado/);
  const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);assert.deepEqual(saved({campaign:pair.campaign,battle:pair.battle}),{campaign:pair.campaign,battle:pair.battle});assert.deepEqual(initial,enterSector(request,previous));
  // Each refused climb is terminal raw evidence. The next variant creates
  // a new declared campaign; it never uses this returned error state.
  const blocked=actBattle(battle,{type:'climb',unitId:courierId,linkId:access.id});assert.match(blocked.lastError,/bloqueado/);continue;
 }
 const tape=[],execute=action=>{const old=battle,next=action.type==='endTurn'?endTurn(old):actBattle(old,action);assert.equal(next.lastError,null);assert.deepEqual((action.type==='endTurn'?presentedEndTurn(old):presentedActBattle(old,action)).state,next);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(next))),next);battle=next;tape.push(action);};let fired=null;
 for(let window=0;window<8&&!fired;window++){
  assert.equal(battle.status,'active');for(const id of s.guards){const unit=battle.units.find(u=>u.id===String(id)),action=policy.controller(battle,unit);if(!action)continue;
   const old=unitAmmunitionByType(unit);if(action.type==='fire'){const target=battle.units.find(u=>u.id===action.targetId),shot=firearmShotOptions(battle,unit,target,action.aim??0).find(row=>row.aim===(action.aim??0)&&row.hitLocation===(action.hitLocation??'torso'));assert.ok(shot.chance>=25&&shot.damageFactor>0);assert.equal(knownRouteBystanderShotSafety(battle,unit,target)(shot),true);}
   execute(action);if(action.type==='fire'){const next=battle.units.find(u=>u.id===String(id)),debit=Object.values(old).reduce((a,b)=>a+b,0)-Object.values(unitAmmunitionByType(next)).reduce((a,b)=>a+b,0);if(debit){assert.equal(debit,1);assert.equal(next.condition,unit.condition-1);fired=action;break;}}
  }if(!fired)execute({type:'endTurn'});
 }
 assert.ok(fired,'Actual paid lookout and current safe fire must consume a finite cartridge.');let replay=initial;for(const action of tape){replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null);}assert.deepEqual(replay,battle);
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);assert.deepEqual(saved({campaign:pair.campaign,battle:pair.battle}),{campaign:pair.campaign,battle:pair.battle});
 for(const post of posts)assert.ok(sameCell(battle.units.find(u=>u.id===String(post.id)),post));assert.deepEqual(initial,enterSector(request,previous));
 }
});


// Independent rear declarations keep the old ten controls and their factories
// exact. The courier carries its finite medical load; every recruit, discovery,
// post, defense level, renewal and march below is an ordinary Native action.
function courierRear({treasury=20000,arsenal=true,retainedRoof=false,retainedGuardMedical=0}={}){
 const d=scaffoldDocuments('rescue-courier-paid-cordoba-rear');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('watch-post','cordoba').replaceAll('"camp"','"tucuman"').replaceAll('camp:','tucuman:'));
 d.content.rules.startingTreasury=treasury;d.content.rules.deploymentCartridges=12;d.content.rules.enemyCartridges=6;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.content.startingTerritory.cordoba={owner:'patriot',loyalty:65};
 d.world.arrivalFacilities.cordoba=['barracks'];d.content.arrivalSites.push({sector:'cordoba',facilities:['barracks']});
 d.world.expansion.buildingTargets={tucuman:0,cordoba:0};d.world.expansion.rural=[];
 const base=d.content.characters[0],stock=weaponSpecification({weapon:1801});
 d.content.weapons.push({id:'rear-stock-musket',template:1801,name:stock.name,damage:stock.damage,fireAP:stock.fireAP,aimAP:stock.aimAP,reloadAP:stock.reloadAP,range:stock.range,readyAP:stock.readyAP,capacity:stock.capacity,weight:stock.weight,price:stock.price,art:base.portrait});
 d.content.oppositionEquipment={officer:'rear-stock-musket',line:'rear-stock-musket',veteran:'rear-stock-musket'};
 const names=['courier','old-roof-guard','rear-physician','new-crew-west','new-crew-east','new-roof-rifle','tucuman-physician','tucuman-patient'];
 if(retainedRoof)names.push('old-clinical-rear');
 d.content.characters=names.map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:i>=2&&i<=5?3000:30,arrivalHours:0,weapon:[1,3,4,5].includes(i)?'rear-stock-musket':null,
  attributes:{...base.attributes,maxHp:80,strength:100,agility:80,dexterity:90,wisdom:80,leadership:90,marksmanship:i===0?10:[3,4].includes(i)?40:95,medical:retainedRoof&&i===1?retainedGuardMedical:[2,6].includes(i)?90:0},
  startingCondition:{hp:i===7||retainedRoof&&i===8?75:80,bleeding:0,bandaged:0,energy:100,fatigue:0},
  startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?13:i===1?1:i===2?6:i===6?3:0}}));
 d.maps.cordoba.props=[{id:'courier-rear-arsenal',type:'chest',x:12,y:12,footprint:{width:1,height:1},blocksMovement:true}];
 d.maps.cordoba.upperSurfaces=Array.from({length:24},(_,i)=>({id:'courier-rear-roof-'+i,x:8+i%6,y:5+Math.floor(i/6),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:25}));
 d.maps.cordoba.climbLinks=[{id:'courier-rear-access',kind:'climb',from:{x:7,y:6,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}}];
 d.world.physical.caches.cordoba={chest:'courier-rear-arsenal',contents:[{item:'weapon',weapon:1801,count:4,condition:90,loaded:0,weight:stock.weight},{item:'inventory:ammo:musket_75',kind:'ammunition',ammoType:'musket_75',name:'Cartuchos de mosquete',count:80,weight:.04}]};
 d.world.physical.arsenals=arsenal?{cordoba:{version:1,sector:'cordoba',chest:'courier-rear-arsenal',pieces:[{id:'arsenal:courier-rear:1',type:'bronze4',side:'player',loaded:true,ammo:6}]}}:{};
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:16,raidEveryHours:29,axis:['cordoba']}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const people=rosterFor(c),id=key=>people.find(op=>op.contentId===key).id,ids=names.map(id),courier=ids[0],oldGuard=ids[1],tucumanDoctor=ids[6],patient=ids[7];
 for(const operativeId of [courier,oldGuard,tucumanDoctor,patient,...(retainedRoof?[ids[8]]:[])]){const quote=contractQuote(c,people.find(op=>op.id===operativeId),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id:operativeId,term:'week',destination:operativeId===oldGuard||retainedRoof&&operativeId===ids[8]?'cordoba':'tucuman'});assert.equal(cash-c.resources.treasury,quote.total);}
 c=order(c,{type:'createSquad',sector:'cordoba',ids:[oldGuard],name:'Puesto anterior'});c=discoverRouteCache(c,oldGuard);c=stageRouteRoofDefenders(c,[oldGuard]);
 c=order(c,{type:'assignCare',operativeId:oldGuard,assignment:'rest'});
 if(retainedRoof){c=order(c,{type:'createSquad',sector:'cordoba',ids:[ids[8]],name:'Paciente anterior de Córdoba'});c=order(c,{type:'assignCare',operativeId:ids[8],assignment:'patient'});}
 c=order(c,{type:'createSquad',sector:'tucuman',ids:[tucumanDoctor,patient],name:'Clínica original'});
 c=order(c,{type:'assignCare',operativeId:tucumanDoctor,assignment:'doctor'});c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});
 c=order(c,{type:'createSquad',sector:'tucuman',ids:[courier],name:'Correo sanitario'});const outbound=previewStrategicRoute(c,c.activeSquadId,'cordoba','march');assert.equal(outbound.valid,true,outbound.reason);c=order(c,{...outbound.action,queue:false});assert.equal(c.location,'cordoba');assert.equal(c.pendingEncounter,null);
 assert.equal(c.operativeState[courier].medkits,13);assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,courier,oldGuard,tucumanDoctor,patient,ids,declaration};
}

test('the returning medical courier pays a five-person rear and resolves the actual sixteen-raider Cordoba defense before restoring its Tucuman selection',()=>{
 const s=courierRear(),start=s.campaign,before=structuredClone(start),events=[],result=prepareRescueCordobaRear(start,{courier:s.courier,report:event=>events.push(event)}),prepared=result.campaign,r=result.receipt;
 assert.deepEqual(start,before);assert.equal(r.rear.length,5);assert.equal(r.hires.length,4);assert.equal(r.fortification.cost,450);assert.equal(prepared.sectors.cordoba.fort,3);assert.ok(r.hires.every(h=>h.quote.total===h.debited&&h.arrival.travelHours===0));
 assert.equal(prepared.resources.treasury,start.resources.treasury-450-r.hires.reduce((n,h)=>n+h.debited,0));assert.ok(r.endSeconds>r.startSeconds&&r.endSeconds<=r.startSeconds+3600);
 assert.equal(r.readiness.crewIds.length,2);assert.equal(r.finalReadiness.crewIds.length,2);for(const receipt of [r.readiness,r.finalReadiness]){assert.ok(!receipt.crewIds.includes(s.courier));assert.notEqual(receipt.doctorId,s.courier);}assert.equal(cordobaClinicGroundCrew(prepared).length,2);assert.ok(r.staging[0].orders.some(row=>row.kind==='battle'&&row.action.type==='move'));
 assert.deepEqual(prepared.operativeState[s.oldGuard].residentPosition,start.operativeState[s.oldGuard].residentPosition);assert.equal(prepared.operativeState[s.oldGuard].assignment,start.operativeState[s.oldGuard].assignment);assert.equal(prepared.operativeState[s.courier].medkits,13);assert.ok(start.operativeState[s.tucumanDoctor].medkits<3,'The declared stable wound already consumed one real clinical dressing during the outward courier march.');
 assert.deepEqual(prepared.sectorStates.cordoba.artillery,start.sectorStates.cordoba.artillery);assert.deepEqual(prepareRescueCordobaRear(saved({campaign:start}).campaign,{courier:s.courier}),result);
 let c=prepared;const route=previewStrategicRoute(c,c.activeSquadId,'tucuman','march');assert.equal(route.valid,true,route.reason);
 const renew=hours=>{for(const id of c.recruited){let contract=c.contracts[id];while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=clock(c)+(hours+1)*3600){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;c=order(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(cash-c.resources.treasury,quote.price);contract=c.contracts[id];}}};
 renew(route.hours);const departed=clock(c);c=order(c,{...route.action,queue:false});assert.equal(clock(c)-departed,route.hours*3600);assert.equal(c.location,'tucuman');assert.equal(c.pendingEncounter,null);assert.equal(c.operativeState[s.courier].medkits,13);assert.equal(rosterFor(start).find(op=>op.id===s.courier).marksmanship,10);assert.deepEqual(cordobaClinicGroundCrew(c),r.finalReadiness.crewIds);assert.ok(!cordobaClinicGroundCrew(c).includes(s.courier));assert.notEqual(r.finalReadiness.doctorId,s.courier);
 for(let n=0;!c.pendingEncounter&&n<40;n++){renew(2);c=order(c,{type:'wait',hours:1});}
 assert.equal(c.pendingEncounter?.sector,'cordoba');const group=c.enemyGroups.find(g=>g.id===c.pendingEncounter.groupId);assert.equal(group.initialStrength,16);assert.equal(group.units.length,16);assert.ok(group.units.every(u=>u.weapon===1801&&u.ammo+u.loaded===6));
 const input=c,unchanged=structuredClone(input),selected=c.activeSquadId,doctorAssignment=c.operativeState[s.tucumanDoctor].assignment,patientAssignment=c.operativeState[s.patient].assignment;
 const resolved=resolveRescueRecoveryEncounter(input,{report:event=>events.push(event)}),end=resolved.campaign,e=resolved.evidence;
 assert.deepEqual(input,unchanged);assert.equal(e.sector,'cordoba');assert.equal(e.status,'victory');assert.equal(e.exactNativeReplay,true);assert.ok(e.actions>0&&e.turns<=81);assert.ok(e.orders.some(action=>action.type==='artillery'));assert.equal(end.enemyGroups.find(g=>g.id===group.id).status,'defeated');assert.equal(end.sectors.cordoba.owner,'patriot');assert.equal(end.activeSquadId,selected);assert.equal(end.location,'tucuman');assert.equal(end.pendingEncounter,null);assert.equal(end.pendingBattle,null);
 const charges=pieces=>pieces.reduce((n,g)=>n+Number(g.loaded)+g.ammo,0);assert.ok(charges(e.artilleryBefore)>charges(e.artilleryAfter));assert.ok(charges(e.artilleryAfter)>=0);assert.deepEqual(e.artilleryAfter.map(({loaded,ammo,facing,reloadProgress,stationed,...g})=>g),e.artilleryBefore.map(({loaded,ammo,facing,reloadProgress,stationed,...g})=>g));
 assert.ok(e.medkitsAfter>=0&&e.medkitsAfter<=e.medkitsBefore);assert.equal(e.medkitsBefore,7);assert.ok(events.some(row=>row.event==='cordobaMedicalRearFieldAid'));assert.equal(end.operativeState[s.courier].medkits,13);assert.equal(end.operativeState[s.tucumanDoctor].assignment,doctorAssignment);assert.equal(end.operativeState[s.patient].assignment,patientAssignment);
 assert.ok(end.resources.treasury>=0);assert.equal(end.operativeState[s.patient].hp,end.operativeState[s.patient].maxHp);for(const id of end.recruited)assert.ok(contractExpiresSeconds(end.contracts[id])===null||contractExpiresSeconds(end.contracts[id])>clock(end));
 assert.deepEqual(saved({campaign:end}).campaign,end);assert.deepEqual(resolveRescueRecoveryEncounter(saved({campaign:input}).campaign),resolved);
});

test('rear preparation retains the actual accepted prefix when quoted budget or the already-discovered physical cannon is unavailable',()=>{
 for(const variant of ['budget','cannon']){
  const s=courierRear({treasury:variant==='budget'?1000:20000,arsenal:variant!=='cannon'}),before=structuredClone(s.campaign);let failure;
  try{prepareRescueCordobaRear(s.campaign,{courier:s.courier});}catch(error){failure=error;}
  assert.ok(failure);assert.deepEqual(s.campaign,before);assert.ok(failure.rescueCordobaRear);assert.ok(failure.campaign.resources.treasury<=before.resources.treasury);assert.equal(failure.campaign.operativeState[s.courier].medkits,13);
  if(variant==='budget'){assert.match(failure.message,/quoted affordable immediate/);assert.equal(failure.rescueCordobaRear.hires.length,1);assert.equal(before.resources.treasury-failure.campaign.resources.treasury,failure.rescueCordobaRear.hires[0].debited);}
  else {assert.match(failure.message,/already discovered actual finite rear cannon/);assert.deepEqual(failure.rescueCordobaRear.hires,[]);assert.equal(failure.campaign.resources.treasury,before.resources.treasury);}
  // These are raw terminal observations only. Do not query, encode, replay or
  // continue either unavailable result; the next variant declares a new world.
 }
});


test('three actually paid rear arrivals place only the supplied physician beside an unchanged earned roof rifle',()=>{
 const s=courierRear({retainedRoof:true}),start=s.campaign,before=structuredClone(start),result=prepareRescueCordobaRear(start,{courier:s.courier}),c=result.campaign,r=result.receipt,staged=r.staging[0],physician=staged.physicianId;
 assert.deepEqual(start,before);assert.equal(r.rear.length,5);assert.equal(r.initialRear.length,2);assert.equal(r.hires.length,3);assert.ok(r.hires.every(row=>row.debited===row.quote.total&&row.arrival.travelHours===0));
 assert.equal(c.resources.treasury,start.resources.treasury-450-r.hires.reduce((n,row)=>n+row.debited,0));assert.ok(r.endSeconds>r.startSeconds&&r.endSeconds<=r.startSeconds+3600);
 assert.equal(r.readiness.crewIds.length,2);assert.equal(r.finalReadiness.crewIds.length,2);assert.ok(r.newIds.includes(physician));assert.deepEqual(staged.ids,[physician]);assert.equal(staged.retainedRoofRifleId,s.oldGuard);assert.ok(!r.finalReadiness.crewIds.includes(s.oldGuard));assert.ok(!staged.ids.includes(s.courier));
 assert.deepEqual(staged.physicianPost.neighbors,[s.oldGuard]);const post=c.operativeState[physician].residentPosition,guard=c.operativeState[s.oldGuard].residentPosition;assert.equal(post.tacticalLevel,guard.tacticalLevel);assert.ok(Math.hypot(post.x-guard.x,post.y-guard.y)<=1.5);assert.ok(!sameCell(post,guard));
 assert.deepEqual(guard,start.operativeState[s.oldGuard].residentPosition);assert.equal(c.operativeState[s.oldGuard].assignment,start.operativeState[s.oldGuard].assignment);assert.equal(c.operativeState[s.courier].medkits,13);assert.deepEqual(c.sectorStates.cordoba.artillery,start.sectorStates.cordoba.artillery);assert.equal(c.operativeState[s.ids[8]].assignment,'patient');
 const load=state=>carriedAmmunition(rosterFor(state).find(op=>op.id===s.oldGuard),state.operativeState[s.oldGuard]);assert.deepEqual(unitAmmunitionByType(load(c)),unitAmmunitionByType(load(start)));assert.ok(Object.values(unitAmmunitionByType(load(c))).reduce((a,b)=>a+b,0)>0);
 assert.ok(staged.orders.some(row=>row.kind==='battle'&&row.action.type==='climb'&&row.action.unitId===String(physician)));assert.ok(staged.orders.filter(row=>row.kind==='battle').every(row=>row.action.unitId===String(physician)));assert.ok(staged.steps<=64&&staged.orders.length<=staged.maximumOrders&&staged.maximumOrders<=600);assert.ok(staged.endSeconds<=staged.until&&staged.until<=staged.startSeconds+3600);
 const midpoint=staged.visits[0];assert.deepEqual(saved({campaign:midpoint.initialCampaign,battle:midpoint.initial}),{campaign:midpoint.initialCampaign,battle:midpoint.initial});assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(prepareRescueCordobaRear(saved({campaign:start}).campaign,{courier:s.courier}),result);
 for(const [id,body]of Object.entries(start.operativeState))if(!body.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,body.deathMinute);}
});

test('retained-roof physician staging refuses an actual clinical guard and an exhausted original deadline without continuing either failure',()=>{
 for(const variant of ['clinical','deadline']){
  const s=courierRear({retainedRoof:true,retainedGuardMedical:variant==='clinical'?80:0});let c=s.campaign;const physician=s.ids[2],quote=contractQuote(c,rosterFor(c).find(op=>op.id===physician),'day'),cash=c.resources.treasury;
  c=order(c,{type:'recruitCivic',id:physician,term:'day',destination:'cordoba'});assert.equal(cash-c.resources.treasury,quote.total);c=order(c,{type:'createSquad',sector:'cordoba',ids:[physician],name:'Nueva médica de relevo'});
  if(variant==='clinical')c=order(c,{type:'assignCare',operativeId:s.oldGuard,assignment:'doctor'});
  const before=structuredClone(c),reservedPositions=[{id:s.oldGuard,...c.operativeState[s.oldGuard].residentPosition}];let failure;
  try{stageRouteRoofDefenders(c,[physician],{bounded:{deadlineSeconds:clock(c)+(variant==='deadline'?0:3600)},reservedPositions,physicianId:physician,retainedRoofRifleId:s.oldGuard});}catch(error){failure=error;}
  assert.ok(failure);assert.match(failure.message,variant==='clinical'?/actual fit nonclinical rifle/:/remaining original care deadline/);assert.deepEqual(c,before);assert.ok(failure.routeRoofDefenders);assert.deepEqual(failure.campaign,before);
  // Both failures stop before another Native order. Never query, encode,
  // replay or continue a failed result; each variant declares a fresh world.
 }
});


// Fresh portable Native declarations. Only actual paid looks exhaust the
// helper; neither current AP nor a captured battle is assigned to the factory.
function rescueCrewOrderArena(){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:100,agility:100,dexterity:100,strength:100,medical:0,medkits:0,marksmanship:0,weapon:1804,blade:0,loaded:1,ammo:4,condition:100,stance:'crouched',facing:2,patrol:false,overwatch:false};
 const players=[{...base,id:'crew-one',x:5,y:5,stance:'prone'},{...base,id:'crew-two',x:6,y:4},
  {...base,id:'roof-physician',x:20,y:8,tacticalLevel:1,medical:90,medkits:2,weapon:0,loaded:0,ammo:0,activeSlot:'unarmed'},
  {...base,id:'roof-guard',x:20,y:7,tacticalLevel:1,weapon:1813,loaded:0,ammo:0,activeSlot:'blade'}];
 const options={id:'declared-rescue-exact-crew-order',width:40,height:20,hour:12,seed:45,exploration:false,
  tiles:Array.from({length:800},(_,n)=>({x:n%40,y:Math.floor(n/40),type:'grass',cover:0,blocked:false})),
  upperSurfaces:[7,8].map(y=>({id:'retained-roof-'+y,x:20,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:30})),climbLinks:[],
  enemies:[{id:'public-raider',x:18,y:5,hp:500,maxHp:500,weapon:0,blade:0,loaded:0,ammo:0,medical:0,medkits:0,patrol:false,overwatch:false}],
  artillery:[{id:'finite-rear-gun',type:'bronze4',side:'player',x:6,y:5,facing:0,loaded:true,ammo:2}]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

test('the exact rescue crew holds an unpayable gun quote instead of buying an ordinary rise and later pays real finite cannon work',()=>{
 const actor=(b,id)=>b.units.find(unit=>unit.id===id),crew=['crew-one','crew-two'];
 const replay=(start,orders)=>{let direct=start,shown=start,restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,action).state;assert.deepEqual(shown,direct);restored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(restored,action))));assert.deepEqual(restored,direct);}return direct;};
 const start=rescueCrewOrderArena(),before=structuredClone(start),policy=rescueCordobaDefenseController(start),paid=[];let battle=start;
 // The complete initial admission is retained even when one original helper
 // later spends his own AP. No replacement or physician is added to the job.
 for(let count=0;actor(battle,'crew-two').ap>0&&count<128;count++){
  const unit=actor(battle,'crew-two'),points=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].map(([dx,dy])=>({x:unit.x+dx,y:unit.y+dy}));
  const quote=points.map(point=>({point,quote:lookPreview(battle,unit,point)})).filter(row=>row.quote.valid&&row.quote.pa>0).sort((a,b)=>a.quote.pa-b.quote.pa)[0];assert.ok(quote,'The actual helper must pay a current affordable look.');
  const action={type:'look',unitId:unit.id,...quote.point},ap=unit.ap;paid.push(action);battle=actBattle(battle,action);assert.equal(battle.lastError,null);assert.equal(actor(battle,unit.id).ap,ap-quote.quote.pa);
 }
 assert.equal(actor(battle,'crew-two').ap,0);assert.deepEqual(replay(start,paid),battle);
 const prone=actor(battle,'crew-one'),legacy=cordobaClinicDefenseOrder(battle,prone),held=structuredClone(battle);
 assert.deepEqual(legacy,{type:'stance',unitId:prone.id,stance:'crouched'});assert.equal(usefulRouteRifleShot(publicRouteView(battle,prone),prone),null);assert.equal(usefulRouteFiringPosture(battle,prone,legacy),false);
 assert.equal(policy(battle,prone),null,'The admitted crew must hold while its actual complete gun work and useful rifle work are unavailable.');assert.deepEqual(battle,held);
 for(const id of ['roof-physician','roof-guard'])assert.deepEqual(policy(battle,actor(battle,id)),cordobaClinicDefenseOrder(battle,actor(battle,id)),'Noncrew keeps the exact ordinary clinic policy.');
 assert.deepEqual(start,before);
 // An independent identical fresh declaration has its actual full crew AP.
 // It earns one useful rise, shot and reload through the real caller policy.
 const ready=rescueCrewOrderArena(),readyBefore=structuredClone(ready),active=rescueCordobaDefenseController(ready),tape=[];let current=ready;
 for(let count=0;count<16&&!tape.some(action=>action.type==='artilleryReload');count++){
  const unit=actor(current,'crew-one'),action=active(current,unit);assert.ok(action);assert.ok(['stance','artillery','artilleryPivot','artilleryReload'].includes(action.type));
  const gun=current.artillery[0],quote=action.type==='artilleryReload'?artilleryReloadPreview(current,unit,gun):action.type.startsWith('artillery')?artilleryCrewPlan(current,unit,gun,artilleryCosts(current,unit,gun)[action.type==='artillery'?'fire':'pivot']):null;
  const cost=action.type==='stance'?stanceCost(unit,action.stance):action.type==='artilleryReload'?quote.pa:artilleryCosts(current,unit,gun)[action.type==='artillery'?'fire':'pivot'];
  if(quote){assert.equal(quote.reason,null);assert.deepEqual(new Set(quote.crew),new Set(crew));}else {assert.equal(action.stance,'crouched');assert.equal(tape.length,0);}
  const prior=current;current=actBattle(current,action);assert.equal(current.lastError,null);tape.push(action);
  for(const id of quote?crew:[unit.id])assert.equal(actor(current,id).ap,actor(prior,id).ap-cost);
 }
 assert.ok(tape.some(action=>action.type==='artillery'));assert.ok(tape.some(action=>action.type==='artilleryReload'));assert.equal(tape.filter(action=>action.type==='stance').length,1);assert.equal(current.artillery[0].loaded,true);assert.equal(current.artillery[0].ammo,1);
 assert.deepEqual(replay(ready,tape),current);assert.deepEqual(ready,readyBefore);
 for(const unit of ready.units.filter(unit=>unit.side==='player')){const next=actor(current,unit.id);assert.deepEqual(unitAmmunitionByType(next),unitAmmunitionByType(unit));for(const key of ['hp','bleeding','bandaged','medkits','weapon','inventory'])assert.deepEqual(next[key],unit[key]);assert.deepEqual(spacePoint(next),spacePoint(unit));}
 for(const key of ['id','type','side','x','y'])assert.deepEqual(current.artillery[0][key],ready.artillery[0][key]);
});

// Independent public close-threat declarations. Every wound, role, body,
// roof and finite supply exists before the Native battle factory runs.
function rescueRoofPhysicianEscapeArena({blocked=false,lowCover=false,distant=false,adjacent=false,armed=false,doctor={},gunContact=false}={}){
 const base={hp:100,maxHp:100,bleeding:0,bandaged:0,energy:100,fatigue:0,morale:90,agility:100,dexterity:100,strength:100,wisdom:80,experienceLevel:4,medical:0,medkits:0,marksmanship:0,weapon:0,blade:0,loaded:0,ammo:0,condition:100,stance:'crouched',movementMode:'crouch',activeSlot:'unarmed',facing:6,patrol:false,overwatch:false};
 const players=[{...base,id:'roof-medic',x:8,y:9,tacticalLevel:1,medical:90,medkits:2,...(armed?{weapon:1805,loaded:1,ammo:3,marksmanship:90,activeSlot:'primary'}:{}),...doctor},
  {...base,id:'declared-patient',x:adjacent?9:11,y:9,tacticalLevel:1,hp:14,bleeding:2}];
 if(blocked)for(const [n,[x,y]]of [[8,8],[8,10],[9,8],[9,9],[9,10]].entries())players.push({...base,id:'declared-body-'+n,x,y,tacticalLevel:1});
 if(gunContact)players.push({...base,id:'actual-gunner',x:7,y:8,tacticalLevel:1,medical:0});
 const options={id:'declared-rescue-roof-close-threat',width:32,height:20,hour:12,seed:45,exploration:false,
  tiles:Array.from({length:640},(_,n)=>({x:n%32,y:Math.floor(n/32),type:'grass',cover:0,blocked:false})),
  upperSurfaces:Array.from({length:36},(_,n)=>({id:'escape-roof-'+n,x:2+n%12,y:8+Math.floor(n/12),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:lowCover&&!(2+n%12===8&&8+Math.floor(n/12)===9)?0:30})),climbLinks:[],npcs:[],
  enemies:[{...base,id:'known-close-raider',name:'Amenaza declarada',x:distant?2:6,y:9,tacticalLevel:1,stance:'standing',movementMode:'walk',facing:2}],
  artillery:gunContact?[{id:'declared-contact-gun',type:'bronze4',side:'player',x:8,y:8,tacticalLevel:1,loaded:true,ammo:2}]:[]};
 const declaration=structuredClone({players,options}),battle=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}

function replayRescueRoofEscape(start,orders){
 let direct=start,shown=start,restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,action).state;assert.deepEqual(shown,direct);const next=actBattle(restored,action);assert.equal(next.lastError,null);restored=validateBattleSnapshot(JSON.parse(JSON.stringify(next)));assert.deepEqual(restored,direct);}
 return direct;
}

test('a supplied roof physician pays a short equal-cover escape from a current close threat then performs real finite care',()=>{
 const start=rescueRoofPhysicianEscapeArena(),before=structuredClone(start),actor=(b,id='roof-medic')=>b.units.find(u=>u.id===id),policy=rescueCordobaDefenseController(start),doctor=actor(start),target=actor(start,'known-close-raider'),patient=actor(start,'declared-patient');
 assert.ok(canSee(start,doctor,target));assert.ok(sameSurface(doctor,target));assert.ok(Math.hypot(doctor.x-target.x,doctor.y-target.y)<=2.5);assert.equal(medicalUsePreview(start,{...doctor,activeSlot:'medical'},patient).allowed,false);assert.deepEqual(cordobaClinicDefenseOrder(start,doctor),{type:'stance',unitId:doctor.id,stance:'prone'});
 const move=policy(start,doctor);assert.equal(move?.type,'move');const view=publicRouteView(start,doctor),route=getReachable(view,doctor,{stopAt:p=>sameCell(p,move)})[0],quote=paidHospitalRoofWalkPreview(view,doctor,route);
 assert.ok(route.cost>0&&route.cost<=24&&route.path.length<=3);assert.ok(route.path.every(p=>(p.kind===undefined||p.kind==='move')&&sameSurface(p,doctor)&&(surfaceAt(view,p)?.cover??0)>=(surfaceAt(view,doctor)?.cover??0)));assert.ok(quote);assert.ok(Math.hypot(move.x-target.x,move.y-target.y)>Math.hypot(doctor.x-target.x,doctor.y-target.y));
 const arrived=replayRescueRoofEscape(start,[move]),medic=actor(arrived);assert.equal(medic.ap,doctor.ap-route.cost);assert.equal(medic.energy,quote.actor.energy);assert.equal(medic.facing,quote.actor.facing);assert.equal(medic.stance,doctor.stance);assert.equal(medic.medkits,2);assert.deepEqual(spacePoint(medic),spacePoint(move));assert.equal(arrived.elapsedSeconds,quote.view.elapsedSeconds);
 const hand=policy(arrived,medic);assert.deepEqual(hand,{type:'weapon',unitId:medic.id,slot:'medical'});const held=replayRescueRoofEscape(arrived,[hand]),ready=actor(held),care=medicalUsePreview(held,ready,actor(held,'declared-patient'));assert.equal(care.allowed,true,care.reason);
 const aid=policy(held,ready);assert.deepEqual(aid,{type:'useItem',unitId:ready.id,targetId:'declared-patient'});const end=replayRescueRoofEscape(start,[move,hand,aid]);assert.equal(actor(end).ap,ready.ap-care.cost);assert.equal(actor(end).medkits,2-care.treatment.dressingsUsed);assert.ok(care.treatment.dressingsUsed>0);assert.equal(actor(end,'declared-patient').hp,care.treatment.hpAfter);assert.equal(actor(end,'declared-patient').bleeding,0);assert.ok(actor(end,'declared-patient').hp>=15);
 for(const u of start.units){const v=actor(end,u.id);assert.deepEqual(unitAmmunitionByType(v),unitAmmunitionByType(u));assert.deepEqual(v.inventory,u.inventory);if(u.id!=='declared-patient')for(const key of ['hp','bleeding','bandaged'])assert.equal(v[key],u[key]);if(u.id!=='roof-medic')assert.deepEqual(spacePoint(v),spacePoint(u));}
 assert.deepEqual(start,before);
});

test('actual adjacent finite aid and an immediately useful safe rifle shot precede the roof physician escape',()=>{
 const aidStart=rescueRoofPhysicianEscapeArena({adjacent:true}),aidBefore=structuredClone(aidStart),medic=aidStart.units.find(u=>u.id==='roof-medic'),aidPolicy=rescueCordobaDefenseController(aidStart),hand=aidPolicy(aidStart,medic);assert.deepEqual(hand,{type:'weapon',unitId:medic.id,slot:'medical'});
 const held=replayRescueRoofEscape(aidStart,[hand]),ready=held.units.find(u=>u.id===medic.id),patient=held.units.find(u=>u.id==='declared-patient'),quote=medicalUsePreview(held,ready,patient),aid=aidPolicy(held,ready);assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:ready.id,targetId:patient.id});const treated=replayRescueRoofEscape(aidStart,[hand,aid]);assert.equal(treated.units.find(u=>u.id===ready.id).medkits,2-quote.treatment.dressingsUsed);assert.deepEqual(spacePoint(treated.units.find(u=>u.id===ready.id)),spacePoint(medic));assert.deepEqual(aidStart,aidBefore);
 const shotStart=rescueRoofPhysicianEscapeArena({armed:true}),shotBefore=structuredClone(shotStart),shooter=shotStart.units.find(u=>u.id==='roof-medic'),fire=rescueCordobaDefenseController(shotStart)(shotStart,shooter);assert.equal(fire?.type,'fire');const target=shotStart.units.find(u=>u.id===fire.targetId),option=firearmShotOptions(shotStart,shooter,target,fire.aim).find(p=>p.aim===fire.aim&&p.hitLocation===fire.hitLocation);assert.ok(option.chance>=25&&knownRouteBystanderShotSafety(shotStart,shooter,target)(option));
 const fired=replayRescueRoofEscape(shotStart,[fire]),after=fired.units.find(u=>u.id===shooter.id);assert.equal(after.loaded,0);assert.equal(after.ammo,shooter.ammo);assert.equal(after.ap,shooter.ap-actionCosts(shotStart,shooter,target).fire-fire.aim*actionCosts(shotStart,shooter,target).aim);assert.equal(after.medkits,2);assert.deepEqual(spacePoint(after),spacePoint(shooter));assert.deepEqual(shotStart,shotBefore);
});

test('blocked equal-cover space, lower-cover routes and actually exhausted AP cannot grant a physician escape',()=>{
 for(const variant of ['blocked','lowCover','paidAP']){
  const start=rescueRoofPhysicianEscapeArena({[variant]:true}),before=structuredClone(start),policy=rescueCordobaDefenseController(start),tape=[];let battle=start;
  if(variant==='paidAP')for(let count=0;battle.units.find(u=>u.id==='roof-medic').ap>0&&count<128;count++){
   const u=battle.units.find(v=>v.id==='roof-medic'),points=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].map(([x,y])=>({x:u.x+x,y:u.y+y})),paid=points.map(p=>({point:p,quote:lookPreview(battle,u,p)})).filter(p=>p.quote.valid&&p.quote.pa>0).sort((a,b)=>a.quote.pa-b.quote.pa)[0];assert.ok(paid);const action={type:'look',unitId:u.id,...paid.point},next=actBattle(battle,action);assert.equal(next.lastError,null);assert.equal(next.units.find(v=>v.id===u.id).ap,u.ap-paid.quote.pa);battle=next;tape.push(action);
  }
  const u=battle.units.find(v=>v.id==='roof-medic');if(variant==='paidAP'){assert.ok(tape.length>0);assert.equal(u.ap,0);assert.deepEqual(replayRescueRoofEscape(start,tape),battle);}
  const untouched=structuredClone(battle),action=policy(battle,u);assert.notEqual(action?.type,'move',variant);assert.deepEqual(action,cordobaClinicDefenseOrder(battle,u));assert.deepEqual(battle,untouched);assert.deepEqual(start,before);
 }
});

test('distant contacts, unsupplied or nonmedical roof people and actual charged gun contact keep the existing clinic policy',()=>{
 for(const declaration of [{distant:true},{doctor:{medkits:0}},{doctor:{medical:0}},{gunContact:true}]){
  const start=rescueRoofPhysicianEscapeArena(declaration),before=structuredClone(start),u=start.units.find(v=>v.id==='roof-medic'),ordinary=cordobaClinicDefenseOrder(start,u),policy=rescueCordobaDefenseController(start);
  if(declaration.distant){assert.deepEqual(ordinary,{type:'stance',unitId:u.id,stance:'prone'});assert.ok(start.units.filter(v=>v.side==='enemy').every(v=>Math.hypot(v.x-u.x,v.y-u.y)>2.5));}
  if(declaration.gunContact){const gun=start.artillery[0],gunner=start.units.find(v=>v.id==='actual-gunner'),crew=artilleryCrewPlan(start,gunner,gun,0);assert.equal(crew.reason,null);assert.ok(crew.crew.includes(u.id));}
  assert.deepEqual(policy(start,u),ordinary);assert.deepEqual(start,before);
 }
});
