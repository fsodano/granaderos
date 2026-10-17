import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {visit,hireLocal,leave} from './local-contract-fixture.mjs';
import {quoteMountainServiceBudget} from './mountain-service-budget.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
const order=(c,action)=>{const before=structuredClone(c),next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);assert.deepEqual(c,before);return next;};
function setup({treasury=5000,dayHours=24,refusal=false,permanent=true}={}){
 const d=scaffoldDocuments('mountain-service-budget'),base=d.content.characters[0];
 d.content.rules.startingTreasury=treasury;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 if(dayHours!==24)d.content.contractRules={days:{day:dayHours/24,week:7,month:30},salaryMonthDays:30,xpStep:100,xpRaisePercent:10,warningHours:2};
 d.content.characters=[
  {...structuredClone(base),id:'paid-a',name:'Primera contratada',monthlyPay:300,serviceGuarantee:41},
  {...structuredClone(base),id:'paid-b',name:'Segundo contratado',monthlyPay:450},
  ...(permanent?[{...structuredClone(base),id:'alma-contract',name:'Servicio permanente',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,encounter:{recruitable:true,greeting:'Sirvo en el campamento.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}}]:[]),
 ];
 if(permanent){delete d.content.characters[2].arrivalHours;d.content.placements.push({id:'permanent-home',character:'alma-contract',mode:'fixed',sectors:['camp'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});}
 if(refusal)d.content.characters[0].serviceRefusals=[{character:'paid-b',reason:'No trabajan en la misma columna.'}];
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);let campaign=initialCampaign(42,content);
 const ids=rosterFor(campaign).map(op=>op.id);
 campaign=order(campaign,{type:'advanceStrategicTime',seconds:121});
 campaign=order(campaign,{type:'recruitCivic',id:ids[0],term:'day',destination:'camp'});
 campaign=order(campaign,{type:'recruitCivic',id:ids[1],term:'week',destination:'camp'});
 if(permanent)campaign=leave(hireLocal(visit(campaign)));
 assert.deepEqual(d,declaration);return {campaign:saved(campaign),ids};
}
const physical=r=>Object.fromEntries(Object.entries(r).filter(([key])=>!['morale','lastMoralePayAt','lastMoralePaySecond'].includes(key)));

test('current fractional paid terms and permanent service quote the full absolute horizon once per person',()=>{
 const {campaign:start,ids}=setup(),before=structuredClone(start),[a,b,p]=ids,expiry=contractExpiresSeconds(start.contracts[a]);
 assert.ok(clock(start)>=121);assert.equal(expiry,86400+121);
 for(const [until,renewals]of [[expiry-1,0],[expiry,1],[expiry+86400-1,1],[expiry+86400,2]]){
  const keepIds=[a,a,b,p],originalIds=[...keepIds],budget=quoteMountainServiceBudget(start,{keepIds,horizonSeconds:until,fixedCost:150});
  assert.equal(budget.available,true);assert.equal(budget.reason,null);assert.deepEqual(budget.keepIds,ids);assert.deepEqual(keepIds,originalIds);
  const row=budget.entries.find(row=>row.id===a),quote=contractRenewalQuote(start,rosterFor(start).find(op=>op.id===a),'day');
  assert.equal(row.renewals,renewals);assert.equal(row.quote.guarantee,0);assert.equal(row.quote.price,quote.price);assert.equal(row.cost,renewals*quote.price);
  assert.equal(budget.entries.find(row=>row.id===b).renewals,0,'An already paid week is real coverage, not another local hire.');
  assert.deepEqual(budget.entries.find(row=>row.id===p),{id:p,expirySeconds:null,permanent:true,renewals:0,quote:null,cost:0,reason:null});
  assert.equal(budget.totalCost,150+renewals*quote.price);assert.equal(budget.shortfall,0);assert.deepEqual(start,before);
 }
});

test('the quoted full service debit executes through Native renewals with unchanged physical stock and exact saved repetition',()=>{
 const {campaign:start,ids}=setup(),before=structuredClone(start),horizonSeconds=contractExpiresSeconds(start.contracts[ids[0]])+2*86400,budget=quoteMountainServiceBudget(start,{keepIds:ids,horizonSeconds,fixedCost:150});
 assert.equal(budget.available,true);const actions=[];let campaign=start;
 for(const entry of budget.entries)for(let n=0;n<entry.renewals;n++){
  const contract=campaign.contracts[entry.id],quote=contractRenewalQuote(campaign,rosterFor(campaign).find(op=>op.id===entry.id),'day'),cash=campaign.resources.treasury,expiry=contractExpiresSeconds(contract);
  const action={type:'renewContract',id:entry.id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0};
  campaign=order(campaign,action);actions.push(action);assert.equal(campaign.resources.treasury,cash-quote.price);assert.equal(contractExpiresSeconds(campaign.contracts[entry.id]),expiry+quote.hours*3600);
 }
 const fortify={type:'fortify',sector:'camp'};campaign=order(campaign,fortify);actions.push(fortify);
 assert.equal(campaign.resources.treasury,start.resources.treasury-budget.totalCost);assert.equal(clock(campaign),clock(start));
 for(const id of ids){assert.deepEqual(physical(campaign.operativeState[id]),physical(start.operativeState[id]));assert.ok(contractExpiresSeconds(campaign.contracts[id])===null||contractExpiresSeconds(campaign.contracts[id])>horizonSeconds);}
 assert.equal(campaign.contracts[ids[0]].guaranteeId,start.contracts[ids[0]].guaranteeId);assert.deepEqual(campaign.serviceGuarantees,start.serviceGuarantees);
 let repeated=saved(start);for(const action of actions)repeated=order(repeated,action);assert.deepEqual(saved(repeated),saved(campaign));assert.deepEqual(start,before);
 const paid=quoteMountainServiceBudget(campaign,{keepIds:ids,horizonSeconds});assert.equal(paid.renewalCost,0);assert.equal(paid.totalCost,0);
});

test('authored day duration is quoted through Native terms rather than a hard-coded 24-hour renewal',()=>{
 const {campaign:start,ids}=setup({dayHours:48}),expiry=contractExpiresSeconds(start.contracts[ids[0]]),horizonSeconds=expiry+86400;
 const budget=quoteMountainServiceBudget(start,{keepIds:[ids[0]],horizonSeconds}),row=budget.entries[0];
 assert.equal(row.quote.hours,48);assert.equal(row.renewals,1);const contract=start.contracts[ids[0]],cash=start.resources.treasury;
 const paid=order(start,{type:'renewContract',id:ids[0],term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});
 assert.equal(paid.resources.treasury,cash-budget.renewalCost);assert.ok(contractExpiresSeconds(paid.contracts[ids[0]])>horizonSeconds);assert.deepEqual(saved(paid),paid);
});

test('a short treasury is refused without spending known costs or treating future time as paid income',()=>{
 const {campaign:start,ids}=setup({treasury:800}),before=structuredClone(start),horizonSeconds=contractExpiresSeconds(start.contracts[ids[0]])+2*86400;
 const budget=quoteMountainServiceBudget(start,{keepIds:ids,horizonSeconds,fixedCost:150});
 assert.equal(budget.available,false);assert.match(budget.reason,/actual treasury/);assert.equal(budget.shortfall,budget.totalCost-start.resources.treasury);assert.ok(budget.shortfall>0);assert.deepEqual(start,before);
});

test('required Native renewal refusal is retained while an already paid term remains usable',()=>{
 const {campaign:start,ids}=setup({refusal:true}),before=structuredClone(start),expiry=contractExpiresSeconds(start.contracts[ids[0]]);
 const covered=quoteMountainServiceBudget(start,{keepIds:ids,horizonSeconds:expiry-1});assert.equal(covered.available,true);assert.equal(covered.renewalCost,0);
 const needed=quoteMountainServiceBudget(start,{keepIds:ids,horizonSeconds:expiry});assert.equal(needed.available,false);assert.match(needed.reason,/No trabajan en la misma columna/);
 const native=dispatchCampaign(start,{type:'renewContract',id:ids[0],term:'day',expectedExpiresAt:start.contracts[ids[0]].expiresAt,expectedExpiresSecond:start.contracts[ids[0]].expiresSecond??0});assert.match(native.lastError,/No trabajan en la misma columna/);assert.deepEqual({...native,lastError:null},start);assert.deepEqual(start,before);
});

test('invalid horizons and a genuinely dismissed named person cannot turn into a cheaper service plan',()=>{
 const {campaign:start,ids}=setup(),before=structuredClone(start);
 for(const options of [{keepIds:ids,horizonSeconds:clock(start)-1},{keepIds:ids,horizonSeconds:clock(start)+.5},{keepIds:ids,horizonSeconds:clock(start),fixedCost:-1},{keepIds:['0'],horizonSeconds:clock(start)}])assert.throws(()=>quoteMountainServiceBudget(start,options));
 const dismissed=order(start,{type:'dismiss',id:ids[0]}),plan=quoteMountainServiceBudget(dismissed,{keepIds:ids,horizonSeconds:clock(dismissed)+86400});
 assert.equal(plan.available,false);assert.match(plan.reason,/no current available service/);assert.deepEqual(start,before);assert.deepEqual(saved(dismissed),dismissed);
});
