import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {prepareNorthernRemoteDefenseRest} from './fresh-northern-recovery.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
const save=c=>{const next=decodeSave(encodeSave(c)).campaign;assert.deepEqual(next,c);return next;};
// The two towns and every initial wound/supply are declared before admission.
// No failed route input, combat result or returned health is reconstructed.
function setup({acute=true,medical=90,lateDoctor=false}={}){
 const d=scaffoldDocuments('declared-remote-defense-rest'),base=d.content.characters[0];
 d.content.rules.startingTreasury=3000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.startingTerritory['watch-post'].owner='patriot';d.world.arrivalFacilities['watch-post']=['barracks'];d.content.arrivalSites.push({sector:'watch-post',facilities:['barracks']});
 const bodies=[{medical,medkits:6,hp:70},{medical:0,medkits:0,hp:acute?3:68,bleeding:acute?4:0},{medical:0,medkits:0,hp:acute?21:70,bleeding:acute?3:0},{medical:0,medkits:0,hp:70},{medical:0,medkits:0,hp:60}];
 d.content.characters=bodies.map((body,i)=>({...structuredClone(base),id:'guard-'+i,name:'Guardia '+i,nickname:'Guardia '+i,arrivalHours:0,monthlyPay:300,serviceGuarantee:31,
  attributes:{...base.attributes,medical:body.medical},startingSupplies:{rations:0,torches:0,medkits:body.medkits,boleadoras:0},
  startingCondition:{hp:body.hp,bleeding:body.bleeding??0,bandaged:body.bleeding?0:70-body.hp,energy:100,fatigue:0}}));
 const declared=structuredClone(d),definition=compileCampaignPackage(d.manifest,d);let c=initialCampaign(42,definition);const ids=rosterFor(c).map(op=>op.id),book=id=>{
  const person=rosterFor(c).find(op=>op.id===id),quote=contractQuote(c,person,'day'),cash=c.resources.treasury;
  c=order(c,{type:'recruitCivic',id,term:'day',destination:id===ids[4]?'camp':'watch-post'});assert.equal(c.resources.treasury,cash-quote.total);
 };
 book(ids[0]);
 if(lateDoctor){const until=clock(c)+23*3600;for(let attempt=0;clock(c)<until&&attempt<3;attempt++)c=order(c,{type:'wait',hours:Math.min(23,(until-clock(c))/3600)});assert.equal(clock(c),until);}
 for(const id of ids.slice(1))book(id);
 c=order(c,{type:'createSquad',ids:ids.slice(0,4),sector:'watch-post',name:'Reserva real'});
 c=order(c,{type:'createSquad',ids:[ids[4]],sector:'camp',name:'Hospital distante'});
 assert.deepEqual(d,declared);return {campaign:save(c),ids};
}
function replay(start,result){
 let c=start;for(const [index,action]of result.receipt.orders.entries()){c=order(c,action);if(index===Math.floor(result.receipt.orders.length/2))c=save(c);}
 assert.deepEqual(save(c),result.campaign);
}
const property=(c,id)=>Object.fromEntries(['alive','captured','location','residentPosition','inventory','primaryWeapon','bladeWeapon','ammoStock','carriedLoaded','carriedLoading','carriedJammed','weaponDropped'].map(key=>[key,c.operativeState[id][key]]));

test('new remote critical and bleeding guards receive finite local care before the distant clinic clock resumes',()=>{
 const {campaign:start,ids}=setup({lateDoctor:true}),before=structuredClone(start),events=[];
 const result=prepareNorthernRemoteDefenseRest(start,'watch-post',{report:event=>events.push(event)}),c=result.campaign;
 assert.deepEqual(result.receipt.patients,ids.slice(1,3));assert.ok(result.receipt.stabilization.ticks.length>0);
 const spent=start.operativeState[ids[0]].medkits-c.operativeState[ids[0]].medkits;
 assert.ok(spent>0&&spent<=6);assert.equal(spent,result.receipt.stabilization.ticks.reduce((sum,tick)=>sum+tick.dressingsSpent,0));
 for(const id of ids.slice(0,4)){const r=c.operativeState[id];assert.ok(r.alive&&r.hp>=15&&!r.bleeding);assert.equal(r.assignment,'rest');assert.ok(c.recruited.includes(id));assert.deepEqual(property(c,id),property(start,id));}
 assert.ok(c.operativeState[ids[1]].hp<c.operativeState[ids[1]].maxHp,'Acute stabilization is not a full-health grant.');
 assert.equal(c.operativeState[ids[4]].hp,start.operativeState[ids[4]].hp);assert.equal(c.operativeState[ids[4]].assignment,'active');assert.equal(c.location,start.location);assert.equal(c.activeSquadId,start.activeSquadId);
 const renewals=events.filter(event=>event.event==='northernHospitalRenewal');assert.ok(renewals.some(event=>event.action.id===ids[0]));
 assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,event)=>sum+event.cost,0));
 assert.ok(contractExpiresSeconds(c.contracts[ids[0]])>clock(c));assert.equal(c.contracts[ids[0]].guaranteeId,start.contracts[ids[0]].guaranteeId);
 assert.deepEqual(c.sectorStates,start.sectorStates);assert.deepEqual(start,before);replay(start,result);
});

test('a stable remote reserve is assigned real rest without a free health, energy, morale or clock change',()=>{
 const {campaign:start,ids}=setup({acute:false}),before=structuredClone(start),result=prepareNorthernRemoteDefenseRest(start,'watch-post'),c=result.campaign;
 assert.equal(result.receipt.stabilization,null);assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury);
 for(const id of ids.slice(0,4)){const r=c.operativeState[id],old=start.operativeState[id];assert.equal(r.assignment,'rest');for(const key of ['hp','bleeding','energy','fatigue','morale','medkits'])assert.equal(r[key],old[key]);}
 let rested=c;const waits=[],until=clock(c)+6*3600;
 for(let notice=0;clock(rested)<until&&notice<3;notice++){const action={type:'wait',hours:(until-clock(rested))/3600};waits.push(action);rested=order(rested,action);}
 assert.equal(clock(rested)-clock(c),6*3600);assert.equal(rested.operativeState[ids[1]].hp,c.operativeState[ids[1]].hp+1);
 assert.equal(rested.operativeState[ids[4]].hp,c.operativeState[ids[4]].hp,'The active distant patient is not silently healed.');
 for(const id of ids.slice(0,4))assert.deepEqual(property(rested,id),property(start,id));
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(waits.reduce(order,save(c)),save(rested));
});

test('acute guards without an actual stable local physician cannot be declared ready or advance a remote clock',()=>{
 const {campaign:start}=setup({medical:0}),before=structuredClone(start);
 assert.throws(()=>prepareNorthernRemoteDefenseRest(start,'watch-post'),/actual stable local physician/);assert.deepEqual(start,before);
});
