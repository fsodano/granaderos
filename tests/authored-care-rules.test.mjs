import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_CARE_RULES,careRules,CARE_RULE_FIELDS} from '../game/campaign-care-rules.js';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {medicalSupplyQuote} from '../game/medical-care.js';
import {workshopServiceQuote} from '../game/workshop-service.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {preparedCare,DOCTOR,PATIENT} from './medical-care-fixture.mjs';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {assertTradeRejected} from './commerce-gear-fixture.mjs';
const rules=values=>({...DEFAULT_CARE_RULES,...values});
const op=(s,id)=>rosterFor(s).find(o=>o.id===id);

test('care rules are optional, portable and strict, retaining old package identity without inserting defaults',()=>{
 const d=defaultContentPackage();assert.equal(d.careRules,undefined);assert.deepEqual(careRules(initialCampaign()),DEFAULT_CARE_RULES);const old=initialCampaign(8,d),identity=old.contentCampaign.identity;assert.deepEqual(careRules(saved({campaign:old}).campaign),DEFAULT_CARE_RULES);assert.deepEqual(saved({campaign:old}).campaign.contentCampaign.identity,identity);assert.equal(saved({campaign:old}).campaign.contentCampaign.package.careRules,undefined);
 d.careRules=rules({minimumSkill:0,dressingPrice:0,restHealingHours:168});assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(careRules(initialCampaign(8,d)),d.careRules);
 const invalid=[null,[],{}, {...d.careRules,extra:1}];for(const [key,,min,max]of CARE_RULE_FIELDS)for(const value of [min-1,max+1,1.5,'2'])invalid.push({...d.careRules,[key]:value});
 for(const config of invalid){const x={...d,careRules:config};assert.ok(validateContentPackage(x).length);assert.throws(()=>initialCampaign(8,x));}
});

test('authored skill, healing and work costs drive actual assignments, safe hours and pinned saves',()=>{
 let s=preparedCare({careRules:rules({minimumSkill:90})});assert.ok(dispatchCampaign(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'}).lastError);
 s=preparedCare({careRules:rules({minimumSkill:0,baseHealing:5,skillStep:40,energyCost:7,fatigueCost:9,restEnergy:4,restFatigue:3})});
 const hp=s.operativeState[PATIENT].hp;s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});s=order(s,{type:'wait',hours:2});assert.equal(s.operativeState[PATIENT].hp,hp+7);assert.equal(s.operativeState[DOCTOR].energy,82,'fatigue limits current breath to 100 minus fatigue');assert.equal(s.operativeState[DOCTOR].fatigue,18);assert.equal(s.operativeState[DOCTOR].medkits,2);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'rest'});s=advanceCampaignHours(s,2);assert.equal(s.hour,4);assert.equal(s.operativeState[DOCTOR].energy,86,'rest obeys the profile sleep need and fatigue ceiling');assert.equal(s.operativeState[DOCTOR].fatigue,14);assert.equal(s.operativeState[DOCTOR].medkits,2);s=saved({campaign:s}).campaign;assert.equal(careRules(s).baseHealing,5);
 const altered=structuredClone(s);altered.contentCampaign.package.careRules.baseHealing=99;assert.throws(()=>saved({campaign:altered}),/identidad/);
 s=order(s,{type:'assignCare',id:PATIENT,assignment:'doctor'});assert.equal(op(s,PATIENT).medical,0);assert.ok(saved({campaign:s}),'authored zero minimum also applies to saved doctor eligibility');
});

test('configured rest intervals above six preserve midpoint saves and award only the actual completed interval',()=>{
 let s=preparedCare({careRules:rules({restHealingHours:9,restEnergy:0,restFatigue:0})});Object.assign(s.operativeState[PATIENT],{bleeding:0,energy:30,fatigue:40});synchronizeCampaignPresence(s);s=order(saved({campaign:s}).campaign,{type:'assignCare',id:PATIENT,assignment:'rest'});const hp=s.operativeState[PATIENT].hp;
 s=order(s,{type:'wait',hours:8});assert.equal(s.operativeState[PATIENT].recoveryHours,8);s=saved({campaign:s}).campaign;assert.equal(s.operativeState[PATIENT].hp,hp);assert.equal(s.operativeState[PATIENT].energy,30);assert.equal(s.operativeState[PATIENT].fatigue,40);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[PATIENT].hp,hp+1);assert.equal(s.operativeState[PATIENT].recoveryHours,0);
 const wire=JSON.parse(encodeSave(s));wire.campaign.operativeState[PATIENT].recoveryHours=9;assert.throws(()=>decodeSave(JSON.stringify(wire)),/asignaciones|descanso/);
 s=order(s,{type:'assignCare',id:PATIENT,assignment:'active'});const p=visit(s);assert.equal(p.battle.units.find(u=>u.id===String(PATIENT)).hp,hp+1);assert.ok(saved(p));
});

test('old authored dressing quotes retain their pinned prices while all refill callbacks stay closed',()=>{
 for(const price of [0,17]){
  let s=preparedCare({careRules:rules({dressingPrice:price})});s.operativeState[DOCTOR].medkits=0;s=saved({campaign:s}).campaign;const before=s.resources.treasury;
  const bulk=medicalSupplyQuote(s,op(s,DOCTOR),4,isSupplied(s,s.location)),refill=workshopServiceQuote(s,op(s,DOCTOR),'resupply',isSupplied(s,s.location));assert.equal(bulk.cost,price*4);assert.equal(refill.cost,price*2);assert.equal(refill.available,true);
  assertTradeRejected(s,{type:'resupply',operativeId:DOCTOR});assertTradeRejected(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:4});assert.equal(s.resources.treasury,before);assert.equal(s.operativeState[DOCTOR].medkits,0);assert.ok(saved({campaign:s}));
 }
});

test('free authored work costs keep finite dressing consumption and changing an external draft cannot alter an active campaign',()=>{
 const d=defaultContentPackage();d.careRules=rules({energyCost:0,fatigueCost:0,dressingPrice:17});d.characters.find(c=>c.id==='person-110').arrivalHours=0;let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'month'});d.careRules.dressingPrice=0;assertTradeRejected(s,{type:'purchaseMedicalSupplies',id:110,quantity:1});assert.equal(careRules(s).dressingPrice,17);assert.ok(saved({campaign:s}));
 s=preparedCare({careRules:rules({energyCost:0,fatigueCost:0})});s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'assignCare',id:PATIENT,assignment:'patient'});s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[DOCTOR].energy,100);assert.equal(s.operativeState[DOCTOR].fatigue,0);assert.equal(s.operativeState[DOCTOR].medkits,3);
});
