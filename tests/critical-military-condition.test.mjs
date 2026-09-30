import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,maxActionPoints} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {completedTacticalVictory} from '../game/battle-outcome.js';
import {assertAmmunitionConservation} from '../game/campaign-ammunition.js';
import {totalReserveAmmunition,addAmmunition} from '../game/ammunition-types.js';
import {enterSector} from '../game/world.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {order,saved,visit,tactical,leave} from './local-contract-fixture.mjs';

const field=(patient={})=>createBattle([{id:'doc',name:'Sanitario',x:1,y:1,medical:60,medkits:2},{id:'patient',name:'Herido',x:2,y:1,hp:1,bleeding:0,energy:75,mounted:true,overwatch:true,...patient}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}]});
const use=s=>{if(s.units.find(u=>u.id==='doc').activeSlot!=='medical'){s=actBattle(s,{type:'weapon',unitId:'doc',slot:'medical'});assert.equal(s.lastError,null);}return actBattle(s,{type:'heal',unitId:'doc',targetId:'patient'});};
const finishRound=s=>{const turn=s.turn;for(let i=0;i<20&&s.turn===turn&&s.status==='active';i++){s=endTurn(s);assert.equal(s.lastError,null);}assert.ok(s.turn>turn);return s;};
const patient=s=>s.units.find(u=>u.id==='patient');

test('critical combatants cannot act or wake through breath recovery and stabilization grants no immediate action points',()=>{
 let s=field();assert.equal(patient(s).unconscious,true);assert.equal(patient(s).ap,0);assert.equal(maxActionPoints(s,patient(s)),0);assert.equal(patient(s).mounted,false);assert.equal(patient(s).overwatch,false);
 for(const action of [{type:'move',x:2,y:2},{type:'fire',targetId:'enemy'},{type:'ration'},{type:'heal'}]){const n=actBattle(s,{...action,unitId:'patient'});assert.ok(n.lastError);assert.equal(patient(n).hp,1);assert.equal(patient(n).rations,patient(s).rations);}
 s=finishRound(s);assert.equal(patient(s).hp,1);assert.equal(patient(s).unconscious,true);assert.equal(patient(s).ap,0);assert.ok(patient(s).energy>75);
 s=use(s);assert.equal(s.lastError,null);assert.equal(patient(s).hp,9);assert.equal(patient(s).unconscious,true);s=use(validateBattleSnapshot(s));assert.equal(patient(s).hp,15);assert.equal(patient(s).unconscious,false);assert.equal(patient(s).ap,0);assert.equal(s.units[0].medkits,0);
 s=finishRound(s);assert.ok(patient(s).ap>0);assert.ok(validateBattleSnapshot(s));
});

test('only critical health ends the last fighting force, while exhaustion can recover without declaring victory or defeat',()=>{
 const enemy={id:'enemy',x:7,y:7,patrol:false,overwatch:false};
 let s=createBattle([{id:'only',hp:14}],{width:8,height:8,enemies:[enemy]});assert.equal(s.status,'defeat');assert.equal(s.units[0].hp,14);
 s=createBattle([{id:'only',hp:50,energy:0}],{width:8,height:8,enemies:[enemy]});assert.equal(s.status,'active');s=endTurn(s);assert.equal(s.units[0].unconscious,false);assert.ok(s.units[0].ap>0);
 s=createBattle([{id:'only'}],{width:8,height:8,enemies:[{...enemy,hp:14}]});assert.equal(s.status,'victory');assert.equal(completedTacticalVictory(s),true);assert.equal(s.units[1].hp,14);
 s=createBattle([{id:'only'}],{width:8,height:8,enemies:[{...enemy,hp:50,energy:0}]});assert.equal(s.status,'active');assert.equal(completedTacticalVictory(s),false);
});

test('actual damage leaves an incapacitated enemy whose body, wounds and finite equipment persist after victory and new occupation',()=>{
 // A compact prepared encounter isolates casualty persistence, not a fresh route.
 const request={id:'critical-encounter',sector:'retiro',hour:12,exploration:false,issuedCartridges:0,squad:[{id:110,name:'Soldado',x:1,y:1,weapon:1813,ammo:0,loaded:0}],enemies:[{id:'enemy-0',name:'Herido realista',x:2,y:1,hp:41,maxHp:100,weapon:1800,ammo:3,loaded:1,overwatch:false}]};
 let b=createBattle(request.squad,{...request,width:20,height:16});b=actBattle(b,{type:'melee',unitId:'110',targetId:'enemy-0'});assert.equal(b.lastError,null);assert.equal(b.status,'victory');const casualty=b.units.find(u=>u.id==='enemy-0');assert.equal(casualty.hp,9);assert.equal(casualty.unconscious,true);assert.equal(casualty.ap,0);assert.equal(casualty.ammo,3);assert.equal(completedTacticalVictory(b),true);
 b=validateBattleSnapshot(actBattle(b,{type:'explore'}));assert.equal(b.mode,'exploration');assert.equal(b.status,'active');assert.equal(b.units.find(u=>u.id==='enemy-0').hp,9);
 const visitRequest={...request,exploration:true,enemies:[],compactLayout:true};let entered=enterSector(visitRequest,b);const savedEnemy=entered.units.find(u=>u.id==='enemy-0');assert.equal(savedEnemy.hp,9);assert.equal(savedEnemy.ammo,3);assert.equal(savedEnemy.unconscious,true);assert.ok(validateBattleSnapshot(entered));
 const occupied=enterSector({...request,id:'new-garrison',enemies:[{...request.enemies[0],hp:100}]},entered);assert.equal(occupied.units.find(u=>u.id==='enemy-0').hp,100);const old=occupied.units.find(u=>u.originalUnitId==='enemy-0');assert.ok(old);assert.equal(old.hp,9);assert.equal(old.ammo,3);assert.equal(old.unconscious,true);assert.ok(validateBattleSnapshot(occupied));
 const ammoKey=Object.keys(old.inventory).find(key=>old.inventory[key].kind==='ammunition');assert.ok(ammoKey);const pickup={type:'loot',unitId:'110',targetId:old.id,item:`inventory:${ammoKey}`,count:3};const looted=actBattle(occupied,pickup);assert.equal(looted.lastError,null);assert.equal(looted.units.find(u=>u.id===old.id).ammo,0);assert.equal(totalReserveAmmunition(looted.units.find(u=>u.id==='110')),3);assert.doesNotThrow(()=>assertAmmunitionConservation({...request,id:'new-garrison'},looted,entered));const forged=structuredClone(looted);addAmmunition(forged.units.find(u=>u.id==='110'),'musket_75',1);assert.throws(()=>assertAmmunitionConservation({...request,id:'new-garrison'},forged,entered));assert.ok(actBattle(looted,pickup).lastError);assert.ok(validateBattleSnapshot(looted));
});

test('old snapshots migrate critical incapacity without healing, and current snapshots reject inconsistent consciousness and action budgets',()=>{
 const current=field(),legacy=structuredClone(current);delete legacy.conditionVersion;Object.assign(patient(legacy),{unconscious:false,ap:100,maxAP:100,mounted:true,overwatch:true});
 const restored=validateBattleSnapshot(legacy);assert.equal(restored.conditionVersion,1);assert.equal(patient(restored).hp,1);assert.equal(patient(restored).medkits,patient(current).medkits);assert.equal(patient(restored).unconscious,true);assert.equal(patient(restored).ap,0);assert.equal(patient(restored).mounted,false);assert.ok(validateBattleSnapshot(restored));
 for(const patch of [{unconscious:false},{ap:1},{maxAP:1},{mounted:true},{braced:true},{overwatch:true}]){const bad=structuredClone(current);Object.assign(patient(bad),patch);assert.throws(()=>validateBattleSnapshot(bad));}
 assert.throws(()=>validateBattleSnapshot({...current,conditionVersion:2}));
});

test('an actually hired critical soldier arrives unconscious, receives finite field aid and preserves recovered health through campaign saves',()=>{
 const d=defaultContentPackage(),doc=d.characters.find(c=>c.id==='person-110'),wounded=d.characters.find(c=>c.id==='person-112');doc.arrivalHours=0;doc.attributes.medical=80;wounded.arrivalHours=0;wounded.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};
 let s=initialCampaign(42,d);for(const id of [110,112])s=order(s,{type:'recruitCivic',id,term:'week'});let p=visit(s),u=p.battle.units.find(u=>u.id==='112');assert.equal(u.unconscious,true);assert.equal(u.ap,0);assert.equal(u.hp,1);
 // Entry places the two members in adjacent cells of the ordinary map.
 assert.ok(Math.hypot(p.battle.units[0].x-u.x,p.battle.units[0].y-u.y)<=1.5);
 p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:'112'});assert.equal(p.battle.units.find(u=>u.id==='112').unconscious,true);p=tactical(saved(p),{type:'heal',targetId:'112'});assert.equal(p.battle.units.find(u=>u.id==='112').hp,15);assert.equal(p.battle.units.find(u=>u.id==='112').unconscious,false);
 s=saved({campaign:leave(p)}).campaign;assert.equal(s.operativeState[112].hp,15);assert.equal(s.operativeState[110].medkits,0);p=visit(s);assert.equal(p.battle.units.find(u=>u.id==='112').hp,15);assert.equal(p.battle.units.find(u=>u.id==='112').unconscious,false);assert.ok(saved(p));
});

// Declared outcome boundaries: this is not a scripted victory playthrough.
test('routed troops contest a field until departure while surrender and actual departure remove them from the result',()=>{
 const b=createBattle([{id:'p',x:1,y:1}],{width:8,height:8,enemies:[{id:'e',x:7,y:7}]});
 for(const [patch,expected] of [[{routed:true},false],[{energy:0,unconscious:true},false],[{surrendered:true},true],[{fled:true},true],[{departure:{destination:'retiro'}},true],[{hp:14},true],[{hp:0},true]]){
  const boundary=structuredClone(b);boundary.status='victory';Object.assign(boundary.units[1],patch);assert.equal(completedTacticalVictory(boundary),expected,JSON.stringify(patch));
 }
 const won=structuredClone(b);won.units[1].hp=0;won.status='victory';assert.equal(completedTacticalVictory(won),true);
 for(const patch of [{phase:'enemy'},{phase:'interrupt'},{enemyTurn:{}},{alliedTurn:{}},{interrupt:{}},{reactionStack:[]}])assert.equal(completedTacticalVictory({...won,...patch}),false,JSON.stringify(patch));
 for(const patch of [{fled:true},{surrendered:true},{departure:{destination:'retiro'}}]){const absent=structuredClone(won);Object.assign(absent.units[0],patch);assert.equal(completedTacticalVictory(absent),false);}
});
