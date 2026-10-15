import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {visit,saved,order} from './local-contract-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor} from '../game/campaign.js';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {attemptRouteDressings,supplyRouteDressings} from './route-dressings.mjs';
import {initialCampaign as createCampaign} from '../game/campaign.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {leave} from './local-contract-fixture.mjs';

test('route care redistributes real local carried dressings before consuming a finite discovered cache',()=>{
 let start=leaveFiniteCache(takeFiniteCache(visit(initialCampaign()),10,[]));
 const cache=sectorInventoryModel(start,'retiro',rosterFor(start),4).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(cache);
 start=order(start,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:cache.key,expected:cache.expected,count:12});
 const before=structuredClone(start),events=[],initialTotal=start.recruited.reduce((sum,id)=>sum+start.operativeState[id].medkits,0),target=7;
 const s=supplyRouteDressings(start,10,target,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(s.operativeState[10].medkits,target);assert.equal(s.resources.treasury,start.resources.treasury);assert.equal(s.hour,start.hour);assert.equal(s.secondOfHour,start.secondOfHour);
 const chest=s.sectorStates.retiro.props.find(prop=>prop.id==='retiro:armory-cache');assert.equal(chest.contents.some(item=>item.item==='medkits'),false);assert.equal(s.recruited.reduce((sum,id)=>sum+s.operativeState[id].medkits,0),initialTotal);
 assert.ok(events.some(event=>event.event==='routeDressingDonation'));assert.ok(events.some(event=>event.event==='routeDressingsCollected'));assert.deepEqual(saved({campaign:s}).campaign,s);
 const checkpoint=structuredClone(s);assert.throws(()=>supplyRouteDressings(s,10,20),/finite dressings/);assert.deepEqual(s,checkpoint,'an exhausted finite plan must not partially alter its caller');
 const reserves=Object.fromEntries(s.recruited.map(id=>[id,s.operativeState[id].medkits]));
 assert.throws(()=>supplyRouteDressings(s,3,s.operativeState[3].medkits+1,{reserves}),/finite dressings/);
 assert.deepEqual(s,checkpoint,'A later top-up cannot steal another actor’s declared carried reserve.');
});

function declaredSupply({count=1,rations=0,cache=true}={}){
 const d=scaffoldDocuments('declared-dressing-attempt'),cacheId='finite-clinic-cache';
 d.content.characters[0].startingSupplies={rations:0,torches:0,medkits:0,boleadoras:0};
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:20,max:null}];
 d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 d.maps.camp.props=cache?[{id:cacheId,type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}]:[];
 if(cache)d.world.physical.caches.camp={chest:cacheId,contents:[{item:'medkits',count,weight:.2},...(rations?[{item:'rations',count:rations,weight:.5}]:[])]};
 const before=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);
 const campaign=saved({campaign:order(createCampaign(8,definition),{type:'recruitCivic',id:2000,term:'week'})}).campaign;
 assert.deepEqual(d,before);assert.equal(campaign.operativeState[2000].medkits,0);
 return {campaign,cacheId};
}

test('an explicit dressing attempt retains actual finite discovery, partial collection and clock on shortage while the old wrapper stays strict',()=>{
 const {campaign:start,cacheId}=declaredSupply(),before=structuredClone(start),events=[];
 const result=attemptRouteDressings(start,2000,2,{report:e=>events.push(e)}),c=result.campaign;
 assert.equal(result.supplied,false);assert.equal(result.reason,'finite-dressing-shortage');
 assert.equal(result.details.carried,1);assert.equal(result.details.target,2);assert.equal(result.details.inaccessibleCount,0);
 assert.equal(c.operativeState[2000].medkits,1);assert.ok(c.hour*3600+(c.secondOfHour??0)>start.hour*3600+(start.secondOfHour??0));
 const chest=c.sectorStates.camp.props.find(p=>p.id===cacheId);assert.ok(chest.open&&chest.knownToPlayer);assert.equal(chest.contents.some(i=>i.item==='medkits'),false);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(start,before);
 assert.equal(events.filter(e=>e.event==='routeDressingsCollected').reduce((sum,e)=>sum+e.count,0),1);
 assert.deepEqual(attemptRouteDressings(saved({campaign:start}).campaign,2000,2),result);assert.deepEqual(saved({campaign:c}).campaign,c);
 assert.throws(()=>supplyRouteDressings(start,2000,2),/No actual reachable finite dressings/);assert.deepEqual(start,before);
 const success=attemptRouteDressings(c,2000,1);assert.equal(success.supplied,true);assert.equal(success.reason,null);assert.deepEqual(success.campaign,c);
});

test('an attempt preserves missing-actor and actual pending-battle refusals instead of reporting a dressing shortage',()=>{
 const {campaign:start}=declaredSupply(),before=structuredClone(start);
 assert.throws(()=>attemptRouteDressings(start,9999,1),/recipient must exist/);
 const pending=order(start,{type:'visitSector'}),pendingBefore=structuredClone(pending);
 assert.ok(pending.pendingBattle);assert.throws(()=>attemptRouteDressings(pending,2000,1),/encuentro pendiente/);
 assert.deepEqual(pending,pendingBefore);assert.deepEqual(start,before);
});

test('reachable finite stock with a full Native pack remains a capacity error rather than a shortage result',()=>{
 let {campaign:c}=declaredSupply({rations:100});c=discoverRouteCache(c,2000);
 const model=sectorInventoryModel(c,'camp',rosterFor(c),2000),ration=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='rations');assert.ok(ration);
 let fill=0;
 for(let count=1;count<=ration.count;count++){
  let packed;try{packed=applyItemQuantity(model.personal,{...JSON.parse(ration.expected),count});}catch{break;}
  try{applyItemQuantity(packed,{item:'medkits',count:1,weight:.2});}catch{fill=count;break;}
 }
 assert.ok(fill,'The declared finite rations can fill this actual pack.');
 c=order(c,{type:'sectorInventory',sector:'camp',operativeId:2000,direction:'take',sourceKey:ration.key,expected:ration.expected,count:fill});
 assert.ok(sectorInventoryModel(c,'camp',rosterFor(c),2000).entries.some(row=>row.reachable&&JSON.parse(row.expected).item==='medkits'));
 const before=structuredClone(c);assert.throws(()=>attemptRouteDressings(c,2000,1),/no carrying room/);assert.deepEqual(c,before);
});

test('known positive stock behind declared stone walls is reported inaccessible and is never erased or called absent',()=>{
 const {campaign:start}=declaredSupply({cache:false}),pending=order(start,{type:'visitSector'}),request=pending.pendingBattle;
 const tiles=Array.from({length:64},(_,i)=>{const x=i%8,y=Math.floor(i/8),wall=(x===5||x===7)&&y>=5||y===5&&x>=5;return {x,y,type:wall?'wall':'grass',blocked:wall,cover:0,...(wall?{material:'stone'}:{})};});
 const initial=createBattle(request.squad.map(u=>({...u,x:1,y:1})),{...request,width:8,height:8,exploration:true,tiles,props:[],npcs:[],groundItems:[{id:'known-finite-dressings',type:'item',item:'medkits',count:2,weight:.2,x:6,y:6,knownToPlayer:true}]});
 const explored=actBattle(initial,{type:'explore'});assert.equal(explored.lastError,null);
 const c=saved({campaign:leave({campaign:pending,battle:explored})}).campaign,before=structuredClone(c);
 const row=sectorInventoryModel(c,'camp',rosterFor(c),2000).entries.find(row=>JSON.parse(row.expected).item==='medkits');assert.ok(row);assert.equal(row.reachable,false);
 const result=attemptRouteDressings(c,2000,1);
 assert.equal(result.supplied,false);assert.equal(result.details.availability,'inaccessible-stock');assert.equal(result.details.inaccessibleCount,2);
 assert.equal(result.campaign.operativeState[2000].medkits,0);assert.deepEqual(result.campaign.sectorStates,c.sectorStates);assert.deepEqual(c,before);
});
