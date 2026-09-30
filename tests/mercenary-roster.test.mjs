import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,serializeCampaign,restoreCampaign,contractQuote} from '../game/campaign.js';
import {CIVIC_RECRUITS} from '../game/recruitment.js';
import {OPERATIVES,CAMPAIGN_SECTORS} from '../game/data.js';
import {MERCENARY_ADDITIONS,FORMER_OFFICER_IDS} from '../game/mercenaries.js';
import {CHARACTER_PROFILES,SPEECH_EVENTS} from '../game/characters.js';
import {filterMercenaries} from '../game/mercenary-catalogue.js';
import {createBattle,WEAPONS,BLADES} from '../game/tactical.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type} ${a.id}: ${next.lastError}`);return next;};
test('ten former senior officers are foreign paid volunteers with distinct specialties',()=>{
 const officers=FORMER_OFFICER_IDS.map(id=>CIVIC_RECRUITS.find(o=>o.id===id));
 assert.equal(officers.length,10);
 assert.equal(officers.filter(o=>o.role.includes('británico')).length,5);
 assert.equal(officers.filter(o=>o.role.includes('francés')).length,5);
 for(const op of officers){
  assert.ok(op.foreign);assert.ok(op.leadership>=75);assert.ok(op.monthlyPay>0);
  assert.equal(CHARACTER_PROFILES[op.id].registry,'Registro de voluntarios extranjeros');
 }
 assert.ok(officers.some(o=>o.medical>=90&&o.marksmanship<50));
 assert.ok(officers.some(o=>o.explosives>=90));
 assert.ok(officers.some(o=>o.traits.includes('expert_rider')));
 assert.ok(officers.some(o=>o.traits.includes('guerrilla_tactician')));
});
test('48 distinct paid volunteers coexist with every historical operative',()=>{
 const roster=rosterFor(initialCampaign());
 assert.equal(CIVIC_RECRUITS.length,48);
 assert.equal(roster.length,48+OPERATIVES.length);
 assert.equal(new Set(roster.map(o=>o.id)).size,roster.length);
 assert.equal(new Set(CIVIC_RECRUITS.map(o=>o.name)).size,48);
 for(const op of MERCENARY_ADDITIONS){
  assert.ok(CAMPAIGN_SECTORS.some(s=>s.id===op.sector),op.name);
  assert.ok(WEAPONS[op.weapon]&&BLADES[op.blade],op.name);
  assert.ok(op.monthlyPay>0&&op.biography.startsWith('Personaje ficticio.'));
  assert.equal(op.hp,op.maxHp);
  for(const stat of ['maxHp','agility','dexterity','strength','leadership','wisdom','marksmanship','mechanical','explosives','medical'])assert.ok(Number.isInteger(op[stat])&&op[stat]>=0&&op[stat]<=100,`${op.id} ${stat}`);
  for(const event of SPEECH_EVENTS)assert.ok(CHARACTER_PROFILES[op.id].speech[event]?.length>10,`${op.id} ${event}`);
  assert.ok(CHARACTER_PROFILES[op.id].skills.every(Boolean));
 }
 assert.equal(new Set(MERCENARY_ADDITIONS.map(o=>CHARACTER_PROFILES[o.id].speech.hired)).size,41);
});
test('every paid volunteer can be hired, saved, restored, dismissed and rehired',()=>{
 for(const op of CIVIC_RECRUITS){
  let s=initialCampaign();const before=s.resources.treasury,quote=contractQuote(s,op);
  s=order(s,{type:'recruitCivic',id:op.id,term:'day'});
  assert.ok(s.recruited.includes(op.id));assert.ok(s.squad.includes(op.id));
  assert.equal(s.resources.treasury,before-quote.price);
  assert.equal(s.contracts[op.id].expiresAt,24);
  s=restoreCampaign(serializeCampaign(s));assert.ok(s.recruited.includes(op.id));
  assert.ok(dispatchCampaign(s,{type:'recruitCivic',id:op.id}).lastError);
  const unit=createBattle([rosterFor(s).find(o=>o.id===op.id)],{exploration:true}).units.find(u=>Number(u.id)===op.id);
  assert.equal(unit.weapon,op.weapon);assert.equal(unit.maxHp,op.maxHp);
  s=order(s,{type:'dismiss',id:op.id});assert.ok(!s.recruited.includes(op.id));
  s=order(s,{type:'recruitCivic',id:op.id});assert.ok(s.recruited.includes(op.id));
 }
});
test('specialists sign weekly contracts only when the treasury affords them',()=>{
 for(const op of MERCENARY_ADDITIONS){
  let s=initialCampaign();
  if(contractQuote(s,op).topTier){
   const weeklyQuote=contractQuote(s,op,'week');
   assert.ok(weeklyQuote.price>s.resources.treasury,'a week of a top-tier specialist exceeds the starting treasury');
   assert.ok(dispatchCampaign(s,{type:'recruitCivic',id:op.id,term:'week'}).lastError);
   s.resources.treasury=weeklyQuote.price+10000;
  }
  s=order(s,{type:'recruitCivic',id:op.id,term:'week'});assert.equal(s.contracts[op.id].expiresAt,168);
  s=order(s,{type:'renewContract',id:op.id,term:'day'});assert.equal(s.contracts[op.id].expiresAt,192);
 }
});
test('older saves gain the expanded roster without changing existing volunteers',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'week'});
 const original=structuredClone(s.operativeState[100]),contract=structuredClone(s.contracts[100]);
 for(const op of MERCENARY_ADDITIONS)delete s.operativeState[op.id];
 s=restoreCampaign(serializeCampaign(s));
 assert.deepEqual(s.operativeState[100],original);assert.deepEqual(s.contracts[100],contract);
 for(const op of MERCENARY_ADDITIONS){assert.equal(s.operativeState[op.id].hp,op.maxHp);assert.equal(s.operativeState[op.id].alive,true);}
 s=order(s,{type:'recruitCivic',id:147});assert.ok(s.recruited.includes(147));
});
test('catalogue searches accents, filters live candidates and sorts actual experienced wages',()=>{
 const s=initialCampaign();
 assert.deepEqual(filterMercenaries(CIVIC_RECRUITS,s,{query:'ines'}).map(o=>o.id),[107]);
 assert.deepEqual(filterMercenaries(CIVIC_RECRUITS,s,{query:'Tiento'}).map(o=>o.id),[108]);
 const medics=filterMercenaries(CIVIC_RECRUITS,s,{specialty:'medic',sort:'medical'});
 assert.ok(medics.length>=6);assert.ok(medics.every(o=>o.medical>=70));assert.ok(medics[0].medical>=medics.at(-1).medical);
 s.recruited.push(107);s.operativeState[108].alive=false;
 const available=filterMercenaries(CIVIC_RECRUITS,s,{availability:'available'});
 assert.equal(available.length,46);assert.ok(!available.some(o=>[107,108].includes(o.id)));
 assert.deepEqual(filterMercenaries(CIVIC_RECRUITS,s,{availability:'hired'}).map(o=>o.id),[107]);
 assert.deepEqual(filterMercenaries(CIVIC_RECRUITS,s,{availability:'fallen'}).map(o=>o.id),[108]);
 s.operativeState[119].xp=10000;
 const sorted=filterMercenaries(CIVIC_RECRUITS,s,{sort:'price'});
 assert.notEqual(sorted[0].id,119);
 assert.ok(sorted.every((op,i)=>i===0||contractQuote(s,sorted[i-1]).price<=contractQuote(s,op).price));
 assert.equal(filterMercenaries(CIVIC_RECRUITS,s,{query:'zzzz'}).length,0);
 assert.equal(CIVIC_RECRUITS[0].id,100);
});
test('replaced officer identities retain an existing weekly contract, injuries and experience',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:109});
 // A pre-replacement volunteer could already have a weekly contract.
 s.contracts[109]={kind:'paid',term:'week',started:0,expiresAt:168,paid:77};
 s.operativeState[109].hp=40;s.operativeState[109].xp=120;
 const record=structuredClone(s.operativeState[109]),contract=structuredClone(s.contracts[109]);
 s=restoreCampaign(serializeCampaign(s));
 assert.deepEqual(s.operativeState[109],record);assert.deepEqual(s.contracts[109],contract);
 const officer=rosterFor(s).find(o=>o.id===109);
 assert.equal(officer.name,'Edward Harcourt');assert.equal(officer.xp,120);assert.ok(s.recruited.includes(109));
});
