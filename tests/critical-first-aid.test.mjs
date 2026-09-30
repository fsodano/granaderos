import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {preparedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {order,saved,visit,leave,sync} from './local-contract-fixture.mjs';

const field=(doc={},patient={},sector={})=>{const b=createBattle([
 {id:'doc',name:'Sanitario',x:1,y:1,medical:60,activeSlot:'medical',dexterity:75,experienceLevel:4,medkits:3,...doc},
 {id:'patient',name:'Herido',x:2,y:1,maxHp:100,hp:1,bleeding:10,bandaged:0,energy:75,...patient},
],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}],...sector});b.units[0].ap=doc.ap??100;if(patient.side){b.units[1].side=patient.side;b.units[1].patrol=false;}return b;};
const aid=s=>actBattle(s,{type:'heal',unitId:'doc',targetId:'patient'});
const patient=s=>s.units.find(u=>u.id==='patient');

test('actual critical treatment consumes skill-based work, AP and dressings and replays its second stroke after save',()=>{
 const s=field(),first=aid(s);assert.equal(first.lastError,null);assert.equal(patient(first).hp,9);assert.equal(patient(first).bleeding,2);assert.equal(first.units[0].ap,75);assert.equal(first.units[0].medkits,2);assert.equal(patient(s).hp,1);
 const second=aid(first);assert.equal(second.lastError,null);assert.equal(patient(second).hp,15);assert.equal(patient(second).bleeding,0);assert.equal(patient(second).bandaged,85);assert.equal(second.units[0].ap,50);assert.equal(second.units[0].medkits,1);assert.deepEqual(aid(validateBattleSnapshot(first)),second);
 const again=aid(second);assert.ok(again.lastError);assert.deepEqual(again.units,second.units);
});

test('ordinary field bandaging does not heal and incomplete, unavailable or unpaid care changes nothing',()=>{
 const missing=actBattle(field({}, {hp:55,bleeding:4}),{type:'heal',unitId:'doc',targetId:'missing'});assert.ok(missing.lastError);assert.equal(missing.units[0].medkits,3);
 const s=field({}, {hp:55,bleeding:4}),treated=aid(s);assert.equal(patient(treated).hp,55);assert.equal(patient(treated).bleeding,0);assert.equal(patient(treated).bandaged,45);
 for(const original of [treated,field({medical:0}),field({medkits:0}),field({ap:24}),field({}, {hp:0,bleeding:0}),field({}, {side:'enemy'}),field({}, {x:4,y:4})]){const next=aid(original);assert.ok(next.lastError);assert.deepEqual(next.units,original.units);assert.equal(next.elapsedSeconds,original.elapsedSeconds);}
});

test('stabilization does not grant breath, AP, fatigue relief or posture to an exhausted patient',()=>{
 const s=field({}, {hp:14,bleeding:0,bandaged:86,energy:0,fatigue:40}),before=patient(s);before.ap=0;before.stance='prone';const n=aid(s);assert.equal(n.lastError,null);assert.equal(patient(n).hp,15);assert.equal(patient(n).unconscious,true);
 for(const key of ['energy','ap','fatigue','stance','movementMode'])assert.equal(patient(n)[key],before[key],key);assert.ok(validateBattleSnapshot(n));
});

test('exploration treatment spends time and supplies with the same work while preserving AP',()=>{
 const s=field({ap:0},{bleeding:0},{exploration:true,enemies:[]}),first=aid(s),second=aid(first);assert.equal(first.lastError,null);assert.equal(patient(first).hp,9);assert.equal(patient(second).hp,15);assert.equal(second.units[0].ap,0);assert.equal(second.units[0].medkits,1);assert.ok(second.elapsedSeconds>0);assert.ok(validateBattleSnapshot(second));
});

test('civilian partial stabilization preserves wound history and records only actual restored health',()=>{
 let s=field({}, {hp:100,bleeding:0},{npcs:[{id:'civil',name:'Vecina',x:1,y:2,civilianHealthVersion:1,maxHp:60,hp:1,energy:75,unconscious:true,civilianWoundVersion:1,bleeding:10,bandaged:0,bleedSource:{attackerId:null,side:'unknown',militia:false,intentional:false}}]});
 const use=x=>actBattle(x,{type:'heal',unitId:'doc',targetId:'civil'});s=use(s);assert.equal(s.lastError,null);assert.equal(s.npcs[0].hp,9);assert.equal(s.npcs[0].bleeding,2);assert.equal(s.npcs[0].civilianFirstAid.hpRestored,8);assert.ok(s.npcs[0].bleedSource);const n=use(validateBattleSnapshot(s));assert.equal(n.npcs[0].hp,15);assert.equal(n.npcs[0].civilianFirstAid.hpRestored,14);assert.equal(n.npcs[0].bleedSource,undefined);assert.equal(n.npcs[0].unconscious,false);assert.ok(validateBattleSnapshot(n));
});

test('bandaged military wounds survive actual campaign return and require strategic care for further recovery',()=>{
 // Initial wounds are declared by preparedCare; all treatment, travel state,
 // returns and saved redeployments below use the real campaign actions.
 let p=visit(preparedCare()),u=p.battle.units.find(u=>u.id===String(DOCTOR)),target=p.battle.units.find(u=>u.id===String(PATIENT));const spot=getReachable(p.battle,u).find(t=>Math.hypot(t.x-target.x,t.y-target.y)<=1.5);assert.ok(spot);
 if(spot.cost){const b=actBattle(p.battle,{type:'move',unitId:u.id,x:spot.x,y:spot.y});assert.equal(b.lastError,null);p=sync({campaign:p.campaign,battle:b});}
 const equipped=actBattle(p.battle,{type:'weapon',unitId:String(DOCTOR),slot:'medical'});assert.equal(equipped.lastError,null);p=sync({campaign:p.campaign,battle:equipped});
 const hp=p.battle.units.find(u=>u.id===String(PATIENT)).hp,b=actBattle(p.battle,{type:'heal',unitId:String(DOCTOR),targetId:String(PATIENT)});assert.equal(b.lastError,null);p=saved(sync({campaign:p.campaign,battle:b}));assert.equal(p.battle.units.find(u=>u.id===String(PATIENT)).hp,hp);
 let s=saved({campaign:leave(p)}).campaign;const bandaged=s.operativeState[PATIENT].bandaged;assert.ok(bandaged>0);p=visit(s);assert.equal(p.battle.units.find(u=>u.id===String(PATIENT)).bandaged,bandaged);s=leave(p);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[PATIENT].hp,hp+6);assert.equal(s.operativeState[PATIENT].bandaged,bandaged-6);assert.ok(saved({campaign:s}));
});

test('saved bandaged wounds reject invalid quantities while older service records remain loadable',()=>{
 const old=preparedCare();delete old.operativeState[PATIENT].bandaged;const loaded=saved({campaign:old}).campaign;assert.equal(loaded.operativeState[PATIENT].hp,old.operativeState[PATIENT].hp);assert.equal(loaded.operativeState[PATIENT].medkits,old.operativeState[PATIENT].medkits);
 for(const value of [-1,Infinity,'3',101]){const bad=field();patient(bad).bandaged=value;assert.throws(()=>validateBattleSnapshot(bad),/heridas|vendadas|números inválidos/);const s=structuredClone(old);s.operativeState[PATIENT].bandaged=value;assert.throws(()=>saved({campaign:s}),/heridas|vendadas|números inválidos/);}
});
