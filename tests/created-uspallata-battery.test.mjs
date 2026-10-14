import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,artilleryContact,artilleryCrewPlan,artilleryCosts,artilleryReloadPreview,stanceCost,exitPreview,teamCanSee} from '../game/tactical.js';
import {beginSectorDeployment} from '../game/sector-deployment.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {mountainPassBatteryController} from './fresh-cuyo-fixture.mjs';
import {heavyContactCrewController} from './stable-crew-driver.mjs';

const flat=()=>Array.from({length:40*24},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',blocked:false,cover:0}));
const exit={id:'arena:return',edge:'E',destination:'rear',entryEdge:'W',entryAnchor:{x:0,y:7}};
// These are declared portable formations, not an earned Uspallata force.
// Every deployment, separation, departure, reload and dressing uses real orders.
function arena({deployment=false,wounded=false,hidden=false,emptyGuns=false,crewSlot='primary',crewLoaded=1}={}){
 const positions={founder:[39,23],med:[39,13],c1:[39,11],c2:[38,12],c3:[39,12],c4:[39,8],s1:[37,13],s2:[38,14]};
 const ids=Object.keys(positions),squad=ids.map((id,i)=>({id,name:id,x:positions[id][0],y:positions[id][1],facing:6,
  weapon:1800,loaded:1,ammo:11,medkits:id==='med'?3:0,medical:id==='med'?90:20,marksmanship:id.startsWith('c')?40+Number(id[1])*5:90,
  stance:id==='med'?'prone':deployment?'standing':'crouched',...(wounded&&id==='c2'?{hp:30,maxHp:100,bleeding:3}:{}),
  ...(id==='c1'?{activeSlot:crewSlot,loaded:crewLoaded}:{}),
  ...(deployment?{entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}}:{}),energy:100,fatigue:0,morale:90,inventory:{},strength:90}));
 const b=createBattle(squad,{id:'declared-mountain',width:40,height:24,tiles:flat(),exits:[exit],seed:45,
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
