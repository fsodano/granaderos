import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {DEFAULT_CARE_RULES} from '../game/campaign-care-rules.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {restRouteStableLocal} from './route-stable-local-rest.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const saved=c=>{const restored=decodeSave(encodeSave(c)).campaign;assert.deepEqual(restored,c);return restored;};

// Starting wounds and empty supply are authored before initialCampaign. All
// service, assignments, healing, fees, clock and raids below use Native code.
function setup({wounds=[2,0],bleeding=0,hp,treasury=1000,raid=false,energy=100,fatigue=0,careRules}={}){
 const d=scaffoldDocuments('declared-stable-local-rest'),base=d.content.characters[0];
 d.content.rules.startingTreasury=treasury;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 if(careRules)d.content.careRules=careRules;
 d.content.characters=wounds.map((wound,i)=>({...structuredClone(base),id:'rest-'+i,name:'Descanso '+i,nickname:'Descanso '+i,arrivalHours:0,monthlyPay:300,serviceGuarantee:31,
  attributes:{...base.attributes,medical:0},startingSupplies:{rations:0,torches:0,medkits:0,boleadoras:0},
  startingCondition:{hp:i===0&&hp!==undefined?hp:base.attributes.maxHp-wound,energy,fatigue,bleeding:i===0?bleeding:0,bandaged:i===0&&bleeding?0:wound}}));
 if(raid){
  d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
  d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:3,raidEveryHours:240,axis:['watch-post']}}};
 }
 const declared=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let campaign=initialCampaign(42,definition);const ids=rosterFor(campaign).map(op=>op.id);
 for(const id of ids){const quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===id),'day'),cash=campaign.resources.treasury;
  campaign=order(campaign,{type:'recruitCivic',id,term:'day',destination:raid?'watch-post':'camp'});assert.equal(campaign.resources.treasury,cash-quote.total);
 }
 if(raid)campaign=order(campaign,{type:'createSquad',ids,sector:'watch-post',name:'Descanso local'});
 assert.deepEqual(d,declared);return {campaign:saved(campaign),ids};
}
function replay(start,result){
 let campaign=start;
 for(const [i,action]of result.orders.entries()){
  campaign=order(campaign,action);if(i===Math.floor(result.orders.length/2))campaign=saved(campaign);
 }
 assert.deepEqual(saved(campaign),result.campaign);
}
function physical(c,id){
 const r=c.operativeState[id];return Object.fromEntries(['alive','captured','maxHp','location','inventory','medkits','weaponDropped','primaryWeapon','bladeWeapon','ammoStock','ammunitionByType','carriedLoaded','carriedLoading','carriedJammed','carriedReprime'].map(key=>[key,r[key]]));
}

test('two stable HP require twelve real concurrent rest ticks, exact paid renewal and complete saved order replay',()=>{
 const {campaign:base,ids}=setup({wounds:[2,1]});const start=saved(order(base,{type:'wait',hours:13})),before=structuredClone(start),events=[];
 for(const id of ids){assert.equal(start.operativeState[id].medkits,0);assert.equal(sectorInventoryModel(start,start.location,rosterFor(start),id).entries.some(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'),false);}
 const result=restRouteStableLocal(start,ids,{report:e=>events.push(e)}),c=result.campaign;
 assert.equal(result.ready,true);assert.equal(result.reason,null);assert.equal(result.boundHours,12,'The patients rest concurrently; their deficits are not summed.');assert.equal(result.elapsedSeconds,12*3600);
 assert.equal(result.ticks.filter(t=>t.elapsedSeconds===3600).length,12);
 const renewals=events.filter(e=>e.event==='freshRouteRenewal');assert.equal(renewals.length,2);assert.ok(renewals.every(e=>e.price>0));
 assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,e)=>sum+e.price,0));
 for(const [index,id]of ids.entries()){
  const r=c.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.hp-start.operativeState[id].hp,index===0?2:1);assert.equal(r.bleeding,0);assert.equal(r.assignment,'active');assert.equal(r.asleep,false);assert.equal(r.energy,100);assert.equal(r.fatigue,0);
  assert.ok(c.recruited.includes(id));assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.equal(c.contracts[id].guaranteeId,start.contracts[id].guaranteeId);assert.deepEqual(physical(c,id),physical(start,id));
 }
 assert.deepEqual(c.serviceGuarantees,start.serviceGuarantees);assert.deepEqual(start,before);replay(start,result);
});

test('an existing rest counter is retained and reduces the actual remaining wound bound',()=>{
 const {campaign,ids}=setup({wounds:[2,0]});let start=order(campaign,{type:'assignCare',operativeId:ids[0],assignment:'rest'});start=saved(order(start,{type:'wait',hours:4}));
 assert.equal(start.operativeState[ids[0]].recoveryHours,4);const before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
 assert.equal(result.ready,true);assert.equal(result.boundHours,8);assert.equal(result.elapsedSeconds,8*3600);assert.equal(result.orders.filter(a=>a.type==='assignCare'&&a.assignment==='rest').length,0);assert.deepEqual(start,before);replay(start,result);
});

test('awake departure uses actual rest rates and waits for Native sleep completion without a forced wake',()=>{
 const {campaign,ids}=setup({wounds:[0,0],energy:80,fatigue:20});const start=saved(order(campaign,{type:'setSleep',operativeId:ids[0],asleep:true})),before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
 assert.equal(result.ready,true);assert.equal(result.boundHours,5);assert.ok(result.elapsedSeconds>0&&result.elapsedSeconds<=5*3600);assert.equal(result.campaign.operativeState[ids[0]].asleep,false);assert.equal(result.campaign.operativeState[ids[0]].energy,100);assert.equal(result.campaign.operativeState[ids[0]].fatigue,0);
 assert.equal(result.orders.some(a=>a.type==='setSleep'),false);assert.deepEqual(start,before);replay(start,result);
});

test('acute or bleeding people cannot use stable rest or advance an unprotected clock',()=>{
 for(const config of [{wounds:[2,0],bleeding:1},{wounds:[0,0],hp:14}]){
  const {campaign:start,ids}=setup(config),before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
  assert.equal(result.ready,false);assert.match(result.reason,/acute/);assert.deepEqual(result.orders,[]);assert.equal(result.elapsedSeconds,0);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 }
});

test('a genuine marching raid returns the exact interrupted campaign even when the retained-order helper throws',()=>{
 const {campaign:start,ids}=setup({raid:true}),group=launchEnemyGroup(start,'frontier','watch-post');assert.ok(group);const before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
 assert.equal(result.ready,false);assert.equal(result.reason,'pending-encounter');assert.equal(result.campaign.pendingEncounter.groupId,group.id);assert.equal(result.orders.filter(a=>a.type==='wait').length,1);assert.equal(result.elapsedSeconds,3600);assert.equal(result.campaign.operativeState[ids[0]].hp,start.operativeState[ids[0]].hp);assert.ok(result.campaign.operativeState[ids[0]].hp<result.campaign.operativeState[ids[0]].maxHp);
 assert.deepEqual(start,before);replay(start,result);const again=restRouteStableLocal(result.campaign,[ids[0]]);assert.equal(again.ready,false);assert.equal(again.reason,'pending-encounter');assert.deepEqual(again.orders,[]);assert.deepEqual(again.campaign,result.campaign);
});

test('unaffordable real renewal returns the paid partial rest without losing a term or claiming full health',()=>{
 const {campaign:base,ids}=setup({treasury:182});assert.equal(base.resources.treasury,0);const start=saved(order(base,{type:'wait',hours:13})),before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
 assert.equal(result.ready,false);assert.match(result.reason,/renewal/);assert.ok(result.elapsedSeconds>0&&result.elapsedSeconds<12*3600);assert.equal(result.campaign.resources.treasury,0);assert.ok(result.campaign.operativeState[ids[0]].hp<result.campaign.operativeState[ids[0]].maxHp);
 for(const id of ids){assert.ok(result.campaign.recruited.includes(id));assert.ok(contractExpiresSeconds(result.campaign.contracts[id])>clock(result.campaign));}
 assert.deepEqual(start,before);replay(start,result);
});

test('configured zero recovery cannot promise a finite awake bound, and an already ready explicit party is a no-op',()=>{
 const {campaign:start,ids}=setup({wounds:[0,0],energy:80,fatigue:20,careRules:{...DEFAULT_CARE_RULES,restEnergy:0,restFatigue:0}}),before=structuredClone(start),result=restRouteStableLocal(start,[ids[0]]);
 assert.equal(result.ready,false);assert.match(result.reason,/rates/);assert.deepEqual(result.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);
 const ready=setup({wounds:[0,0]}),noOp=restRouteStableLocal(ready.campaign,ready.ids);assert.equal(noOp.ready,true);assert.deepEqual(noOp.orders,[]);assert.equal(noOp.elapsedSeconds,0);assert.deepEqual(noOp.campaign,ready.campaign);
});
