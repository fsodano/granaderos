import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {recordMilitiaHit,earnedMilitiaRank,validMilitiaExperience} from '../game/militia-experience.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {combatMilitia,militiaReaction} from './militia-combat-fixture.mjs';
const save=s=>saved({campaign:s}).campaign;
const soldier=(s,id)=>s.garrisons.retiro.find(u=>u.id===id);
const kept=['hp','maxHp','weapon','blade','weaponMetadata','bladeMetadata','condition','loaded','ammo','inventory','energy','bleeding','bandaged','medkits','priming'];

test('actual reaction kills promote one paid, wounded survivor through both ranks without healing or issuing equipment',()=>{
 let {s,id}=combatMilitia();const before=structuredClone(soldier(s,id)),next=s.nextMilitiaId;
 for(const rank of [1,2]){const result=militiaReaction(s,id);s=result.s;const u=soldier(s,id);assert.equal(u.militiaRank,rank);assert.equal(u.militiaExperience,rank*3);assert.equal(u.militiaCombatCredit.length,rank);for(const key of kept)assert.deepEqual(u[key],result.actual[key],key);assert.equal(u.hp,44);assert.equal(u.maxHp,60);assert.equal(u.loaded,before.loaded-rank);assert.equal(u.ammo,before.ammo);assert.equal(u.condition,before.condition-rank);assert.equal(u.marksmanship,before.marksmanship+rank*8);assert.equal(u.leadership,before.leadership+rank*5);assert.equal(s.nextMilitiaId,next);assert.deepEqual(s.sectors.retiro.militia,rank===1?[2,1,0]:[2,0,1]);assert.equal(s.log.filter(e=>e.text.includes('asciende por experiencia de combate')).length,rank);s=save(s);}
 const u=soldier(s,id);assert.notEqual(...u.militiaCombatCredit.map(e=>e.id));const p=visit(s),field=p.battle.units.find(u=>Number(u.id)===id);assert.equal(field.militiaRank,2);assert.equal(field.hp,44);assert.equal(field.militiaExperience,6);assert.equal(field.loaded,1);const returned=save(leave(p));assert.equal(soldier(returned,id).militiaRank,2);assert.equal(returned.log.filter(e=>e.text.includes('asciende por experiencia de combate')).length,2);
});

test('a first wound grants bounded credit, repeated wounds do not farm points, and a later eligible kill upgrades the same receipt',()=>{
 const state={battleId:'bounded',startSeconds:0},unit={id:'m',side:'player',militia:true,militiaRank:0,hp:60},target={id:'enemy',side:'enemy',hp:50};
 recordMilitiaHit(state,unit,target,true,20);const identity=target.militiaCreditId;assert.equal(unit.militiaExperience,1);recordMilitiaHit(state,unit,target,true,10);assert.equal(unit.militiaExperience,1);target.hp=0;recordMilitiaHit(state,unit,target,true,50);assert.equal(unit.militiaExperience,3);recordMilitiaHit(state,unit,target,true,10);assert.equal(unit.militiaExperience,3);assert.deepEqual(unit.militiaCombatCredit,[{id:identity,points:3}]);assert.equal(validMilitiaExperience(unit),true);
 for(const [victim,eligible,damage]of [[{id:'ally',side:'player',hp:50},true,20],[{id:'helpless',side:'enemy',hp:0},false,20],[{id:'miss',side:'enemy',hp:80},true,0]])recordMilitiaHit(state,unit,victim,eligible,damage);assert.equal(unit.militiaExperience,3);
});

test('manual militia attacks cannot farm helpless opponents or civilians',()=>{
 const fields={width:10,height:8,seed:42,tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}))};
 const militia={id:'m',militia:true,militiaRank:0,hp:60,maxHp:60,weapon:1800,blade:1813,x:1,y:1};
 let b=createBattle([militia],{...fields,enemies:[{id:'helpless',x:2,y:1,hp:10,maxHp:60,weapon:1813},{id:'active',x:8,y:6,hp:100,maxHp:100,weapon:1813}]});b=actBattle(b,{type:'melee',unitId:'m',targetId:'helpless'});assert.match(b.lastError,/milicias actúan por su cuenta/);assert.equal(b.units[1].hp,10);assert.equal(b.units[0].militiaExperience,undefined);assert.equal(b.units[1].militiaCreditId,undefined);assert.ok(validateBattleSnapshot(b));
 b=createBattle([militia],{...fields,exploration:true,enemies:[],npcs:[{id:'resident',name:'Habitante',x:2,y:1,hp:100,maxHp:100}]});const hp=b.npcs[0].hp;b=actBattle(b,{type:'melee',unitId:'m',targetId:'resident'});assert.match(b.lastError,/milicias actúan por su cuenta/);assert.equal(b.npcs[0].hp,hp);assert.equal(b.units[0].militiaExperience,undefined);assert.equal(b.npcs[0].militiaCreditId,undefined);assert.ok(validateBattleSnapshot(b));
});

test('a saved unfinished encounter keeps its opponent receipt when the same militia returns',()=>{
 const issued={id:20000,militia:true,militiaRank:0,hp:60,maxHp:60,weapon:1800},request={id:'first',sector:'retiro',squad:[],garrison:[issued],enemies:[{id:'e',hp:100,maxHp:100}],seed:42};
 const old=enterSector(request),u=old.units.find(u=>u.militia),enemy=old.units.find(u=>u.side==='enemy');recordMilitiaHit(old,u,enemy,true,10);const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(old)));const again=enterSector({...request,id:'second',garrison:[{...issued,militiaExperience:u.militiaExperience,militiaCombatCredit:u.militiaCombatCredit}]},restored),retained=again.units.find(u=>u.militia),same=again.units.find(u=>u.side==='enemy');assert.equal(same.militiaCreditId,enemy.militiaCreditId);recordMilitiaHit(again,retained,same,true,10);assert.equal(retained.militiaExperience,1);assert.ok(validateBattleSnapshot(again));
});

test('new veteran tuition is rejected atomically while regular instruction and already-paid count-only veteran courses remain valid',()=>{
 let {s,id}=combatMilitia();const before=structuredClone(s),denied=dispatchCampaign(s,{type:'militia',rank:2,trainerId:1000});assert.match(denied.lastError,/veteranos/);denied.lastError=null;assert.deepEqual(denied,before);
 s=order(s,{type:'militia',rank:1,trainerId:1000});s=order(save(s),{type:'wait',hours:s.militiaTraining[0].remaining});assert.equal(soldier(s,id).militiaRank,1);assert.equal(soldier(s,id).hp,44);assert.equal(soldier(s,id).militiaExperience,undefined);
 // Explicit already-paid older save. It cannot identify its unknown participants.
 s.garrisons.retiro=[];s.sectors.retiro.militia=[0,0,0];s.militiaTraining=[{sector:'retiro',rank:2,trainerId:1000,count:3,duration:48,remaining:1,started:s.hour}];s=order(save(s),{type:'wait',hours:1});assert.deepEqual(s.sectors.retiro.militia,[0,0,3]);assert.ok(save(s));
});

test('peaceful returns, dead soldiers and stale or reduced ledgers cannot trigger another promotion',()=>{
 const old={militia:true,militiaRank:0,hp:60,militiaExperience:3,militiaCombatCredit:[{id:'old',points:3}]};assert.equal(earnedMilitiaRank(old,structuredClone(old)),0);assert.equal(earnedMilitiaRank({...old,militiaExperience:0,militiaCombatCredit:[]},{...old,hp:0}),0);assert.throws(()=>earnedMilitiaRank(old,{...old,militiaExperience:0,militiaCombatCredit:[]}),/experiencia/);
 const swapped={...old,militiaExperience:3,militiaCombatCredit:[{id:'replacement',points:3}]};assert.throws(()=>earnedMilitiaRank(old,swapped),/experiencia/);
 let {s,id}=combatMilitia();({s}=militiaReaction(s,id));const before=structuredClone(soldier(s,id));const p=visit(s);s=save(leave(p));assert.equal(soldier(s,id).militiaRank,before.militiaRank);assert.deepEqual(soldier(s,id).militiaCombatCredit,before.militiaCombatCredit);
});

test('saved garrisons, active units and trainees reject malformed or duplicate combat credit',()=>{
 let {s,id}=combatMilitia();({s}=militiaReaction(s,id));
 for(const mutate of [u=>u.militiaExperience=-1,u=>u.militiaExperience++,u=>u.militiaCombatCredit.push({...u.militiaCombatCredit[0]}),u=>u.militiaCombatCredit[0].points=2,u=>u.militiaCombatCredit[0].extra=true,u=>u.militiaCombatCredit[0].id='',u=>delete u.militiaCombatCredit]){const wire=JSON.parse(encodeSave(s));mutate(wire.campaign.garrisons.retiro.find(u=>u.id===id));assert.throws(()=>decodeSave(JSON.stringify(wire)),/guarniciones|experiencia/);}
 const p=visit(s),bad=structuredClone(p.battle);bad.units.find(u=>Number(u.id)===id).militiaExperience=99;assert.throws(()=>validateBattleSnapshot(bad),/experiencia/);const enemy=createBattle([],{width:4,height:4,enemies:[{id:'bad',militiaCreditId:''}]});assert.throws(()=>validateBattleSnapshot(enemy),/experiencia/);
 const pending=JSON.parse(encodeSave(p.campaign,p.battle));pending.campaign.pendingBattle.garrison.find(u=>u.id===id).militiaExperience=99;assert.throws(()=>decodeSave(JSON.stringify(pending)),/experiencia/);
 const training=order(combatMilitia().s,{type:'militia',rank:1,trainerId:1000}),wire=JSON.parse(encodeSave(training));Object.assign(wire.campaign.militiaTraining[0].trainees[0],{militiaExperience:2,militiaCombatCredit:[{id:'duplicate',points:1},{id:'duplicate',points:1}]});assert.throws(()=>decodeSave(JSON.stringify(wire)),/instrucción|experiencia/);
 const raw={militia:true,militiaRank:1,militiaExperience:301,militiaCombatCredit:[]};assert.equal(validMilitiaExperience(raw),false);assert.ok(saved(p));
});
