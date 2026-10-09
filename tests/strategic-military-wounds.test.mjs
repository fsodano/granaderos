import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,dailyIncome} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage,parseContentPackage,encodeContentPackage} from '../game/content-package.js';
import {DEFAULT_CARE_RULES,strategicBleedingPercent} from '../game/campaign-care-rules.js';
import {careStatus} from '../game/medical-care.js';
import {order,saved,localId,visit,tactical,A} from './local-contract-fixture.mjs';
import {woundedService} from './civilian-service-fixture.mjs';
const rules=percent=>({...DEFAULT_CARE_RULES,bleedingDamagePercent:percent});
const current=(s,id=localId(s))=>s.operativeState[id];

test('optional strategic bleeding rate keeps legacy content identity and rejects malformed or unpinned rules',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);assert.equal(d.careRules,undefined);assert.equal(strategicBleedingPercent(s),25);assert.deepEqual(saved({campaign:s}).campaign.contentCampaign.identity,s.contentCampaign.identity);
 d.careRules={...DEFAULT_CARE_RULES};const old=initialCampaign(42,d);assert.equal(strategicBleedingPercent(old),25);assert.equal(saved({campaign:old}).campaign.contentCampaign.package.careRules.bleedingDamagePercent,undefined);
 for(const value of [0,50,100]){d.careRules=rules(value);assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);const campaign=initialCampaign(42,d);assert.equal(strategicBleedingPercent(saved({campaign}).campaign),value);}
 for(const value of [-1,101,.5,'25',null]){d.careRules=rules(value);assert.ok(validateContentPackage(d).length);assert.throws(()=>initialCampaign(42,d));}
 const forged=structuredClone(old);forged.contentCampaign.package.careRules.bleedingDamagePercent=100;assert.throws(()=>saved({campaign:forged}),/identidad/);
});

test('actual military wounds consume configured hourly health through waits and saves without a daily heal',()=>{
 let s=woundedService({term:'week',careRules:rules(50),contactHour:20}),id=localId(s);const before=structuredClone(current(s)),loss=Math.ceil(before.bleeding/2);assert.ok(loss>0);
 const batch=order(s,{type:'wait',hours:3});for(let i=0;i<3;i++)s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.deepEqual(current(s),current(batch));assert.equal(current(s).hp,before.hp-loss*3);assert.equal(current(s).torches,before.torches);assert.equal(current(s).bleeding,before.bleeding);
 const toMidnight=24-s.hour%24;assert.ok(current(s).hp>loss*toMidnight);{const hp=current(s).hp;s=order(s,{type:'wait',hours:toMidnight});assert.equal(current(s).hp,hp-loss*toMidnight,'midnight does not heal an open wound');}
 assert.match(careStatus(s,rosterFor(s).find(o=>o.id===id),rosterFor(s)),/Hemorragia/);assert.ok(saved({campaign:s}));
 const zero=woundedService({term:'week',careRules:rules(0)}),unchanged=order(zero,{type:'wait',hours:24});assert.equal(current(unchanged).hp,current(zero).hp);assert.equal(current(unchanged).bleeding,current(zero).bleeding);
});

test('finite doctor treatment precedes hourly loss and rest alone cannot stop an actual service wound',()=>{
 let s=woundedService({medical:80,term:'week',careRules:rules(100)}),id=localId(s),hp=current(s).hp;const stock=s.operativeState[110].medkits;
 s=order(s,{type:'assignCare',id,assignment:'patient'});s=order(s,{type:'assignCare',id:110,assignment:'doctor'});s=order(s,{type:'wait',hours:1});assert.equal(current(s).hp,hp);assert.equal(current(s).bleeding,0);assert.equal(s.operativeState[110].medkits,stock-1);assert.ok(saved({campaign:s}));
 s=woundedService({term:'week'});id=localId(s);hp=current(s).hp;const bleed=current(s).bleeding;s=order(s,{type:'assignCare',id,assignment:'rest'});const hour=s.hour;s=order(s,{type:'wait',hours:2});assert.equal(s.hour,hour);assert.equal(s.assignmentAttention.notice.events[0].code,'bleeding');s=order(s,{type:'wait',hours:2});assert.equal(s.hour,hour+2);assert.equal(current(s).hp,hp-2*Math.ceil(bleed/4));assert.equal(current(s).bleeding,bleed);assert.equal(current(s).recoveryHours,0);assert.ok(saved({campaign:s}));
});

test('a remote service wound advances once while another squad acts, without also damaging deployed troops',()=>{
 let s=woundedService({term:'week'}),id=localId(s);s=order(s,{type:'createSquad',name:'Médico en posta',ids:[110]});let p=visit(s);const hp=current(p.campaign).hp,doctor=p.battle.units.find(u=>Number(u.id)===110).hp,loss=Math.ceil(current(p.campaign).bleeding/4),start=p.campaign.hour;
 while(p.campaign.hour===start)p=tactical(p,{type:'rest',seconds:600});
 assert.equal(current(p.campaign).hp,hp-loss);assert.equal(p.battle.units.find(u=>Number(u.id)===110).hp,doctor);assert.ok(saved(p));
 // A loaded wounded resident owns its tactical health. Campaign synchronization
 // does not subtract another strategic interval from its dormant service record.
 s=woundedService({term:'week',careRules:rules(100)});p=visit(s);const serviceHP=current(p.campaign).hp;let b=p.battle;for(let i=0;i<6;i++)p=tactical(p,{type:'rest',seconds:600});assert.equal(current(p.campaign).hp,serviceHP);assert.ok(p.battle.units.find(u=>Number(u.id)===localId(p.campaign)).hp<b.units.find(u=>Number(u.id)===localId(p.campaign)).hp);assert.ok(saved(p));
});

test('a real wound can end service during a march, preserving one death and the last reached cell',()=>{
 const configure=d=>{d.characters.push({...structuredClone(d.characters.find(c=>c.id==='alma-contract')),id:'alma-successor',name:'Sucesora de Alma'});d.placements.push({id:'successor-placement',character:'alma-successor',mode:'fixed',sectors:[A],moveChance:100,afterDeath:'alma-contract',delayMin:1,delayMax:1});};
 let s=woundedService({term:'week',careRules:rules(100),configure}),id=localId(s),loss=current(s).bleeding;const hours=Math.ceil(current(s).hp/loss)-1;if(hours)s=order(s,{type:'wait',hours});assert.ok(current(s).hp>0&&current(s).hp<=loss);
 s=order(s,{type:'squad',ids:[id]});const origin=s.location,at=s.hour;const treasury=s.resources.treasury,income=at%24===23?dailyIncome(s):0,stock=current(s).torches;s=order(s,{type:'travel',sector:A});assert.equal(s.hour,at+1);assert.equal(s.location,origin);assert.equal(current(s).location,origin);assert.equal(current(s).hp,0);assert.equal(current(s).alive,false);assert.equal(current(s).deathMinute,s.hour*60+Math.floor((s.secondOfHour??0)/60));assert.equal(current(s).torches,stock);assert.deepEqual(s.squad,[]);assert.ok(s.recruited.includes(id),'a death remains in the service history');assert.ok(!s.squads.some(q=>q.members.includes(id)));assert.equal(s.resources.treasury,treasury+income);
 const death=current(s).deathMinute;assert.equal(s.contentPresence.people['alma-successor'].appeared,false);assert.equal(s.contentPresence.receipts.find(r=>r.trigger==='alma-contract').at,death+1);s=saved({campaign:s}).campaign;s=order(s,{type:'wait',hours:2});assert.equal(current(s).deathMinute,death);assert.equal(s.contentPresence.people['alma-successor'].appeared,true);assert.equal(s.contentPresence.receipts.filter(r=>r.trigger==='alma-contract').length,1);assert.equal(s.log.filter(e=>e.text==='Alma Contratada fallece por sus heridas.').length,1);assert.ok(dispatchCampaign(s,{type:'renewContract',id,term:'week'}).lastError);s=order(s,{type:'dismiss',id});assert.equal(s.contentPresence.people['alma-contract'].alive,false);assert.ok(saved({campaign:s}));
});

test('a strategic death triggers an authored ending at that hour and remains a loss after saving',()=>{
 const configure=d=>{d.campaignStory={introduction:'La guardia de Alma.',chapters:[{id:'guard',name:'Sostener la guardia',objective:'Mantener la guardia durante la campaña.',conditions:[{type:'day',min:100,max:null}]}],victory:'La guardia cumplió su misión.',defeat:'La guardia perdió a Alma.',failureConditions:[{type:'character',character:'alma-contract',state:'dead'}]};};
 let s=woundedService({term:'week',careRules:rules(100),configure}),id=localId(s),at=s.hour,remaining=Math.ceil(current(s).hp/current(s).bleeding);s=order(s,{type:'wait',hours:remaining+3});assert.equal(s.hour,at+remaining);assert.equal(s.defeated,true);assert.equal(current(s).alive,false);assert.ok(saved({campaign:s}).campaign.defeated);assert.ok(dispatchCampaign(s,{type:'wait',hours:1}).lastError);
});

test('unhired, in-transit and dismissed bulletin candidates stay outside the military wound clock',()=>{
 const d=defaultContentPackage();d.careRules=rules(100);const candidate=d.characters.find(c=>c.id==='person-110');candidate.startingCondition={hp:20,energy:100,fatigue:0,bleeding:4,bandaged:0};candidate.arrivalHours=2;
 let s=order(initialCampaign(42,d),{type:'wait',hours:12});assert.equal(s.operativeState[110].hp,20);s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[110].hp,20);assert.ok(s.recruited.includes(110));s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(s.operativeState[110].hp,16);
 s=order(s,{type:'dismiss',id:110});s=order(s,{type:'wait',hours:24});assert.equal(s.operativeState[110].hp,16);assert.equal(s.contentPresence.people['person-110'].sector,null);assert.deepEqual(Object.keys(s.civilianState.people),[]);assert.ok(saved({campaign:s}));
});
