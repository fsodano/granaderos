import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {runCivilianPhase,advanceCivilianTime} from '../game/npc-ai.js';
import {applyCivilianHarm,civilianIncidents} from '../game/civilian-harm.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {order,saved,visit,leave,tactical,talk,localPackage,localNPC,localId,hireLocal,approachLocal} from './local-contract-fixture.mjs';

const field=(condition={})=>createBattle([{id:'p',x:0,y:7}],{width:12,height:8,exploration:true,enemies:[],npcs:[{id:'resident',name:'Habitante',x:5,y:3,hp:60,maxHp:80,energy:0,...condition}]});

test('loaded civilian phases recover breath after the actor turn without healing, moving on wake, clearing harm or granting AP',()=>{
 const s=field(),n=s.npcs[0],before=structuredClone(s.units);assert.equal(n.unconscious,true);
 runCivilianPhase(s);assert.equal(n.energy,10);assert.equal(n.unconscious,false);assert.equal(n.hp,60);assert.deepEqual([n.x,n.y],[5,3]);assert.equal(n.ai,undefined);assert.deepEqual(s.units,before);assert.equal(n.ap,undefined);assert.equal(s.phase,'player');
 assert.ok(validateBattleSnapshot(s));runCivilianPhase(s);assert.ok(n.ai);assert.equal(n.energy,20);
 // A real harm receipt remains intact during recovery; no attribution is erased.
 applyCivilianHarm(s,n,{damage:1,breathLoss:100,source:s.units[0],intentional:true});assert.equal(n.energy,0);const wounds=structuredClone(civilianIncidents(n)),hp=n.hp,bleeding=n.bleeding;assert.equal(wounds[0].side,'player');
 runCivilianPhase(s);assert.equal(n.hp,hp);assert.equal(n.bleeding,bleeding);assert.deepEqual(civilianIncidents(n),wounds);assert.equal(n.energy,10);assert.ok(validateBattleSnapshot(s));
});

test('critical residents and bodies do not wake or heal, and loaded recovery keeps a split saved six-second cadence',()=>{
 let a=field(),b=structuredClone(a);a.elapsedSeconds=60;advanceCivilianTime(a,60);
 for(let i=0;i<20;i++){b.elapsedSeconds+=3;advanceCivilianTime(b,3);if(i===8)b=validateBattleSnapshot(b);}
 assert.equal(a.npcs[0].energy,100);assert.deepEqual(a.npcs,b.npcs);assert.equal(a.civilianTurns,10);assert.equal(b.civilianTurns,10);
 for(const hp of [1,14,0]){const s=field({hp}),n=s.npcs[0];for(let i=0;i<12;i++)runCivilianPhase(s);assert.equal(n.hp,hp);assert.equal(n.energy,hp?100:0);assert.equal(n.unconscious,hp>0);assert.deepEqual([n.x,n.y],[5,3]);assert.equal(n.ai,undefined);assert.ok(validateBattleSnapshot(s));}
 const gone=field();gone.npcs[0].departure=true;runCivilianPhase(gone);assert.equal(gone.npcs[0].energy,0);
});

test('actual tactical time recovers civilians once per completed round or six exploration seconds, while field aid grants no breath',()=>{
 const original=field({hp:1,stance:'prone'}),treated=actBattle(createBattle([{id:'doc',x:4,y:3,medical:80,medkits:2,activeSlot:'medical'}],{width:12,height:8,exploration:true,enemies:[],npcs:original.npcs}),{type:'heal',unitId:'doc',targetId:'resident'});
 assert.equal(treated.lastError,null);assert.ok(treated.npcs[0].hp>1);assert.equal(treated.npcs[0].energy,0);assert.equal(treated.npcs[0].unconscious,true);
 const stabilized=actBattle(treated,{type:'heal',unitId:'doc',targetId:'resident'});assert.equal(stabilized.lastError,null);assert.equal(stabilized.npcs[0].hp,15);assert.equal(stabilized.npcs[0].energy,0);assert.equal(stabilized.npcs[0].unconscious,true);assert.equal(stabilized.units[0].medkits,0);
 const awake=actBattle(stabilized,{type:'ambient'});assert.equal(awake.npcs[0].energy,10);assert.equal(awake.npcs[0].unconscious,false);assert.equal(awake.npcs[0].hp,15);assert.equal(awake.npcs[0].stance,'prone');assert.equal(awake.units[0].medkits,0);
 let explored=actBattle(field(),{type:'ambient'});assert.equal(explored.npcs[0].energy,10);assert.equal(explored.npcs[0].hp,60);assert.equal(explored.elapsedSeconds,6);
 const battle=createBattle([{id:'p',x:0,y:7}],{width:12,height:8,enemies:[{id:'enemy',x:11,y:0,patrol:false,overwatch:false}],npcs:field().npcs});
 const after=endTurn(battle);assert.equal(after.npcs[0].energy,10);assert.equal(after.civilianTurns,1);assert.equal(after.npcs[0].hp,60);assert.ok(validateBattleSnapshot(after));
});

test('an authored exhausted resident stays unchanged off map, wakes in its loaded sector and retains recovery through conversation, hire and saved return',()=>{
 const d=localPackage({pay:0,service:'permanent'}),resident=d.characters.find(c=>c.id==='alma-contract');resident.startingCondition={hp:95,energy:0,fatigue:0,bleeding:0,bandaged:0};
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'}),id=localId(s);s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[id].energy,0);s=order(s,{type:'travel',sector:'cell-27-27'});let p=visit(s),n=localNPC(p.battle);assert.equal(n.energy,0);assert.equal(n.unconscious,true);assert.ok(dispatchCampaign(p.campaign,talk(p)).lastError);
 p=tactical(p,{type:'ambient'});assert.equal(localNPC(p.battle).energy,10);assert.equal(localNPC(p.battle).unconscious,false);p=saved(p);assert.equal(p.campaign.operativeState[id].energy,10);
 s=leave(p);s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[id].energy,10,'unloaded strategic time does not recover a resident');p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).energy,10);
 p=approachLocal(saved(p));const recovered=localNPC(p.battle).energy;assert.ok(recovered>=10);p=hireLocal(p);assert.equal(p.battle.units.find(u=>u.id===String(id)).energy,recovered);
 s=order(leave(p),{type:'dismiss',id});p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).energy,recovered);assert.equal(localNPC(p.battle).hp,95);assert.equal(resident.startingCondition.energy,0);assert.ok(saved(p));
});
