import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_CHARACTER_SUPPLIES} from '../game/character-supplies.js';
import {initialCampaign,refillCost} from '../game/campaign.js';
import {encountersFor} from '../game/encounters.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {order,saved,visit,tactical,leave,localPackage,localId,readyLocal,hireLocal,localNPC} from './local-contract-fixture.mjs';
const allocation={priming:7,flints:0,rations:3,torches:1,medkits:0,boleadoras:0};
const supplies=o=>Object.fromEntries(Object.keys(DEFAULT_CHARACTER_SUPPLIES).map(k=>[k,o[k]]));
const person=(d,id=110)=>d.characters.find(c=>c.id===`person-${id}`);
const unit=(p,id)=>p.battle.units.find(u=>u.id===String(id));

test('starting supplies accept only complete bounded integer allocations and old packages keep their defaults',()=>{
 const d=defaultContentPackage();assert.equal(person(d).startingSupplies,undefined);
 for(const bad of [null,[],{},allocation.priming,{...allocation,torches:-1},{...allocation,rations:1.5},{...allocation,flints:1001},{...allocation,medkits:'2'},{...allocation,ammo:10},{...allocation,boleadoras:Infinity}]){
  person(d).startingSupplies=bad;assert.ok(validateContentPackage(d).some(e=>e.includes('startingSupplies')));assert.throws(()=>initialCampaign(42,d));
 }
 person(d).startingSupplies=allocation;assert.deepEqual(campaignContentReport(d).blocked,[]);
 const imported=parseContentPackage(encodeContentPackage(d));assert.deepEqual(person(imported).startingSupplies,allocation);
 let s=saved({campaign:initialCampaign(42,imported)}).campaign;assert.deepEqual(supplies(s.operativeState[110]),allocation);
 delete person(d).startingSupplies;s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});assert.deepEqual(supplies(unit(visit(s),110)),DEFAULT_CHARACTER_SUPPLIES);
});

test('paid arrivals use the authored supplies and consumption survives saves, renewal, dismissal and rehire',()=>{
 const d=defaultContentPackage();person(d).startingSupplies=allocation;
 let s=initialCampaign(42,d);assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));
 s=order(s,{type:'recruitCivic',id:110,term:'day'});assert.ok(!s.recruited.includes(110));assert.deepEqual(supplies(s.operativeState[110]),allocation);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:6});let p=visit(s);assert.deepEqual(supplies(unit(p,110)),allocation);
 const u=unit(p,110);p=tactical(p,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y});p=saved(p);
 const consumed={...allocation,torches:0};assert.deepEqual(supplies(unit(p,110)),consumed);
 assert.match(actBattle(p.battle,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y}).lastError,/antorchas/);
 s=leave(p);assert.deepEqual(supplies(s.operativeState[110]),consumed);
 s=order(s,{type:'renewContract',id:110,term:'day'});assert.deepEqual(supplies(s.operativeState[110]),consumed);
 s=order(s,{type:'dismiss',id:110});assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));
 s=order(s,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});p=visit(saved({campaign:s}).campaign);assert.deepEqual(supplies(unit(p,110)),consumed);
 s=leave(p);const price=refillCost(s.operativeState[110]),money=s.resources.treasury;s=order(s,{type:'resupply',operativeId:110});assert.equal(s.resources.treasury,money-price);
 assert.deepEqual(supplies(s.operativeState[110]),{...DEFAULT_CHARACTER_SUPPLIES,rations:3,boleadoras:0});
 assert.deepEqual(person(d).startingSupplies,allocation,'mutable campaign supplies do not edit the content package');
});

test('a physically recruited resident keeps the same finite allocation after leaving service and returning',()=>{
 const d=localPackage();d.characters.find(c=>c.id==='alma-contract').startingSupplies={...allocation,medkits:5,boleadoras:4};
 let p=hireLocal(readyLocal(undefined,d)),id=localId(p.campaign);const initial={...allocation,medkits:5,boleadoras:4};assert.deepEqual(supplies(unit(p,id)),initial);
 const u=unit(p,id);p=tactical(p,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y});let s=leave(saved(p));const consumed={...initial,torches:0};assert.deepEqual(supplies(s.operativeState[id]),consumed);
 s=order(s,{type:'dismiss',id});p=visit(saved({campaign:s}).campaign);const n=localNPC(p.battle),speaker=p.battle.units.find(u=>u.side==='player');const spot=getReachable(p.battle,speaker.id).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});p=hireLocal(p);assert.deepEqual(supplies(unit(p,id)),consumed);
});

test('zero supplies also survive historical in-person recruitment',()=>{
 const d=defaultContentPackage();person(d,3).startingSupplies=Object.fromEntries(Object.keys(DEFAULT_CHARACTER_SUPPLIES).map(k=>[k,0]));person(d).arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'week'}),p=visit(s);const npc=p.battle.npcs.find(n=>n.operativeId===3),speaker=unit(p,110);assert.ok(npc);
 const spot=getReachable(p.battle,speaker.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 s=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:speaker.id,approach:'recruit',sectorState:p.battle});assert.ok(s.recruited.includes(3));assert.deepEqual(supplies(s.pendingBattle.squad.find(u=>u.id===3)),person(d,3).startingSupplies);
});
