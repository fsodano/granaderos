import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';

test('paid local squads reach distinct authored roof cells and retain finite gear and saved resident positions',()=>{
 // This declared clinic scenario tests preparation; campaign victories are
 // covered by the full native opening and funded recovery routes.
 const content=fundedRouteContent();content.headquarters='cordoba';content.startingTerritory.cordoba={owner:'patriot',loyalty:65};
 let c=initialCampaign(42,content);const ids=[110,114,115,123];
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);};
 for(const id of ids)order({type:'recruitCivic',id,term:'week'});
 for(let h=0;h<24&&c.hiringArrivals.length;h++)order({type:'wait',hours:1});assert.equal(c.hiringArrivals.length,0);
 for(const members of [[110,114],[115,123]])order({type:'createSquad',name:'Guardia del hospital',ids:members,sector:'cordoba'});
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 order({type:'unloadAmmunition',operativeId:110});assert.equal(c.operativeState[110].carriedLoaded,0);
 const before=structuredClone(c),events=[],staged=stageRouteRoofDefenders(c,ids,{report:event=>events.push(event)});
 assert.deepEqual(c,before);assert.deepEqual(stageRouteRoofDefenders(before,ids),staged);
 assert.equal(staged.resources.treasury,before.resources.treasury);assert.deepEqual(staged.contracts,before.contracts);
 assert.equal(staged.activeSquadId,before.activeSquadId);assert.deepEqual(staged.squads,before.squads);
 const evidence=events.find(event=>event.event==='routeRoofDefenders');assert.ok(evidence.elapsedSeconds>0);assert.ok(evidence.actions.some(action=>action.type==='move'));
 assert.equal(new Set(evidence.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,ids.length);
 for(const id of ids){const old=before.operativeState[id],next=staged.operativeState[id];assert.equal(next.hp,old.hp);assert.equal(next.alive,old.alive);assert.equal(next.medkits,old.medkits);assert.equal(next.carriedAmmo,old.carriedAmmo);assert.equal(next.assignment,'rest');}
 assert.equal(staged.operativeState[110].carriedLoaded,1,'ordinary staging reloads the existing unloaded cartridge without changing total custody');
 const restored=decodeSave(encodeSave(staged)).campaign;assert.deepEqual(restored,staged);
 for(const squad of restored.squads.filter(squad=>squad.members.some(id=>ids.includes(id)))){
  let visit=dispatchCampaign(restored,{type:'selectSquad',id:squad.id});
  for(const operativeId of squad.members)visit=dispatchCampaign(visit,{type:'assignCare',operativeId,assignment:'active'});
  visit=dispatchCampaign(visit,{type:'visitSector'});assert.equal(visit.lastError,null);
  const battle=enterSector(visit.pendingBattle,visit.sectorStates.cordoba);
  for(const id of squad.members){const unit=battle.units.find(unit=>unit.id===String(id)),point=evidence.positions.find(point=>point.id===id);assert.deepEqual({x:unit.x,y:unit.y,tacticalLevel:unit.tacticalLevel},{x:point.x,y:point.y,tacticalLevel:point.tacticalLevel});}
 }
});


// These independent declarations keep the original staging control above
// byte-exact. Every body, finite load and obstruction exists before compile.
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {rosterFor} from '../game/campaign.js';
import {weaponSpecification} from '../game/weapon-definition.js';
import {contractQuote} from '../game/contracts.js';
import {getReachable,actBattle,presentedActBattle} from '../game/tactical.js';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {syncBattleTime} from '../game/time.js';
import {carriedAmmunition,unitAmmunitionByType} from '../game/campaign-ammunition.js';

const supportClock=c=>c.hour*3600+(c.secondOfHour??0);
function retainedSupportSetup({rear='open'}={}){
 const d=scaffoldDocuments('retained-roof-protected-support'),base=d.content.characters[0],stock=weaponSpecification({weapon:1801});
 d.content.headquarters='watch-post';d.content.startingTerritory['watch-post']={owner:'patriot',loyalty:65};d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=12;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});d.world.expansion.rural=[];d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 d.content.weapons.push({id:'support-stock-musket',template:1801,name:stock.name,damage:stock.damage,fireAP:stock.fireAP,aimAP:stock.aimAP,reloadAP:stock.reloadAP,range:stock.range,readyAP:stock.readyAP,capacity:stock.capacity,weight:stock.weight,price:stock.price,art:base.portrait});
 d.content.characters=['retained-rifle','supplied-physician'].map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:i?null:'support-stock-musket',attributes:{...base.attributes,maxHp:80,strength:100,agility:80,dexterity:80,leadership:90,medical:i?90:0},startingCondition:{hp:80,bleeding:0,bandaged:0,energy:100,fatigue:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i?2:0}}));
 d.maps['watch-post'].upperSurfaces=Array.from({length:24},(_,i)=>{const x=8+i%6,y=5+Math.floor(i/6);return {id:'support-roof-'+i,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:rear==='blocked'&&x===11&&y===8,cover:x===11&&(y===7||rear==='lower-cover'&&y===8)?20:30};});
 d.maps['watch-post'].climbLinks=[{id:'support-north-access',kind:'climb',from:{x:7,y:6,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}},{id:'support-west-access',kind:'climb',from:{x:7,y:8,tacticalLevel:0},to:{x:8,y:8,tacticalLevel:1}}];
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const people=rosterFor(c),guard=people.find(op=>op.contentId==='retained-rifle').id,physician=people.find(op=>op.contentId==='supplied-physician').id;
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);};
 for(const id of [guard,physician]){const cash=c.resources.treasury,quote=contractQuote(c,people.find(op=>op.id===id),'week');order({type:'recruitCivic',id,term:'week'});assert.equal(cash-c.resources.treasury,quote.total);}
 assert.equal(c.hiringArrivals.length,0);order({type:'createSquad',name:'Apoyo real de la azotea',ids:[guard,physician],sector:'watch-post'});order({type:'assignCare',operativeId:physician,assignment:'rest'});
 c=stageRouteRoofDefenders(c,[guard]);assert.deepEqual(c.operativeState[guard].residentPosition,spacePoint(c.sectorStates['watch-post'].upperSurfaces.find(point=>point.id==='support-roof-20')));assert.equal(c.operativeState[guard].assignment,'active');assert.equal(c.operativeState[physician].medkits,2);assert.deepEqual(d,declaration);
 return {campaign:c,guard,physician,declaration};
}

test('a supplied physician pays a protected rear roof post around the unchanged retained rifle instead of a cheaper public approach',()=>{
 const s=retainedSupportSetup(),start=s.campaign,before=structuredClone(start),guardPost={id:s.guard,...start.operativeState[s.guard].residentPosition},options={bounded:{deadlineSeconds:supportClock(start)+3600},reservedPositions:[guardPost],physicianId:s.physician,retainedRoofRifleId:s.guard};
 const result=stageRouteRoofDefenders(start,[s.physician],options),c=result.campaign,r=result.receipt,visit=r.visits[0],initial=visit.initial,actor=initial.units.find(u=>u.id===String(s.physician)),post=r.physicianPost;
 assert.deepEqual(start,before);assert.deepEqual(post,{id:s.physician,x:guardPost.x+1,y:guardPost.y,tacticalLevel:1,neighbors:[s.guard]});assert.equal(initial.mode,'exploration');assert.ok(initial.units.some(u=>u.id===String(s.guard)&&sameCell(u,guardPost)),'The retained body remains in actual Native collision.');
 const accesses=initial.climbLinks.map(link=>link.to).filter(point=>sameSurface(point,guardPost)),margin=point=>Math.min(...accesses.map(access=>Math.hypot(point.x-access.x,point.y-access.y)-Math.hypot(guardPost.x-access.x,guardPost.y-access.y)));
 assert.equal(accesses.length,2);assert.ok(margin(post)>0);assert.ok(surfaceAt(initial,post).cover>=surfaceAt(initial,guardPost).cover);
 const routes=getReachable(initial,actor),chosen=routes.find(point=>sameCell(point,post));assert.ok(chosen);assert.ok(chosen.path.every(point=>!sameCell(point,guardPost)));
 assert.ok(routes.some(point=>sameSurface(point,guardPost)&&Math.hypot(point.x-guardPost.x,point.y-guardPost.y)<=1.5&&surfaceAt(initial,point).cover>=surfaceAt(initial,guardPost).cover&&margin(point)<0&&point.cost<chosen.cost),'An actual cheaper front-side quote must not win protected staging.');
 assert.ok(r.steps>0&&r.steps<=64);assert.ok(r.orders.length<=r.maximumOrders&&r.maximumOrders<=600);assert.ok(r.endSeconds>r.startSeconds&&r.endSeconds<=r.until&&r.until<=r.startSeconds+3600);assert.deepEqual(r.ids,[s.physician]);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);
 const load=state=>carriedAmmunition(rosterFor(state).find(op=>op.id===s.guard),state.operativeState[s.guard]);assert.deepEqual(unitAmmunitionByType(load(c)),unitAmmunitionByType(load(start)));assert.deepEqual(load(c).weapon,load(start).weapon);assert.equal(load(c).condition,load(start).condition);assert.deepEqual(c.operativeState[s.guard].residentPosition,start.operativeState[s.guard].residentPosition);
 for(const id of [s.guard,s.physician])for(const key of ['hp','alive','bleeding','bandaged','medkits','assignment'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key],`${id}/${key}`);
 const battleOrders=r.orders.filter(row=>row.kind==='battle');assert.ok(battleOrders.some(row=>row.action.type==='climb'));assert.ok(battleOrders.some(row=>row.action.type==='move'));assert.ok(battleOrders.every(row=>row.action.unitId===String(s.physician)));
 let pair={campaign:visit.initialCampaign,battle:visit.initial};const original=structuredClone(pair);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),pair);
 for(const {action}of battleOrders){const next=actBattle(pair.battle,action);assert.equal(next.lastError,null,JSON.stringify(action));assert.deepEqual(presentedActBattle(pair.battle,action).state,next);const synced=syncBattleTime(pair.campaign,next);assert.equal(synced.error,null);pair={campaign:synced.campaign,battle:synced.battle};}
 assert.deepEqual(pair.battle,visit.returned);assert.deepEqual({campaign:visit.initialCampaign,battle:visit.initial},original);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);assert.deepEqual(stageRouteRoofDefenders(decodeSave(encodeSave(start)).campaign,[s.physician],options),result);
});

test('retained physician staging refuses blocked or lower-cover rear posts without falling back toward either public access',()=>{
 for(const rear of ['blocked','lower-cover']){
  const s=retainedSupportSetup({rear}),start=s.campaign,before=structuredClone(start),guardPost={id:s.guard,...start.operativeState[s.guard].residentPosition};let failure;
  try{stageRouteRoofDefenders(start,[s.physician],{bounded:{deadlineSeconds:supportClock(start)+3600},reservedPositions:[guardPost],physicianId:s.physician,retainedRoofRifleId:s.guard});}catch(error){failure=error;}
  assert.ok(failure);assert.match(failure.message,/currently reachable protected roof/);assert.deepEqual(start,before);const r=failure.routeRoofDefenders;assert.ok(r);assert.equal(r.steps,0);assert.deepEqual(r.positions,[]);assert.ok(r.orders.filter(row=>row.kind==='battle').every(row=>row.action.type==='movement'&&row.action.unitId===String(s.physician)));assert.ok(r.endSeconds<=r.until&&r.until<=r.startSeconds+3600);assert.ok(r.orders.length<=r.maximumOrders&&r.maximumOrders<=600);
  assert.deepEqual(failure.campaign.operativeState[s.guard].residentPosition,start.operativeState[s.guard].residentPosition);assert.equal(failure.campaign.operativeState[s.guard].medkits,start.operativeState[s.guard].medkits);assert.equal(failure.campaign.operativeState[s.physician].medkits,2);assert.equal(failure.campaign.resources.treasury,start.resources.treasury);
  // Raw refusal only. No query, codec, replay or continuation of this prefix.
 }
});
