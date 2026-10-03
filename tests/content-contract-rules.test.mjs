import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage,resolveContent} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_CONTRACT_RULES,validateContractRules} from '../game/contract-rules.js';
import {CONTRACT_TERMS,contractTermsFor,contractQuote} from '../game/contracts.js';
import {contractAttentionStates} from '../game/contract-attention.js';
import {filterMercenaries} from '../game/mercenary-catalogue.js';
import {encounterHireTerms,encountersFor} from '../game/encounters.js';
import {A,localPackage} from './local-contract-fixture.mjs';
const rules=()=>({days:{day:2,week:10,month:40},salaryMonthDays:20,xpStep:50,xpRaisePercent:25,warningHours:4});
const authored=()=>({...defaultContentPackage(),contractRules:rules()});
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=s=>restoreCampaign(serializeCampaign(s));

test('optional contract rules preserve existing packages, prices and unrestricted elite terms',()=>{
 const content=defaultContentPackage(),s=initialCampaign(42,content),op=rosterFor(s).find(o=>o.id===110);
 assert.equal(Object.hasOwn(content,'contractRules'),false);assert.deepEqual(resolveContent(content),content);
 assert.deepEqual(contractTermsFor(s),CONTRACT_TERMS);assert.equal(contractQuote(s,op,'week').price,Math.ceil(op.monthlyPay/30)*7);
 assert.equal(saved(s).contentCampaign.identity.hash,s.contentCampaign.identity.hash);
 assert.deepEqual(validateContractRules(undefined),[]);
 const elite=rosterFor(s).find(o=>o.tier==='elite');assert.ok(elite);assert.equal(contractQuote(s,elite,'month').available,true);
 for(const term of ['constructor','toString','__proto__','year'])assert.equal(contractQuote(s,op,term).available,false);
});

test('authored contract duration, experience pay and roster prices use campaign-specific rules',()=>{
 const d=authored();d.characters.find(c=>c.id==='person-110').monthlyPay=600;
 const s=initialCampaign(42,d),op=rosterFor(s).find(o=>o.id===110);s.operativeState[110].xp=125;
 const quote=contractQuote(s,op,'week');assert.equal(quote.daily,45);assert.equal(quote.price,450);assert.equal(quote.hours,240);assert.equal(quote.expiresAt,240);
 assert.deepEqual(Object.values(contractTermsFor(s)).map(t=>t.name),['2 días','10 días','40 días']);
 const sorted=filterMercenaries(rosterFor(s),s,{sort:'price'});assert.ok(sorted.every((o,i)=>!i||contractQuote(s,sorted[i-1]).daily<=contractQuote(s,o).daily));
 assert.equal(contractQuote(initialCampaign(42),op,'week').hours,168);
 d.contractRules.days.week=12;assert.equal(contractQuote(s,op,'week').hours,240);
 assert.equal(campaignContentReport(s.contentCampaign.package).blocked.length,0);
});

test('pending hires save exact authored payment and duration, then renew from the current expiry',()=>{
 let s=initialCampaign(42,authored()),op=rosterFor(s).find(o=>o.id===110),quote=contractQuote(s,op,'week'),cash=s.resources.treasury;
 s=order(s,{type:'recruitCivic',id:110,term:'week'});
 assert.equal(s.hiringArrivals[0].serviceHours,240);assert.equal(s.resources.treasury,cash-quote.price);s=saved(s);
 for(const alter of [a=>a.paid++,a=>a.serviceHours=168]){const bad=structuredClone(s);alter(bad.hiringArrivals[0]);assert.throws(()=>saved(bad),/llegadas/);}
 s=order(s,{type:'wait',hours:6});assert.equal(s.contracts[110].expiresAt,246);
 s=order(saved(s),{type:'renewContract',id:110,term:'day'});assert.equal(s.contracts[110].expiresAt,294);
 assert.equal(saved(s).contracts[110].expiresAt,294);
});

test('authored warning window pauses waiting and survives save continuation',()=>{
 const d=authored();d.contractRules.days={day:1,week:10,month:40};d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'day'});
 s=order(s,{type:'wait',hours:24});assert.equal(s.hour,20);assert.equal(s.contractAttention.notice.events[0].expiresAt,24);
 assert.deepEqual(saved(s),s);assert.equal(order(saved(s),{type:'wait',hours:1}).hour,21);
 const bad=structuredClone(s);bad.contractAttention.notice.events[0].expiresAt=25;assert.throws(()=>saved(bad),/avisos/);
});

test('a zero warning window reports only expiry',()=>{
 const d=authored();d.contractRules.days={day:1,week:10,month:40};d.contractRules.warningHours=0;d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:23});assert.equal(s.hour,23);assert.deepEqual(contractAttentionStates(s),[]);
 s=order(s,{type:'wait',hours:2});assert.equal(s.hour,24);assert.equal(s.contractAttention.notice.events[0].code,'expired');assert.ok(saved(s));
});

test('local paid residents share authored terms while free service remains free',()=>{
 const d=localPackage({pay:600});d.contractRules=rules();const s=initialCampaign(42,d),npc=encountersFor(s,A).find(n=>n.contentId==='alma-contract');assert.ok(npc);
 assert.deepEqual(encounterHireTerms(s,npc).map(q=>[q.name,q.hours,q.price]),[['2 días',48,60],['10 días',240,300],['40 días',960,1200]]);
 const free={id:9999,service:'contract',monthlyPay:0};assert.equal(contractQuote(s,free,'month').price,0);assert.equal(contractQuote(s,{...free,service:'permanent'},'month').hours,null);
});

test('malformed authored contract rules and changed saved rules are rejected',()=>{
 const invalid=[r=>r.days.day=0,r=>r.days.week=r.days.day,r=>r.days.month=91,r=>r.days.month=NaN,r=>r.salaryMonthDays=0,r=>r.xpStep=0,r=>r.xpRaisePercent=101,r=>r.warningHours=-1,r=>r.warningHours=25,r=>r.warningHours=1.5,r=>r.unused=true,r=>r.days.year=365,r=>delete r.xpStep];
 for(const mutate of invalid){const d=authored();mutate(d.contractRules);assert.ok(validateContentPackage(d).length,mutate.toString());assert.throws(()=>initialCampaign(42,d));}
 for(const value of [null,[],{...DEFAULT_CONTRACT_RULES,days:null}])assert.ok(validateContractRules(value).length);
 const s=structuredClone(initialCampaign(42,authored()));s.contentCampaign.package.contractRules.warningHours=3;assert.throws(()=>saved(s),/identidad/);
});
