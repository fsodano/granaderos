import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {returnSaltaClinicRelief} from './salta-clinic-relief.mjs';
import {visit,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const saved=c=>{const r=decodeSave(encodeSave(c)).campaign;assert.deepEqual(r,c);return r;};
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
function setup({stock=30,doctorKits=1,patientHP=5,bleeding=3,body=false}={}){
 const d=scaffoldDocuments('declared-salta-clinic-relief'),base=d.content.characters[0],musket=defaultContentPackage().weapons.find(w=>w.template===1800);
 d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=8;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.expansion.buildingTargets={camp:0,'watch-post':0};
 d.content.weapons.push({...structuredClone(musket),id:'relief-musket',art:base.portrait});
 d.content.characters=[
  {...structuredClone(base),id:'depot-physician',name:'Médico del depósito',weapon:'relief-musket',monthlyPay:300,startingSupplies:{rations:0,torches:0,medkits:doctorKits,boleadoras:0},attributes:{...base.attributes,maxHp:78,medical:30},startingCondition:{hp:15,bleeding:0,bandaged:63,energy:100,fatigue:0}},
  {...structuredClone(base),id:'serving-relief',name:'Relevo contratado',weapon:'relief-musket',monthlyPay:300,startingSupplies:{rations:0,torches:0,medkits:2,boleadoras:0},attributes:{...base.attributes,maxHp:77,medical:26},startingCondition:{hp:patientHP,bleeding,bandaged:bleeding?0:77-patientHP,energy:95,fatigue:0}},
  {...structuredClone(base),id:'original-week-guard',name:'Guardia semanal',weapon:'relief-musket',monthlyPay:300,startingSupplies:{rations:0,torches:0,medkits:0,boleadoras:0},attributes:{...base.attributes,medical:0}},
 ];
 if(body)d.content.characters.push({...structuredClone(base),id:'fallen-linen-carrier',name:'Portador caído',weapon:null,monthlyPay:300,startingSupplies:{rations:0,torches:0,medkits:stock,boleadoras:0},attributes:{...base.attributes,medical:0}});
 d.maps.camp.spawns=[{id:'entry',x:3,y:8,side:'player'},{id:'opposition',x:16,y:8,side:'enemy'}];
 if(!body){d.maps.camp.props=[{id:'declared-clinic-stock',type:'chest',x:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];d.world.physical.caches.camp={chest:'declared-clinic-stock',contents:stock?[{item:'medkits',count:stock,weight:.2}]:[]};}
 const before=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let c=initialCampaign(42,definition);const roster=rosterFor(c),doctor=roster.find(op=>op.name==='Médico del depósito').id,patient=roster.find(op=>op.name==='Relevo contratado').id,guard=roster.find(op=>op.name==='Guardia semanal').id,fallen=roster.find(op=>op.name==='Portador caído')?.id;
 c=order(c,{type:'recruitCivic',id:guard,term:'week'});
 c=order(c,{type:'createSquad',ids:[guard],sector:'camp',name:'Guardia original'});c=order(c,{type:'travel',sector:'watch-post'});
 const remaining=contractExpiresSeconds(c.contracts[guard])-clock(c);assert.ok(remaining>22*3600);c=order(c,{type:'wait',hours:Math.floor(remaining/3600)-22});
 c=order(c,{type:'recruitCivic',id:doctor,term:'week',destination:'camp'});c=order(c,{type:'createSquad',ids:[doctor],sector:'camp',name:'Médico local'});
 if(!body)c=leaveFiniteCache(takeFiniteCache(visit(c),doctor,[],{cacheId:'declared-clinic-stock'}));
 c=order(c,{type:'recruitCivic',id:patient,term:'day',destination:'camp'});if(body)c=order(c,{type:'recruitCivic',id:fallen,term:'week',destination:'camp'});c=order(c,{type:'createSquad',ids:body?[doctor,patient,fallen]:[doctor,patient],sector:'camp',name:'Clínica local'});
 if(body){
  const pending=order(c,{type:'visitSector'}),request=pending.pendingBattle,tiles=Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}));
  const declared=createBattle(request.squad.map((u,i)=>({...u,x:2+i,y:2,facing:0,...(Number(u.id)===fallen?{hp:0,x:3,y:6}:{} )})),{...request,width:8,height:8,exploration:true,tiles,props:[],npcs:[]});
  const explored=actBattle(declared,{type:'explore'});assert.equal(explored.lastError,null);c=saved(leave({campaign:pending,battle:explored}));
 }
 if(body&&stock)assert.equal(c.sectorStates.camp.units.find(u=>u.id===String(fallen)).knownToPlayer,undefined,'The linen body is not initially discovered behind the physician.');
 const originalGuard=c.contracts[guard];assert.deepEqual(d,before);return {campaign:saved(c),doctor,patient,guard,fallen,protectedTerms:{[guard]:{term:'week',paid:originalGuard.paid}}};
}

function physical(c,id){const r=c.operativeState[id];return Object.fromEntries(['alive','captured','maxHp','inventory','weaponDropped','condition','ammo','carriedAmmo','carriedLoaded','weaponFittings'].map(k=>[k,r[k]]));}

test('a real local doctor fully heals serving relief with finite known linen, paid terms and an actual journey while the original guard receipt remains weekly',()=>{
 const {campaign:start,doctor,patient,guard,protectedTerms}=setup(),before=structuredClone(start),events=[];
 const result=returnSaltaClinicRelief(start,[patient],{destination:'watch-post',protectedTerms,report:e=>events.push(e)}),c=result.campaign,r=result.receipt;
 assert.equal(c.operativeState[patient].hp,77);assert.equal(c.operativeState[patient].bleeding,0);assert.equal(c.operativeState[patient].location,'watch-post');assert.equal(c.operativeState[doctor].location,'camp');assert.ok(c.operativeState[doctor].hp>=15);assert.equal(c.operativeState[doctor].bleeding,0);
 assert.equal(r.ticks[0].patients[0].hp,5);assert.equal(r.ticks[0].after[0].hp,5);assert.equal(r.ticks[0].after[0].bleeding,0);assert.equal(r.ticks.length,25);assert.equal(r.ticks.reduce((n,t)=>n+t.spent,0),25);
 const linen=start.operativeState[doctor].medkits+r.collections.filter(x=>x.kind==='known-stock').reduce((n,x)=>n+x.count,0)-c.operativeState[doctor].medkits;assert.equal(linen,25);
 const stock=sectorInventoryModel(c,'camp',rosterFor(c),doctor).entries.find(row=>JSON.parse(row.expected).item==='medkits');assert.equal(stock?.count??0,30-r.collections.filter(x=>x.kind==='known-stock').reduce((n,x)=>n+x.count,0));
 assert.equal(r.arrivalSeconds-r.departureSeconds,r.quote.hours*3600);assert.ok(r.endSeconds-r.startSeconds<=72*3600);
 assert.ok(r.renewals.some(x=>x.id===patient));for(const x of r.renewals){assert.equal(x.quote.available,true);assert.equal(x.quote.price,contractQuote(start,rosterFor(start).find(o=>o.id===x.id),x.term).price);}
 assert.ok(r.renewals.some(x=>x.id===guard&&x.term==='week'));assert.equal(c.contracts[guard].term,'week');assert.equal(c.contracts[guard].paid,protectedTerms[guard].paid);assert.ok(contractExpiresSeconds(c.contracts[guard])>clock(c));
 for(const id of [doctor,patient,guard]){assert.ok(c.recruited.includes(id));assert.deepEqual(physical(c,id),physical(start,id));}
 assert.equal(c.resources.treasury,start.resources.treasury-r.renewals.reduce((n,x)=>n+x.quote.price,0));assert.deepEqual(start,before);assert.deepEqual(saved(c),c);assert.equal(events.filter(e=>e.event==='saltaClinicRelief').length,1);
 let replay=start;for(const [i,row]of r.orders.entries()){assert.equal(clock(replay),row.from);assert.equal(replay.resources.treasury,row.treasuryBefore);replay=order(replay,row.action);assert.equal(clock(replay),row.to);assert.equal(replay.resources.treasury,row.treasuryAfter);if(i===Math.floor(r.orders.length/2))replay=saved(replay);}assert.deepEqual(saved(replay),c);
});

test('a stable doctor earns additional linen only by observing, approaching and hand-looting an actual declared body after the bleeding stops',()=>{
 const {campaign:start,doctor,patient,fallen,protectedTerms}=setup({stock:30,body:true,patientHP:14,bleeding:1}),before=structuredClone(start),result=returnSaltaClinicRelief(start,[patient],{destination:'watch-post',protectedTerms}),r=result.receipt,c=result.campaign;
 assert.equal(c.operativeState[patient].hp,77);assert.equal(c.operativeState[patient].bleeding,0);assert.equal(c.operativeState[doctor].location,'camp');
 const bodies=r.collections.filter(x=>x.kind==='observed-body');assert.ok(bodies.length>0);assert.ok(bodies.every(x=>x.bodyId===String(fallen)&&x.before-x.after===x.count));
 assert.ok(r.collections.some(x=>x.kind==='observed-discovery'&&x.steps.some(a=>a.type==='loot'&&a.targetId===String(fallen))));
 assert.ok(r.collections.filter(x=>x.kind==='known-stock').every(x=>x.key.includes(String(fallen))),'Later collection can use only the actually discovered finite body.');
 assert.ok(r.collections.find(x=>x.kind==='observed-discovery').from>=r.ticks[0].to);assert.equal(c.sectorStates.camp.units.find(u=>u.id===String(fallen)).medkits,30-bodies.reduce((n,x)=>n+x.count,0)-r.collections.filter(x=>x.kind==='known-stock').reduce((n,x)=>n+x.count,0));
 assert.deepEqual(start,before);assert.deepEqual(saved(c),c);assert.deepEqual(returnSaltaClinicRelief(saved(start),[patient],{destination:'watch-post',protectedTerms}),result);
});

test('missing finite linen and an unsupplied physician refuse without claiming a relief, changing a death or editing the caller input',()=>{
 const poor=setup({stock:0,patientHP:75,bleeding:1,body:true}),before=structuredClone(poor.campaign);
 assert.throws(()=>returnSaltaClinicRelief(poor.campaign,[poor.patient],{destination:'watch-post',protectedTerms:poor.protectedTerms}),/no reachable finite linen/);assert.deepEqual(poor.campaign,before);
 const noDoctor=setup({doctorKits:0}),original=structuredClone(noDoctor.campaign);assert.throws(()=>returnSaltaClinicRelief(noDoctor.campaign,[noDoctor.patient],{destination:'watch-post'}),/supplied actual local physician/);assert.deepEqual(noDoctor.campaign,original);
});
