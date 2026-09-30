import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,civicStatus} from '../game/campaign.js';
import {encounterHireTerms,encountersFor} from '../game/encounters.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {A,order,saved,localId,localNPC,localPackage,visit,sync,tactical,readyLocal,talk,hireLocal,leave} from './local-contract-fixture.mjs';
import {approachNPC} from './approach-npc.mjs';
import {applyCivilianHarm} from '../game/civilian-harm.js';

test('local paid residents offer all terms and begin service in place without becoming bulletin arrivals',()=>{
 for(const [term,hours,price]of [['day',24,10],['week',168,70],['month',720,300]]){
  let p=readyLocal(),id=localId(p.campaign),cash=p.campaign.resources.treasury,hour=p.campaign.hour;
  const quotes=encounterHireTerms(p.campaign,localNPC(p.battle));assert.deepEqual(quotes.map(q=>[q.term,q.hours,q.price]),[['day',24,10],['week',168,70],['month',720,300]]);
  assert.equal(civicStatus(p.campaign,id).available,false);assert.ok(dispatchCampaign(p.campaign,{type:'recruitCivic',id,term}).lastError);
  const direct=order(p.campaign,talk(p,term,'direct'));assert.match(direct.lastConversation.text,/un día, 10 pesos; una semana, 70 pesos; un mes, 300 pesos/);assert.ok(!direct.lastConversation.text.includes('sin paga'));
  const repeated=talk(p,term);p=hireLocal(p,term);const duplicate=dispatchCampaign(p.campaign,repeated);assert.ok(duplicate.lastError);assert.equal(duplicate.resources.treasury,p.campaign.resources.treasury);assert.deepEqual(duplicate.recruited,p.campaign.recruited);assert.equal(p.campaign.resources.treasury,cash-price);assert.equal(p.campaign.contracts[id].kind,'paid');assert.equal(p.campaign.contracts[id].expiresAt,hour+hours);assert.equal(p.campaign.hiringArrivals.length,0);
  assert.ok(p.battle.units.some(u=>u.id===String(id)));assert.equal(localNPC(p.battle),undefined);assert.ok(!encountersFor(p.campaign,A).some(n=>n.operativeId===id));assert.ok(saved(p));
 }
});

test('insufficient money and invalid terms cannot charge or transfer a local resident',()=>{
 const p=readyLocal({pay:1000000}),id=localId(p.campaign),cash=p.campaign.resources.treasury;
 assert.equal(encounterHireTerms(p.campaign,localNPC(p.battle)).every(q=>!q.available),true);
 for(const term of ['day','year']){const n=dispatchCampaign(p.campaign,talk(p,term));assert.ok(n.lastError);assert.equal(n.resources.treasury,cash);assert.ok(!n.recruited.includes(id));assert.equal(n.contracts[id],undefined);assert.ok(saved({campaign:n,battle:p.battle}));}
});

test('wounded local recruits retain health through deferred expiry, return and rehire',()=>{
 let p=readyLocal();applyCivilianHarm(p.battle,localNPC(p.battle),{damage:20,intentional:false});p=sync(p);p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});const hp=localNPC(p.battle).hp;
 p=hireLocal(p);const id=localId(p.campaign);assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,hp);
 for(let i=0;i<144;i++)p.battle=actBattle(p.battle,{type:'rest'});p=saved(sync(p));
 assert.equal(p.campaign.contracts[id].departurePending,true);assert.ok(p.campaign.recruited.includes(id));assert.equal(localNPC(p.battle),undefined);
 let s=leave(p);assert.ok(!s.recruited.includes(id));assert.equal(s.contracts[id],undefined);p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).hp,hp);assert.equal(p.battle.units.some(u=>u.id===String(id)),false);
 // Use normal approach after the scene is reconstructed.
 const npc=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player');p=sync({campaign:p.campaign,battle:approachNPC(p.battle,unit.id,npc.id)});
 p=hireLocal(p,'week');assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,hp);assert.equal(p.campaign.contracts[id].term,'week');assert.ok(saved(p));
});

test('bandaging a resident hurt by the player does not erase refusal or permit a paid hire',()=>{
 let p=readyLocal();p=tactical(p,{type:'melee',targetId:localNPC(p.battle).id});p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});p=saved(p);
 const before=structuredClone(p.campaign),rejected=dispatchCampaign(p.campaign,talk(p));assert.match(rejected.lastError,/Me heriste/);assert.deepEqual({...rejected,lastError:null},before);assert.deepEqual(p.campaign,before);assert.ok(saved(p));
});


test('renewal and dismissal preserve paid local identity and reject permanent-contract forgeries',()=>{
 let p=hireLocal(readyLocal(),'day'),id=localId(p.campaign),s=leave(p),until=s.contracts[id].expiresAt,cash=s.resources.treasury;
 s=order(s,{type:'renewContract',id,term:'week'});assert.equal(s.contracts[id].expiresAt,until+168);assert.equal(s.resources.treasury,cash-70);assert.ok(saved({campaign:s}));
 const wire=JSON.parse(encodeSave(s));Object.assign(wire.campaign.contracts[id],{kind:'patriot',expiresAt:null});assert.throws(()=>decodeSave(JSON.stringify(wire)),/servicio/);
 s=order(s,{type:'dismiss',id});assert.equal(s.resources.treasury,cash-70);assert.ok(!s.recruited.includes(id));assert.ok(encountersFor(s,A).some(n=>n.operativeId===id));assert.ok(saved({campaign:s}));
});

test('zero-price local contracts still expire and unpaid permanent service remains explicit',()=>{
 let p=hireLocal(readyLocal({pay:0})),id=localId(p.campaign),s=leave(p);assert.equal(s.contracts[id].kind,'paid');assert.equal(s.contracts[id].paid,0);assert.ok(Number.isInteger(s.contracts[id].expiresAt));
 const expires=s.contracts[id].expiresAt;while(s.hour<expires){const before=s.hour;s=order(s,{type:'wait',hours:expires-s.hour});assert.ok(s.hour>before,'time must advance after each notice');}assert.ok(!s.recruited.includes(id));assert.ok(saved({campaign:s}));
 p=readyLocal({pay:0,service:'permanent'});assert.deepEqual(encounterHireTerms(p.campaign,localNPC(p.battle)),[]);p=hireLocal(p);assert.equal(p.campaign.contracts[localId(p.campaign)].expiresAt,null);
 const bad=localPackage({pay:10,service:'permanent'});assert.throws(()=>initialCampaign(42,bad));
});
