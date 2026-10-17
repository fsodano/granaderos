import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryContact,artilleryCrewPlan,artilleryCosts,artilleryReloadPreview,stanceCost,exitPreview,teamCanSee,getReachable,lookPreview,actionCosts,firearmShotOptions,transferPreview,medicalUsePreview,hasLineOfSight} from '../game/tactical.js';
import {beginSectorDeployment,sectorDeploymentModel} from '../game/sector-deployment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {mountainPassBatteryController} from './fresh-cuyo-fixture.mjs';
import {heavyContactCrewController} from './stable-crew-driver.mjs';
import {sameCell,sameSurface,spacePoint,surfaceAt} from '../game/tactical-space.js';
import {publicRouteView} from './route-infantry-progress.mjs';

const flat=()=>Array.from({length:40*24},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
const exit={id:'arena:return',edge:'E',destination:'rear',entryEdge:'W',entryAnchor:{x:0,y:7}};
// These are declared portable formations, not an earned Uspallata force.
// Every deployment, separation, departure, reload and dressing uses real orders.
function arena({deployment=false,wounded=false,hidden=false,emptyGuns=false,crewSlot='primary',crewLoaded=1,narrowArrival=false}={}){
 const positions={founder:[39,23],med:[39,13],c1:[39,11],c2:[38,12],c3:[39,12],c4:[39,8],s1:[37,13],s2:[38,14]};
 if(narrowArrival)Object.keys(positions).forEach((id,i)=>{positions[id]=[39,8+i];});
 const ids=Object.keys(positions),squad=ids.map((id,i)=>({id,name:id,x:positions[id][0],y:positions[id][1],facing:6,
  weapon:1800,loaded:1,ammo:11,medkits:id==='med'?3:0,medical:id==='med'?90:20,marksmanship:id.startsWith('c')?40+Number(id[1])*5:90,
  stance:id==='med'?'prone':deployment?'standing':'crouched',...(wounded&&id==='c2'?{hp:30,maxHp:100,bleeding:3}:{}),
  ...(id==='c1'?{activeSlot:crewSlot,loaded:crewLoaded}:{}),
  ...(deployment?{entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}}:{}),energy:100,fatigue:0,morale:90,inventory:{},strength:90}));
 const tiles=flat().map(t=>narrowArrival&&t.x===39&&(t.y<8||t.y>15)?{...t,type:'stone',material:'stone',blocked:true,cover:40}:t);
 const b=createBattle(squad,{id:'declared-mountain',width:40,height:24,tiles,exits:[exit],seed:45,
  exploration:deployment,deferContact:deployment,
  enemies:[{id:'target',x:deployment||hidden?2:24,y:deployment||hidden?2:11,weapon:0,loaded:0,ammo:0,patrol:false,overwatch:false,hp:500,maxHp:500}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:38,y:11,loaded:!emptyGuns,ammo:emptyGuns?0:2},{id:'small',type:'swivel',side:'player',x:38,y:deployment?10:8,loaded:!emptyGuns,ammo:emptyGuns?0:2}],
 });
 if(deployment)assert.equal(beginSectorDeployment(b,{squad}),true);return b;
}
const own=b=>b.units.filter(u=>u.side==='player'),unit=(b,id)=>b.units.find(u=>u.id===id),piece=(b,id)=>b.artillery.find(g=>g.id===id);
const gear=u=>Object.fromEntries(['hp','maxHp','bleeding','weapon','blade','loaded','ammo','ammoMusket','ammoPistol','medkits','condition','inventory'].map(k=>[k,u[k]]));
function replay(start,orders){
 let ordinary=structuredClone(start),presented=structuredClone(start),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){
  ordinary=actBattle(ordinary,action);assert.equal(ordinary.lastError,null,JSON.stringify(action));
  presented=presentedActBattle(presented,action).state;assert.deepEqual(presented,ordinary);
  restored=actBattle(restored,action);assert.equal(restored.lastError,null);restored=validateBattleSnapshot(JSON.parse(JSON.stringify(restored)));assert.deepEqual(restored,ordinary);
 }
 return ordinary;
}
const factory=(b,report=()=>{})=>createdUspallataBattery(b,{reserveIds:['founder'],reserveDestination:'rear',report});

test('native public deployment retains all eight arrivals and gives the real 3+1 crews, doctor and reserve distinct cells',()=>{
 const start=arena({deployment:true}),before=structuredClone(start),events=[],helper=factory(start,e=>events.push(e)),after=helper.deploy(start);
 const orders=events.filter(e=>e.event==='uspallataDeploymentOrder').map(e=>e.action);assert.equal(orders.length,9);
 assert.deepEqual(replay(start,orders),after);assert.deepEqual(start,before);assert.deepEqual(after.artillery,start.artillery);
 assert.deepEqual(helper.roles,{reserves:['founder'],physicianId:'med',crews:[{gunId:'heavy',ids:['c1','c2','c3']},{gunId:'small',ids:['c4']}],screens:['s1','s2']});
 assert.equal(new Set(own(after).map(u=>`${u.x},${u.y}`)).size,8);
 for(const old of own(start)){assert.deepEqual(gear(unit(after,old.id)),gear(old));assert.equal(unit(after,old.id).energy,old.energy);}
 assert.equal(after.elapsedSeconds,0);assert.equal(after.seed,start.seed);
 assert.equal(exitPreview(after,{unitIds:['founder'],exitId:exit.id}).available,true);
 for(const gun of after.artillery)assert.equal(artilleryContact(after,unit(after,'med'),gun),false,'the doctor is not an implicit cannon helper');
 const altered=arena({deployment:true});Object.assign(unit(altered,'target'),{x:4,y:3,name:'Unseen alternative',ammoMusket:99});
 const hiddenEvents=[];factory(altered,e=>hiddenEvents.push(e)).deploy(altered);
 assert.deepEqual(hiddenEvents.filter(e=>e.action).map(e=>e.action),orders,'hidden opposing details cannot choose our roles or preferred arrival cells');
});

test('eight actual arrivals without a departing reserve fit eight legal border cells and pay for an alternative swivel separation',()=>{
 const start=arena({deployment:true,narrowArrival:true}),before=structuredClone(start),model=sectorDeploymentModel(start),events=[],helper=createdUspallataBattery(start,{report:event=>events.push(event)});
 assert.equal(model.entryCells.E.length,8);assert.deepEqual(model.entryCells.E.map(p=>p.y),[8,9,10,11,12,13,14,15]);
 assert.deepEqual(helper.roles.reserves,[]);assert.equal(helper.roles.screens.length,3);
 let b=helper.deploy(start);const orders=events.filter(e=>e.event==='uspallataDeploymentOrder').map(e=>e.action);
 assert.equal(orders.length,9);assert.deepEqual(replay(start,orders),b);assert.deepEqual(start,before);
 assert.deepEqual(b.artillery,start.artillery);assert.equal(b.elapsedSeconds,start.elapsedSeconds);assert.equal(b.deploymentComplete,true);
 assert.equal(new Set(own(b).map(u=>`${u.x},${u.y}`)).size,8);
 for(const actor of own(b))assert.ok(model.entryCells.E.some(p=>p.x===actor.x&&p.y===actor.y));
 for(const id of helper.roles.screens)for(const gun of b.artillery)assert.equal(artilleryContact(b,unit(b,id),gun),false,'An infantry screen never supplies an implicit cannon crew.');
 const smallRole=helper.roles.crews.find(crew=>crew.gunId==='small'),initialGuns=structuredClone(b.artillery),initialUnits=structuredClone(own(b));
 let paid=0;
 for(let step=0;Math.hypot(piece(b,'small').x-piece(b,'heavy').x,piece(b,'small').y-piece(b,'heavy').y)<3&&step<4;step++){
  const actor=unit(b,smallRole.ids[0]),small=piece(b,'small'),action=helper.controller(b,actor);
  assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'small');
  const cost=artilleryCosts(b,actor,small).move,plan=artilleryCrewPlan(b,actor,small,cost);assert.equal(plan.reason,null);assert.deepEqual(plan.crew,smallRole.ids);
  if(step===0)assert.equal(action.x,small.x-1,'The occupied preferred north lane cannot be used; the existing public routine chooses an open west step.');
  const elapsed=b.elapsedSeconds,ap=actor.ap;orders.push(action);b=replay(b,[action]);paid++;
  assert.equal(b.elapsedSeconds-elapsed,Math.max(1,Math.ceil(cost*.06)));assert.equal(unit(b,actor.id).ap,ap,'Native exploration charges clock instead of invented AP.');
 }
 assert.ok(paid>0&&paid<=4);assert.ok(Math.hypot(piece(b,'small').x-piece(b,'heavy').x,piece(b,'small').y-piece(b,'heavy').y)>=3);
 assert.deepEqual(piece(b,'heavy'),initialGuns.find(g=>g.id==='heavy'));
 assert.deepEqual({...piece(b,'small'),x:initialGuns[1].x,y:initialGuns[1].y},initialGuns.find(g=>g.id==='small'));
 for(const actor of initialUnits){assert.deepEqual(gear(unit(b,actor.id)),gear(actor));assert.equal(unit(b,actor.id).energy,actor.energy);}
 assert.deepEqual(replay(start,orders),b);assert.deepEqual(start,before);
 const hidden=arena({deployment:true,narrowArrival:true});Object.assign(unit(hidden,'target'),{x:3,y:2,name:'Otra fuerza no vista',ammo:99});
 const otherEvents=[];createdUspallataBattery(hidden,{report:event=>otherEvents.push(event)}).deploy(hidden);
 assert.deepEqual(otherEvents.filter(e=>e.event==='uspallataDeploymentOrder').map(e=>e.action),orders.filter(a=>a.type==='placeDeployment'||a.type==='confirmDeployment'));
});

test('required founder pays the real exit before the swivel separates, with finite property and complete saved replay',()=>{
 const initial=arena({deployment:true}),helper=factory(initial),start=helper.deploy(initial),orders=[];let b=start;
 for(const member of own(b).filter(u=>u.id!=='founder'))assert.equal(helper.controller(b,member),null,'other work waits for the actual reserve crossing');
 const reserve=unit(b,'founder'),departure=helper.controller(b,reserve);assert.deepEqual(departure,{type:'exit',unitIds:['founder'],exitId:exit.id});orders.push(departure);b=replay(b,[departure]);
 assert.equal(unit(b,'founder').departure.destination,'rear');assert.equal(b.elapsedSeconds,3);assert.ok(unit(b,'founder').energy<reserve.energy);assert.deepEqual(gear(unit(b,'founder')),gear(reserve));
 const heavyBefore=structuredClone(piece(b,'heavy')),operatorBefore=unit(b,'c4');
 for(let step=0;step<2;step++){
  const operator=unit(b,'c4'),action=helper.controller(b,operator);assert.equal(action?.type,'artilleryMove');assert.equal(action.artilleryId,'small');
  const cost=artilleryCosts(b,operator,piece(b,'small')).move,plan=artilleryCrewPlan(b,operator,piece(b,'small'),cost);assert.equal(cost,10);assert.deepEqual(plan.crew,['c4']);assert.equal(plan.reason,null);
  const seconds=b.elapsedSeconds;orders.push(action);b=replay(b,[action]);assert.equal(b.elapsedSeconds-seconds,Math.max(1,Math.ceil(cost*.06)));
 }
 assert.deepEqual(piece(b,'heavy'),heavyBefore);assert.equal(Math.hypot(piece(b,'heavy').x-piece(b,'small').x,piece(b,'heavy').y-piece(b,'small').y),3);
 assert.deepEqual(gear(unit(b,'c4')),gear(operatorBefore));assert.equal(unit(b,'c4').energy,operatorBefore.energy,'native artillery work charges AP or real exploration time, not an invented walking energy debit');
 for(const crew of helper.roles.crews){const leader=unit(b,crew.ids[0]),plan=artilleryCrewPlan(b,leader,piece(b,crew.gunId),0);assert.equal(plan.reason,null);assert.deepEqual(new Set(plan.crew),new Set(crew.ids));}
 assert.deepEqual(replay(start,orders),b);assert.equal(own(b).length,8);assert.deepEqual(b.artillery.map(g=>Number(g.loaded)+g.ammo),[3,3]);
});

test('a coherent heavy crew pays native fire and partial reload without borrowing doctor or departed reserve',()=>{
 const start=arena(),helper=factory(start),orders=[];let b=start;
 const departure=helper.controller(b,unit(b,'founder'));assert.equal(departure?.type,'exit');orders.push(departure);b=replay(b,[departure]);
 const doctor=gear(unit(b,'med')),reserve=gear(unit(b,'founder')),leader=unit(b,'c1'),gun=piece(b,'heavy'),action=helper.controller(b,leader);
 assert.equal(action?.type,'artillery');assert.equal(action.artilleryId,'heavy');assert.equal(teamCanSee(b,'player',unit(b,'target')),true);
 const cost=artilleryCosts(b,leader,gun).fire,plan=artilleryCrewPlan(b,leader,gun,cost),before=structuredClone(b);assert.deepEqual(new Set(plan.crew),new Set(['c1','c2','c3']));
 orders.push(action);b=replay(b,[action]);assert.equal(Number(piece(b,'heavy').loaded)+piece(b,'heavy').ammo,2);
 for(const id of plan.crew)assert.equal(unit(b,id).ap,unit(before,id).ap-cost);
 assert.deepEqual(gear(unit(b,'med')),doctor);assert.deepEqual(gear(unit(b,'founder')),reserve);
 const reload=helper.controller(b,unit(b,'c1'));assert.equal(reload?.type,'artilleryReload');
 const preview=artilleryReloadPreview(b,unit(b,'c1'),piece(b,'heavy'));assert.equal(preview.valid,true);assert.deepEqual(new Set(preview.crew),new Set(['c1','c2','c3']));
 const preReload=structuredClone(b);orders.push(reload);b=replay(b,[reload]);
 for(const id of preview.crew)assert.equal(unit(b,id).ap,unit(preReload,id).ap-preview.pa);
 assert.equal(Number(piece(b,'heavy').loaded)+piece(b,'heavy').ammo,2,'reload moves one real charge, never creates it');
 assert.deepEqual(gear(unit(b,'med')),doctor);assert.deepEqual(gear(unit(b,'founder')),reserve);assert.deepEqual(replay(start,orders),b);
});

test('adjacent bleeding care keeps native medical switch and one finite dressing ahead of cannon work',()=>{
 const start=arena({wounded:true}),helper=factory(start),before=structuredClone(start),doctor=unit(start,'med'),action=helper.controller(start,doctor);
 assert.deepEqual(action,{type:'weapon',unitId:'med',slot:'medical'});let b=replay(start,[action]);
 const aid=helper.controller(b,unit(b,'med'));assert.equal(aid?.type,'useItem');assert.equal(unit(b,'med').activeSlot,'medical');assert.equal(aid.targetId,'c2');
 const kits=own(b).reduce((n,u)=>n+u.medkits,0),patient=structuredClone(unit(b,'c2'));b=replay(b,[aid]);assert.equal(own(b).reduce((n,u)=>n+u.medkits,0),kits-1);
 assert.equal(unit(b,'c2').hp,patient.hp,'ordinary dressing stops bleeding without granting full clinical healing');assert.ok(unit(b,'c2').bleeding<patient.bleeding);assert.ok(unit(b,'c2').bandaged>patient.bandaged);assert.deepEqual(b.artillery,start.artillery);
 assert.deepEqual(replay(start,[action,aid]),b);assert.deepEqual(start,before);
});

test('spent cannon crew keeps its real carried-primary activation and finite personal reload',()=>{
 for(const setup of [{crewSlot:'blade',crewLoaded:1},{crewSlot:'primary',crewLoaded:0}]){
  const start=arena({emptyGuns:true,...setup}),before=structuredClone(start),helper=factory(start);
  let b=replay(start,[helper.controller(start,unit(start,'founder'))]);const member=unit(b,'c1'),action=helper.controller(b,member);
  assert.equal(action?.type,setup.crewLoaded?'weapon':'reload');if(setup.crewLoaded)assert.equal(action.slot,'primary');
  const after=replay(b,[action]);assert.ok(unit(after,'c1').ap<member.ap);assert.deepEqual(after.artillery,b.artillery);
  if(setup.crewLoaded)assert.equal(unit(after,'c1').activeSlot,'primary');
  else {assert.ok(unit(after,'c1').loaded>member.loaded||unit(after,'c1').reloadProgress>0);assert.deepEqual(unitAmmunitionByType(unit(after,'c1')),unitAmmunitionByType(member),'reload conserves the real carried family, including the loaded cartridge');}
  for(const key of ['hp','maxHp','bleeding','medkits'])assert.deepEqual(unit(after,'c1')[key],member[key]);
  if(setup.crewLoaded)assert.deepEqual(unit(after,'c1').inventory,member.inventory);
  else {
   assert.deepEqual(Object.keys(unit(after,'c1').inventory),Object.keys(member.inventory));
   for(const [key,row]of Object.entries(member.inventory)){
    const current=unit(after,'c1').inventory[key];assert.deepEqual({...current,count:row.count},row,'loading preserves the exact ammunition stack metadata');
    assert.equal(current.count,row.count-(row.ammoType==='musket_75'?unit(after,'c1').loaded-member.loaded:0),'one loose cartridge becomes one loaded cartridge');
   }
  }
  assert.deepEqual(replay(start,[helper.controller(start,unit(start,'founder')),action]),after);assert.deepEqual(start,before);
 }
});

test('lowering a crew posture is paid once and the old heavy-contact factory stays unchanged',()=>{
 const start=arena({hidden:true}),helper=factory(start),reserveExit=helper.controller(start,unit(start,'founder')),b=replay(start,[reserveExit]);
 const leader=unit(b,'c1'),action=helper.controller(b,leader);assert.equal(action,null,'a crouched contact crew cannot oscillate into prone with no useful shot');
 const defaultPolicy=mountainPassBatteryController(start),oldPolicy=heavyContactCrewController({holdCommand:false});
 for(const member of own(start))assert.deepEqual(defaultPolicy(start,member),oldPolicy(start,member),'the earned/default heavy-contact policy is not replaced');
 const hidden=structuredClone(b);Object.assign(unit(hidden,'target'),{x:3,y:3,ammoMusket:99});hidden.npcs=[{id:'unseen',name:'Unknown',x:2,y:4,hp:100}];
 assert.equal(teamCanSee(b,'player',unit(b,'target')),false);assert.equal(teamCanSee(hidden,'player',unit(hidden,'target')),false);
 for(const member of own(b))assert.deepEqual(helper.controller(hidden,unit(hidden,member.id)),helper.controller(b,member),'public planning cannot reveal hidden body positions');
 assert.deepEqual(b,replay(start,[reserveExit]));assert.ok(stanceCost(leader,'prone')>0);
});


// Independent pre-factory screen declarations. The old advancing selector is
// retained below only to expose its actual paid cover/AP tradeoff on this fresh
// arena. No failed route state, actor/AP grant or forced combat result is used.
function screenArena({coverLoss=false,pathGap=false,corner=false}={}){
 const positions={founder:[39,23],med:[39,13],c1:[39,11],c2:[38,12],c3:[39,12],c4:[39,8],s1:[pathGap?35:34,13],s2:[38,15]};
 const squad=Object.keys(positions).map(id=>({id,name:id,x:positions[id][0],y:positions[id][1],facing:6,weapon:1800,blade:1813,loaded:1,ammo:11,
  medkits:id==='med'?3:0,medical:id==='med'?90:20,marksmanship:id.startsWith('c')?40+Number(id[1])*5:90,stance:id==='med'?'prone':'crouched',
  agility:75,dexterity:75,strength:90,experienceLevel:4,energy:100,fatigue:0,morale:90,inventory:{}}));
 const tiles=flat().map(t=>{
  const wall=t.x===30&&t.y===13||corner&&t.x===33&&t.y===13;
  return wall?{...t,type:'stone',material:'stone',blocked:true,cover:40}:{...t,cover:coverLoss&&t.x===34&&t.y===13||pathGap&&t.y===13&&[35,33].includes(t.x)?15:0};
 });
 return createBattle(squad,{id:'declared-screen-fallback',width:40,height:24,tiles,exits:[exit],seed:45,
  enemies:[{id:'target',x:24,y:13,weapon:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:38,y:11,loaded:true,ammo:2},{id:'small',type:'swivel',side:'player',x:38,y:8,loaded:true,ammo:2}]});
}
function oldScreenAdvance(b,u){
 const view=publicRouteView(b,u),goal={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)},distance=(a,c)=>Math.hypot(a.x-c.x,a.y-c.y),cover=p=>surfaceAt(b,p)?.cover??0;
 const points=getReachable(view,u).filter(p=>p.cost>0&&p.cost<=Math.min(20,u.ap)&&sameSurface(p,u)&&p.path.every(step=>sameSurface(step,u))&&
  b.artillery.some(g=>g.side==='player'&&distance(p,g)<=6)&&distance(p,goal)<distance(u,goal)&&
  !view.units.some(v=>v.side!==u.side&&v.hp>=15&&!v.departure&&!v.unconscious&&!v.routed&&!v.surrendered&&distance(p,v)<=2.5));
 points.sort((a,c)=>distance(a,goal)-cover(a)*.2-(distance(c,goal)-cover(c)*.2)||a.cost-c.cost||a.y-c.y||a.x-c.x);
 return points[0]??null;
}
function screenWindow(declared,remaining){
 const helper=factory(declared),exitAction=helper.controller(declared,unit(declared,'founder'));assert.equal(exitAction.type,'exit');
 const orders=[exitAction];let b=replay(declared,orders),actor=unit(b,'s1');assert.ok(helper.roles.screens.includes(actor.id));assert.equal(actor.ap,100);
 const turnPoint=u=>({x:u.x+(u.facing===6?1:-1),y:u.y}),first=lookPreview(b,actor,turnPoint(actor));assert.equal(first.valid,true);assert.equal(first.pa,8);
 const looks=Math.floor((actor.ap-remaining)/first.pa);assert.ok(looks>=0&&looks<16);
 for(let n=0;n<looks;n++){actor=unit(b,'s1');const point=turnPoint(actor),quote=lookPreview(b,actor,point);assert.equal(quote.valid,true);assert.equal(quote.pa,first.pa);const action={type:'look',unitId:actor.id,...point};orders.push(action);b=replay(b,[action]);}
 if(unit(b,'s1').ap!==remaining){
  assert.equal(unit(b,'s1').ap-remaining,6);for(const stance of ['standing','crouched']){const actor=unit(b,'s1'),cost=stanceCost(actor,stance),action={type:'stance',unitId:actor.id,stance};assert.equal(cost,3);const ap=actor.ap;orders.push(action);b=replay(b,[action]);assert.equal(unit(b,'s1').ap,ap-cost);}
 }
 assert.equal(unit(b,'s1').ap,remaining);assert.equal(unit(b,'s1').activeSlot,'primary');assert.equal(unit(b,'s1').stance,'crouched');assert.equal(teamCanSee(b,'player',unit(b,'target')),true);
 assert.deepEqual(replay(declared,orders),b);return {battle:b,helper,orders};
}
function sameFiniteGoods(before,after){
 assert.deepEqual(after.artillery,before.artillery);for(const old of own(before)){const current=unit(after,old.id);assert.deepEqual(gear(current),gear(old));assert.deepEqual(unitAmmunitionByType(current),unitAmmunitionByType(old));}
}

test('a paid marginal screen holds its current cover instead of taking the former exposed bound',()=>{
 const declared=screenArena({coverLoss:true}),input=structuredClone(declared),{battle:start,helper}=screenWindow(declared,12),before=structuredClone(start),actor=unit(start,'s1'),former=oldScreenAdvance(start,actor);
 assert.ok(former?.cost>0);assert.equal(surfaceAt(start,actor).cover,15);assert.equal(surfaceAt(start,former).cover,0);
 const oldPaid=replay(start,[{type:'move',unitId:actor.id,...spacePoint(former)}]);assert.equal(unit(oldPaid,actor.id).ap,actor.ap-former.cost);assert.ok(sameCell(unit(oldPaid,actor.id),former));sameFiniteGoods(start,oldPaid);
 const action=helper.controller(start,actor);assert.notEqual(action?.type,'move');if(action){const after=replay(start,[action]);assert.ok(sameCell(unit(after,actor.id),actor));sameFiniteGoods(start,after);}
 assert.deepEqual(start,before);assert.deepEqual(declared,input);
});

test('an equal-cover endpoint cannot hide the former screen path through lower cover',()=>{
 const declared=screenArena({pathGap:true}),input=structuredClone(declared),helper=factory(declared),start=replay(declared,[helper.controller(declared,unit(declared,'founder'))]),before=structuredClone(start),actor=unit(start,'s1'),former=oldScreenAdvance(start,actor);
 assert.ok(former?.cost>0);assert.equal(surfaceAt(start,former).cover,surfaceAt(start,actor).cover);assert.ok(former.path.some(p=>surfaceAt(start,p).cover<surfaceAt(start,actor).cover));
 assert.notEqual(helper.controller(start,actor)?.type,'move');assert.deepEqual(start,before);assert.deepEqual(declared,input);
});

test('a loaded screen cannot spend its last Native unready base-fire AP on an optional equal-cover bound',()=>{
 const declared=screenArena(),input=structuredClone(declared),{battle:start,helper}=screenWindow(declared,12),before=structuredClone(start),actor=unit(start,'s1'),former=oldScreenAdvance(start,actor),reserve=actionCosts(start,{...actor,weaponReady:false}).fire;
 assert.ok(former?.cost>0);assert.ok(former.path.every(p=>surfaceAt(start,p).cover===surfaceAt(start,actor).cover));assert.equal(actor.ap,reserve);
 const oldPaid=replay(start,[{type:'move',unitId:actor.id,...spacePoint(former)}]);assert.ok(unit(oldPaid,actor.id).ap<reserve);sameFiniteGoods(start,oldPaid);
 assert.notEqual(helper.controller(start,actor)?.type,'move');assert.deepEqual(start,before);assert.deepEqual(declared,input);
});

test('a safe equal-cover screen bound pays Native movement and retains an actual useful finite follow-up',()=>{
 const declared=screenArena({corner:true}),input=structuredClone(declared),{battle:start,helper,orders}=screenWindow(declared,22),before=structuredClone(start),actor=unit(start,'s1'),action=helper.controller(start,actor);
 assert.equal(action?.type,'move');const point=getReachable(publicRouteView(start,actor),actor).find(p=>sameCell(p,action));assert.ok(point?.cost>0);assert.ok(point.path.every(p=>surfaceAt(start,p).cover>=surfaceAt(start,actor).cover));
 const reserve=actionCosts(start,{...actor,weaponReady:false}).fire;assert.ok(actor.ap-point.cost>=reserve);
 const moved=replay(start,[action]),current=unit(moved,actor.id);assert.equal(current.ap,actor.ap-point.cost);assert.ok(sameCell(current,point));sameFiniteGoods(start,moved);
 const shot=helper.controller(moved,current);assert.equal(shot?.type,'fire');const target=unit(moved,shot.targetId),cost=actionCosts(moved,current,target),option=firearmShotOptions(moved,current,target,shot.aim??0).find(o=>o.aim===(shot.aim??0)&&o.hitLocation===(shot.hitLocation??'torso'));
 assert.ok(option&&option.chance>=25&&!option.interveningFriendly);assert.ok(current.ap>=cost.fire+(shot.aim??0)*cost.aim);
 const final=replay(moved,[shot]);assert.equal(unit(final,actor.id).ap,current.ap-cost.fire-(shot.aim??0)*cost.aim);assert.ok(unit(final,actor.id).loaded<current.loaded||unit(final,actor.id).jammed);
 assert.deepEqual(final.artillery,moved.artillery);for(const old of own(moved).filter(u=>u.id!==actor.id))assert.deepEqual(gear(unit(final,old.id)),gear(old));
 assert.deepEqual(replay(declared,[...orders,action,shot]),final);assert.deepEqual(start,before);assert.deepEqual(declared,input);
});

// Independent fresh declarations. The unsupplied high-skill arrival is not
// patched into a saved battle, and the primary's fifteen pieces are finite.
function clinicalArena({deployment=false,exploration=false,wounded=false,relay=false,gap=false,blocked=false,primaryKits=15,shortCrew=false}={}){
 const positions=deployment?{primary:[39,13],clinical:[39,15],h1:[39,11],h2:[38,12],h3:[39,12],small:[39,8],s1:[37,13],s2:[38,14]}
  :{primary:[20,10],clinical:[relay?17:gap||blocked?18:19,10],h1:[26,9],h2:[25,10],h3:[26,11],small:[33,9],s1:[18,relay?10:wounded?10:12],s2:[relay?19:14,relay?10:12]};
 const squad=Object.entries(positions).map(([id,[x,y]])=>({id,name:id,x,y,facing:6,weapon:1800,blade:1813,loaded:1,ammo:11,
  hp:wounded&&id==='s1'?4:100,maxHp:100,bleeding:wounded&&id==='s1'?6:0,bandaged:0,
  medical:id==='primary'?65:id==='clinical'?91:shortCrew&&['h1','h2','h3'].includes(id)?70:20,
  medkits:id==='primary'?primaryKits:['h1','h2','h3','small'].includes(id)&&!shortCrew?2:0,
  marksmanship:id==='clinical'?5:id==='primary'?30:id==='h1'?40:id==='h2'?45:id==='h3'?50:id==='small'?55:90,
  activeSlot:'primary',stance:'standing',energy:100,fatigue:0,morale:90,strength:90,dexterity:90,experienceLevel:4,inventory:{},
  ...(deployment?{entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}}:{})}));
 const tiles=flat().map(tile=>{const wall=tile.x===10||deployment&&tile.x===39&&(tile.y<8||tile.y>15)||blocked&&tile.x===19;
  return wall?{...tile,type:'wall',blocked:true,blocksSight:true,cover:40}:{...tile,cover:deployment&&tile.x===39&&[14,15].includes(tile.y)||!deployment&&tile.y===10&&tile.x>=17&&tile.x<=20?40:0};});
 const options={id:'declared-clinical-reserve',width:40,height:24,hour:12,seed:45,tiles,exits:[exit],exploration:deployment||exploration,deferContact:deployment||exploration,
  enemies:[{id:'contact',name:'Contact',x:2,y:22,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:deployment?38:26,y:deployment?11:10,loaded:true,ammo:6},{id:'small-gun',type:'swivel',side:'player',x:deployment?38:33,y:10,loaded:true,ammo:6}]};
 const declaration=structuredClone({squad,options}),battle=createBattle(squad,options);assert.deepEqual({squad,options},declaration);
 if(deployment)assert.equal(beginSectorDeployment(battle,{squad}),true);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
const clinicalFactory=(battle,report=()=>{})=>createdUspallataBattery(battle,{coordinateClinicalReserve:true,report});
const fieldKits=battle=>own(battle).reduce((sum,actor)=>sum+actor.medkits,0);

test('opted-in clinical cover keeps the same eight and four nonclinical cannon contacts through real deployment',()=>{
 const start=clinicalArena({deployment:true}),before=structuredClone(start),events=[],helper=clinicalFactory(start,event=>events.push(event)),legacy=createdUspallataBattery(start);
 assert.equal(legacy.roles.clinicalReserveId,undefined);assert.ok(legacy.roles.crews.some(crew=>crew.ids.includes('clinical')),'The default does not silently change a qualified gunner role.');
 assert.equal(helper.roles.physicianId,'primary');assert.equal(helper.roles.clinicalReserveId,'clinical');assert.equal(helper.roles.crews.flatMap(crew=>crew.ids).length,4);assert.equal(helper.roles.screens.length,2);
 for(const crew of helper.roles.crews)for(const id of crew.ids)assert.ok(unit(start,id).medical<60);
 const after=helper.deploy(start),orders=events.filter(event=>event.event==='uspallataDeploymentOrder').map(event=>event.action),model=sectorDeploymentModel(start);
 assert.equal(own(after).length,8);assert.equal(new Set(own(after).map(actor=>`${actor.x},${actor.y}`)).size,8);assert.deepEqual(after.artillery,start.artillery);assert.equal(after.elapsedSeconds,start.elapsedSeconds);
 for(const actor of own(after)){assert.ok(model.entryCells.E.some(point=>sameCell(point,actor)));assert.deepEqual(gear(actor),gear(unit(start,actor.id)));}
 for(const id of ['primary','clinical']){assert.equal(surfaceAt(after,unit(after,id)).cover,40);for(const gun of after.artillery)assert.equal(artilleryContact(after,unit(after,id),gun),false);}
 assert.ok(Math.hypot(unit(after,'primary').x-unit(after,'clinical').x,unit(after,'primary').y-unit(after,'clinical').y)<=1.5);
 assert.deepEqual(replay(start,orders),after);assert.deepEqual(start,before);
});

test('a real finite handover funds adjacent clinical aid with exact combat and exploration costs',()=>{
 for(const exploration of [false,true]){
  const start=clinicalArena({wounded:true,exploration}),before=structuredClone(start),helper=clinicalFactory(start),primary=unit(start,'primary'),reserve=unit(start,'clinical');
  assert.equal(fieldKits(start),23);assert.equal(primary.medkits,15);assert.equal(reserve.medkits,0);const action=helper.controller(start,primary),quote=transferPreview(start,primary,reserve,'medkits',2);
  assert.equal(quote.valid,true);assert.equal(quote.kind,'give');assert.equal(quote.chance,100);assert.deepEqual(action,{type:'transfer',unitId:'primary',targetId:'clinical',item:'medkits',count:2,transferKind:'give',transferRoute:['primary','clinical']});
  const handed=replay(start,[action]);assert.equal(fieldKits(handed),23);assert.equal(unit(handed,'primary').medkits,13);assert.equal(unit(handed,'clinical').medkits,2);assert.equal(handed.seed,start.seed);assert.equal(handed.elapsedSeconds-start.elapsedSeconds,exploration?1:6);
  for(const old of own(start)){assert.equal(unit(handed,old.id).ap,old.ap-(exploration?0:quote.route.find(step=>step.id===old.id)?.pa??0));assert.equal(unit(handed,old.id).hp,old.hp);}
  const switchAction=helper.controller(handed,unit(handed,'clinical')),handCost=actionCosts(handed,unit(handed,'clinical')).weapon;assert.deepEqual(switchAction,{type:'weapon',unitId:'clinical',slot:'medical'});
  let treated=replay(handed,[switchAction]);const orders=[action,switchAction];assert.equal(unit(treated,'clinical').ap,unit(handed,'clinical').ap-(exploration?0:handCost));assert.equal(treated.elapsedSeconds-handed.elapsedSeconds,exploration?Math.max(1,Math.ceil(handCost*.06)):0);
  for(let stroke=0;stroke<2;stroke++){
   const doctor=unit(treated,'clinical'),patient=unit(treated,'s1'),medical=medicalUsePreview(treated,doctor,patient),aid=helper.controller(treated,doctor),beforeAid=treated;assert.equal(medical.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:'clinical',targetId:'s1'});
   treated=replay(beforeAid,[aid]);orders.push(aid);assert.equal(unit(treated,'clinical').medkits,doctor.medkits-medical.treatment.dressingsUsed);assert.equal(fieldKits(treated),fieldKits(beforeAid)-medical.treatment.dressingsUsed);assert.equal(unit(treated,'primary').medkits,13);assert.equal(unit(treated,'s1').bleeding,medical.treatment.bleedingAfter);assert.equal(unit(treated,'s1').hp,medical.treatment.hpAfter);assert.equal(unit(treated,'clinical').ap,doctor.ap-(exploration?0:medical.cost));assert.equal(treated.elapsedSeconds-beforeAid.elapsedSeconds,exploration?Math.max(1,Math.ceil(medical.cost*.06)):0);
  }
  assert.equal(unit(treated,'s1').hp,15);assert.equal(unit(treated,'s1').bleeding,0);assert.equal(unit(treated,'clinical').medkits,0);assert.equal(fieldKits(treated),21);assert.notEqual(helper.controller(treated,unit(treated,'primary'))?.type,'transfer','Two real care strokes cannot restart the initial two-kit allocation.');
  assert.deepEqual(treated.artillery,start.artillery);for(const old of own(start))assert.deepEqual(unitAmmunitionByType(unit(treated,old.id)),unitAmmunitionByType(old));assert.deepEqual(replay(start,orders),treated);assert.deepEqual(start,before);
 }
});

test('a quoted certain relay pays every actual screen participant without topping up a supplied reserve',()=>{
 for(const exploration of [false,true]){
  const start=clinicalArena({relay:true,exploration}),before=structuredClone(start),helper=clinicalFactory(start),primary=unit(start,'primary'),reserve=unit(start,'clinical'),quote=transferPreview(start,primary,reserve,'medkits',2),action=helper.controller(start,primary);
  assert.equal(quote.valid,true);assert.equal(quote.kind,'relay');assert.equal(quote.chance,100);assert.deepEqual(quote.route.map(step=>step.id),['primary','s2','s1','clinical']);assert.equal(action?.type,'transfer');assert.equal(action.count,2);assert.equal(action.transferKind,'relay');assert.deepEqual(action.transferRoute,quote.route.map(step=>step.id));
  const after=replay(start,[action]);assert.equal(fieldKits(after),23);assert.equal(unit(after,'primary').medkits,13);assert.equal(unit(after,'clinical').medkits,2);assert.equal(after.elapsedSeconds-start.elapsedSeconds,exploration?quote.route.length-1:6);assert.equal(after.seed,start.seed);
  for(const old of own(start)){const paid=quote.route.find(step=>step.id===old.id)?.pa??0;assert.equal(unit(after,old.id).ap,old.ap-(exploration?0:paid));assert.equal(unit(after,old.id).hp,old.hp);assert.deepEqual(unitAmmunitionByType(unit(after,old.id)),unitAmmunitionByType(old));}
  assert.notEqual(helper.controller(after,unit(after,'primary'))?.type,'transfer');assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
 }
});

test('clinical handover preserves the primary last kit and rejects throw-only, blocked and insufficient-crew declarations',()=>{
 for(const options of [{primaryKits:1},{gap:true},{blocked:true},{shortCrew:true}]){
  const start=clinicalArena(options),before=structuredClone(start),helper=clinicalFactory(start),primary=unit(start,'primary'),reserve=unit(start,'clinical');
  if(options.shortCrew){assert.equal(helper.roles.clinicalReserveId,null);assert.deepEqual(helper.roles, {...createdUspallataBattery(start).roles,clinicalReserveId:null});}
  else{assert.equal(helper.roles.clinicalReserveId,'clinical');if(!options.primaryKits){const quote=transferPreview(start,primary,reserve,'medkits',2);assert.ok(!quote.valid||quote.kind==='throw');}}
  assert.notEqual(helper.controller(start,primary)?.type,'transfer');assert.equal(unit(start,'clinical').medkits,0);assert.equal(unit(start,'primary').medkits,options.primaryKits??15);assert.deepEqual(start,before);
 }
});

// These separate declarations start both clinicians on zero cover. The
// reserve is scheduled before its real supplier, as in an ordinary squad pass.
// Every wound, wall, cartridge and dressing is fixed before createBattle.
function clinicalCoverArena({adjacentCare=false,exposedPath=false,woundedScreen=false,visibleTarget=false,hiddenAlternate=false}={}){
 const positions=woundedScreen
  ?{primary:[35,13],clinical:[35,14],h1:[39,11],h2:[38,12],h3:[39,12],small:[39,8],s1:[34,13],s2:[38,15]}
  :exposedPath
   ?{primary:[21,10],clinical:[20,10],h1:[26,9],h2:[25,10],h3:[26,11],small:[33,9],s1:[12,12],s2:[15,12]}
   :{primary:[20,10],clinical:[20,11],h1:[26,9],h2:[25,10],h3:[26,11],small:[33,9],s1:[adjacentCare?19:12,adjacentCare?10:12],s2:[15,12]};
 const squad=Object.entries(positions).map(([id,[x,y]])=>({id,name:id,x,y,facing:6,weapon:1800,blade:1813,loaded:1,ammo:11,
  hp:id==='s1'&&(adjacentCare||woundedScreen)?32:100,maxHp:100,bleeding:id==='s1'&&(adjacentCare||woundedScreen)?4:0,bandaged:0,
  medical:id==='primary'?65:id==='clinical'?91:20,medkits:id==='primary'?15:['h1','h2','h3','small'].includes(id)?2:0,
  marksmanship:id==='clinical'?5:id==='primary'?30:id==='h1'?40:id==='h2'?45:id==='h3'?50:id==='small'?55:90,
  activeSlot:id==='primary'&&(adjacentCare||woundedScreen)?'medical':'primary',stance:'standing',energy:100,fatigue:0,morale:90,strength:90,dexterity:90,experienceLevel:4,inventory:{},
  entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}}));
 const tiles=flat().map(tile=>{
  const wall=woundedScreen?!visibleTarget&&tile.x===30:exposedPath?tile.x===19&&tile.y!==11:tile.x===10;
  const cover=exposedPath?tile.x===20&&tile.y===11:!woundedScreen&&tile.x===18&&[10,11].includes(tile.y);
  return wall?{...tile,type:'wall',blocked:true,blocksSight:true,cover:40}:{...tile,cover:cover?10:0};
 });
 const target=woundedScreen?{x:visibleTarget?30:24,y:13}:exposedPath?{x:14,y:10}:{x:hiddenAlternate?3:2,y:22};
 const options={id:'declared-zero-cover-clinic',width:40,height:24,hour:12,seed:45,tiles,exits:[exit],exploration:false,
  enemies:[{id:'contact',name:'Contact',...target,weapon:0,blade:0,loaded:0,ammo:0,hp:500,maxHp:500,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:woundedScreen?38:26,y:woundedScreen?11:10,loaded:true,ammo:6},
   {id:'small-gun',type:'swivel',side:'player',x:woundedScreen?38:33,y:woundedScreen?8:10,loaded:true,ammo:6}]};
 const declaration=structuredClone({squad,options}),battle=createBattle(squad,options);
 assert.deepEqual({squad,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);return battle;
}
function supplyStandingClinicalReserve(start){
 const before=structuredClone(start),helper=clinicalFactory(start),primary=unit(start,'primary'),reserve=unit(start,'clinical');
 assert.equal(own(start).length,8);assert.equal(helper.roles.clinicalReserveId,reserve.id);assert.equal(helper.roles.crews.flatMap(crew=>crew.ids).length,4);assert.equal(helper.roles.screens.length,2);
 assert.equal(reserve.stance,'standing');assert.equal(reserve.medkits,0);assert.equal(primary.medkits,15);assert.equal(fieldKits(start),23);
 assert.equal(helper.controller(start,reserve),null,'The earlier unsupplied reserve does not spend its posture before the actual current handover.');
 const action=helper.controller(start,primary),quote=transferPreview(start,primary,reserve,'medkits',2);
 assert.equal(quote.valid,true);assert.equal(quote.kind,'give');assert.equal(quote.chance,100);assert.deepEqual(action,{type:'transfer',unitId:primary.id,targetId:reserve.id,item:'medkits',count:2,transferKind:'give',transferRoute:[primary.id,reserve.id]});
 const battle=replay(start,[action]);assert.equal(unit(battle,reserve.id).stance,'standing');assert.equal(unit(battle,reserve.id).medkits,2);assert.equal(unit(battle,primary.id).medkits,13);assert.equal(fieldKits(battle),23);
 assert.deepEqual(start,before);return {battle,helper,orders:[action]};
}

test('the earlier unsupplied clinical reserve waits for its paid handover then both clinicians pay two-step cover gains',()=>{
 const actions=[];
 for(const hiddenAlternate of [false,true]){
  const declared=clinicalCoverArena({hiddenAlternate}),input=structuredClone(declared),{battle:start,helper,orders}=supplyStandingClinicalReserve(declared);let battle=start;
  assert.equal(teamCanSee(start,'player',unit(start,'contact')),false);
  for(const id of ['clinical','primary']){
   const actor=unit(battle,id),before=structuredClone(battle),action=helper.controller(battle,actor);assert.equal(surfaceAt(battle,actor).cover,0);assert.equal(actor.stance,'standing');assert.equal(action?.type,'move');
   const point=getReachable(publicRouteView(battle,actor),actor).find(p=>sameCell(p,action));assert.ok(point);assert.equal(point.path.length,2);assert.ok(point.cost>0&&point.cost<=16);assert.ok(actor.ap-point.cost>=actionCosts(battle,actor).weapon+actionCosts(battle,actor).heal);
   assert.ok(surfaceAt(battle,point).cover>surfaceAt(battle,actor).cover);assert.ok(point.path.every(p=>sameSurface(p,actor)&&surfaceAt(battle,p).cover>=surfaceAt(battle,actor).cover));
   orders.push(action);battle=replay(battle,[action]);assert.equal(unit(battle,id).ap,actor.ap-point.cost);assert.ok(unit(battle,id).energy<actor.energy);assert.ok(sameCell(unit(battle,id),point));sameFiniteGoods(before,battle);
  }
  assert.equal(fieldKits(battle),23);assert.deepEqual(replay(declared,orders),battle);assert.deepEqual(declared,input);actions.push(orders);
 }
 assert.deepEqual(actions[1],actions[0],'An unseen alternative cannot choose either clinical move.');
});

test('actual adjacent bleeding care stays ahead of a zero-cover clinical relocation and finite handover',()=>{
 const start=clinicalCoverArena({adjacentCare:true}),before=structuredClone(start),helper=clinicalFactory(start),doctor=unit(start,'primary'),patient=unit(start,'s1'),quote=medicalUsePreview(start,doctor,patient),action=helper.controller(start,doctor);
 assert.equal(surfaceAt(start,doctor).cover,0);assert.equal(quote.allowed,true);assert.deepEqual(action,{type:'useItem',unitId:doctor.id,targetId:patient.id});
 const after=replay(start,[action]);assert.equal(unit(after,doctor.id).ap,doctor.ap-quote.cost);assert.equal(unit(after,doctor.id).medkits,doctor.medkits-quote.treatment.dressingsUsed);assert.equal(fieldKits(after),fieldKits(start)-quote.treatment.dressingsUsed);
 assert.equal(unit(after,patient.id).hp,quote.treatment.hpAfter);assert.equal(unit(after,patient.id).bleeding,0);assert.ok(unit(after,patient.id).bandaged>patient.bandaged);assert.ok(sameCell(unit(after,doctor.id),doctor));assert.deepEqual(after.artillery,start.artillery);assert.deepEqual(start,before);
});

test('paired clinical cover quotes reject new hostile sight and preserve real exhausted-AP limits',()=>{
 for(const exposedPath of [true,false]){
  const declared=clinicalCoverArena({exposedPath}),input=structuredClone(declared),supplied=supplyStandingClinicalReserve(declared);let battle=supplied.battle;const orders=[...supplied.orders],helper=supplied.helper;
  if(exposedPath){
   const actor=unit(battle,'clinical'),target=unit(battle,'contact'),view=publicRouteView(battle,actor),point=getReachable(view,actor).find(p=>surfaceAt(view,p).cover>surfaceAt(view,actor).cover);
   assert.equal(teamCanSee(battle,'player',target),true);assert.ok(point&&point.cost>0&&point.cost<=16);assert.equal(hasLineOfSight(view,target,actor),false);assert.equal(hasLineOfSight(view,target,{...actor,...spacePoint(point)}),true);
  }else{
   const actor=unit(battle,'clinical'),hand=actionCosts(battle,actor).weapon,count=2*Math.floor(actor.ap/(2*hand));assert.ok(hand>0&&count>=2&&count<=100);
   for(let n=0;n<count;n++){const old=unit(battle,actor.id),action={type:'weapon',unitId:actor.id,slot:n%2?'primary':'medical'},cost=actionCosts(battle,old).weapon;orders.push(action);battle=replay(battle,[action]);assert.equal(unit(battle,actor.id).ap,old.ap-cost);}
   assert.equal(unit(battle,actor.id).activeSlot,'primary');assert.ok(unit(battle,actor.id).ap<=actionCosts(battle,unit(battle,actor.id)).weapon+actionCosts(battle,unit(battle,actor.id)).heal);
  }
  const before=structuredClone(battle),actor=unit(battle,'clinical'),action=helper.controller(battle,actor);assert.notEqual(action?.type,'move');
  if(action){orders.push(action);battle=replay(battle,[action]);assert.ok(sameCell(unit(battle,actor.id),actor));sameFiniteGoods(before,battle);}
  assert.deepEqual(replay(declared,orders),battle);assert.deepEqual(declared,input);
 }
 for(const options of [{gap:true},{blocked:true},{primaryKits:1}]){
  const start=clinicalArena(options),before=structuredClone(start),helper=clinicalFactory(start),primary=unit(start,'primary'),reserve=unit(start,'clinical'),quote=transferPreview(start,primary,reserve,'medkits',2);
  assert.ok(!quote.valid||quote.kind==='throw');assert.deepEqual(helper.controller(start,reserve),{type:'stance',unitId:reserve.id,stance:'prone'},'Without a current certain two-kit handover the former unsupplied fallback remains.');assert.deepEqual(start,before);
 }
});

test('a truly bandaged wounded screen stops optional forward bounds while payable fire and reload remain',()=>{
 for(const visibleTarget of [false,true]){
  const declared=clinicalCoverArena({woundedScreen:true,visibleTarget}),input=structuredClone(declared),helper=clinicalFactory(declared),doctor=unit(declared,'primary'),patient=unit(declared,'s1'),quote=medicalUsePreview(declared,doctor,patient),aid=helper.controller(declared,doctor);
  assert.equal(quote.allowed,true);assert.deepEqual(aid,{type:'useItem',unitId:doctor.id,targetId:patient.id});let battle=replay(declared,[aid]);const orders=[aid],actor=unit(battle,patient.id);
  assert.equal(actor.hp,32);assert.equal(actor.bleeding,0);assert.ok(actor.bandaged>0);assert.equal(fieldKits(battle),fieldKits(declared)-1);assert.ok(helper.roles.screens.includes(actor.id));
  if(!visibleTarget){
   const ordinary=createdUspallataBattery(battle),former=ordinary.controller(battle,actor);assert.equal(former?.type,'move','The same ordinary non-paired screen still has its original admitted advancing policy.');
   const paid=replay(battle,[former]);assert.ok(!sameCell(unit(paid,actor.id),actor));sameFiniteGoods(battle,paid);
   const action=helper.controller(battle,actor);assert.notEqual(action?.type,'move');if(action){orders.push(action);battle=replay(battle,[action]);assert.ok(sameCell(unit(battle,actor.id),actor));}
  }else{
   assert.equal(teamCanSee(battle,'player',unit(battle,'contact')),true);let action=helper.controller(battle,unit(battle,actor.id));
   if(action?.type==='stance'){orders.push(action);battle=replay(battle,[action]);action=helper.controller(battle,unit(battle,actor.id));}
   assert.equal(action?.type,'fire');const shooter=unit(battle,actor.id),target=unit(battle,action.targetId),cost=actionCosts(battle,shooter,target),rounds=unitAmmunitionByType(shooter);orders.push(action);battle=replay(battle,[action]);assert.equal(unit(battle,actor.id).ap,shooter.ap-cost.fire-(action.aim??0)*cost.aim);assert.ok(unit(battle,actor.id).loaded<shooter.loaded||unit(battle,actor.id).jammed);
   const reload=helper.controller(battle,unit(battle,actor.id));assert.equal(reload?.type,'reload');const before=unit(battle,actor.id);orders.push(reload);battle=replay(battle,[reload]);assert.ok(unit(battle,actor.id).ap<before.ap);assert.ok(unit(battle,actor.id).loaded>before.loaded||unit(battle,actor.id).reloadProgress>0);assert.deepEqual(unitAmmunitionByType(unit(battle,actor.id)),unitAmmunitionByType(before));assert.notDeepEqual(unitAmmunitionByType(before),rounds,'Only the actual shot debits one finite cartridge.');
  }
  assert.deepEqual(battle.artillery,declared.artillery);assert.deepEqual(replay(declared,orders),battle);assert.deepEqual(declared,input);
 }
});
