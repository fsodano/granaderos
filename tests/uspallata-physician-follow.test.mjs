import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,stanceCost,medicalUsePreview,teamCanSee,hasLineOfSight,artilleryContact} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {createdUspallataBattery} from './created-uspallata-battery.mjs';
import {usefulRouteRifleShot,publicRouteView} from './route-infantry-progress.mjs';

const actor=(b,id)=>b.units.find(u=>u.id===id),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function arena({near=false,blocked=false,cover=false,unsafe=false,hidden=false,wounded=false,visible=false,doctor={}}={}){
 const width=40,height=24,players=[
  {id:'doctor',x:20,y:10,medical:95,medkits:2,stance:'prone',movementMode:'prone',marksmanship:95,...doctor},
  {id:'heavy-1',x:26,y:9,marksmanship:1},{id:'heavy-2',x:25,y:10,marksmanship:2},{id:'heavy-3',x:26,y:11,marksmanship:3},
  {id:'small-1',x:33,y:9,marksmanship:4},
  {id:'screen-1',x:wounded?19:near?18:14,y:wounded?10:8,marksmanship:91,...(wounded?{hp:30,bleeding:1}: {})},
  {id:'screen-2',x:near?18:14,y:10,marksmanship:92},{id:'screen-3',x:near?18:14,y:12,marksmanship:93},
 ].map(raw=>({name:raw.id,weapon:1800,blade:1813,loaded:1,ammo:11,hp:100,maxHp:100,medical:0,medkits:0,energy:100,fatigue:0,morale:90,stance:'crouched',strength:90,dexterity:90,experienceLevel:4,facing:6,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7},...raw}));
 const options={id:'declared-physician-follow',width,height,hour:12,seed:45,
  tiles:Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width),wall=y===20||blocked&&x===19;return {x,y,type:wall?'wall':cover&&x===20&&y===10?'forest':'grass',blocked:wall,blocksSight:wall,cover:cover&&x===20&&y===10?40:0};}),
  enemies:[{id:'contact',name:hidden?'Other hidden contact':'Contact',x:unsafe?18:visible?14:hidden?35:2,y:unsafe?10:visible?4:22,hp:500,maxHp:500,weapon:0,blade:0,loaded:0,ammo:0,patrol:false,overwatch:false}],
  artillery:[{id:'heavy',type:'field8',side:'player',x:26,y:10,loaded:true,ammo:3},{id:'small',type:'swivel',side:'player',x:33,y:10,loaded:true,ammo:6}],
 };
 const declaration=structuredClone({players,options}),b=createBattle(players,options);assert.deepEqual({players,options},declaration);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(b))),b);return b;
}
function replay(start,orders){
 let direct=structuredClone(start),shown=structuredClone(start),stored=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
 for(const action of orders){direct=actBattle(direct,action);assert.equal(direct.lastError,null,JSON.stringify(action));shown=presentedActBattle(shown,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(shown,direct);stored=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(stored,JSON.parse(JSON.stringify(action))))));assert.deepEqual(stored,direct);}return direct;
}
function quote(b,u,action){
 const paid=action.movement?stanceCost(u,'standing'):0,projected=action.movement?{...u,stance:'standing',movementMode:action.movement,ap:u.ap-paid}:u;
 const route=getReachable(publicRouteView(b,u),projected).find(p=>sameCell(p,action));assert.ok(route?.cost>0);assert.ok(paid+route.cost<=16);assert.ok(u.ap-paid-route.cost>=actionCosts(b,u).weapon+actionCosts(b,u).heal);return {paid,route};
}

test('a supplied idle prone physician pays a bounded walk toward the current living screen before any wound',()=>{
 const start=arena(),before=structuredClone(start),helper=createdUspallataBattery(start),doctor=actor(start,'doctor');assert.equal(helper.roles.physicianId,'doctor');assert.deepEqual(helper.roles.screens,['screen-1','screen-2','screen-3']);assert.equal(usefulRouteRifleShot(publicRouteView(start,doctor),doctor),null);
 const action=helper.controller(start,doctor);assert.equal(action?.type,'move');assert.equal(action.movement,'walk');const q=quote(start,doctor,action),end=replay(start,[action]);
 assert.equal(actor(end,'doctor').ap,doctor.ap-q.paid-q.route.cost);assert.equal(actor(end,'doctor').activeSlot,doctor.activeSlot);assert.equal(actor(end,'doctor').medkits,doctor.medkits);assert.ok(actor(end,'doctor').energy<doctor.energy);assert.ok(distance(actor(end,'doctor'),actor(end,'screen-2'))<distance(doctor,actor(start,'screen-2')));
 assert.ok(q.route.path.every(p=>p.x>=actor(start,'screen-2').x));for(const gun of start.artillery)for(const p of q.route.path)assert.equal(artilleryContact(start,{...doctor,...spacePoint(p)},gun),false);
 assert.deepEqual(end.artillery,start.artillery);assert.deepEqual(start,before);
});

test('a standing physician uses the current safe support route before the former idle prone order',()=>{
 const start=arena({doctor:{stance:'standing',movementMode:'walk'}}),before=structuredClone(start),doctor=actor(start,'doctor'),action=createdUspallataBattery(start).controller(start,doctor);
 assert.equal(action?.type,'move');assert.equal(action.movement,undefined);const q=quote(start,doctor,action),end=replay(start,[action]);assert.equal(q.paid,0);assert.equal(actor(end,'doctor').ap,doctor.ap-q.route.cost);assert.equal(actor(end,'doctor').stance,'standing');assert.equal(actor(end,'doctor').medkits,doctor.medkits);assert.deepEqual(start,before);
});

test('fresh authored deployment and actual screen moves leave a real paid support route for the same eight roles',()=>{
 const request={id:'fresh-eight-physician-follow',sector:'uspallata',origin:'mendoza',seed:45,hour:10,
  squad:Array.from({length:8},(_,i)=>({id:String(i),name:'Llegada '+i,weapon:1800,blade:1813,loaded:1,ammo:11,medical:i===0?95:0,medkits:i===0?15:0,marksmanship:40+i*3,strength:90,dexterity:90,energy:100,fatigue:0,morale:90,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:7}})),
  enemies:[],artillery:[{id:'fresh-heavy',type:'field8',side:'player',loaded:true,ammo:3},{id:'fresh-small',type:'swivel',side:'player',loaded:true,ammo:6}],
 },declaration=structuredClone(request),initial=enterSector(request,null,{placement:true}),events=[],helper=createdUspallataBattery(initial,{report:event=>events.push(event)});let b=helper.deploy(initial);
 const orders=events.filter(e=>e.event==='uspallataDeploymentOrder').map(e=>e.action);
 for(let n=0;n<4;n++){const small=b.artillery.find(g=>g.type==='swivel'),heavy=b.artillery.find(g=>g.type==='field8');if(distance(small,heavy)>=3)break;const id=helper.roles.crews.find(c=>c.gunId===small.id).ids[0],action=helper.controller(b,actor(b,id));assert.equal(action?.type,'artilleryMove');b=replay(b,[action]);orders.push(action);}
 const prone={type:'stance',unitId:helper.roles.physicianId,stance:'prone'};b=replay(b,[prone]);orders.push(prone);
 for(const id of helper.roles.screens){const u=actor(b,id),route=getReachable(publicRouteView(b,u),u).filter(p=>p.x===57&&p.y===u.y)[0];assert.ok(route);const action={type:'move',unitId:id,...spacePoint(route)};b=replay(b,[action]);orders.push(action);}
 const before=structuredClone(b),doctor=actor(b,helper.roles.physicianId),action=helper.controller(b,doctor);assert.equal(doctor.stance,'prone');assert.equal(action?.type,'move');const q=quote(b,doctor,action),elapsed=b.elapsedSeconds,end=replay(b,[action]);orders.push(action);
 assert.ok(end.elapsedSeconds>elapsed);assert.equal(actor(end,doctor.id).ap,doctor.ap,'Native exploration pays time rather than an invented AP debit.');assert.ok(actor(end,doctor.id).energy<doctor.energy);assert.equal(actor(end,doctor.id).medkits,15);assert.deepEqual(end.artillery,b.artillery);assert.ok(q.route.path.length>0);assert.deepEqual(replay(initial,orders),end);assert.deepEqual(b,before);assert.deepEqual(request,declaration);
});

test('a physician already behind the current screen keeps the existing idle hold',()=>{
 const start=arena({near:true}),before=structuredClone(start);assert.equal(createdUspallataBattery(start).controller(start,actor(start,'doctor')),null);assert.deepEqual(start,before);
});

test('blocked routes and a loss of actual terrain cover do not justify a new support posture',()=>{
 for(const options of [{blocked:true},{cover:true}]){const start=arena(options),before=structuredClone(start);assert.equal(createdUspallataBattery(start).controller(start,actor(start,'doctor')),null);assert.deepEqual(start,before);}
});

test('a team-known close hostile refuses support movement without borrowing hidden target data',()=>{
 const start=arena({unsafe:true,doctor:{activeSlot:'medical'}}),before=structuredClone(start);assert.equal(teamCanSee(start,'player',actor(start,'contact')),true);assert.equal(hasLineOfSight(start,actor(start,'contact'),actor(start,'doctor')),true);assert.equal(createdUspallataBattery(start).controller(start,actor(start,'doctor')),null);assert.deepEqual(start,before);
});

test('real hand costs cannot spend the complete medical reserve on following',()=>{
 const declared=arena(),helper=createdUspallataBattery(declared),orders=[];let b=declared;
 while(actor(b,'doctor').ap-actionCosts(b,actor(b,'doctor')).weapon-actionCosts(b,actor(b,'doctor')).heal>=8){const u=actor(b,'doctor'),action={type:'weapon',unitId:u.id,slot:u.activeSlot==='medical'?'primary':'medical'};b=replay(b,[action]);orders.push(action);}
 const before=structuredClone(b);assert.equal(helper.controller(b,actor(b,'doctor')),null);assert.deepEqual(replay(declared,orders),b);assert.deepEqual(b,before);
});

test('adjacent finite aid stays first and its last actual dressing cannot fund later healthy following',()=>{
 const start=arena({wounded:true,doctor:{medkits:1,activeSlot:'medical'}}),helper=createdUspallataBattery(start),doctor=actor(start,'doctor'),patient=actor(start,'screen-1'),q=medicalUsePreview(start,doctor,patient),action=helper.controller(start,doctor);assert.equal(q.allowed,true);assert.deepEqual(action,{type:'useItem',unitId:'doctor',targetId:'screen-1'});
 const end=replay(start,[action]);assert.equal(actor(end,'doctor').ap,doctor.ap-q.cost);assert.equal(actor(end,'doctor').medkits,0);assert.equal(actor(end,'screen-1').bleeding,0);assert.equal(helper.controller(end,actor(end,'doctor')),null);assert.deepEqual(end.artillery,start.artillery);
});

test('an actual useful rifle shot stays ahead of healthy screen following',()=>{
 const start=arena({visible:true}),doctor=actor(start,'doctor'),shot=usefulRouteRifleShot(publicRouteView(start,doctor),doctor);assert.equal(shot?.type,'fire');assert.deepEqual(createdUspallataBattery(start).controller(start,doctor),shot);const end=replay(start,[shot]);assert.ok(actor(end,'doctor').ap<doctor.ap);assert.equal(actor(end,'doctor').loaded,0);
});

test('unseen opposing changes do not choose the current screen, support posture or paid route',()=>{
 const start=arena(),other=arena({hidden:true}),before=structuredClone(start),otherBefore=structuredClone(other);assert.equal(teamCanSee(start,'player',actor(start,'contact')),false);assert.equal(teamCanSee(other,'player',actor(other,'contact')),false);
 const action=createdUspallataBattery(start).controller(start,actor(start,'doctor'));assert.equal(action?.type,'move');assert.deepEqual(createdUspallataBattery(other).controller(other,actor(other,'doctor')),action);replay(start,[action]);replay(other,[action]);assert.deepEqual(start,before);assert.deepEqual(other,otherBefore);
});
