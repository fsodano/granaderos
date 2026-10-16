import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {operativeLocation} from '../game/squads.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {prepareMountainDoctorReadiness} from './fresh-mountain-route.mjs';
import {mountainCommandRolePlan} from './mountain-command-role-plan.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=c=>{const pair=decodeSave(encodeSave(c,null));assert.deepEqual(pair,{campaign:c,battle:null});return pair.campaign;};
const capable=(c,id)=>{const r=c.operativeState[id];return c.recruited.includes(id)&&r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&!r.asleep&&!r.unconscious&&!r.routed&&!r.surrendered&&r.energy>10&&r.morale>=50&&operativeLocation(c,id)==='camp';};

// This is a declared energy-readiness boundary. It does not reconstruct a
// historical morale loss or an earned mountain route. Every person, condition,
// map and campaign goal is fixed before validation and the Native factory.
function setup(){
 const d=scaffoldDocuments('mountain-distinct-command-readiness'),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:4,reserve:3,raidEveryHours:240,axis:['watch-post']}}};
 const rows=[{id:'dual-ready',medical:65,leadership:89},{id:'physician-two',medical:85,leadership:35},{id:'physician-three',medical:90,leadership:35},...Array.from({length:13},(_,i)=>({id:'ready-line-'+i,medical:0,leadership:35})),{id:'distinct-tired-command',medical:20,leadership:90,tired:true}];
 d.content.characters=rows.map(row=>({...structuredClone(base),id:row.id,name:row.id,nickname:row.id,monthlyPay:300,arrivalHours:0,attributes:{...base.attributes,leadership:row.leadership,medical:row.medical},startingCondition:{hp:base.attributes.maxHp,bleeding:0,bandaged:0,energy:row.tired?10:100,fatigue:row.tired?90:0},startingSupplies:{medkits:2,rations:2,torches:0,boleadoras:0}}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content),paid=0;const hires=[];
 const people=rosterFor(c),ids=rows.map(row=>people.find(op=>op.name===row.id).id),commander=ids.at(-1),doctors=ids.slice(0,3);
 for(const id of ids){const op=rosterFor(c).find(op=>op.id===id),quote=contractQuote(c,op,'week'),cash=c.resources.treasury,action={type:'recruitCivic',id,term:'week'};assert.equal(quote.available,true);c=order(c,action);assert.equal(cash-c.resources.treasury,quote.total);paid+=quote.total;hires.push({action,quote});}
 for(let i=0;i<ids.length;i+=6)c=order(c,{type:'createSquad',sector:'camp',name:'Paid current group '+i,ids:ids.slice(i,i+6)});
 assert.deepEqual(d,declaration);assert.equal(c.recruited.length,17);assert.ok(ids.slice(0,16).every(id=>capable(c,id)));assert.equal(capable(c,commander),false);assert.equal(c.operativeState[commander].energy,10);assert.equal(c.operativeState[commander].hp,c.operativeState[commander].maxHp);assert.ok(c.operativeState[commander].morale>=50);
 assert.deepEqual(people.filter(op=>doctors.includes(op.id)).map(op=>op.id).sort((a,b)=>a-b),doctors.slice().sort((a,b)=>a-b));assert.equal(c.resources.treasury,20000-paid);assert.equal(c.squads.filter(q=>q.members.length).length,3);assert.ok(c.squads.every(q=>q.members.length<=6));
 return {campaign:saved(c),ids,commander,doctors,hires,paid};
}

const rolePlan=(c,s)=>{const people=rosterFor(c).filter(op=>s.ids.includes(op.id)&&capable(c,op.id));return mountainCommandRolePlan({commanders:people.filter(op=>op.leadership>=80),physicians:people.filter(op=>op.medical>=60),count:3});};
const perform=(s,options={})=>{const events=[],campaign=prepareMountainDoctorReadiness(s.campaign,{sector:'camp',count:3,fieldCount:16,...options,report:event=>events.push(event)});return {campaign,events,orders:events.filter(event=>event.event==='freshRouteOrder'||event.event==='freshRouteRenewal').map(event=>event.action)};};

test('default physician readiness remains an exact no-op when three doctors and sixteen field bodies are ready',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start);assert.equal(rolePlan(start,s),null);
 const result=perform(s);assert.deepEqual(result.campaign,start);assert.deepEqual(result.events,[]);assert.deepEqual(result.orders,[]);assert.equal(clock(result.campaign),clock(start));assert.deepEqual(start,before);
});

test('distinct-command readiness pays actual local rest before admitting one commander and all three separate physicians, with exact official replay',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start);assert.equal(rolePlan(start,s),null);
 const result=perform(s,{requireCommander:true}),c=result.campaign,plan=rolePlan(c,s),elapsed=clock(c)-clock(start);
 assert.ok(elapsed>0&&elapsed<=600*3600);assert.ok(result.orders.some(action=>action.type==='assignCare'&&action.operativeId===s.commander&&action.assignment==='rest'));assert.ok(result.orders.some(action=>action.type==='wait'&&action.hours===1));
 assert.ok(plan);assert.equal(plan.commander.id,s.commander);assert.deepEqual(plan.doctors.map(op=>op.id).sort((a,b)=>a-b),s.doctors.slice().sort((a,b)=>a-b));assert.ok(plan.doctors.every(op=>op.id!==plan.commander.id));assert.ok(c.operativeState[s.commander].energy>10);assert.equal(c.operativeState[s.commander].asleep,false);
 const begun=result.events.filter(event=>event.event==='mountainDoctorReadinessStarted'),ended=result.events.filter(event=>event.event==='mountainDoctorReadinessPrepared');assert.equal(begun.length,1);assert.equal(ended.length,1);assert.equal(ended[0].elapsedSeconds,elapsed);assert.ok(begun[0].ids.includes(s.commander));
 const renewals=result.events.filter(event=>event.event==='freshRouteRenewal');assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,event)=>sum+event.price,0));assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 for(const id of s.ids){const old=start.operativeState[id],next=c.operativeState[id];assert.ok(c.recruited.includes(id)&&next.alive&&!next.captured);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));for(const key of ['hp','maxHp','bleeding','bandaged','medkits','carriedLoaded','carriedAmmo','ammo','inventory','weapon','blade','condition','rations','torches','boleadoras','headwear','outfit','legwear','location','residentPosition'])assert.deepEqual(next[key],old[key],id+': '+key);}
 let replay=saved(start);for(const [index,action]of result.orders.entries()){replay=order(replay,action);if(index===Math.floor(result.orders.length/2))replay=saved(replay);}assert.deepEqual(saved(replay),c);assert.deepEqual(perform({...s,campaign:saved(start)},{requireCommander:true}),result);assert.deepEqual(start,before);
});

test('a reserved or explicitly protected sole repair commander refuses before any rest, renewal or clock order',()=>{
 for(const variant of ['reserved','excluded']){
  const s=setup(),start=s.campaign,before=structuredClone(start),events=[],current=variant==='reserved'?{reservedIds:[s.commander]}:{exclude:[s.commander]};let error;
  try{prepareMountainDoctorReadiness(start,{sector:'camp',count:3,fieldCount:16,requireCommander:true,...current,report:event=>events.push(event)});}catch(e){error=e;}
  assert.ok(error);assert.match(error.message,/A free local commander or additional physician/);assert.deepEqual(events,[]);assert.deepEqual(start,before);assert.equal(rolePlan(start,s),null);saved(start);
 }
});
