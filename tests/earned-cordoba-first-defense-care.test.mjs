import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {stabilizeCordobaFirstDefense} from './cordoba-first-defense-care.mjs';

const proof=JSON.parse(readFileSync(new URL('./fixtures/earned-original-cordoba-first-care.provenance.json',import.meta.url))),sha=x=>createHash('sha256').update(x).digest('hex');
const load=suffix=>{const entry=proof.fixtures.find(f=>f.fixture.includes('-'+suffix+'.save')),packed=readFileSync(new URL('./fixtures/'+entry.fixture,import.meta.url)),raw=gunzipSync(packed);assert.equal(sha(packed),entry.gzipSha256);assert.equal(sha(raw),entry.rawSha256);assert.equal(raw.length,entry.rawBytes);return decodeSave(raw.toString());};
const input=()=>load('settled').campaign,clock=s=>s.hour*3600+(s.secondOfHour??0),saved=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,action)=>{const c=dispatchCampaign(s,action);assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);return c;};
const knownLinen=s=>sectorInventoryModel(s,'cordoba',rosterFor(s),146).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');
const countLinen=s=>Object.values(s.operativeState).reduce((n,r)=>n+(r.medkits??0),0)+Object.values(s.sectorStates).reduce((n,b)=>n+(b.units??[]).filter(u=>u.side!=='player').reduce((m,u)=>m+(u.medkits??0),0)+(b.props??[]).reduce((m,p)=>m+(p.contents??[]).filter(x=>x.item==='medkits').reduce((a,x)=>a+x.count,0),0),0);
let treated;

test('the exact native150 victory leaves real critical survivors, and seven untended hours reproduce112s post-battle death',t=>{
 const pair=load('paired'),settled=input(),battle=pair.battle;assert.equal(battle.status,'victory');assert.equal(battle.turn,7);assert.equal(battle.elapsedSeconds,50);
 const nativeDeaths=battle.units.filter(u=>u.side==='player'&&u.hp===0&&pair.campaign.operativeState[u.id]?.alive).map(u=>Number(u.id));assert.deepEqual(nativeDeaths,[121,129,108]);
 const returned=order(pair.campaign,{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:battle.status,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});assert.deepEqual(returned,settled,'the stored settlement is the actual paired-save battle result');
 assert.deepEqual([settled.hour,settled.secondOfHour],[150,2227]);assert.deepEqual([112,122,101].map(id=>({id,hp:settled.operativeState[id].hp,bleeding:settled.operativeState[id].bleeding})),[{id:112,hp:7,bleeding:3},{id:122,hp:5,bleeding:3},{id:101,hp:52,bleeding:1}]);
 assert.equal(settled.recruited.filter(id=>settled.operativeState[id].alive&&settled.operativeState[id].location==='cordoba').reduce((n,id)=>n+settled.operativeState[id].medkits,0),0);
 let untreated=saved(settled);
 for(let hour=0;hour<7;hour++){
  const began=clock(untreated);for(let notice=0;clock(untreated)===began&&notice<3;notice++)untreated=order(untreated,{type:'wait',hours:1});assert.equal(clock(untreated)-began,3600);
 }
 assert.equal(untreated.operativeState[112].alive,false);assert.equal(untreated.operativeState[112].deathMinute,157*60+37);assert.equal(untreated.operativeState[122].alive,false);assert.equal(untreated.operativeState[122].deathMinute,155*60+37);
 assert.equal(untreated.encounterHistory[0].outcome,'victory');assert.deepEqual(untreated.encounterHistory[0].casualties,[121,129,108]);assert.deepEqual(saved(untreated),untreated);
 t.diagnostic('112 survives the genuine native victory, then loses7HP to seven actual untreated hourly bleeding ticks. Its death is not a native battle casualty.');
});

test('known corpse linen and two uniquely paid weekly medics stabilize the actual patients without changing native deaths or granting full health',t=>{
 const start=input(),before=structuredClone(start),events=[];assert.equal(knownLinen(start).reduce((n,row)=>n+row.count,0),4);const physical=countLinen(start);
 treated=stabilizeCordobaFirstDefense(start,{report:e=>events.push(e)});const {campaign:c,receipt:r}=treated;
 assert.deepEqual(r.cohort,[107,124,116,112,122,144,146,134,101]);assert.deepEqual(r.patients,[112,122,101]);assert.deepEqual(r.hires.map(h=>h.id),[130,100]);assert.equal(r.hires.reduce((n,h)=>n+h.debited,0),504);
 for(const h of r.hires){assert.equal(h.debited,h.quote.total);assert.equal(h.arrival.travelHours,0);assert.equal(h.quote.term,'week');assert.equal(h.quote.hours,168);assert.equal(contractExpiresSeconds(c.contracts[h.id]),h.arrival.dueAt*3600+h.arrival.dueSecond+168*3600);assert.ok(c.operativeState[h.id].alive);assert.equal(c.operativeState[h.id].medkits,0);}
 assert.equal(r.renewals.length,0);assert.equal(r.endSeconds-r.startSeconds,7*3600);assert.equal(c.resources.treasury,start.resources.treasury-504);assert.equal(r.dressingsSpent,7);assert.equal(countLinen(c),physical-7);
 assert.deepEqual(r.linen.filter(row=>row.kind==='body').map(row=>({source:row.sourceKey,count:row.count})),[{source:'["body","enemy-6","medkits"]',count:2},{source:'["body","enemy-7","medkits"]',count:2}]);assert.equal(r.linen.filter(row=>row.kind==='ground').reduce((n,row)=>n+row.count,0),4);assert.equal(c.operativeState[146].medkits,1);assert.equal(knownLinen(c).length,0);
 assert.deepEqual([112,122,101].map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding})),[{id:112,hp:18,bleeding:0},{id:122,hp:17,bleeding:0},{id:101,hp:50,bleeding:0}]);assert.ok([112,122,101].every(id=>c.operativeState[id].hp<c.operativeState[id].maxHp),'these genuine wounds still require the later full clinical recovery');
 for(const id of r.cohort){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].bleeding,0);assert.ok(c.operativeState[id].hp>=15);}
 for(const [id,v]of Object.entries(start.operativeState))if(!v.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,v.deathMinute);}
 assert.deepEqual(c.encounterHistory,start.encounterHistory);
 const courierBefore=start.squads.find(q=>q.journey),courierAfter=c.squads.find(q=>q.id===courierBefore.id);
 assert.deepEqual(courierAfter.members,courierBefore.members);assert.equal(courierAfter.location,courierBefore.journey.path[1]);assert.deepEqual(courierAfter.journey.path,courierBefore.journey.path.slice(1),'the normal care clock advances the actual courier by one real leg');
 for(const key of ['mode','startedAt','startedSecond','returning'])assert.equal(courierAfter.journey[key],courierBefore.journey[key]);assert.equal(courierAfter.journey.status,'paused');assert.equal(courierAfter.journey.reason,'exhausted','the courier still requires its ordinary sleep recovery before continuing');
 assert.equal(c.squads.length,start.squads.length);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.deepEqual(r.otherDeaths,[]);
 assert.ok(events.some(e=>e.event==='cordobaFirstDefenseCareNotice'),'acknowledge the real completed-rest notice with another ordinary wait');assert.deepEqual(saved(c),c);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Actual150 settlement through seven-hour paid finite critical care only',nativeDeaths:[121,129,108],bodyDressings:4,paidIssuedDressings:4,spent:7,left:1,hires:[130,100],cost:504,elapsedSeconds:25200,clock:[c.hour,c.secondOfHour],patients:r.ticks.at(-1).patients}));
});

test('every actual inventory, booking, assignment and wait order replays exactly through an official midpoint save',()=>{
 assert.ok(treated);let replay=input();const {orders}=treated.receipt;
 for(let i=0;i<orders.length;i++){replay=order(replay,orders[i]);if(i===Math.floor(orders.length/2))replay=saved(replay);}
 assert.deepEqual(replay,treated.campaign);assert.deepEqual(saved(replay),replay);
});
