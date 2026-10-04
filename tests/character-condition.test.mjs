import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage,validateContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {encountersFor} from '../game/encounters.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {getReachable} from '../game/tactical.js';
import {order,saved,visit,leave,tactical,talk,localPackage,readyLocal,localNPC,localId,hireLocal} from './local-contract-fixture.mjs';

const person=(d,id=110)=>d.characters.find(c=>c.id===`person-${id}`);
const state=(hp=30)=>({hp,energy:61,fatigue:23,bleeding:0,bandaged:7});
const condition=o=>Object.fromEntries(['hp','energy','fatigue','bleeding','bandaged'].map(k=>[k,o[k]]));

test('initial condition validates complete finite integer fields and coherent wounds without changing legacy content identity',()=>{
 const d=defaultContentPackage(),identity=contentIdentity(d),max=person(d).attributes.maxHp;
 assert.equal(person(d).startingCondition,undefined);assert.deepEqual(contentIdentity(parseContentPackage(encodeContentPackage(d))),identity);
 const old=saved({campaign:initialCampaign(42,d)}).campaign;assert.equal(old.operativeState[110].hp,max);assert.equal(old.operativeState[110].energy,100);
 for(const bad of [null,[],{},30,{...state(),hp:0},{...state(),hp:max+1},{...state(),hp:1.5},{...state(),energy:-1},{...state(),energy:101},{...state(),fatigue:'23'},{...state(),fatigue:Infinity},{...state(),bleeding:11},{...state(),bandaged:-1},{...state(),bandaged:max},{...state(max),bandaged:0,bleeding:1},{...state(),bandaged:max-30,bleeding:1},{...state(),alive:true}]){
  person(d).startingCondition=bad;assert.ok(validateContentPackage(d).some(e=>e.includes('startingCondition')),JSON.stringify(bad));assert.throws(()=>initialCampaign(42,d));
 }
 person(d).startingCondition=state();assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);
 const imported=parseContentPackage(encodeContentPackage(d));assert.deepEqual(person(imported).startingCondition,state());assert.deepEqual(condition(saved({campaign:initialCampaign(42,imported)}).campaign.operativeState[110]),state());
 for(const value of [{hp:1,energy:0,fatigue:100,bleeding:10,bandaged:0},{hp:max,energy:100,fatigue:0,bleeding:0,bandaged:0},{...state(),bandaged:max-30}]){person(d).startingCondition=value;assert.deepEqual(condition(saved({campaign:initialCampaign(42,d)}).campaign.operativeState[110]),value);}
 person(d).startingCondition=state();
 person(d).attributes.maxHp=20;assert.ok(validateContentPackage(d).some(e=>e.includes('startingCondition')));
});

test('authored paid candidates remain off the map and preserve condition through arrival, actual recovery and rehire',()=>{
 const d=defaultContentPackage();person(d).startingCondition=state();let s=initialCampaign(42,d);
 assert.deepEqual(condition(s.operativeState[110]),state());assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));
 s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.ok(!s.recruited.includes(110));assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));s=order(saved({campaign:s}).campaign,{type:'wait',hours:6});assert.deepEqual(condition(s.operativeState[110]),state());
 s=order(s,{type:'assignCare',id:110,assignment:'rest'});s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[110].hp,31);assert.ok(s.operativeState[110].energy>61);assert.ok(s.operativeState[110].fatigue<23);assert.equal(s.operativeState[110].bandaged,7);
 s=order(s,{type:'assignCare',id:110,assignment:'active'});const recovered=condition(s.operativeState[110]);s=order(s,{type:'renewContract',id:110,term:'week'});s=order(s,{type:'dismiss',id:110});assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));
 s=order(saved({campaign:s}).campaign,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});assert.deepEqual(condition(s.operativeState[110]),recovered);assert.equal(s.operativeState[110].location,'retiro');
 const p=visit(s);assert.equal(p.battle.units.find(u=>u.id==='110').hp,recovered.hp);assert.deepEqual(person(d).startingCondition,state());assert.equal(saved(p).campaign.contentCampaign.package.characters.find(c=>c.id==='person-110').startingCondition.hp,30);
});

test('an editor-authored critical resident is stabilized, recruited, treated with found supplies and returns without resetting',()=>{
 const d=localPackage({pay:0,service:'permanent'}),resident=d.characters.find(c=>c.id==='alma-contract');resident.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};person(d).attributes.medical=80;
 let p=readyLocal(undefined,d),npc=localNPC(p.battle);assert.equal(npc.hp,1);assert.equal(npc.unconscious,true);assert.equal(npc.civilianHarm,undefined);assert.ok(dispatchCampaign(p.campaign,talk(p)).lastError);
 p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:npc.id});p=saved(p);assert.ok(localNPC(p.battle).hp>1&&localNPC(p.battle).hp<15);assert.equal(p.battle.units.find(u=>u.id==='110').medkits,1);
 p=tactical(p,{type:'heal',targetId:npc.id});assert.equal(localNPC(p.battle).hp,15);assert.equal(localNPC(p.battle).unconscious,false);assert.equal(p.battle.units.find(u=>u.id==='110').medkits,0);assert.deepEqual(civilianIncidents(localNPC(p.battle)),[]);
 p=hireLocal(saved(p));const id=localId(p.campaign);assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,15);
 let s=order(leave(p),{type:'travel',sector:'retiro'});const money=s.resources.treasury;s=leaveFiniteCache(takeFiniteCache(visit(s),110,[{item:'medkits',count:2}]));assert.equal(s.resources.treasury,money);s=order(s,{type:'assignCare',id:110,assignment:'doctor'});s=order(s,{type:'assignCare',id,assignment:'patient'});s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[id].hp,27);assert.equal(s.operativeState[110].medkits,0);
 s=order(saved({campaign:s}).campaign,{type:'dismiss',id});s=order(s,{type:'assignCare',id:110,assignment:'active'});s=order(s,{type:'travel',sector:'cell-27-27'});p=visit(s);assert.equal(localNPC(p.battle).hp,27);assert.equal(localNPC(p.battle).bandaged,68);assert.equal(localNPC(p.battle).civilianFirstAid,undefined);
 const n=localNPC(p.battle),u=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,u.id).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});p=hireLocal(saved(p));assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,27);assert.equal(resident.startingCondition.hp,1);
});

test('authored bleeding enters the actual civilian clock without blaming the player and death remains saved',()=>{
 const d=localPackage({pay:0,service:'permanent'});d.characters.find(c=>c.id==='alma-contract').startingCondition={hp:4,energy:100,fatigue:0,bleeding:3,bandaged:0};d.placements.find(p=>p.character==='alma-contract').sectors=['retiro'];
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});let p=visit(s);assert.equal(localNPC(p.battle).hp,4);assert.equal(localNPC(p.battle).bleeding,3);assert.equal(localNPC(p.battle).bleedSource.side,'unknown');
 for(let i=0;i<5&&localNPC(p.battle).hp>0;i++)p=tactical(p,{type:'rest'});
 assert.equal(localNPC(p.battle).hp,0);assert.ok(civilianIncidents(localNPC(p.battle)).every(e=>e.side==='unknown'));p=saved(p);const id=localId(p.campaign);assert.equal(p.campaign.operativeState[id].alive,false);s=leave(p);p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).hp,0);assert.ok(saved(p));
});
